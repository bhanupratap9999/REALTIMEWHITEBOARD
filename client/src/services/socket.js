import { io } from 'socket.io-client';

const rawServerUrl = import.meta.env.VITE_SERVER_URL;
const SERVER_URL = rawServerUrl && rawServerUrl.trim() !== ''
  ? rawServerUrl.trim().replace(/\/$/, '')
  : (import.meta.env.DEV ? 'http://localhost:5000' : undefined);

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });
  }
  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
  }
}
