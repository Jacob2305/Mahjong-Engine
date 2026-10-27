import React, { useRef } from 'react';
import Tile from './Tile.jsx';
import { TILE_IDS } from '../engine/tiles.js';

const ALL_IDS = TILE_IDS;

const HOLD_MS = 420; // press-and-hold threshold
const MOVE_TOL = 12; // px of movement that cancels a press (i.e. a scroll)

// A single picker tile that distinguishes a quick tap from a press-and-hold.
// The highlighted zone gets the tap; the other zone gets the hold:
//   • tap            → adds to `tapTarget`
//   • press & hold   → adds to `holdTarget`
// This lets the whole flow happen from the picker without switching zones.
function PickerTile({ id, dead, onPick, tapTarget, holdTarget }) {
  const timer = useRef(null);
  const longFired = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (dead) return;
    longFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timer.current = setTimeout(() => {
      longFired.current = true;
      timer.current = null;
      if (navigator.vibrate) navigator.vibrate(15);
      onPick(id, holdTarget);
    }, HOLD_MS);
  };

  const onPointerMove = (e) => {
    if (!timer.current && !longFired.current) return;
    const dx = Math.abs(e.clientX - start.current.x);
    const dy = Math.abs(e.clientY - start.current.y);
    if (dx > MOVE_TOL || dy > MOVE_TOL) clearTimer(); // treat as a scroll
  };

  const onPointerUp = () => {
    if (longFired.current) return; // hold already added to hand
    if (!timer.current) return; // canceled by scroll / leave
    clearTimer();
    onPick(id, tapTarget);
  };

  const cancel = () => clearTimer();

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="select-none-app"
      style={{ touchAction: 'pan-y' }}
    >
      <Tile id={id} size="md" dead={dead} onClick={() => {}} />
    </div>
  );
}

const ZONE_LABEL = { hand: 'your Hand', discards: 'Seen Discards' };

// Compact one-box picker. Tap goes to the highlighted zone; press & hold goes to
// the other one. Tiles with no live copies left are shown struck through.
export default function TilePicker({ remaining, onPick, zone }) {
  const tapTarget = zone === 'hand' ? 'hand' : 'discards';
  const holdTarget = tapTarget === 'hand' ? 'discards' : 'hand';

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-cream/55 leading-snug">
        <span className="text-gold font-semibold">Tap</span> → {ZONE_LABEL[tapTarget]}
        <span className="text-cream/30"> · </span>
        <span className="text-gold font-semibold">Press &amp; hold</span> → {ZONE_LABEL[holdTarget]}
      </p>
      <div className="flex flex-wrap gap-1 justify-center">
        {ALL_IDS.map((id) => (
          <PickerTile
            key={id}
            id={id}
            dead={remaining(id) <= 0}
            onPick={onPick}
            tapTarget={tapTarget}
            holdTarget={holdTarget}
          />
        ))}
      </div>
    </div>
  );
}
