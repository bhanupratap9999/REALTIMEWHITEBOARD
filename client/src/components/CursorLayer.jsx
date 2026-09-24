import React from 'react';

export function CursorLayer({ remoteCursors = {} }) {
  const cursors = Object.values(remoteCursors);

  if (cursors.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {cursors.map((c) => {
        const color = c.color || '#3b82f6';
        return (
          <div
            key={c.userId}
            style={{
              transform: `translate3d(${c.x}px, ${c.y}px, 0)`,
              transition: 'transform 80ms ease-out',
            }}
            className="absolute top-0 left-0 pointer-events-none flex flex-col items-start"
          >
            {/* SVG Cursor Icon */}
            <svg
              className="w-5 h-5 -rotate-12 drop-shadow-md"
              viewBox="0 0 24 24"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="3 3 10 21 14 14 21 10 3 3" />
            </svg>

            {/* User Name Tag */}
            <div
              style={{ backgroundColor: color }}
              className="ml-3 -mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-lg whitespace-nowrap"
            >
              {c.userName || 'Peer'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
