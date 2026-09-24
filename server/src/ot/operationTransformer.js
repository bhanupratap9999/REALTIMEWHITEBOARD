/**
 * Operational Transformation (OT) Transformer Engine
 * Deterministically transforms an incoming operation against a previously applied operation.
 */

export function transformOperation(incomingOp, previousOp) {
  // Clone incoming operation to avoid mutating the original
  const transformed = JSON.parse(JSON.stringify(incomingOp));
  transformed.transformed = false;
  transformed.conflictRule = null;

  if (!previousOp) {
    return transformed;
  }

  // If incoming is already a NOOP, nothing to transform
  if (transformed.type === 'NOOP') {
    return transformed;
  }

  // ----------------------------------------------------
  // RULE 6: CLEAR has highest priority
  // If CLEAR occurred before a pending operation, operations based on older board versions are invalidated
  // ----------------------------------------------------
  if (previousOp.type === 'CLEAR') {
    transformed.type = 'NOOP';
    transformed.isNoOp = true;
    transformed.transformed = true;
    transformed.conflictRule = 'RULE_6_CLEAR_PRECEDENCE';
    transformed.conflictDetails = 'Operation invalidated because board was cleared by previous operation.';
    return transformed;
  }

  // If incoming operation is CLEAR, it always executes regardless of previous ops
  if (transformed.type === 'CLEAR') {
    return transformed;
  }

  // Operations on different objects do not conflict (RULE 5: ADD + ADD / separate objects)
  if (transformed.objectId !== previousOp.objectId) {
    // Check rare duplicate objectId on ADD
    if (transformed.type === 'ADD' && previousOp.type === 'ADD' && transformed.objectId === previousOp.objectId) {
      // Re-assign a unique ID if collision occurred
      transformed.objectId = `${transformed.objectId}_transformed_${Date.now()}`;
      if (transformed.payload) {
        transformed.payload.id = transformed.objectId;
      }
      transformed.transformed = true;
      transformed.conflictRule = 'RULE_5_ADD_ID_COLLISION_RESOLVED';
    }
    return transformed;
  }

  // ----------------------------------------------------
  // CONFLICTS ON THE SAME OBJECT (same objectId)
  // ----------------------------------------------------

  // RULE 2: MOVE + DELETE
  // If object was already deleted, any subsequent MOVE, UPDATE, RESIZE, ROTATE, TEXT_UPDATE becomes a NO-OP
  if (previousOp.type === 'DELETE') {
    if (transformed.type === 'DELETE') {
      // RULE 3: DELETE + DELETE
      transformed.type = 'NOOP';
      transformed.isNoOp = true;
      transformed.transformed = true;
      transformed.conflictRule = 'RULE_3_DELETE_DELETE_NOOP';
      transformed.conflictDetails = 'Object was already deleted by another user. Second DELETE is a no-op.';
      return transformed;
    } else {
      // Any operation on an already-deleted object is discarded
      transformed.type = 'NOOP';
      transformed.isNoOp = true;
      transformed.transformed = true;
      transformed.conflictRule = 'RULE_2_DELETE_WINS_OVER_MODIFICATION';
      transformed.conflictDetails = `Object was deleted by another user. Incoming ${transformed.type} ignored.`;
      return transformed;
    }
  }

  // RULE 2 (Inverse): If incoming is DELETE and previous was MOVE/UPDATE/RESIZE, DELETE wins!
  if (transformed.type === 'DELETE') {
    // Delete operation continues cleanly, will remove the moved/updated object
    transformed.conflictRule = 'RULE_2_DELETE_WINS';
    return transformed;
  }

  // RULE 1: CONCURRENT MOVE + MOVE
  // If two users move the same object concurrently, movement is additive
  if (transformed.type === 'MOVE' && previousOp.type === 'MOVE') {
    const prevDx = Number(previousOp.payload?.dx || 0);
    const prevDy = Number(previousOp.payload?.dy || 0);
    const incomingDx = Number(transformed.payload?.dx || 0);
    const incomingDy = Number(transformed.payload?.dy || 0);

    // Keep incoming relative movement (additive to what previousOp moved)
    // Adjust absolute coordinates if provided in payload
    if (transformed.payload && typeof transformed.payload.left === 'number') {
      transformed.payload.left += prevDx;
    }
    if (transformed.payload && typeof transformed.payload.top === 'number') {
      transformed.payload.top += prevDy;
    }

    transformed.transformed = true;
    transformed.conflictRule = 'RULE_1_CONCURRENT_MOVE_ADDITIVE';
    transformed.conflictDetails = `Merged concurrent movement. Previous (dx:${prevDx}, dy:${prevDy}) + Incoming (dx:${incomingDx}, dy:${incomingDy}).`;
    return transformed;
  }

  // RULE 4: UPDATE + UPDATE
  // If two users update properties of the same object concurrently
  if (transformed.type === 'UPDATE' && previousOp.type === 'UPDATE') {
    const prevProps = previousOp.payload || {};
    const incomingProps = transformed.payload || {};

    const conflictingKeys = [];
    const mergedProps = { ...incomingProps };

    for (const key of Object.keys(prevProps)) {
      if (key in incomingProps) {
        conflictingKeys.push(key);
      }
    }

    transformed.transformed = true;
    transformed.conflictRule = 'RULE_4_UPDATE_MERGED';
    if (conflictingKeys.length > 0) {
      transformed.conflictDetails = `Concurrent update on property [${conflictingKeys.join(', ')}]. Server order applied (incoming overwrites conflicting keys).`;
    } else {
      transformed.conflictDetails = 'Concurrent updates to distinct properties merged cleanly.';
    }
    return transformed;
  }

  // RESIZE / ROTATE / TEXT_UPDATE concurrent handling
  if (transformed.type === 'RESIZE' && previousOp.type === 'MOVE') {
    // Adjust target position for resize if move happened concurrently
    if (typeof transformed.payload?.left === 'number') {
      transformed.payload.left += Number(previousOp.payload?.dx || 0);
    }
    if (typeof transformed.payload?.top === 'number') {
      transformed.payload.top += Number(previousOp.payload?.dy || 0);
    }
    transformed.transformed = true;
    transformed.conflictRule = 'RESIZE_MOVE_ADJUSTED';
    return transformed;
  }

  if (transformed.type === 'ROTATE' && previousOp.type === 'ROTATE') {
    transformed.transformed = true;
    transformed.conflictRule = 'ROTATE_SERVER_ORDER_WINS';
    transformed.conflictDetails = 'Concurrent rotation resolved by server operation order.';
    return transformed;
  }

  if (transformed.type === 'TEXT_UPDATE' && previousOp.type === 'TEXT_UPDATE') {
    transformed.transformed = true;
    transformed.conflictRule = 'TEXT_UPDATE_SERVER_ORDER_WINS';
    transformed.conflictDetails = 'Concurrent text editing resolved by server operation order.';
    return transformed;
  }

  return transformed;
}

/**
 * Transforms an incoming operation against a sequence of previous concurrent operations.
 * @param {Object} incomingOp - The incoming client operation
 * @param {Array<Object>} historyOps - Operations that occurred after incomingOp.baseVersion
 * @returns {Object} Transformed operation
 */
export function transformAgainstHistory(incomingOp, historyOps = []) {
  let currentOp = JSON.parse(JSON.stringify(incomingOp));
  const appliedTransformations = [];

  for (const prevOp of historyOps) {
    const transformed = transformOperation(currentOp, prevOp);
    if (transformed.transformed) {
      appliedTransformations.push({
        againstOpId: prevOp.operationId,
        againstType: prevOp.type,
        rule: transformed.conflictRule,
        details: transformed.conflictDetails
      });
    }
    currentOp = transformed;
    if (currentOp.type === 'NOOP') {
      break;
    }
  }

  if (appliedTransformations.length > 0) {
    currentOp.transformed = true;
    currentOp.transformationHistory = appliedTransformations;
  }

  return currentOp;
}
