import React from 'react';
import Tile from './Tile.jsx';
import { tileToId, tileName } from '../engine/tiles.js';

const TYPE_LABEL = { chow: 'Chow 吃', pung: 'Pung 碰', kong: 'Kong 槓' };

export default function MeldAdvice({ advice }) {
  if (!advice) return null;
  const claim = advice.recommendation === 'claim';

  return (
    <div
      className={`rounded-xl p-3 ring-2 ${
        claim ? 'bg-green-900/40 ring-green-400/70' : 'bg-red-900/30 ring-red-400/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Tile id={tileToId(advice.tile)} size="md" />
        <div>
          <div className="text-[11px] text-cream/60">
            Last discard: {tileName(tileToId(advice.tile))}
            {advice.meldType ? ` · ${TYPE_LABEL[advice.meldType]}` : ''}
          </div>
          <div
            className={`font-extrabold text-lg ${
              claim ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {claim ? '✓ CLAIM' : '✗ SKIP'}
          </div>
        </div>
      </div>

      <p className="text-sm text-cream/85 leading-snug">{advice.reason}</p>

      {advice.meldTiles && claim && (
        <div className="mt-2">
          <div className="text-[10px] text-cream/50 mb-1">Resulting meld:</div>
          <div className="flex gap-1">
            {advice.meldTiles.map((t, i) => (
              <Tile key={i} id={t} size="sm" highlight />
            ))}
          </div>
        </div>
      )}

      {typeof advice.shantenIfClaim === 'number' && (
        <div className="mt-2 text-[11px] text-cream/60">
          tiles-from-ready if you claim:{' '}
          <span className="text-cream font-semibold">{advice.shantenIfClaim}</span>
          {'  '}· if you skip:{' '}
          <span className="text-cream font-semibold">{advice.shantenIfSkip}</span>
        </div>
      )}
    </div>
  );
}
