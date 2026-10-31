import React from 'react';
import Tile from './Tile.jsx';
import { TILE_INDEX, isBonus } from '../engine/tiles.js';

function sortIds(ids) {
  return [...ids].sort((a, b) => {
    const ia = isBonus(a) ? 100 + a.charCodeAt(6) : TILE_INDEX[a];
    const ib = isBonus(b) ? 100 + b.charCodeAt(6) : TILE_INDEX[b];
    return ia - ib;
  });
}

const MELD_LABEL = { chow: 'Chow', pung: 'Pung', kong: 'Kong' };

export default function HandDisplay({
  handIds,
  melds,
  onRemoveTile,
  onRemoveMeld,
  active,
  onActivate,
  onClear,
}) {
  const sorted = sortIds(handIds);
  const concealed = handIds.filter((id) => !isBonus(id)).length;
  const melded = melds.length;

  return (
    <div className="space-y-1.5">
      <div
        onClick={onActivate}
        className={`rounded-xl p-2 transition-colors cursor-pointer ${
          active
            ? 'bg-gold/15 ring-2 ring-gold'
            : 'bg-jade-dark/40 ring-1 ring-white/10'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span
            className={`text-sm font-bold ${active ? 'text-gold' : 'text-cream/80'}`}
          >
            My Hand 手牌
            {active && <span className="text-[10px] ml-1.5 align-middle">● adding here · tap to close</span>}
          </span>
          <span className="text-[11px] text-cream/60">
            {concealed} in hand + {melded} melded
          </span>
        </div>

        <div className="min-h-[58px] rounded-lg bg-jade-dark/60 p-2">
        {sorted.length === 0 ? (
          <p className="text-cream/40 text-xs py-3 text-center">
            {active ? 'Tap tiles below to add them to your hand' : 'Tap this box to add tiles to your hand'}
          </p>
        ) : (
          <div>
            <div className="flex flex-wrap gap-1">
              {sorted.map((id, i) => (
                <Tile
                  key={`${id}-${i}`}
                  id={id}
                  size="md"
                  animateKey={`${id}-${i}`}
                  onClick={(e) => { e.stopPropagation(); onRemoveTile(id); }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="text-[10px] text-cream/40">
                tap a tile to discard it → it moves to Seen Discards
              </p>
              <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="rounded-md bg-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-cream/80 active:scale-95"
          >
            Clear
          </button>
            </div>
          </div>
        )}
        {sorted.length === 0 && melds.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="rounded-md bg-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-cream/80 active:scale-95"
            >
              Clear
            </button>
          </div>
        )}
        </div>
      </div>

      {melds.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] text-cream/60">Melds (tap to remove)</span>
          <div className="flex flex-wrap gap-2">
            {melds.map((meld, mi) => (
              <div
                key={mi}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onRemoveMeld(mi); }}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRemoveMeld(mi)}
                className="flex items-center gap-0.5 bg-jade-dark/70 rounded-lg p-1 ring-1 ring-gold/40 active:scale-95 transition-transform cursor-pointer"
              >
                <span className="text-[9px] text-gold/80 mr-0.5 font-semibold">
                  {MELD_LABEL[meld.type]}
                </span>
                {meld.tiles.map((t, ti) => (
                  <Tile key={ti} id={t} size="sm" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
