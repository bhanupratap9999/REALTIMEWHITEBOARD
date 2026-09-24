import test from 'node:test';
import assert from 'node:assert/strict';
import { v4 as uuidv4 } from 'uuid';
import { transformOperation, transformAgainstHistory } from '../src/ot/operationTransformer.js';
import { applyOperation } from '../src/ot/operationApplier.js';
import { validateOperation } from '../src/ot/operationValidator.js';
import { inverseOperation } from '../src/ot/inverseOperation.js';
import { BoardService } from '../src/services/boardService.js';

test('OT ENGINE UNIT TESTS', async (t) => {
  // -----------------------------------------------------------------
  // 1. RULE 1: MOVE + MOVE -> Combined additive movement
  // -----------------------------------------------------------------
  await t.test('Test 1: MOVE + MOVE -> additive movement', () => {
    const objectId = 'rect-123';
    const userA_Move = {
      operationId: 'op-1',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'MOVE',
      objectId,
      payload: { dx: 20, dy: 0, left: 120, top: 100 },
      baseVersion: 5,
    };

    const userB_Move = {
      operationId: 'op-2',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'MOVE',
      objectId,
      payload: { dx: 0, dy: 30, left: 100, top: 130 },
      baseVersion: 5,
    };

    // User A's operation was already applied to the server (dx=20, dy=0).
    // Now User B's concurrent operation arrives based on baseVersion 5.
    const transformedB = transformOperation(userB_Move, userA_Move);

    assert.equal(transformedB.transformed, true);
    assert.equal(transformedB.conflictRule, 'RULE_1_CONCURRENT_MOVE_ADDITIVE');
    // Payload dx, dy remain additive (0 and 30)
    assert.equal(transformedB.payload.dx, 0);
    assert.equal(transformedB.payload.dy, 30);
    // Absolute position left/top is adjusted by User A's displacement (dx: 20, dy: 0)
    assert.equal(transformedB.payload.left, 120); // 100 + 20
    assert.equal(transformedB.payload.top, 130);  // 130 + 0

    // Test applying both sequentially to a board
    const board = { objects: [{ id: objectId, left: 100, top: 100 }] };
    applyOperation(board, userA_Move); // left: 120, top: 100
    applyOperation(board, transformedB); // dx: 0, dy: 30 applied -> left: 120, top: 130

    assert.equal(board.objects[0].left, 120);
    assert.equal(board.objects[0].top, 130);
  });

  // -----------------------------------------------------------------
  // 2. RULE 2: MOVE + DELETE -> DELETE wins
  // -----------------------------------------------------------------
  await t.test('Test 2: MOVE + DELETE -> DELETE wins, MOVE becomes no-op', () => {
    const objectId = 'circle-99';
    const deleteOp = {
      operationId: 'op-del',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'DELETE',
      objectId,
      baseVersion: 3,
    };

    const concurrentMoveOp = {
      operationId: 'op-move',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'MOVE',
      objectId,
      payload: { dx: 50, dy: 50 },
      baseVersion: 3,
    };

    const transformedMove = transformOperation(concurrentMoveOp, deleteOp);
    assert.equal(transformedMove.type, 'NOOP');
    assert.equal(transformedMove.isNoOp, true);
    assert.equal(transformedMove.conflictRule, 'RULE_2_DELETE_WINS_OVER_MODIFICATION');
  });

  // -----------------------------------------------------------------
  // 3. RULE 3: DELETE + DELETE -> Second is no-op
  // -----------------------------------------------------------------
  await t.test('Test 3: DELETE + DELETE -> Second delete is NOOP', () => {
    const objectId = 'line-456';
    const deleteOpA = {
      operationId: 'op-del-1',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'DELETE',
      objectId,
      baseVersion: 7,
    };

    const deleteOpB = {
      operationId: 'op-del-2',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'DELETE',
      objectId,
      baseVersion: 7,
    };

    const transformedDeleteB = transformOperation(deleteOpB, deleteOpA);
    assert.equal(transformedDeleteB.type, 'NOOP');
    assert.equal(transformedDeleteB.isNoOp, true);
    assert.equal(transformedDeleteB.conflictRule, 'RULE_3_DELETE_DELETE_NOOP');
  });

  // -----------------------------------------------------------------
  // 4. RULE 4: UPDATE + UPDATE different properties -> Merged
  // -----------------------------------------------------------------
  await t.test('Test 4: UPDATE + UPDATE different properties -> merged', () => {
    const objectId = 'rect-1';
    const updateOpA = {
      operationId: 'op-upd-1',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'UPDATE',
      objectId,
      payload: { x: 100, strokeWidth: 4 },
      baseVersion: 2,
    };

    const updateOpB = {
      operationId: 'op-upd-2',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'UPDATE',
      objectId,
      payload: { fill: 'red' },
      baseVersion: 2,
    };

    const transformedB = transformOperation(updateOpB, updateOpA);
    assert.equal(transformedB.transformed, true);
    assert.equal(transformedB.conflictRule, 'RULE_4_UPDATE_MERGED');

    const board = { objects: [{ id: objectId, x: 50, fill: 'blue', strokeWidth: 1 }] };
    applyOperation(board, updateOpA);
    applyOperation(board, transformedB);

    assert.equal(board.objects[0].x, 100);
    assert.equal(board.objects[0].fill, 'red');
    assert.equal(board.objects[0].strokeWidth, 4);
  });

  // -----------------------------------------------------------------
  // 5. RULE 4: UPDATE + UPDATE same property -> Server order wins
  // -----------------------------------------------------------------
  await t.test('Test 5: UPDATE + UPDATE same property -> Server order wins', () => {
    const objectId = 'circle-1';
    const updateOpA = {
      operationId: 'op-upd-a',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'UPDATE',
      objectId,
      payload: { fill: 'green' },
      baseVersion: 4,
    };

    const updateOpB = {
      operationId: 'op-upd-b',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'UPDATE',
      objectId,
      payload: { fill: 'purple' },
      baseVersion: 4,
    };

    const transformedB = transformOperation(updateOpB, updateOpA);
    assert.equal(transformedB.transformed, true);

    const board = { objects: [{ id: objectId, fill: 'black' }] };
    applyOperation(board, updateOpA); // Applied first on server -> fill: green
    applyOperation(board, transformedB); // Applied second -> fill: purple

    assert.equal(board.objects[0].fill, 'purple');
  });

  // -----------------------------------------------------------------
  // 6. RULE 5: ADD + ADD -> Both objects exist
  // -----------------------------------------------------------------
  await t.test('Test 6: ADD + ADD -> Both objects exist', () => {
    const addOpA = {
      operationId: 'op-add-a',
      boardId: 'test-board',
      userId: 'user-a',
      type: 'ADD',
      objectId: 'obj-a',
      payload: { type: 'rect', left: 10, top: 20 },
      baseVersion: 0,
    };

    const addOpB = {
      operationId: 'op-add-b',
      boardId: 'test-board',
      userId: 'user-b',
      type: 'ADD',
      objectId: 'obj-b',
      payload: { type: 'circle', left: 80, top: 90 },
      baseVersion: 0,
    };

    const transformedB = transformOperation(addOpB, addOpA);
    assert.equal(transformedB.type, 'ADD');

    const board = { objects: [] };
    applyOperation(board, addOpA);
    applyOperation(board, transformedB);

    assert.equal(board.objects.length, 2);
    assert.equal(board.objects[0].id, 'obj-a');
    assert.equal(board.objects[1].id, 'obj-b');
  });

  // -----------------------------------------------------------------
  // 7. RULE 6: CLEAR + old operation -> Old operation ignored
  // -----------------------------------------------------------------
  await t.test('Test 7: CLEAR + old operation -> Old operation ignored', () => {
    const clearOp = {
      operationId: 'op-clear',
      boardId: 'test-board',
      userId: 'user-admin',
      type: 'CLEAR',
      baseVersion: 10,
    };

    const oldOp = {
      operationId: 'op-old-move',
      boardId: 'test-board',
      userId: 'user-c',
      type: 'MOVE',
      objectId: 'old-rect',
      payload: { dx: 10, dy: 10 },
      baseVersion: 9,
    };

    const transformed = transformOperation(oldOp, clearOp);
    assert.equal(transformed.type, 'NOOP');
    assert.equal(transformed.isNoOp, true);
    assert.equal(transformed.conflictRule, 'RULE_6_CLEAR_PRECEDENCE');
  });

  // -----------------------------------------------------------------
  // 8. Duplicate operation -> Not applied twice
  // -----------------------------------------------------------------
  await t.test('Test 8: Duplicate operation idempotency', async () => {
    const boardId = `board-test-dupe-${Date.now()}`;
    const op = {
      operationId: `op-dupe-test-${Date.now()}`,
      boardId,
      userId: 'user-1',
      type: 'ADD',
      objectId: 'rect-dup',
      payload: { type: 'rect', left: 100, top: 100 },
      baseVersion: 0,
    };

    const firstRes = await BoardService.processOperation(op);
    assert.equal(firstRes.success, true);
    assert.equal(firstRes.isDuplicate, undefined);

    const secondRes = await BoardService.processOperation(op);
    assert.equal(secondRes.success, true);
    assert.equal(secondRes.isDuplicate, true);
    // Board version shouldn't increment on duplicate
    assert.equal(secondRes.board.version, firstRes.board.version);
  });

  // -----------------------------------------------------------------
  // 9. Integration Test: Two clients -> Same board -> Operations flow
  // -----------------------------------------------------------------
  await t.test('Test 9: Integration simulation of two clients collaborating with OT', async () => {
    const boardId = `collab-board-${Date.now()}`;
    await BoardService.getOrCreateBoard(boardId, 'Collab Room');

    // User A adds a rectangle at baseVersion 0
    const addOp = {
      operationId: 'int-op-1',
      boardId,
      userId: 'alice',
      type: 'ADD',
      objectId: 'shape-1',
      payload: { type: 'rect', left: 200, top: 200, width: 80, height: 80, fill: '#ff0000' },
      baseVersion: 0,
    };
    const resA1 = await BoardService.processOperation(addOp);
    assert.equal(resA1.success, true);
    assert.equal(resA1.board.version, 1);

    // User A and User B concurrently submit operations based on baseVersion 1!
    // User A moves shape-1 by dx: 30, dy: 0
    const opA_Move = {
      operationId: 'int-op-2',
      boardId,
      userId: 'alice',
      type: 'MOVE',
      objectId: 'shape-1',
      payload: { dx: 30, dy: 0 },
      baseVersion: 1,
    };

    // User B simultaneously moves shape-1 by dx: 0, dy: 40 at baseVersion 1!
    const opB_Move = {
      operationId: 'int-op-3',
      boardId,
      userId: 'bob',
      type: 'MOVE',
      objectId: 'shape-1',
      payload: { dx: 0, dy: 40 },
      baseVersion: 1,
    };

    // User A's operation reaches server first
    const resA2 = await BoardService.processOperation(opA_Move);
    assert.equal(resA2.success, true);
    assert.equal(resA2.board.version, 2);

    // User B's operation arrives after, with baseVersion = 1 (< server version 2)
    // Server OT engine must transform User B's operation against User A's op!
    const resB = await BoardService.processOperation(opB_Move);
    assert.equal(resB.success, true);
    assert.equal(resB.board.version, 3);
    assert.equal(resB.operation.transformed, true);
    assert.equal(resB.operation.conflictRule, 'RULE_1_CONCURRENT_MOVE_ADDITIVE');

    // Verify final state on board: both moves combined!
    const finalBoard = await BoardService.getBoard(boardId);
    const shape = finalBoard.objects.find(o => o.id === 'shape-1');
    assert.equal(shape.left, 230); // 200 + 30
    assert.equal(shape.top, 240);  // 200 + 40
  });

  // -----------------------------------------------------------------
  // 10. Undo creates inverse operation
  // -----------------------------------------------------------------
  await t.test('Test 10: Undo creates inverse operation and restores state', async () => {
    const boardId = `undo-board-${Date.now()}`;
    const userId = 'user-undoer';
    await BoardService.getOrCreateBoard(boardId);

    // Add an object
    await BoardService.processOperation({
      operationId: 'op-u1',
      boardId,
      userId,
      type: 'ADD',
      objectId: 'item-1',
      payload: { type: 'circle', left: 50, top: 50 },
      baseVersion: 0,
    });

    // Move it by 100, 50
    await BoardService.processOperation({
      operationId: 'op-u2',
      boardId,
      userId,
      type: 'MOVE',
      objectId: 'item-1',
      payload: { dx: 100, dy: 50 },
      baseVersion: 1,
    });

    const boardBeforeUndo = await BoardService.getBoard(boardId);
    assert.equal(boardBeforeUndo.objects[0].left, 150);

    // Trigger Undo
    const undoRes = await BoardService.undo(boardId, userId);
    assert.equal(undoRes.success, true);
    assert.equal(undoRes.operation.isInverse, true);
    assert.equal(undoRes.operation.type, 'MOVE');
    assert.equal(undoRes.operation.payload.dx, -100);
    assert.equal(undoRes.operation.payload.dy, -50);

    // Verify board restored
    const boardAfterUndo = await BoardService.getBoard(boardId);
    assert.equal(boardAfterUndo.objects[0].left, 50);
    assert.equal(boardAfterUndo.objects[0].top, 50);
  });
});
