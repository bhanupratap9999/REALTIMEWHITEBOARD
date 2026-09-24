import React, { useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';

export function UserPresence({ activeUsers = [], currentUserId = null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-200 transition-all shadow-sm"
        title="View active users"
      >
        <Users className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-medium">
          Online: <span className="text-emerald-400 font-bold">{activeUsers.length}</span>
        </span>

        {/* Mini stacked avatars preview */}
        <div className="flex -space-x-1.5 overflow-hidden ml-1">
          {activeUsers.slice(0, 3).map((u) => (
            <div
              key={u.userId}
              style={{ backgroundColor: u.color || '#3b82f6' }}
              className="inline-block w-4 h-4 rounded-full ring-2 ring-slate-900 text-[9px] font-bold text-white text-center leading-4"
            >
              {(u.displayName || 'U')[0].toUpperCase()}
            </div>
          ))}
        </div>

        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Dropdown with full user list */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 flex items-center justify-between">
              <span>Active Collaborators</span>
              <span className="text-indigo-400 font-mono">{activeUsers.length}</span>
            </div>

            <div className="mt-1.5 max-h-60 overflow-y-auto space-y-1">
              {activeUsers.map((u) => {
                const isYou = u.userId === currentUserId;
                return (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 text-xs text-slate-200"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: u.color || '#10b981' }}
                      />
                      <span className="truncate font-medium">
                        {u.displayName || 'Anonymous'}
                      </span>
                    </div>
                    {isYou && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono font-semibold">
                        You
                      </span>
                    )}
                  </div>
                );
              })}
              {activeUsers.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500 text-center">
                  No active users
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
