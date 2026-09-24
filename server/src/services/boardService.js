import { v4 as uuidv4 } from 'uuid';
import { Board } from '../models/Board.js';
import { Operation } from '../models/Operation.js';
import { getDBStatus } from '../config/database.js';
import { validateOperation } from '../ot/operationValidator.js';
import { transformAgainstHistory } from '../ot/operationTransformer.js';
import { applyOperation } from '../ot/operationApplier.js';
import { inverseOperation } from '../ot/inverseOperation.js';

// In-memory cache & fallback store for ultra-low latency OT processing
const memoryBoards = new Map();
const memoryOperations = new Map(); // boardId -> Array<Operation>
const userUndoStacks = new Map();   // `${boardId}:${userId}` -> Array<Operation>
const userRedoStacks = new Map();   // `${boardId}:${userId}` -> Array<Operation>

// Debounce map for DB persistence
const persistDebounceTimers = new Map();

/**
 * Helper to debounce saving board state to MongoDB
 */
function debounceSaveToDB(boardId) {
  if (!getDBStatus().connected) return;

  if (persistDebounceTimers.has(boardId)) {
    clearTimeout(persistDebounceTimers.get(boardId));
  }

  const timer = setTimeout(async () => {
    try {
      const boardState = memoryBoards.get(boardId);
      if (boardState) {
        await Board.findOneAndUpdate(
          { boardId },
          {
            name: boardState.name,
            version: boardState.version,
            objects: boardState.objects,
          },
          { upsert: true, new: true }
        );
      }
      persistDebounceTimers.delete(boardId);
    } catch (err) {
      console.error(`Error persisting board ${boardId} to MongoDB:`, err.message);
    }
  }, 1000); // 1-second debounce

  persistDebounceTimers.set(boardId, timer);
}

export class BoardService {
  /**
   * Get or create a board by boardId
   */
  static async getOrCreateBoard(boardId, name = 'Untitled Board') {
    // 1. Check memory cache first
    let board = memoryBoards.get(boardId);
    if (board) {
      return board;
    }

    // 2. Check MongoDB if connected
    if (getDBStatus().connected) {
      try {
        const dbBoard = await Board.findOne({ boardId });
        if (dbBoard) {
          board = {
            boardId: dbBoard.boardId,
            name: dbBoard.name || name,
            version: dbBoard.version || 0,
            objects: dbBoard.objects || [],
            createdAt: dbBoard.createdAt,
            updatedAt: dbBoard.updatedAt,
          };
          memoryBoards.set(boardId, board);

          // Also load recent operations into memory
          const recentOps = await Operation.find({ boardId })
            .sort({ serverVersion: 1 })
            .limit(200);
          memoryOperations.set(boardId, recentOps.map(op => op.toObject()));
          return board;
        }
      } catch (err) {
        console.warn('MongoDB read error, falling back to memory:', err.message);
      }
    }

    // 3. Create fresh board
    board = {
      boardId,
      name,
      version: 0,
      objects: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryBoards.set(boardId, board);
    memoryOperations.set(boardId, []);

    if (getDBStatus().connected) {
      try {
        await Board.create(board);
      } catch (err) {
        console.warn('MongoDB save error:', err.message);
      }
    }

    return board;
  }

  /**
   * Get board state
   */
  static async getBoard(boardId) {
    let board = memoryBoards.get(boardId);
    if (!board && getDBStatus().connected) {
      try {
        const dbBoard = await Board.findOne({ boardId });
        if (dbBoard) {
          board = dbBoard.toObject();
          memoryBoards.set(boardId, board);
        }
      } catch (err) {
        console.warn('MongoDB query error:', err.message);
      }
    }
    return board || null;
  }

  /**
   * Get operation history for board
   */
  static async getOperations(boardId, limit = 100) {
    const memOps = memoryOperations.get(boardId) || [];
    if (memOps.length > 0) {
      return memOps.slice(-limit);
    }

    if (getDBStatus().connected) {
      try {
        const dbOps = await Operation.find({ boardId })
          .sort({ serverVersion: -1 })
          .limit(limit);
        return dbOps.reverse();
      } catch (err) {
        console.warn('MongoDB operations fetch error:', err.message);
      }
    }

    return [];
  }

  /**
   * Delete board
   */
  static async deleteBoard(boardId) {
    memoryBoards.delete(boardId);
    memoryOperations.delete(boardId);
    if (getDBStatus().connected) {
      await Board.deleteOne({ boardId });
      await Operation.deleteMany({ boardId });
    }
    return true;
  }

  /**
   * CORE OT PIPELINE: Process an incoming client operation
   */
  static async processOperation(rawOperation) {
    const { boardId, baseVersion, operationId } = rawOperation;
    const board = await this.getOrCreateBoard(boardId);

    // 1. Validation
    const validation = validateOperation(rawOperation, board.objects.length);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        code: 'VALIDATION_FAILED',
        board,
      };
    }

    // 2. Duplicate operation check (idempotency)
    const existingOps = memoryOperations.get(boardId) || [];
    const duplicate = existingOps.find((op) => op.operationId === operationId);
    if (duplicate) {
      return {
        success: true,
        operation: duplicate,
        board,
        isDuplicate: true,
      };
    }

    // 3. OT Version check & Transformation
    let finalOp = { ...rawOperation };
    const currentServerVersion = board.version;

    if (baseVersion > currentServerVersion) {
      // Client is ahead of server — state corruption or desync
      return {
        success: false,
        error: `Client version (${baseVersion}) is ahead of server version (${currentServerVersion})`,
        code: 'VERSION_AHEAD',
        board,
      };
    }

    if (baseVersion < currentServerVersion) {
      // Concurrent operations detected!
      // Fetch all operations that occurred strictly after client's baseVersion
      const concurrentHistory = existingOps.filter(
        (op) => op.serverVersion > baseVersion
      );

      // Deterministically transform incoming op against historical ops
      finalOp = transformAgainstHistory(rawOperation, concurrentHistory);
    }

    // 4. Apply the operation to the board state
    const applyResult = applyOperation(board, finalOp);
    if (!applyResult.success && finalOp.type !== 'NOOP') {
      console.warn(`[OT Engine] Operation application note: ${applyResult.reason}`);
    }

    // 5. Increment board version
    board.version += 1;
    board.updatedAt = new Date();

    // 6. Finalize operation record
    finalOp.serverVersion = board.version;
    finalOp.timestamp = new Date();

    // Store in memory operations history
    existingOps.push(finalOp);
    // Keep max 500 in memory for performance
    if (existingOps.length > 500) {
      existingOps.shift();
    }
    memoryOperations.set(boardId, existingOps);

    // Track in user undo stack if not an inverse operation and not a NOOP
    if (!finalOp.isInverse && finalOp.type !== 'NOOP' && finalOp.type !== 'CLEAR') {
      const userKey = `${boardId}:${finalOp.userId}`;
      if (!userUndoStacks.has(userKey)) userUndoStacks.set(userKey, []);
      userUndoStacks.get(userKey).push(finalOp);
      // Clear redo stack on new user action
      if (userRedoStacks.has(userKey)) userRedoStacks.set(userKey, []);
    }

    // 7. Persist to MongoDB (debounced for board, direct for operation record)
    debounceSaveToDB(boardId);
    if (getDBStatus().connected) {
      Operation.create(finalOp).catch((err) =>
        console.warn('Async operation DB save error:', err.message)
      );
    }

    return {
      success: true,
      operation: finalOp,
      board,
    };
  }

  /**
   * Undo last operation for a user
   */
  static async undo(boardId, userId) {
    const userKey = `${boardId}:${userId}`;
    const undoStack = userUndoStacks.get(userKey) || [];

    if (undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    const lastOp = undoStack.pop();
    const board = await this.getOrCreateBoard(boardId);

    // Compute inverse operation
    const inverse = inverseOperation(lastOp, board);
    if (!inverse) {
      return { success: false, error: 'Operation cannot be inverted' };
    }

    // Push original op to redo stack
    if (!userRedoStacks.has(userKey)) userRedoStacks.set(userKey, []);
    userRedoStacks.get(userKey).push(lastOp);

    // Route inverse op through normal OT pipeline with current board version
    inverse.baseVersion = board.version;
    inverse.userId = userId;

    return await this.processOperation(inverse);
  }

  /**
   * Redo last undone operation for a user
   */
  static async redo(boardId, userId) {
    const userKey = `${boardId}:${userId}`;
    const redoStack = userRedoStacks.get(userKey) || [];

    if (redoStack.length === 0) {
      return { success: false, error: 'Nothing to redo' };
    }

    const opToRedo = redoStack.pop();
    const board = await this.getOrCreateBoard(boardId);

    // Re-create the forward operation
    const forwardOp = {
      ...opToRedo,
      operationId: uuidv4(),
      baseVersion: board.version,
      timestamp: Date.now(),
      userId,
    };

    return await this.processOperation(forwardOp);
  }
}
