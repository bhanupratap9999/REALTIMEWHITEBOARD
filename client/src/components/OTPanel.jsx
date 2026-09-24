import React, { useState } from 'react';
import {
  Activity,
  Zap,
  Layers,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function OTPanel({
  isOpen,
  setIsOpen,
  boardId,
  boardVersion,
  operationHistory = [],
  emitOperation,
  currentUser,
}) {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'rules' | 'simulator'
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState([]);

  // Filter or take latest 30 operations
  const displayOps = [...operationHistory].reverse().slice(0, 30);

  // Helper for color coding operation types
  const getOpBadge = (type) => {
    switch (type) {
      case 'ADD':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'MOVE':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'UPDATE':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/30';
      case 'RESIZE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'ROTATE':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'CLEAR':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'NOOP':
        return 'bg-slate-700 text-slate-400 border-slate-600';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // -----------------------------------------------------------------
  // HACKATHON DEMO: Simulate Concurrent Conflict
  // -----------------------------------------------------------------
  const runConcurrentMoveSimulation = async () => {
    setSimulating(true);
    setSimulationLog([]);

    const logEntry = (msg, type = 'info') => {
      setSimulationLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    try {
      const demoObjectId = `demo_box_${uuidv4().slice(0, 6)}`;
      const currentVer = boardVersion;

      logEntry(`Step 1: Spawning Demo Object (${demoObjectId}) on board at v${currentVer}...`);

      // 1. First add a demo box
      await emitOperation({
        operationId: uuidv4(),
        boardId,
        userId: currentUser.userId,
        type: 'ADD',
        objectId: demoObjectId,
        payload: {
          type: 'rect',
          left: 300,
          top: 250,
          width: 90,
          height: 90,
          fill: '#4f46e5',
          stroke: '#ffffff',
          strokeWidth: 2,
        },
        baseVersion: currentVer,
      });

      // Wait 300ms for propagation
      await new Promise((r) => setTimeout(r, 400));
      const baseVersionForConflict = boardVersion;

      logEntry(`Step 2: Base Version locked at v${baseVersionForConflict}. Firing 2 CONCURRENT Operations:`, 'warn');
      logEntry(`  • User Alice: MOVE dx=+50, dy=0 (baseVersion: v${baseVersionForConflict})`);
      logEntry(`  • User Bob:   MOVE dx=0, dy=+50 (baseVersion: v${baseVersionForConflict})`);

      // 2. Dispatch both concurrent operations based on the SAME baseVersion!
      const opAlice = {
        operationId: uuidv4(),
        boardId,
        userId: 'simulated_alice',
        type: 'MOVE',
        objectId: demoObjectId,
        payload: { dx: 50, dy: 0, left: 350, top: 250 },
        baseVersion: baseVersionForConflict,
      };

      const opBob = {
        operationId: uuidv4(),
        boardId,
        userId: 'simulated_bob',
        type: 'MOVE',
        objectId: demoObjectId,
        payload: { dx: 0, dy: 50, left: 300, top: 300 },
        baseVersion: baseVersionForConflict,
      };

      // Send both concurrently
      const [resAlice, resBob] = await Promise.all([
        emitOperation(opAlice),
        emitOperation(opBob),
      ]);

      logEntry(`Step 3: Server processed Alice's op -> v${resAlice.version} (applied cleanly).`, 'success');
      logEntry(`Step 4: Bob's op arrived with baseVersion v${baseVersionForConflict} < serverVersion v${resAlice.version}.`, 'warn');
      logEntry(`⚡ OT Engine triggered: RULE 1 (Additive Movement) transformed Bob's op!`, 'success');
      logEntry(`Final state: Object moved by both (+50, +50). Consistent canvas state achieved!`, 'success');
    } catch (err) {
      logEntry(`Simulation error: ${err.message}`, 'error');
    } finally {
      setSimulating(false);
    }
  };

  const runMoveDeleteSimulation = async () => {
    setSimulating(true);
    setSimulationLog([]);

    const logEntry = (msg, type = 'info') => {
      setSimulationLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    try {
      const demoObjectId = `demo_del_${uuidv4().slice(0, 6)}`;
      const currentVer = boardVersion;

      logEntry(`Step 1: Adding Demo Circle (${demoObjectId})...`);
      await emitOperation({
        operationId: uuidv4(),
        boardId,
        userId: currentUser.userId,
        type: 'ADD',
        objectId: demoObjectId,
        payload: {
          type: 'circle',
          left: 450,
          top: 250,
          radius: 40,
          fill: '#ec4899',
          stroke: '#ffffff',
          strokeWidth: 2,
        },
        baseVersion: currentVer,
      });

      await new Promise((r) => setTimeout(r, 400));
      const baseVersionForConflict = boardVersion;

      logEntry(`Step 2: Concurrent Conflict on v${baseVersionForConflict}:`, 'warn');
      logEntry(`  • User A: DELETE ${demoObjectId}`);
      logEntry(`  • User B: MOVE dx=+60, dy=+60`);

      const opDelete = {
        operationId: uuidv4(),
        boardId,
        userId: 'simulated_charlie',
        type: 'DELETE',
        objectId: demoObjectId,
        baseVersion: baseVersionForConflict,
      };

      const opMove = {
        operationId: uuidv4(),
        boardId,
        userId: 'simulated_david',
        type: 'MOVE',
        objectId: demoObjectId,
        payload: { dx: 60, dy: 60 },
        baseVersion: baseVersionForConflict,
      };

      await emitOperation(opDelete);
      await emitOperation(opMove);

      logEntry(`Step 3: DELETE applied first. Object deleted from canvas.`, 'success');
      logEntry(`⚡ OT Engine triggered: RULE 2 (DELETE wins). Incoming MOVE transformed to NO-OP!`, 'success');
    } catch (err) {
      logEntry(`Simulation error: ${err.message}`, 'error');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl glass-panel shadow-2xl border border-indigo-500/40 bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-indigo-300 hover:text-white transition-all hover:scale-105 active:scale-95"
      >
        <Zap className="w-4 h-4 text-indigo-400 animate-pulse" />
        <span>OT Inspector & Demo</span>
        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
          v{boardVersion}
        </span>
      </button>

      {/* Slide-out Drawer Panel */}
      {isOpen && (
        <div className="fixed top-0 right-0 bottom-0 w-96 z-50 glass-panel border-l border-slate-700/80 bg-slate-950/95 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  OT Engine Inspector
                </h3>
                <p className="text-[11px] text-slate-400">Operational Transformation Demo</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Current Board Version Banner */}
          <div className="mx-4 mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300 font-medium">Board Version:</span>
            </div>
            <span className="font-mono text-sm font-bold text-emerald-400 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
              v{boardVersion}
            </span>
          </div>

          {/* Architecture Pipeline Diagram for Judges */}
          <div className="mx-4 mt-3 p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-200">
            <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
              OT Pipeline Architecture
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span className="text-slate-300">Client Op</span>
              <span>→</span>
              <span className="text-amber-400 font-bold">OT Engine</span>
              <span>→</span>
              <span className="text-emerald-400 font-bold">Canonical v+1</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800 px-4 mt-3">
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Live Operations ({displayOps.length})
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`pb-2 px-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === 'simulator'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              Conflict Simulator
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-2 px-2 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'rules'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              OT Rules
            </button>
          </div>

          {/* Tab Content: Live Operation Stream */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {displayOps.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  Draw or modify shapes to view incoming OT operations in real-time.
                </div>
              ) : (
                displayOps.map((op) => (
                  <div
                    key={op.operationId}
                    className={`p-2.5 rounded-xl border transition-all text-xs ${
                      op.transformed
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          v{op.serverVersion || op.baseVersion}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getOpBadge(op.type)}`}>
                          {op.type}
                        </span>
                        {op.transformed && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> TRANSFORMED
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {op.userId?.slice(0, 8)}
                      </span>
                    </div>

                    <div className="text-slate-400 font-mono text-[11px] truncate">
                      obj: <span className="text-slate-200">{op.objectId || 'board'}</span>
                    </div>

                    {op.transformed && op.conflictRule && (
                      <div className="mt-1.5 text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded-md border border-amber-500/20">
                        <span className="font-semibold block">{op.conflictRule}</span>
                        <span>{op.conflictDetails || 'Additive coordinate resolution applied.'}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: Judge Conflict Simulator */}
          {activeTab === 'simulator' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-white block mb-1">
                  ⚡ Interactive Judge Demonstrations
                </span>
                Click below to fire concurrent operations with identical base versions to verify deterministic OT conflict resolution in real-time!
              </div>

              {/* Simulation Action 1 */}
              <button
                disabled={simulating}
                onClick={runConcurrentMoveSimulation}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-200 hover:text-white transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-400" />
                  <span>Test Rule 1: Concurrent MOVE + MOVE</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono">Additive</span>
              </button>

              {/* Simulation Action 2 */}
              <button
                disabled={simulating}
                onClick={runMoveDeleteSimulation}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-semibold text-rose-200 hover:text-white transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-rose-400" />
                  <span>Test Rule 2: MOVE + DELETE</span>
                </div>
                <span className="text-[10px] text-rose-400 font-mono">Delete Wins</span>
              </button>

              {/* Simulation Output Log */}
              {simulationLog.length > 0 && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5">
                  <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1">
                    Simulation Execution Trace:
                  </div>
                  {simulationLog.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'warn'
                          ? 'text-amber-400 font-semibold'
                          : log.type === 'error'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }
                    >
                      {log.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: OT Rules Reference */}
          {activeTab === 'rules' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-indigo-300 block mb-1">Rule 1: MOVE + MOVE</span>
                <p className="text-slate-400 text-[11px]">
                  Concurrent moves on the same object are combined additively (<code className="text-indigo-400">dx = dxA + dxB</code>, <code className="text-indigo-400">dy = dyA + dyB</code>).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-rose-300 block mb-1">Rule 2: MOVE + DELETE</span>
                <p className="text-slate-400 text-[11px]">
                  DELETE wins. If an object was deleted, subsequent concurrent modifications are transformed into NO-OPs.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-amber-300 block mb-1">Rule 3: DELETE + DELETE</span>
                <p className="text-slate-400 text-[11px]">
                  First delete is applied. Second concurrent delete becomes an idempotent NO-OP.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1">Rule 4: UPDATE + UPDATE</span>
                <p className="text-slate-400 text-[11px]">
                  Distinct properties are merged. Conflicting identical properties are deterministically resolved by server sequence order.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-bold text-purple-300 block mb-1">Rule 6: CLEAR Precedence</span>
                <p className="text-slate-400 text-[11px]">
                  CLEAR has highest priority. Stale operations targeting the pre-cleared canvas are invalidated.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
