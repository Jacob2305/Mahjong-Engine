import React, { useState } from 'react';
import Tile from './Tile.jsx';
import { TILE_IDS, isSuited } from '../engine/tiles.js';

// Adds a claimed/exposed meld. Pung/Kong = pick any tile. Chow = pick the
// lowest tile of a suited run (1-7 of a suit).
export default function MeldBuilder({ onAdd, remaining }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('pung');

  const handlePick = (id) => {
    let tiles;
    if (type === 'chow') {
      const idx = TILE_IDS.indexOf(id);
      tiles = [TILE_IDS[idx], TILE_IDS[idx + 1], TILE_IDS[idx + 2]];
    } else if (type === 'kong') {
      tiles = [id, id, id, id];
    } else {
      tiles = [id, id, id];
    }
    const ok = onAdd({ type, tiles });
    if (ok) setOpen(false);
  };

  // tiles eligible for the current meld type
  const pickable = TILE_IDS.filter((id) => {
    if (type === 'chow') {
      if (!isSuited(id)) return false;
      const v = Number(id.slice(3));
      return v <= 7; // run start
    }
    const need = type === 'kong' ? 4 : 3;
    return remaining(id) >= need - 0; // rough availability check
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-gold underline"
      >
        {open ? '− cancel meld' : '+ add a claimed meld'}
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-jade-dark/60 p-2 space-y-2">
          <div className="flex gap-1">
            {['pung', 'kong', 'chow'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1 rounded-md text-xs font-semibold capitalize ${
                  type === t ? 'bg-gold text-jade-dark' : 'bg-jade-mid text-cream/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-cream/50">
            {type === 'chow'
              ? 'Pick the lowest tile of the run'
              : `Pick the tile (×${type === 'kong' ? 4 : 3})`}
          </div>
          <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto no-scrollbar">
            {pickable.map((id) => (
              <Tile key={id} id={id} size="sm" onClick={() => handlePick(id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
