import { getBackendUrl } from './socket';

function getApiBase() {
  const url = getBackendUrl();
  // If backend is on same origin as frontend in production, relative '' works cleanly
  if (typeof window !== 'undefined' && url === window.location.origin) {
    return '';
  }
  return url;
}

export async function createBoard(name = 'Hackathon Whiteboard') {
  const res = await fetch(`${getApiBase()}/api/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create board: ${res.statusText}`);
  }
  return await res.json();
}

export async function getBoard(boardId) {
  const res = await fetch(`${getApiBase()}/api/boards/${boardId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch board: ${res.statusText}`);
  }
  return await res.json();
}

export async function getBoardOperations(boardId, limit = 50) {
  const res = await fetch(`${getApiBase()}/api/boards/${boardId}/operations?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch operations: ${res.statusText}`);
  }
  return await res.json();
}

export async function checkServerHealth() {
  try {
    const res = await fetch(`${getApiBase()}/api/health`);
    if (!res.ok) return { status: 'down' };
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}
