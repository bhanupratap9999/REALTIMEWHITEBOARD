/**
 * Validates incoming operations from clients before passing to OT engine.
 */

const ALLOWED_TYPES = new Set([
  'ADD',
  'MOVE',
  'UPDATE',
  'RESIZE',
  'ROTATE',
  'DELETE',
  'TEXT_UPDATE',
  'CLEAR',
  'NOOP'
]);

const MAX_OBJECTS_PER_BOARD = 1000;
const MAX_TEXT_LENGTH = 5000;

export function validateOperation(operation, currentObjectCount = 0) {
  if (!operation || typeof operation !== 'object') {
    return { isValid: false, error: 'Operation must be an object' };
  }

  const { operationId, boardId, userId, type, baseVersion } = operation;

  if (!operationId || typeof operationId !== 'string') {
    return { isValid: false, error: 'Invalid or missing operationId' };
  }

  if (!boardId || typeof boardId !== 'string' || boardId.trim().length === 0) {
    return { isValid: false, error: 'Invalid or missing boardId' };
  }

  if (!userId || typeof userId !== 'string') {
    return { isValid: false, error: 'Invalid or missing userId' };
  }

  if (!type || !ALLOWED_TYPES.has(type)) {
    return { isValid: false, error: `Invalid operation type: ${type}` };
  }

  if (typeof baseVersion !== 'number' || baseVersion < 0) {
    return { isValid: false, error: 'Invalid baseVersion: must be non-negative integer' };
  }

  // Type-specific validations
  if (type === 'CLEAR') {
    return { isValid: true };
  }

  // Object-level operations require an objectId
  if (!operation.objectId || typeof operation.objectId !== 'string') {
    return { isValid: false, error: `Operation type ${type} requires a valid objectId` };
  }

  if (type === 'ADD') {
    if (currentObjectCount >= MAX_OBJECTS_PER_BOARD) {
      return { isValid: false, error: `Board object limit reached (${MAX_OBJECTS_PER_BOARD})` };
    }
    if (!operation.payload || typeof operation.payload !== 'object') {
      return { isValid: false, error: 'ADD operation requires payload with object definition' };
    }
    if (!operation.payload.type) {
      return { isValid: false, error: 'ADD payload must specify an object type (e.g., rect, circle, path, line, text)' };
    }
  }

  if (type === 'TEXT_UPDATE') {
    const text = operation.payload?.text;
    if (typeof text === 'string' && text.length > MAX_TEXT_LENGTH) {
      return { isValid: false, error: `Text content exceeds maximum length of ${MAX_TEXT_LENGTH} chars` };
    }
  }

  return { isValid: true };
}
