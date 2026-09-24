import { io } from 'socket.io-client';

export function getBackendUrl() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('whiteboard_backend_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/$/, '');
    }
  }

  const rawServerUrl = import.meta.env.VITE_SERVER_URL;
  if (rawServerUrl && rawServerUrl.trim()) {
    return rawServerUrl.trim().replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5000';
  }

  // In production, fallback to current origin if deployed fullstack
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:5000';
}

export function setBackendUrl(url) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('whiteboard_backend_url', url.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('whiteboard_backend_url');
    }
  }
}

let socketInstance = null;
let currentConnectedUrl = null;

export function getSocket() {
  const targetUrl = getBackendUrl();

  // If socket exists but URL changed, reconnect with new target
  if (socketInstance && currentConnectedUrl !== targetUrl) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    currentConnectedUrl = targetUrl;
    socketInstance = io(targetUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 25,
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
    socketInstance = null;
    currentConnectedUrl = null;
  }
}

export function reconnectWithUrl(newUrl) {
  setBackendUrl(newUrl);
  disconnectSocket();
  return connectSocket();
}

