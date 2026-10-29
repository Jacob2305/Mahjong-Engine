import React, { useState } from 'react';
import Tile from './Tile.jsx';
import { tileName } from '../engine/tiles.js';

const GROUP_LABEL = { chow: 'run', pung: 'triplet', kong: 'kong', pair: 'pair' };

// One hand the bot is building toward. Collapsed: name, points, rough chance and a
// small strip of the finished hand (tiles still needed are gold-ringed). Tap to
// open the sets, what's still needed (with copies left) and the scoring.
export default function IdealHand({ ideal, label }) {
  const [open, setOpen] = useState(false);
  if (!ideal) return null;
  const { groups, points, fans, missing, needTiles, headline, chance } = ideal;

  // Needed tiles grouped by kind: "3-Bamboo ×2 (3 left)".
  const needs = [];
  for (const t of needTiles) {
    const n = needs.find((x) => x.id === t.id);
    if (n) n.count++;
    else needs.push({ id: t.id, count: 1, live: t.live });
  }

  return (
    <div className="rounded-xl bg-jade-dark/70 ring-1 ring-gold/25">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-2.5"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {label && <div className="text-[9px] uppercase tracking-wider text-gold/70">{label}</div>}
            <div className="text-sm font-bold text-cream truncate">{headline}</div>
            <div className="text-[10px] text-cream/55">
              {missing === 0 ? 'complete — declare it 🀄' : `${missing} tile${missing === 1 ? '' : 's'} to go`}
              {typeof chance === 'number' && missing > 0 && ` · ~${Math.max(1, Math.round(chance * 100))}% rough chance`}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-gold font-extrabold text-base leading-none">{points}</span>
            <span className="text-[10px] text-cream/50"> pts</span>
            <div className="text-[10px] text-gold/70 mt-0.5">{open ? '▲ less' : '▼ more'}</div>
          </div>
        </div>

        {/* The finished hand at a glance */}
        <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
          {groups.map((g, gi) => (
            <div key={gi} className="flex gap-px">
              {g.tiles.map((t, ti) => (
                <Tile key={ti} id={t.id} size="xs" highlight={!t.have} dead={!t.have && t.live <= 0} />
              ))}
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col items-center">
                <div className="flex gap-0.5">
                  {g.tiles.map((t, ti) => (
                    <Tile key={ti} id={t.id} size="sm" highlight={!t.have} dead={!t.have && t.live <= 0} />
                  ))}
                </div>
                <span className="text-[9px] text-cream/40 mt-0.5">{GROUP_LABEL[g.kind]}</span>
              </div>
            ))}
          </div>
          {needs.length > 0 && (
            <p className="text-[11px] text-cream/75 leading-snug">
              <span className="text-gold/90 font-semibold">Still need: </span>
              {needs.map((n) => `${tileName(n.id)}${n.count > 1 ? ` ×${n.count}` : ''} (${n.live} left)`).join(', ')}
            </p>
          )}
          {fans.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fans.map((f, i) => (
                <span key={i} className="text-[10px] bg-jade-mid/70 text-cream/80 rounded px-1.5 py-0.5">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
