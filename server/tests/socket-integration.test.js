import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

test('LIVE WEBSOCKET & OT INTEGRATION TEST', async () => {
  const SERVER_URL = 'http://localhost:5000';
  const boardId = `socket_test_${Date.now()}`;

  // Client 1 (Alice)
  const clientA = ioClient(SERVER_URL, { transports: ['websocket'] });
  // Client 2 (Bob)
  const clientB = ioClient(SERVER_URL, { transports: ['websocket'] });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientA.on('connect', check);
    clientB.on('connect', check);
  });

  // 1. Join Board
  await new Promise((resolve) => {
    clientA.emit('join-board', {
      boardId,
      user: { userId: 'alice-1', displayName: 'Alice', color: '#ef4444' }
    }, resolve);
  });

  await new Promise((resolve) => {
    clientB.emit('join-board', {
      boardId,
      user: { userId: 'bob-2', displayName: 'Bob', color: '#3b82f6' }
    }, resolve);
  });

  // 2. Alice adds a rectangle
  const objectId = `rect_${Date.now()}`;
  const addOp = {
    operationId: uuidv4(),
    boardId,
    userId: 'alice-1',
    type: 'ADD',
    objectId,
    payload: {
      type: 'rect',
      left: 100,
      top: 100,
      width: 50,
      height: 50,
      fill: '#6366f1'
    },
    baseVersion: 0,
  };

  // Wait for Bob to receive the applied ADD operation
  const bobReceivedAddPromise = new Promise((resolve) => {
    clientB.on('operation-applied', (data) => {
      if (data.operation.operationId === addOp.operationId) {
        resolve(data);
      }
    });
  });

  clientA.emit('operation', addOp);
  const addResult = await bobReceivedAddPromise;
  assert.equal(addResult.operation.type, 'ADD');
  assert.equal(addResult.version, 1);

  // 3. Test Concurrent Conflicting MOVE Operations
  // Both Alice and Bob send MOVE on the same object at baseVersion = 1!
  const aliceMove = {
    operationId: uuidv4(),
    boardId,
    userId: 'alice-1',
    type: 'MOVE',
    objectId,
    payload: { dx: 30, dy: 0 },
    baseVersion: 1,
  };

  const bobMove = {
    operationId: uuidv4(),
    boardId,
    userId: 'bob-2',
    type: 'MOVE',
    objectId,
    payload: { dx: 0, dy: 40 },
    baseVersion: 1,
  };

  const receivedOps = [];
  const captureOps = (data) => {
    receivedOps.push(data.operation);
  };
  clientA.on('operation-applied', captureOps);

  // Emit both operations concurrently
  clientA.emit('operation', aliceMove);
  clientB.emit('operation', bobMove);

  // Wait for both operations to be applied on server
  await new Promise((resolve) => setTimeout(resolve, 800));

  assert.equal(receivedOps.length >= 2, true);
  const transformedOp = receivedOps.find((op) => op.transformed === true);
  assert.ok(transformedOp, 'One of the concurrent operations must be transformed by OT engine');
  assert.equal(transformedOp.conflictRule, 'RULE_1_CONCURRENT_MOVE_ADDITIVE');

  // Clean up
  clientA.disconnect();
  clientB.disconnect();
});
