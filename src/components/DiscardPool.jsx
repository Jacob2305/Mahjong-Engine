import React from 'react';
import Tile from './Tile.jsx';
import { TILE_INDEX } from '../engine/tiles.js';

// Compact grid of all tiles seen discarded by any player, with a ×N badge.
export default function DiscardPool({ discards, onRemove, active, onActivate, lastId, myDiscardId }) {
  const entries = Object.entries(discards)
    .filter(([, n]) => n > 0)
    .sort((a, b) => TILE_INDEX[a[0]] - TILE_INDEX[b[0]]);

  const total = entries.reduce((a, [, n]) => a + n, 0);

  return (
    <div
      onClick={onActivate}
      className={`rounded-xl p-2 transition-colors cursor-pointer ${
        active ? 'bg-gold/15 ring-2 ring-gold' : 'bg-jade-dark/40 ring-1 ring-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className={`text-sm font-bold ${active ? 'text-gold' : 'text-cream/80'}`}>
          Seen Discards 牌河
          {active && <span className="text-[10px] ml-1.5 align-middle">● adding here · tap to close</span>}
        </span>
        <span className="text-[11px] text-cream/60">{total} tiles seen</span>
      </div>
      {myDiscardId ? (
        <p className="text-[10px] text-emerald-300/90 mb-1 px-0.5">
          ◦ green-ringed = what you just discarded
        </p>
      ) : (
        lastId && (
          <p className="text-[10px] text-gold/80 mb-1 px-0.5">
            ◦ gold-ringed = last thrown (advisor checks if you can claim it)
          </p>
        )
      )}
      <div className="min-h-[56px] rounded-lg bg-jade-dark/60 p-2">
        {entries.length === 0 ? (
          <p className="text-cream/40 text-xs py-3 text-center">
            No discards tracked yet — tap this box, then tap tiles you’ve seen thrown
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {entries.map(([id, n]) => (
              <Tile
                key={id}
                id={id}
                size="sm"
                badge={n > 1 ? `×${n}` : null}
                greenRing={id === myDiscardId}
                highlight={id !== myDiscardId && id === lastId}
                onClick={(e) => { e.stopPropagation(); onRemove(id); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
