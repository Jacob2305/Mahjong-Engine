import React, { useState } from 'react';
import Tile from './Tile.jsx';

const GROUP_LABEL = { chow: 'run', pung: 'triplet', kong: 'kong', pair: 'pair' };

// One hand the bot is building toward. Collapsed: name, points, rough chance and a
// small strip of the finished hand (tiles still needed are gold-ringed). Tap to
// open the sets, what's still needed (with copies left) and the scoring.
export default function IdealHand({ ideal, label }) {
  const [open, setOpen] = useState(false);
  if (!ideal) return null;
  const { groups, points, fans, fanPoints, missing, headline, chance, selfDrawOnly } = ideal;
  const scoring = fanPoints || fans.map((name) => ({ name, points: null }));
  const toggle = () => setOpen((o) => !o);

  return (
    <div className="rounded-xl bg-jade-dark/70 ring-1 ring-gold/25">
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className="w-full text-left p-2.5 cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {label && <div className="text-[9px] uppercase tracking-wider text-gold/70">{label}</div>}
            <div className="text-sm font-bold text-cream truncate">{headline}</div>
            <div className="text-[10px] text-cream/55">
              {missing === 0 ? 'complete — declare it 🀄' : `${missing} tile${missing === 1 ? '' : 's'} to go`}
              {typeof chance === 'number' && missing > 0 && ` · ~${Math.max(1, Math.round(chance * 100))}% rough chance`}
              {selfDrawOnly && ' · only if you draw the last tile'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-gold font-extrabold text-base leading-none">{points}</span>
            <span className="text-[10px] text-cream/50"> pts</span>
            <div className="text-[10px] text-gold/70 mt-0.5">{open ? '▲ less' : '▼ more'}</div>
          </div>
        </div>

        {/* The finished hand at a glance (the big layout replaces it when open) */}
        {!open && (
        <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
          {groups.map((g, gi) => (
            <div key={gi} className="flex gap-px">
              {g.tiles.map((t, ti) => (
                <Tile key={ti} id={t.id} size="xs" highlight={!t.have} dead={!t.have && t.live <= 0} />
              ))}
            </div>
          ))}
        </div>
        )}
      </div>

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
          {scoring.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {scoring.map((f, i) => (
                <span key={i} className="text-[10px] bg-jade-mid/70 text-cream/80 rounded px-1.5 py-0.5">
                  {f.name}
                  {f.points != null && <span className="text-gold/90 font-semibold"> ({f.points}pt)</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
