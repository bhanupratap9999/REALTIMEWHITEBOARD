import { BoardService } from '../services/boardService.js';

// Map: boardId -> Map<socketId, { userId, displayName, color, lastActive }>
const roomUsers = new Map();

// Helper to get active users list for a room
function getActiveUsers(boardId) {
  const usersMap = roomUsers.get(boardId);
  if (!usersMap) return [];
  return Array.from(usersMap.values());
}

export function setupBoardSocket(io) {
  io.on('connection', (socket) => {
    let currentBoardId = null;
    let currentUser = null;

    // -----------------------------------------------------------------
    // 1. JOIN BOARD
    // -----------------------------------------------------------------
    socket.on('join-board', async (data, ack) => {
      try {
        const { boardId, user } = data || {};
        if (!boardId) {
          socket.emit('error', { message: 'boardId is required to join' });
          if (typeof ack === 'function') ack({ success: false, error: 'boardId required' });
          return;
        }

        // Leave previous room if any
        if (currentBoardId && currentBoardId !== boardId) {
          socket.leave(currentBoardId);
          const oldRoom = roomUsers.get(currentBoardId);
          if (oldRoom) {
            oldRoom.delete(socket.id);
            io.to(currentBoardId).emit('presence-update', { activeUsers: getActiveUsers(currentBoardId) });
          }
        }

        currentBoardId = boardId;
        const sanitizedDisplayName = (user?.displayName || 'Anonymous').slice(0, 30);
        currentUser = {
          socketId: socket.id,
          userId: user?.userId || socket.id,
          displayName: sanitizedDisplayName,
          color: user?.color || '#3b82f6',
          joinedAt: Date.now(),
        };

        // Add socket to Socket.IO room
        socket.join(boardId);

        // Track presence
        if (!roomUsers.has(boardId)) {
          roomUsers.set(boardId, new Map());
        }
        roomUsers.get(boardId).set(socket.id, currentUser);

        // Fetch current canonical board state
        const board = await BoardService.getOrCreateBoard(boardId);

        // Send current board state back to the joining user
        socket.emit('board-state', {
          boardId: board.boardId,
          name: board.name,
          version: board.version,
          objects: board.objects || [],
          serverTime: Date.now(),
        });

        const activeUsers = getActiveUsers(boardId);

        // Broadcast user joined and updated presence to everyone in board
        socket.to(boardId).emit('user-joined', { user: currentUser, activeUsers });
        io.to(boardId).emit('presence-update', { activeUsers });

        if (typeof ack === 'function') {
          ack({ success: true, board, activeUsers });
        }

        console.log(`[Socket] User "${currentUser.displayName}" (${currentUser.userId}) joined board: ${boardId}`);
      } catch (err) {
        console.error('[Socket] join-board error:', err);
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // -----------------------------------------------------------------
    // 2. REQUEST BOARD STATE
    // -----------------------------------------------------------------
    socket.on('request-board-state', async ({ boardId }, ack) => {
      try {
        const targetBoardId = boardId || currentBoardId;
        if (!targetBoardId) return;
        const board = await BoardService.getBoard(targetBoardId);
        if (board) {
          socket.emit('board-state', {
            boardId: board.boardId,
            name: board.name,
            version: board.version,
            objects: board.objects || [],
            serverTime: Date.now(),
          });
          if (typeof ack === 'function') ack({ success: true, board });
        }
      } catch (err) {
        console.error('[Socket] request-board-state error:', err);
      }
    });

    // -----------------------------------------------------------------
    // 3. OPERATION (Core OT Pipeline)
    // -----------------------------------------------------------------
    socket.on('operation', async (operationData, ack) => {
      try {
        if (!operationData || !operationData.boardId) {
          socket.emit('operation-rejected', {
            operationId: operationData?.operationId,
            error: 'Missing operation or boardId',
            code: 'INVALID_DATA',
          });
          if (typeof ack === 'function') ack({ success: false, error: 'Invalid data' });
          return;
        }

        const result = await BoardService.processOperation(operationData);

        if (result.success) {
          // If duplicate operation was received, simply acknowledge without rebroadcasting
          if (result.isDuplicate) {
            if (typeof ack === 'function') ack({ success: true, duplicate: true, operation: result.operation });
            return;
          }

          // Broadcast canonical applied operation to all clients in the room (including sender)
          io.to(operationData.boardId).emit('operation-applied', {
            operation: result.operation,
            version: result.board.version,
          });

          if (typeof ack === 'function') {
            ack({ success: true, operation: result.operation, version: result.board.version });
          }
        } else {
          // Operation was rejected (e.g. client ahead, invalid op)
          socket.emit('operation-rejected', {
            operationId: operationData.operationId,
            error: result.error,
            code: result.code,
            boardState: {
              boardId: result.board?.boardId,
              version: result.board?.version,
              objects: result.board?.objects,
            },
          });

          if (typeof ack === 'function') {
            ack({ success: false, error: result.error, code: result.code });
          }
        }
      } catch (err) {
        console.error('[Socket] operation processing error:', err);
        socket.emit('error', { message: 'Internal error processing operation' });
      }
    });

    // -----------------------------------------------------------------
    // 4. LIVE CURSOR MOVEMENT (Throttled real-time broadcast)
    // -----------------------------------------------------------------
    socket.on('cursor-move', (data) => {
      if (!currentBoardId || !currentUser) return;
      const { x, y } = data || {};
      if (typeof x !== 'number' || typeof y !== 'number') return;

      // Broadcast cursor to all other peers in the room
      socket.to(currentBoardId).emit('cursor-update', {
        userId: currentUser.userId,
        userName: currentUser.displayName,
        color: currentUser.color,
        x,
        y,
      });
    });

    // -----------------------------------------------------------------
    // 5. UNDO / REDO
    // -----------------------------------------------------------------
    socket.on('undo', async ({ boardId, userId }, ack) => {
      try {
        const bId = boardId || currentBoardId;
        const uId = userId || currentUser?.userId;
        if (!bId || !uId) return;

        const result = await BoardService.undo(bId, uId);
        if (result.success) {
          io.to(bId).emit('operation-applied', {
            operation: result.operation,
            version: result.board.version,
          });
          if (typeof ack === 'function') ack({ success: true, operation: result.operation });
        } else {
          if (typeof ack === 'function') ack({ success: false, error: result.error });
        }
      } catch (err) {
        console.error('[Socket] undo error:', err);
      }
    });

    socket.on('redo', async ({ boardId, userId }, ack) => {
      try {
        const bId = boardId || currentBoardId;
        const uId = userId || currentUser?.userId;
        if (!bId || !uId) return;

        const result = await BoardService.redo(bId, uId);
        if (result.success) {
          io.to(bId).emit('operation-applied', {
            operation: result.operation,
            version: result.board.version,
          });
          if (typeof ack === 'function') ack({ success: true, operation: result.operation });
        } else {
          if (typeof ack === 'function') ack({ success: false, error: result.error });
        }
      } catch (err) {
        console.error('[Socket] redo error:', err);
      }
    });

    // -----------------------------------------------------------------
    // 6. LEAVE BOARD & DISCONNECT
    // -----------------------------------------------------------------
    const handleLeave = () => {
      if (currentBoardId && currentUser) {
        const usersMap = roomUsers.get(currentBoardId);
        if (usersMap) {
          usersMap.delete(socket.id);
          const remainingUsers = getActiveUsers(currentBoardId);
          socket.to(currentBoardId).emit('user-left', {
            userId: currentUser.userId,
            activeUsers: remainingUsers,
          });
          io.to(currentBoardId).emit('presence-update', { activeUsers: remainingUsers });
          if (remainingUsers.length === 0) {
            roomUsers.delete(currentBoardId);
          }
        }
        socket.leave(currentBoardId);
        console.log(`[Socket] User "${currentUser.displayName}" left board: ${currentBoardId}`);
        currentBoardId = null;
        currentUser = null;
      }
    };

    socket.on('leave-board', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
