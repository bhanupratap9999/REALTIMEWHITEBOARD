import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, connectSocket } from '../services/socket';

export function useSocket({ boardId, user, onBoardState, onOperationApplied, onOperationRejected }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeUsers, setActiveUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});

  const socketRef = useRef(null);
  const lastCursorEmitRef = useRef(0);

  // Keep latest callbacks in refs so socket listeners never go stale
  const onBoardStateRef = useRef(onBoardState);
  const onOperationAppliedRef = useRef(onOperationApplied);
  const onOperationRejectedRef = useRef(onOperationRejected);
  useEffect(() => { onBoardStateRef.current = onBoardState; }, [onBoardState]);
  useEffect(() => { onOperationAppliedRef.current = onOperationApplied; }, [onOperationApplied]);
  useEffect(() => { onOperationRejectedRef.current = onOperationRejected; }, [onOperationRejected]);

  // -------------------------------------------------------------------
  // emitCursorMove — throttled, stable ref
  // -------------------------------------------------------------------
  const emitCursorMove = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorEmitRef.current < 33) return; // 30fps cap
    lastCursorEmitRef.current = now;

    if (socketRef.current?.connected && boardId && user?.userId) {
      socketRef.current.emit('cursor-move', { x, y, boardId, userId: user.userId });
    }
  }, [boardId, user?.userId]);

  // -------------------------------------------------------------------
  // emitOperation — returns Promise for ack
  // -------------------------------------------------------------------
  const emitOperation = useCallback((operation) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        reject(new Error('Socket disconnected — operation queued for retry'));
        return;
      }
      socket.emit('operation', operation, (response) => {
        if (response?.success) {
          resolve(response);
        } else {
          // Non-fatal — just log, don't reject so UI stays smooth
          console.warn('[Socket] Server rejected op:', response?.error, response?.code);
          resolve(response); // resolve anyway so callers don't crash
        }
      });
    });
  }, []);

  const emitUndo = useCallback(() => {
    if (socketRef.current?.connected && boardId && user?.userId) {
      socketRef.current.emit('undo', { boardId, userId: user.userId });
    }
  }, [boardId, user?.userId]);

  const emitRedo = useCallback(() => {
    if (socketRef.current?.connected && boardId && user?.userId) {
      socketRef.current.emit('redo', { boardId, userId: user.userId });
    }
  }, [boardId, user?.userId]);

  // -------------------------------------------------------------------
  // Connect and bind socket events
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!boardId || !user?.displayName || !user?.userId) return;

    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionStatus('connected');
      // Re-join board on reconnect too
      socket.emit('join-board', { boardId, user }, (response) => {
        if (response?.activeUsers) setActiveUsers(response.activeUsers);
      });
    };

    const handleDisconnect = (reason) => {
      setConnectionStatus('disconnected');
      console.log('[Socket] Disconnected:', reason);
    };

    const handleConnectError = (err) => {
      setConnectionStatus('reconnecting');
      console.warn('[Socket] Connection error:', err.message);
    };

    const handleReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };

    const handlePresenceUpdate = ({ activeUsers: users }) => {
      if (Array.isArray(users)) setActiveUsers(users);
    };

    const handleUserJoined = ({ activeUsers: users }) => {
      if (Array.isArray(users)) setActiveUsers(users);
    };

    const handleUserLeft = ({ userId, activeUsers: users }) => {
      if (Array.isArray(users)) setActiveUsers(users);
      setRemoteCursors((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const handleCursorUpdate = (cursorData) => {
      if (!cursorData || cursorData.userId === user.userId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [cursorData.userId]: { ...cursorData, lastUpdated: Date.now() },
      }));
    };

    const handleBoardState = (state) => {
      onBoardStateRef.current?.(state);
    };

    const handleOpApplied = (data) => {
      onOperationAppliedRef.current?.(data.operation, data.version);
    };

    const handleOpRejected = (data) => {
      onOperationRejectedRef.current?.(data);
    };

    const handleError = (data) => {
      console.error('[Socket] Server error:', data?.message);
    };

    // If already connected, join immediately
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('presence-update', handlePresenceUpdate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('cursor-update', handleCursorUpdate);
    socket.on('board-state', handleBoardState);
    socket.on('operation-applied', handleOpApplied);
    socket.on('operation-rejected', handleOpRejected);
    socket.on('error', handleError);

    // Periodically clean up stale remote cursors (> 8 seconds old)
    const cleanupInterval = setInterval(() => {
      const threshold = Date.now() - 8000;
      setRemoteCursors((prev) => {
        const stale = Object.entries(prev).filter(([, c]) => c.lastUpdated < threshold);
        if (!stale.length) return prev;
        const next = { ...prev };
        stale.forEach(([id]) => delete next[id]);
        return next;
      });
    }, 4000);

    return () => {
      clearInterval(cleanupInterval);
      socket.emit('leave-board', { boardId, userId: user.userId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('presence-update', handlePresenceUpdate);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('cursor-update', handleCursorUpdate);
      socket.off('board-state', handleBoardState);
      socket.off('operation-applied', handleOpApplied);
      socket.off('operation-rejected', handleOpRejected);
      socket.off('error', handleError);
    };
  }, [boardId, user?.userId, user?.displayName]); // Only re-run if board or user identity changes

  return {
    connectionStatus,
    activeUsers,
    remoteCursors,
    emitCursorMove,
    emitOperation,
    emitUndo,
    emitRedo,
  };
}
