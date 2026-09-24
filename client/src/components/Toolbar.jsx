import React, { useState } from 'react';
import {
  MousePointer,
  Pen,
  StickyNote,
  Square,
  Circle,
  Triangle,
  Minus,
  MoveRight,
  Type,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Palette,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react';

const COLORS = [
  '#1e293b', // Slate Dark
  '#2563eb', // Blue (Miro primary)
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#ffffff', // White
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Bold', value: 8 },
];

export function Toolbar({
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
}) {
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const shapeTools = [
    { id: 'rectangle', label: 'Rectangle (R)', icon: Square },
    { id: 'circle', label: 'Circle (C)', icon: Circle },
    { id: 'triangle', label: 'Triangle', icon: Triangle },
    { id: 'line', label: 'Line (L)', icon: Minus },
    { id: 'arrow', label: 'Arrow (A)', icon: MoveRight },
  ];

  const isShapeActive = ['rectangle', 'circle', 'triangle', 'line', 'arrow'].includes(activeTool);

  const handleClearClick = () => {
    if (confirmClear) {
      onClear();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
    }
  };

  return (
    <>
      {/* Left Floating Vertical Toolbar with 3D Tactile Styling */}
      <div className="absolute top-20 left-4 z-30 flex flex-col items-center gap-3 select-none">
        <div className="flex flex-col items-center p-2 rounded-3xl toolbar-3d text-slate-700 dark:text-slate-200">
          {/* Select Tool */}
          <button
            onClick={() => {
              setActiveTool('select');
              setShowShapesMenu(false);
            }}
            title="Select (V)"
            className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
              activeTool === 'select'
                ? 'tool-active-3d'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <MousePointer className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Pen / Freehand Draw Tool */}
          <button
            onClick={() => {
              setActiveTool('pen');
              setShowShapesMenu(false);
            }}
            title="Pen / Draw (P)"
            className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
              activeTool === 'pen'
                ? 'tool-active-3d'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Pen className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Sticky Note Tool */}
          <button
            onClick={() => {
              setActiveTool('sticky');
              setShowShapesMenu(false);
            }}
            title="Sticky Note (S)"
            className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
              activeTool === 'sticky'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-md shadow-amber-500/20 scale-105'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <StickyNote className="w-5 h-5 stroke-[2] text-amber-600" />
          </button>

          {/* Shapes / Figures Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowShapesMenu(!showShapesMenu);
              }}
              title="Shapes & Figures"
              className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
                isShapeActive
                  ? 'tool-active-3d'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Square className="w-5 h-5 stroke-[2]" />
            </button>

            {/* Shapes Flyout Submenu */}
            {showShapesMenu && (
              <div className="absolute left-full top-0 ml-3 p-2.5 rounded-3xl bg-white/95 dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-1 z-40 min-w-[170px] animate-in fade-in slide-in-from-left-2 duration-150">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1">
                  Shapes & Figures
                </span>
                {shapeTools.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveTool(s.id);
                        setShowShapesMenu(false);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTool === s.id
                          ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-200'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Text Tool */}
          <button
            onClick={() => {
              setActiveTool('text');
              setShowShapesMenu(false);
            }}
            title="Text Tool (T)"
            className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
              activeTool === 'text'
                ? 'tool-active-3d'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Type className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Eraser Tool */}
          <button
            onClick={() => {
              setActiveTool('eraser');
              setShowShapesMenu(false);
            }}
            title="Eraser (E)"
            className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-sm scale-105'
                : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Eraser className="w-5 h-5 stroke-[2]" />
          </button>

          <div className="w-6 h-px bg-slate-200 dark:bg-slate-800 my-1.5" />

          {/* Color & Palette Picker with 3D Ring */}
          <div className="relative">
            <button
              onClick={() => setShowStylePicker(!showStylePicker)}
              title="Stroke & Color Settings"
              className={`p-2.5 rounded-2xl transition-all duration-150 flex items-center justify-center cursor-pointer ${
                showStylePicker
                  ? 'bg-slate-100 ring-2 ring-blue-500 scale-105'
                  : 'hover:bg-slate-100/80 text-slate-600'
              }`}
            >
              <span
                className="w-5 h-5 rounded-full border-2 border-white shadow-md block"
                style={{ backgroundColor: strokeColor }}
              />
            </button>

            {/* Popover */}
            {showStylePicker && (
              <div className="absolute left-full top-0 ml-3 p-4 rounded-3xl bg-white/95 dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 z-40 w-64 animate-in fade-in slide-in-from-left-2 duration-150 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                    Colors
                  </span>
                  <div className="grid grid-cols-4 gap-2.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setStrokeColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-xl border border-black/15 shadow-sm transition-transform cursor-pointer ${
                          strokeColor === c ? 'scale-110 ring-2 ring-blue-500 ring-offset-2' : 'hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
                    Stroke Width
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    {STROKE_WIDTHS.map((w) => (
                      <button
                        key={w.value}
                        onClick={() => setStrokeWidth(w.value)}
                        className={`flex-1 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                          strokeWidth === w.value
                            ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Fill Shapes</span>
                  <button
                    onClick={() => setIsFilled(!isFilled)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      isFilled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 left-1 ${
                        isFilled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete Selected (Contextual) */}
          {selectedObjectId && (
            <button
              onClick={onDeleteSelected}
              title="Delete Selected (Del)"
              className="p-2.5 rounded-2xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer animate-in zoom-in-95"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom Undo / Redo 3D Pill */}
        <div className="flex flex-col items-center p-1.5 rounded-3xl toolbar-3d text-slate-700 dark:text-slate-200">
          <button
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-90 cursor-pointer"
          >
            <Undo2 className="w-4 h-4 stroke-[2.2]" />
          </button>
          <button
            onClick={onRedo}
            title="Redo (Ctrl+Y)"
            className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all active:scale-90 cursor-pointer"
          >
            <Redo2 className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </>
  );
}
