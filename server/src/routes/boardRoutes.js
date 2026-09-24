import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BoardService } from '../services/boardService.js';
import { getDBStatus } from '../config/database.js';

const router = express.Router();

/**
 * POST /api/boards
 * Create a new board with unique boardId
 */
router.post('/boards', async (req, res) => {
  try {
    const { name } = req.body;
    // Generate clean, user-friendly alphanumeric boardId (e.g. 6-8 chars or uuid prefix)
    const boardId = (uuidv4().replace(/-/g, '').slice(0, 8));
    const boardName = (typeof name === 'string' && name.trim()) ? name.trim().slice(0, 50) : 'Hackathon Whiteboard';

    const board = await BoardService.getOrCreateBoard(boardId, boardName);
    return res.status(201).json({
      success: true,
      boardId: board.boardId,
      name: board.name,
      version: board.version,
      createdAt: board.createdAt,
    });
  } catch (error) {
    console.error('Error creating board:', error);
    return res.status(500).json({ success: false, error: 'Failed to create board' });
  }
});

/**
 * GET /api/boards/:boardId
 * Get current board state and objects
 */
router.get('/boards/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const board = await BoardService.getOrCreateBoard(boardId);
    return res.json({
      success: true,
      board: {
        boardId: board.boardId,
        name: board.name,
        version: board.version,
        objects: board.objects || [],
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch board' });
  }
});

/**
 * GET /api/boards/:boardId/operations
 * Get operation history for the board (for audit & OT visualization)
 */
router.get('/boards/:boardId/operations', async (req, res) => {
  try {
    const { boardId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const operations = await BoardService.getOperations(boardId, limit);
    return res.json({
      success: true,
      operations,
    });
  } catch (error) {
    console.error('Error fetching operations:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch operations' });
  }
});

/**
 * DELETE /api/boards/:boardId
 * Delete board
 */
router.delete('/boards/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    await BoardService.deleteBoard(boardId);
    return res.json({ success: true, message: `Board ${boardId} deleted` });
  } catch (error) {
    console.error('Error deleting board:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete board' });
  }
});

/**
 * GET /api/health
 * Health check & DB status
 */
router.get('/health', (req, res) => {
  const dbStatus = getDBStatus();
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

export default router;
