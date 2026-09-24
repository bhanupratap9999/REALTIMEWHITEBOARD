import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../hooks/useSocket';
import { useWhiteboard } from '../hooks/useWhiteboard';
import { Whiteboard } from '../components/Whiteboard';
import { UserPresence } from '../components/UserPresence';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { ShareModal } from '../components/ShareModal';
import { OTPanel } from '../components/OTPanel';
import { getBoard } from '../services/api';
import { getRandomColor } from '../utils/operations';
import { getSavedTheme, saveTheme, THEMES } from '../services/themeService';
import {
  Layers,
  Share2,
  ArrowLeft,
  Download,
  Palette,
  Sun,
  Moon,
  Sparkles,
  Zap,
  Grid,
} from 'lucide-react';

export function Board() {
  const { boardId } = useParams();
  const navigate = useNavigate();

  // Container ref for reliable Fabric canvas sizing
  const containerRef = useRef(null);

  // Theme state
  const [currentTheme, setCurrentTheme] = useState(() => getSavedTheme());
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  const handleSelectTheme = (themeId) => {
    setCurrentTheme(themeId);
    saveTheme(themeId);
    setThemeDropdownOpen(false);
  };

  useEffect(() => {
    saveTheme(currentTheme);
  }, [currentTheme]);

  // User profile:
  // Use sessionStorage for userId so each browser tab/window gets a distinct user identity
  // This is critical for instant multi-screen / multi-tab collaboration without collision!
  const [user, setUser] = useState(() => {
    let name = localStorage.getItem('whiteboard_username') || `User_${Math.floor(100 + Math.random() * 900)}`;
    let userId = sessionStorage.getItem('whiteboard_userId');
    let color = sessionStorage.getItem('whiteboard_userColor');
    if (!userId) {
      userId = `usr_${uuidv4().slice(0, 8)}`;
      sessionStorage.setItem('whiteboard_userId', userId);
    }
    if (!color) {
      color = getRandomColor(userId);
      sessionStorage.setItem('whiteboard_userColor', color);
    }
    return { userId, displayName: name, color };
  });

  const [nameModalOpen, setNameModalOpen] = useState(() => {
    // Only prompt for name if user has never set one before
    return !localStorage.getItem('whiteboard_username');
  });
  const [tempName, setTempName] = useState(user.displayName);

  // Board state
  const [boardName, setBoardName] = useState('Web Whiteboard');
  const [boardVersion, setBoardVersion] = useState(0);
  const [operationHistory, setOperationHistory] = useState([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [otPanelOpen, setOtPanelOpen] = useState(false);

  // boardVersion as a ref so canvas event listeners never go stale
  const boardVersionRef = useRef(0);
  const syncBoardVersion = (v) => {
    boardVersionRef.current = v;
    setBoardVersion(v);
  };

  // loadBoardState and applyRemoteOperation refs
  const loadBoardStateRef = useRef(null);
  const applyRemoteOperationRef = useRef(null);

  // -------------------------------------------------------------------
  // Socket callbacks
  // -------------------------------------------------------------------
  const handleBoardState = useCallback((state) => {
    if (!state) return;
    if (state.name) setBoardName(state.name);
    if (typeof state.version === 'number') syncBoardVersion(state.version);
    if (Array.isArray(state.objects) && loadBoardStateRef.current) {
      loadBoardStateRef.current(state.objects);
    }
  }, []);

  const handleOperationApplied = useCallback((operation, newVersion) => {
    if (!operation) return;
    if (typeof newVersion === 'number') syncBoardVersion(newVersion);
    setOperationHistory((prev) => [...prev.slice(-99), operation]);
    if (applyRemoteOperationRef.current) {
      applyRemoteOperationRef.current(operation);
    }
  }, []);

  const handleOperationRejected = useCallback((rejectionData) => {
    console.warn('[Board] Operation rejected, resyncing:', rejectionData?.error, rejectionData?.code);
    if (rejectionData?.boardState) {
      if (typeof rejectionData.boardState.version === 'number') {
        syncBoardVersion(rejectionData.boardState.version);
      }
      if (Array.isArray(rejectionData.boardState.objects) && loadBoardStateRef.current) {
        loadBoardStateRef.current(rejectionData.boardState.objects);
      }
    }
  }, []);

  // -------------------------------------------------------------------
  // Socket hook — connects immediately with valid user profile
  // -------------------------------------------------------------------
  const {
    connectionStatus,
    activeUsers,
    remoteCursors,
    emitCursorMove,
    emitOperation,
    emitUndo,
    emitRedo,
  } = useSocket({
    boardId,
    user,
    onBoardState: handleBoardState,
    onOperationApplied: handleOperationApplied,
    onOperationRejected: handleOperationRejected,
  });

  // -------------------------------------------------------------------
  // Whiteboard hook
  // -------------------------------------------------------------------
  const {
    canvasRef,
    fabricCanvasRef,
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    fillColor,
    setFillColor,
    isFilled,
    setIsFilled,
    selectedObjectId,
    deleteSelected,
    clearCanvas,
    loadBoardState,
    applyRemoteOperation,
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    hasObjects,
  } = useWhiteboard({
    boardId,
    user,
    emitOperation,
    emitCursorMove,
    boardVersionRef,
    containerRef,
  });

  // Wire up refs
  useEffect(() => {
    loadBoardStateRef.current = loadBoardState;
    applyRemoteOperationRef.current = applyRemoteOperation;
  }, [loadBoardState, applyRemoteOperation]);

  // Adjust default stroke color when theme changes
  useEffect(() => {
    const isDark = currentTheme === 'dark';
    setStrokeColor(isDark ? '#ffffff' : '#1e293b');
  }, [currentTheme, setStrokeColor]);

  // Initial board load via REST API
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current || !boardId) return;
    initialLoadDone.current = true;

    getBoard(boardId)
      .then((res) => {
        if (res?.board) {
          if (res.board.name) setBoardName(res.board.name);
          syncBoardVersion(res.board.version || 0);
          if (res.board.objects?.length > 0 && loadBoardStateRef.current) {
            loadBoardStateRef.current(res.board.objects);
          }
        }
      })
      .catch((err) => console.warn('[Board] REST init error (socket will sync):', err.message));
  }, [boardId]);

  // Export board as PNG
  const handleExportPNG = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    try {
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1,
      });
      const link = document.createElement('a');
      link.download = `${boardName || 'whiteboard'}-${boardId}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.warn('Failed to export canvas:', e);
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    const name = tempName.trim() || user.displayName;
    localStorage.setItem('whiteboard_username', name);
    setUser((prev) => ({ ...prev, displayName: name }));
    setNameModalOpen(false);
  };

  return (
    <div className={`relative w-screen h-screen flex flex-col overflow-hidden font-sans select-none ${currentTheme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* ----------------------------------------------------------------- */}
      {/* HEADER (3D Frosted Studio Header)                                 */}
      {/* ----------------------------------------------------------------- */}
      <header className="h-14 px-4 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 flex items-center justify-between z-30 shrink-0 shadow-sm">
        {/* Left: Brand / Title / Export */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            title="Go home"
            className="p-2 rounded-2xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25 border border-white/40">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                  {boardName}
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 shadow-xs">
                  #{boardId}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
                Real-Time OT Engine
              </span>
            </div>
          </div>

          <button
            onClick={handleExportPNG}
            title="Export Board as PNG"
            className="p-2 ml-1 rounded-2xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Center: Collaboration Status Pill with 3D Ring */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-inner">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Real-time OT active</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">v{boardVersion}</span>
        </div>

        {/* Right: Theme Service, Users, OT Inspector, and Share Button */}
        <div className="flex items-center gap-2.5">
          {/* Theme Switcher Service Dropdown */}
          <div className="relative">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              title="Change Theme"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline capitalize">{currentTheme}</span>
            </button>

            {themeDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 p-2 rounded-3xl bg-white/98 dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2.5 py-1">
                  Canvas Theme
                </span>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTheme(t.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      currentTheme === t.id
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div>{t.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{t.description}</div>
                    </div>
                    {currentTheme === t.id && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Users Avatars */}
          <UserPresence activeUsers={activeUsers} currentUserId={user.userId} />

          {/* 3D OT Inspector Button */}
          <button
            onClick={() => setOtPanelOpen(true)}
            title="Inspect Operational Transformation & Conflict Rules"
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border border-purple-200 text-xs font-bold shadow-xs transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-purple-600 text-purple-600" />
            <span className="hidden sm:inline">OT Inspector</span>
            <span className="px-1.5 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-mono font-bold">
              {operationHistory.length}
            </span>
          </button>

          {/* 3D Share Board Button */}
          <button
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl btn-3d-primary text-xs font-bold cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Share board</span>
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* MAIN CANVAS AREA                                                   */}
      {/* ----------------------------------------------------------------- */}
      <main className="relative flex-1 w-full overflow-hidden">
        <Whiteboard
          canvasRef={canvasRef}
          containerRef={containerRef}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          isFilled={isFilled}
          setIsFilled={setIsFilled}
          selectedObjectId={selectedObjectId}
          onDeleteSelected={deleteSelected}
          onUndo={emitUndo}
          onRedo={emitRedo}
          onClear={clearCanvas}
          remoteCursors={remoteCursors}
          zoomLevel={zoomLevel}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          hasObjects={hasObjects}
          theme={currentTheme}
        />
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* STATUS BAR                                                         */}
      {/* ----------------------------------------------------------------- */}
      <footer className="h-7 px-3 border-t border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between z-30 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
        <ConnectionStatus status={connectionStatus} version={boardVersion} />

        <div className="flex items-center gap-3">
          <span className="hidden lg:inline text-slate-400">
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">V</kbd> Select &nbsp;
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">P</kbd> Pen &nbsp;
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">S</kbd> Sticky &nbsp;
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">T</kbd> Text &nbsp;
            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">Del</kbd> Erase
          </span>
          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
            <span className="max-w-[100px] truncate">{user.displayName || 'You'}</span>
          </div>
        </div>
      </footer>

      {/* ----------------------------------------------------------------- */}
      {/* MODALS & PANELS                                                    */}
      {/* ----------------------------------------------------------------- */}
      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} boardId={boardId} />

      <OTPanel
        isOpen={otPanelOpen}
        setIsOpen={setOtPanelOpen}
        boardId={boardId}
        boardVersion={boardVersion}
        operationHistory={operationHistory}
        emitOperation={emitOperation}
        currentUser={user}
      />

      {/* Optional Display Name Modal */}
      {nameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 border border-blue-200 dark:border-blue-800">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Join Whiteboard</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Set your nickname on board #{boardId}</p>

            <form onSubmit={handleNameSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                autoFocus
                required
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="e.g. Alex or Taylor"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-md shadow-blue-600/20 active:scale-95"
              >
                Save & Continue →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
