import React, { useState } from 'react';
import { Toolbar } from './Toolbar';
import { CursorLayer } from './CursorLayer';
import { Plus, X, Minus, RotateCcw, Sparkles } from 'lucide-react';

export function Whiteboard({
  canvasRef,
  containerRef,
  activeTool,
  setActiveTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  isFilled,
  setIsFilled,
  selectedObjectId,
  onDeleteSelected,
  onUndo,
  onRedo,
  onClear,
  remoteCursors,
  zoomLevel = 100,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  hasObjects = false,
  theme = 'natural',
}) {
  const [emptyPromptDismissed, setEmptyPromptDismissed] = useState(false);

  const showEmptyCard = !emptyPromptDismissed && !hasObjects;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex-1 overflow-hidden select-none canvas-theme-${theme}`}
    >
      {/* Left Floating 3D Toolbar */}
      <Toolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        isFilled={isFilled}
        setIsFilled={setIsFilled}
        selectedObjectId={selectedObjectId}
        onDeleteSelected={onDeleteSelected}
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
      />

      {/* Live Remote Cursors Layer */}
      <CursorLayer remoteCursors={remoteCursors} />

      {/* Fabric.js Canvas Container */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <canvas ref={canvasRef} />
      </div>

      {/* Center 3D "Add your first object" Card (Matching Reference Photo with 3D Pop) */}
      {showEmptyCard && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-auto">
          <div className="relative group w-52 h-48 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-blue-500/10 border border-slate-200/90 dark:border-slate-800 p-5 flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.03] animate-float-3d">
            {/* 3D Behind card illusion */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 rounded-[28px] blur-sm -z-10 opacity-70 group-hover:opacity-100 transition-opacity" />

            {/* Dismiss Button (x) */}
            <button
              onClick={() => setEmptyPromptDismissed(true)}
              className="absolute top-3.5 right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* 3D Tactile Icon */}
            <button
              onClick={() => setActiveTool('rectangle')}
              className="w-16 h-16 rounded-2xl bg-gradient-to-b from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-center shadow-md shadow-blue-500/15 text-blue-600 mb-3 group-hover:scale-105 group-hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="relative flex items-center justify-center">
                <Plus className="w-7 h-7 stroke-[2.5]" />
                <div className="absolute -top-1 -right-2 w-3.5 h-3.5 border-2 border-indigo-400 rounded-sm" />
              </div>
            </button>

            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Add your first object
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
              Click anywhere or select a tool
            </span>
          </div>
        </div>
      )}

      {/* Bottom-Right 3D Zoom & Navigation Bar */}
      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2 select-none">
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl toolbar-3d text-slate-700 dark:text-slate-200 text-xs font-bold">
          <button
            onClick={onZoomOut}
            title="Zoom Out"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          <button
            onClick={onResetZoom}
            title="Reset Zoom (100%)"
            className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-mono text-[11px] text-blue-600 font-bold cursor-pointer"
          >
            {zoomLevel}%
          </button>

          <button
            onClick={onZoomIn}
            title="Zoom In"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5" />

          <button
            onClick={onResetZoom}
            title="Center Canvas"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
