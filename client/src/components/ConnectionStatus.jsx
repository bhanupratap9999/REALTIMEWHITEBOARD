import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function ConnectionStatus({ status = 'connected', version = 0, isInMemoryFallback = false }) {
  let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let dotColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
  let label = 'Connected';
  let Icon = Wifi;

  if (status === 'reconnecting') {
    badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]';
    label = 'Reconnecting...';
    Icon = RefreshCw;
  } else if (status === 'disconnected') {
    badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    dotColor = 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    label = 'Disconnected';
    Icon = WifiOff;
  }

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border ${badgeColor} transition-colors`}>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="font-medium flex items-center gap-1">
          {label}
        </span>
      </div>

      {/* Version Counter Badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300">
        <span className="text-slate-400 font-sans font-medium">Version:</span>
        <span className="font-bold text-indigo-400">v{version}</span>
      </div>

      {/* In-memory badge if active */}
      {isInMemoryFallback && (
        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          In-Memory Mode
        </span>
      )}
    </div>
  );
}
