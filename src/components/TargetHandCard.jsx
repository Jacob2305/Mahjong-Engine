import React from 'react';
import Tile from './Tile.jsx';
import { tileToId } from '../engine/tiles.js';

export default function TargetHandCard({ target, rank }) {
  const outs = target.outsTiles.slice(0, 10);
  return (
    <div className="rounded-xl bg-jade-dark/70 p-3 ring-1 ring-gold/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-cream">
            <span className="text-gold/80 mr-1">#{rank}</span>
            {target.name}{' '}
            <span className="text-cream/60 text-sm">{target.nameChinese}</span>
          </div>
          <div className="text-[11px] text-cream/60 mt-0.5">
            {target.shanten <= 0
              ? 'ready'
              : `${target.shanten} useful tile${target.shanten === 1 ? '' : 's'} away`}{' '}
            · {target.outsCount} live cop{target.outsCount === 1 ? 'y' : 'ies'} help
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-gold font-extrabold text-lg leading-none">
            {target.pointValue}
          </div>
          <div className="text-[10px] text-cream/50">pts</div>
        </div>
      </div>

      {outs.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] text-cream/50 mb-1">Tiles that help:</div>
          <div className="flex flex-wrap gap-1">
            {outs.map((t, i) => (
              <Tile key={i} id={tileToId(t)} size="sm" highlight />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
