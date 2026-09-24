import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a standard Operation object
 */
export function createOperation({
  boardId,
  userId,
  type,
  objectId = null,
  payload = {},
  baseVersion = 0,
}) {
  return {
    operationId: uuidv4(),
    boardId,
    userId,
    type,
    objectId: objectId || (payload?.id ? String(payload.id) : null),
    payload,
    baseVersion,
    timestamp: Date.now(),
  };
}

/**
 * Serializes a Fabric.js object into a clean payload for ADD / state recreation
 */
export function serializeFabricObject(obj) {
  if (!obj) return null;

  const base = {
    id: obj.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: obj.type,
    left: Math.round(obj.left || 0),
    top: Math.round(obj.top || 0),
    width: Math.round(obj.width || 0),
    height: Math.round(obj.height || 0),
    scaleX: obj.scaleX || 1,
    scaleY: obj.scaleY || 1,
    angle: Math.round(obj.angle || 0),
    fill: obj.fill || 'transparent',
    stroke: obj.stroke || '#1e293b',
    strokeWidth: obj.strokeWidth || 2,
    opacity: obj.opacity !== undefined ? obj.opacity : 1,
  };

  // Type specific fields
  if (obj.type === 'rect') {
    base.rx = obj.rx || 0;
    base.ry = obj.ry || 0;
  } else if (obj.type === 'circle') {
    base.radius = Math.round(obj.radius || (obj.width ? obj.width / 2 : 25));
  } else if (obj.type === 'triangle') {
    base.width = Math.round(obj.width || 80);
    base.height = Math.round(obj.height || 80);
  } else if (obj.type === 'line') {
    base.x1 = obj.x1;
    base.y1 = obj.y1;
    base.x2 = obj.x2;
    base.y2 = obj.y2;
  } else if (obj.type === 'arrow') {
    base.x1 = obj.x1;
    base.y1 = obj.y1;
    base.x2 = obj.x2;
    base.y2 = obj.y2;
    base.points = obj.points;
  } else if (obj.type === 'i-text' || obj.type === 'text') {
    base.text = obj.text || '';
    base.fontSize = obj.fontSize || 20;
    base.fontFamily = obj.fontFamily || 'Inter, sans-serif';
    base.fill = obj.fill || '#1e293b';
  } else if (obj.type === 'sticky') {
    base.noteColor = obj.noteColor || '#fef08a';
    const textObj = obj._objects?.find(o => o.type === 'i-text' || o.type === 'text');
    base.text = textObj?.text || '';
    base.width = Math.round(obj.width || 150);
    base.height = Math.round(obj.height || 150);
  } else if (obj.type === 'path') {
    base.path = obj.path;
    if (obj.pathOffset) {
      base.pathOffset = { x: obj.pathOffset.x, y: obj.pathOffset.y };
    }
    base.strokeLineCap = obj.strokeLineCap || 'round';
    base.strokeLineJoin = obj.strokeLineJoin || 'round';
  }

  return base;
}

/**
 * Helper to generate an avatar color for users
 */
const AVATAR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function getRandomColor(seed = '') {
  if (!seed) {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
