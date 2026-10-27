import React, { useState } from 'react';

const WIND_OPTS = [
  ['east', 'E 東'],
  ['south', 'S 南'],
  ['west', 'W 西'],
  ['north', 'N 北'],
];

function WindRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-cream/70 w-20 shrink-0">{label}</span>
      <div className="flex gap-1 flex-1">
        {WIND_OPTS.map(([v, lbl]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              value === v ? 'bg-gold text-jade-dark' : 'bg-jade-mid text-cream/70'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GameContext({ context, onChange }) {
  const [open, setOpen] = useState(true);
  const set = (patch) => onChange({ ...context, ...patch });

  return (
    <div className="rounded-lg bg-jade-dark/50 p-3 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-cream/90">Game Context</span>
        <span className="text-gold text-xs">{open ? '▼ hide' : '▶ show'}</span>
      </button>

      {open && (
        <div className="space-y-3">
          <WindRow
            label="Seat wind"
            value={context.seatWind}
            onChange={(v) => set({ seatWind: v })}
          />
          <WindRow
            label="Prevalent"
            value={context.prevalentWind}
            onChange={(v) => set({ prevalentWind: v })}
          />

        </div>
      )}
    </div>
  );
}
