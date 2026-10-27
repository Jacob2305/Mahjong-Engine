import React from 'react';
import Tile from './Tile.jsx';

const GROUP_LABEL = { chow: 'run', pung: 'triplet', kong: 'kong', pair: 'pair' };

// Renders the concrete hand the bot is building toward: every set laid out as a
// full 14-tile hand. Tiles you already hold show plain; tiles you still need are
// gold-ringed (and struck through if every copy is already gone).
export default function IdealHand({ ideal }) {
  if (!ideal) return null;
  const { groups, points, fans, missing, needTiles, headline } = ideal;
  const deadNeeded = needTiles.filter((t) => t.live <= 0).length;

  return (
    <div className="rounded-xl bg-jade-dark/70 p-3 ring-1 ring-gold/30">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-bold text-cream">{headline}</div>
          <div className="text-[11px] text-cream/60">
            {missing === 0
              ? 'complete — ready to declare 🀄'
              : `${missing} tile${missing === 1 ? '' : 's'} still to draw`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-gold font-extrabold text-lg leading-none">{points}</span>
          <span className="text-[10px] text-cream/50"> pts</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col items-center">
            <div className="flex gap-0.5">
              {g.tiles.map((t, ti) => (
                <Tile
                  key={ti}
                  id={t.id}
                  size="sm"
                  highlight={!t.have}
                  dead={!t.have && t.live <= 0}
                />
              ))}
            </div>
            <span className="text-[9px] text-cream/40 mt-0.5">{GROUP_LABEL[g.kind]}</span>
          </div>
        ))}
      </div>

      {missing > 0 && (
        <p className="text-[10px] text-gold/80 mt-2">
          ◦ gold-ringed = still need to draw
          {deadNeeded > 0 && (
            <span className="text-red-400">
              {' '}
              ({deadNeeded} of them already dead — this goal may be blocked)
            </span>
          )}
        </p>
      )}

      {fans.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {fans.map((f, i) => (
            <span
              key={i}
              className="text-[10px] bg-jade-mid/70 text-cream/80 rounded px-1.5 py-0.5"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
