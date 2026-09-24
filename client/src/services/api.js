const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export async function createBoard(name = 'Hackathon Whiteboard') {
  const res = await fetch(`${API_URL}/api/boards`, {
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
  const res = await fetch(`${API_URL}/api/boards/${boardId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch board: ${res.statusText}`);
  }
  return await res.json();
}

export async function getBoardOperations(boardId, limit = 50) {
  const res = await fetch(`${API_URL}/api/boards/${boardId}/operations?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch operations: ${res.statusText}`);
  }
  return await res.json();
}

export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    if (!res.ok) return { status: 'down' };
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}
