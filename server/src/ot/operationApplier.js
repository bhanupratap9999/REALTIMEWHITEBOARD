/**
 * Operation Applier: Deterministically mutates the board object state based on canonical operations.
 */

export function applyOperation(board, operation) {
  if (!board) {
    throw new Error('Board state is required to apply operation');
  }

  if (!Array.isArray(board.objects)) {
    board.objects = [];
  }

  const { type, objectId, payload } = operation;

  // NOOP does not mutate state
  if (type === 'NOOP') {
    return { success: true, affectedObject: null };
  }

  switch (type) {
    case 'CLEAR': {
      board.objects = [];
      return { success: true, affectedObject: null };
    }

    case 'ADD': {
      // payload must represent the object definition
      const newObject = {
        id: objectId,
        ...payload,
        id: objectId // ensure id matches canonical objectId
      };
      // Check if already exists (idempotency)
      const existingIdx = board.objects.findIndex((o) => (o.id || o.objectId) === objectId);
      if (existingIdx >= 0) {
        board.objects[existingIdx] = newObject;
      } else {
        board.objects.push(newObject);
      }
      return { success: true, affectedObject: newObject };
    }

    case 'DELETE': {
      const initialLen = board.objects.length;
      board.objects = board.objects.filter((o) => (o.id || o.objectId) !== objectId);
      return { success: true, removedCount: initialLen - board.objects.length };
    }

    case 'MOVE': {
      const obj = board.objects.find((o) => (o.id || o.objectId) === objectId);
      if (!obj) {
        return { success: false, reason: 'Object not found for MOVE' };
      }

      if (typeof payload?.left === 'number' && typeof payload?.top === 'number') {
        obj.left = payload.left;
        obj.top = payload.top;
      } else {
        const dx = Number(payload?.dx || 0);
        const dy = Number(payload?.dy || 0);
        obj.left = (Number(obj.left) || 0) + dx;
        obj.top = (Number(obj.top) || 0) + dy;
      }

      return { success: true, affectedObject: obj };
    }

    case 'UPDATE': {
      const obj = board.objects.find((o) => (o.id || o.objectId) === objectId);
      if (!obj) {
        return { success: false, reason: 'Object not found for UPDATE' };
      }

      Object.assign(obj, payload || {});
      return { success: true, affectedObject: obj };
    }

    case 'RESIZE': {
      const obj = board.objects.find((o) => (o.id || o.objectId) === objectId);
      if (!obj) {
        return { success: false, reason: 'Object not found for RESIZE' };
      }

      if (typeof payload?.scaleX === 'number') obj.scaleX = payload.scaleX;
      if (typeof payload?.scaleY === 'number') obj.scaleY = payload.scaleY;
      if (typeof payload?.width === 'number') obj.width = payload.width;
      if (typeof payload?.height === 'number') obj.height = payload.height;
      if (typeof payload?.left === 'number') obj.left = payload.left;
      if (typeof payload?.top === 'number') obj.top = payload.top;

      return { success: true, affectedObject: obj };
    }

    case 'ROTATE': {
      const obj = board.objects.find((o) => (o.id || o.objectId) === objectId);
      if (!obj) {
        return { success: false, reason: 'Object not found for ROTATE' };
      }

      if (typeof payload?.angle === 'number') obj.angle = payload.angle;
      if (typeof payload?.left === 'number') obj.left = payload.left;
      if (typeof payload?.top === 'number') obj.top = payload.top;

      return { success: true, affectedObject: obj };
    }

    case 'TEXT_UPDATE': {
      const obj = board.objects.find((o) => (o.id || o.objectId) === objectId);
      if (!obj) {
        return { success: false, reason: 'Object not found for TEXT_UPDATE' };
      }

      if (typeof payload?.text === 'string') {
        obj.text = payload.text;
      }
      return { success: true, affectedObject: obj };
    }

    default:
      return { success: false, reason: `Unknown operation type: ${type}` };
  }
}
