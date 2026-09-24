import { v4 as uuidv4 } from 'uuid';

/**
 * Computes an inverse operation for Undo/Redo.
 * The inverse operation is sent as a new operation through the OT pipeline.
 */
export function inverseOperation(originalOp, boardSnapshot = null) {
  if (!originalOp) return null;

  const baseInverse = {
    operationId: uuidv4(),
    boardId: originalOp.boardId,
    userId: originalOp.userId,
    objectId: originalOp.objectId,
    baseVersion: originalOp.serverVersion || originalOp.baseVersion,
    timestamp: Date.now(),
    isInverse: true,
    inverseOf: originalOp.operationId,
  };

  switch (originalOp.type) {
    case 'ADD': {
      // Inverse of ADD is DELETE
      return {
        ...baseInverse,
        type: 'DELETE',
        payload: {
          restorationData: originalOp.payload,
        },
      };
    }

    case 'DELETE': {
      // Inverse of DELETE is ADD (restoring the object)
      const restorePayload = originalOp.payload?.restorationData || 
        (boardSnapshot?.objects?.find(o => (o.id || o.objectId) === originalOp.objectId)) ||
        { id: originalOp.objectId };

      return {
        ...baseInverse,
        type: 'ADD',
        payload: restorePayload,
      };
    }

    case 'MOVE': {
      // Inverse of MOVE is opposite displacement
      const dx = Number(originalOp.payload?.dx || 0);
      const dy = Number(originalOp.payload?.dy || 0);
      const originalLeft = originalOp.payload?.originalLeft;
      const originalTop = originalOp.payload?.originalTop;

      return {
        ...baseInverse,
        type: 'MOVE',
        payload: {
          dx: -dx,
          dy: -dy,
          left: typeof originalLeft === 'number' ? originalLeft : undefined,
          top: typeof originalTop === 'number' ? originalTop : undefined,
        },
      };
    }

    case 'UPDATE': {
      // Inverse of UPDATE applies the previous properties
      return {
        ...baseInverse,
        type: 'UPDATE',
        payload: originalOp.payload?.previousValues || originalOp.payload || {},
      };
    }

    case 'RESIZE': {
      return {
        ...baseInverse,
        type: 'RESIZE',
        payload: originalOp.payload?.previousDimensions || {},
      };
    }

    case 'ROTATE': {
      const prevAngle = originalOp.payload?.previousAngle;
      return {
        ...baseInverse,
        type: 'ROTATE',
        payload: {
          angle: typeof prevAngle === 'number' ? prevAngle : 0,
        },
      };
    }

    case 'TEXT_UPDATE': {
      return {
        ...baseInverse,
        type: 'TEXT_UPDATE',
        payload: {
          text: originalOp.payload?.previousText || '',
        },
      };
    }

    default:
      return null;
  }
}
