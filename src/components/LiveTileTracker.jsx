import React from 'react';
import Tile from './Tile.jsx';
import { PICKER_SECTIONS } from '../engine/tiles.js';

// Color-coded reference grid: green 3-4 live, amber 1-2, red/dead 0.
export default function LiveTileTracker({ liveTileMap }) {
  return (
    <div className="space-y-2">
      {PICKER_SECTIONS.filter((s) => s.label !== 'Flowers / Seasons').map((section) => (
        <div key={section.label}>
          <div className="text-[10px] uppercase tracking-wide text-gold/70 mb-1">
            {section.label}
          </div>
          <div className="flex flex-wrap gap-1">
            {section.ids.map((id) => {
              const info = liveTileMap[id] || { live: 4 };
              const live = info.live;
              const dead = live <= 0;
              const dim = live >= 1 && live <= 2;
              return (
                <div key={id} className="flex flex-col items-center">
                  <Tile id={id} size="sm" dead={dead} dim={dim} />
                  <span
                    className={`text-[9px] font-bold ${
                      dead
                        ? 'text-red-400'
                        : dim
                        ? 'text-amber-300'
                        : 'text-green-300'
                    }`}
                  >
                    {live}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
