import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { createBoard } from '../services/api';
import { getRandomColor } from '../utils/operations';
import {
  Sparkles,
  ArrowRight,
  Zap,
  Brain,
  Users,
  HardDrive,
  Plus,
  LogIn,
  Layers,
  X,
  MousePointer,
  CheckCircle2,
} from 'lucide-react';

export function Home() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('whiteboard_username') || '';
  });
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinBoardId, setJoinBoardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const saveUserSession = (name) => {
    const finalName = name.trim() || `User_${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem('whiteboard_username', finalName);

    let userId = sessionStorage.getItem('whiteboard_userId');
    if (!userId) {
      userId = `usr_${uuidv4().slice(0, 8)}`;
      sessionStorage.setItem('whiteboard_userId', userId);
    }
    let userColor = sessionStorage.getItem('whiteboard_userColor');
    if (!userColor) {
      userColor = getRandomColor(userId);
      sessionStorage.setItem('whiteboard_userColor', userColor);
    }
    return { userId, displayName: finalName, color: userColor };
  };

  const handleCreateBoard = async () => {
    setLoading(true);
    setError('');

    try {
      saveUserSession(displayName);
      const res = await createBoard('Whiteboard');
      if (res.boardId) {
        navigate(`/board/${res.boardId}`);
      } else {
        const randomId = uuidv4().slice(0, 8);
        navigate(`/board/${randomId}`);
      }
    } catch (err) {
      const randomId = uuidv4().slice(0, 8);
      navigate(`/board/${randomId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinBoard = (e) => {
    if (e) e.preventDefault();
    if (!joinBoardId.trim()) return;

    saveUserSession(displayName);

    let cleanId = joinBoardId.trim();
    if (cleanId.includes('/board/')) {
      cleanId = cleanId.split('/board/')[1].split('/')[0].split('?')[0];
    }
    cleanId = cleanId.replace('#', '');

    navigate(`/board/${cleanId}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans relative overflow-x-hidden">
      {/* 3D Colorful Ambient Glows */}
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-blue-400/20 via-indigo-300/15 to-transparent rounded-full blur-[130px] pointer-events-none animate-pulse-glow" />
      <div className="fixed top-[30%] -left-[150px] w-[500px] h-[500px] bg-purple-400/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 -right-[100px] w-[600px] h-[600px] bg-emerald-300/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Subtle Natural Grid Background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/40">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight block leading-tight">
              Whiteboard
            </span>
            <span className="text-[11px] font-medium text-blue-600 block">
              Multi-Party OT Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span>Live WebSocket Ready</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-16 flex-1 flex flex-col items-center text-center">
        {/* Top 3D Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-blue-200/80 shadow-md shadow-blue-500/5 text-xs font-semibold text-blue-700 mb-6 transition-transform hover:scale-105">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>Next-Gen Operational Transformation</span>
          <span className="text-slate-300">•</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-slate-600">Deterministic Sync</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.08] max-w-4xl">
          Collaborative{' '}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Whiteboard
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed">
          Draw, brainstorm and collaborate in real time.
        </p>

        {/* User Nickname Input */}
        <div className="mt-8 w-full max-w-md">
          <div className="relative">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name (e.g. Alex or Taylor)"
              className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-md shadow-slate-200/60 transition-all font-medium"
            />
          </div>
        </div>

        {/* 3D Action Buttons */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <button
            onClick={handleCreateBoard}
            disabled={loading}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl btn-3d-primary font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{loading ? 'Creating...' : 'Create New Board'}</span>
          </button>

          <button
            onClick={() => setJoinModalOpen(true)}
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl btn-3d-secondary font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-slate-600" />
            <span>Join Board</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3D Interactive Whiteboard Visual Showcase Mockup               */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-14 w-full max-w-3xl mockup-3d-wrapper animate-float-3d">
          <div className="mockup-3d-canvas rounded-3xl bg-white/95 backdrop-blur-xl p-5 border border-slate-200 relative overflow-hidden">
            {/* Window header buttons */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-400/90 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-amber-400/90 shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/90 shadow-sm" />
                <span className="ml-2 text-xs font-semibold text-slate-400">Team Canvas • #live-collab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600 border border-blue-200/60">
                  OT Resolution v14
                </span>
              </div>
            </div>

            {/* Canvas mockup interior */}
            <div className="relative h-60 w-full rounded-2xl bg-[#fafafa] canvas-theme-natural overflow-hidden mt-3 p-4 flex items-center justify-center">
              {/* Sticky Note 1 */}
              <div className="absolute top-6 left-12 w-36 h-36 rounded-xl bg-gradient-to-br from-amber-200 to-amber-300 p-3 shadow-lg shadow-amber-500/20 -rotate-3 border border-amber-300 flex flex-col justify-between text-left transition-transform hover:scale-105">
                <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider">💡 Sprint Idea</span>
                <span className="text-xs font-semibold text-amber-900">Zero-latency OT Conflict resolution</span>
                <span className="text-[10px] text-amber-800/80">#hackathon</span>
              </div>

              {/* Sticky Note 2 */}
              <div className="absolute top-10 right-14 w-36 h-36 rounded-xl bg-gradient-to-br from-pink-200 to-rose-300 p-3 shadow-lg shadow-rose-500/20 rotate-4 border border-rose-300 flex flex-col justify-between text-left transition-transform hover:scale-105">
                <span className="text-[11px] font-bold text-rose-950 uppercase tracking-wider">🎯 Target</span>
                <span className="text-xs font-semibold text-rose-900">Live multi-user shape sync</span>
                <span className="text-[10px] text-rose-800/80">Verified 60fps</span>
              </div>

              {/* Center Shape Diagram */}
              <div className="relative z-10 px-6 py-4 rounded-2xl bg-white shadow-xl shadow-blue-500/10 border-2 border-blue-500 flex flex-col items-center">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">State Machine</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5">Authoritative OT Hub</span>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Conflict Free Replicated State</span>
                </div>
              </div>

              {/* Simulated Live Cursor 1 (Alex) */}
              <div className="absolute bottom-8 left-28 flex flex-col items-start pointer-events-none animate-float-slow">
                <MousePointer className="w-5 h-5 text-indigo-600 fill-indigo-600 -rotate-12 drop-shadow-md" />
                <span className="ml-3 -mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-indigo-600 shadow-md">
                  Alex (Drawing)
                </span>
              </div>

              {/* Simulated Live Cursor 2 (Taylor) */}
              <div className="absolute top-8 right-36 flex flex-col items-start pointer-events-none animate-float-3d">
                <MousePointer className="w-5 h-5 text-emerald-600 fill-emerald-600 -rotate-12 drop-shadow-md" />
                <span className="ml-3 -mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-emerald-600 shadow-md">
                  Taylor
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4 Feature Cards (Exact 4 Cards requested, with 3D Depth)      */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl text-left">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl card-3d-glass flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30 border border-white/50">
                <Zap className="w-6 h-6 fill-white" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                ⚡ Real-Time Collaboration
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-normal">
                Sub-millisecond WebSocket data pipelines. Every stroke, shape, and cursor update synchronizes instantaneously.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
              <span>Instant P2P Sync</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl card-3d-glass flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30 border border-white/50">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                🧠 Conflict Resolution with OT
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-normal">
                Deterministic transformation engine resolves concurrent edits smoothly. No overwrite collisions, no lost work.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-purple-600">
              <span>Mathematical Consensus</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl card-3d-glass flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 border border-white/50">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                👥 Multi-User Presence
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-normal">
                See teammate names, live cursor pointers, vibrant avatar rings, and dynamic member counters in real time.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-blue-600">
              <span>Live Awareness</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-3xl card-3d-glass flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30 border border-white/50">
                <HardDrive className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                💾 Persistent Boards
              </h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed font-normal">
                Automatic persistence with MongoDB storage and low-latency in-memory cache. Instant resume on reconnect.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <span>Auto-Saved Forever</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-400 border-t border-slate-200/80 bg-white/70 backdrop-blur-md">
        <span>Collaborative Whiteboard • Real-Time Operational Transformation (OT)</span>
      </footer>

      {/* Join Board Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl p-7 bg-white border border-slate-200 shadow-2xl relative">
            <button
              onClick={() => setJoinModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-200/80 shadow-md shadow-blue-500/10">
              <LogIn className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">Join a Whiteboard</h3>
            <p className="text-xs text-slate-500 mt-1">Enter your board ID or paste the link to start collaborating</p>

            <form onSubmit={handleJoinBoard} className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Board ID or URL
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={joinBoardId}
                  onChange={(e) => setJoinBoardId(e.target.value)}
                  placeholder="e.g. 4c013d2d or /board/4c013d2d"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl btn-3d-primary font-bold text-sm cursor-pointer mt-2 flex items-center justify-center gap-2"
              >
                <span>Enter Board</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
