import React, { useRef, useState } from 'react';
import Tile from './Tile.jsx';
import { prepareImage, recognizeTiles, preloadScanner } from '../engine/vision.js';
import { isBonus } from '../engine/tiles.js';

const SECTIONS = [
  { key: 'hand', label: 'My hand', hint: 'the longest row of tiles' },
  { key: 'discards', label: 'Discards', hint: 'everything else on the table' },
];

// Photo -> tiles. One photo of the table: the on-device model reads every tile,
// the longest row becomes your hand and the rest become discards. You review the
// result, then both go in at once.
//
// The review step is not optional by design: recognition is good but not perfect,
// and a single misread tile changes every discard recommendation. Nothing reaches
// the engine until you have looked at it.
export default function PhotoImport({ onImport, remaining }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null); // { hand: [...], discards: [...], notes }
  const [selected, setSelected] = useState(null); // { section, index }
  const fileRef = useRef(null);

  const reset = () => {
    setResult(null);
    setPreview(null);
    setError(null);
    setSelected(null);
  };

  const askForPhoto = () => {
    reset();
    // Reset .value so re-picking the same file still fires onChange.
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const image = await prepareImage(file);
      setPreview(image.previewUrl);
      const res = await recognizeTiles({ image, onStatus: setStatus });
      setResult(res);
      if (res.hand.length + res.discards.length === 0) {
        setError('No tiles were recognised in that photo. Try better light, or get closer.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const removeSelected = () => {
    const { section, index } = selected;
    setResult((r) => ({ ...r, [section]: r[section].filter((_, i) => i !== index) }));
    setSelected(null);
  };
  const moveSelected = () => {
    const { section, index } = selected;
    const other = section === 'hand' ? 'discards' : 'hand';
    setResult((r) => ({
      ...r,
      [section]: r[section].filter((_, i) => i !== index),
      [other]: [...r[other], r[section][index]],
    }));
    setSelected(null);
  };

  // Flag any tile that would push a type past its four physical copies, usually a
  // sign of a double-counted tile. Counted across both sections, hand first.
  const overflow = { hand: new Set(), discards: new Set() };
  if (result) {
    const used = {};
    for (const { key } of SECTIONS) {
      result[key].forEach((t, i) => {
        used[t.id] = (used[t.id] || 0) + 1;
        if (used[t.id] > remaining(t.id)) overflow[key].add(i);
      });
    }
  }
  const keep = (key) => (result ? result[key].filter((_, i) => !overflow[key].has(i)) : []);
  const keepHand = keep('hand');
  const keepDiscards = keep('discards');
  const total = keepHand.length + keepDiscards.length;
  const lowCount = [...keepHand, ...keepDiscards].filter((t) => t.confidence === 'low').length;
  const overflowCount = overflow.hand.size + overflow.discards.size;

  const commit = () => {
    const res = onImport({ hand: keepHand.map((t) => t.id), discards: keepDiscards.map((t) => t.id) });
    reset();
    if (res && res.skipped > 0) {
      setError(
        `Added ${res.added}. Skipped ${res.skipped} that would not fit — check the ` +
          'hand size and the copies already logged.',
      );
    }
  };

  return (
    <div className="rounded-lg bg-jade-dark/50 p-2.5">
      <button
        type="button"
        onClick={() => {
          if (!open) preloadScanner();
          setOpen((o) => !o);
        }}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-cream/90">📷 Fill from a photo</span>
        <span className="text-gold text-xs">{open ? '▼ hide' : '▶ show'}</span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5">
          {/* --- capture -------------------------------------------------- */}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            type="button"
            onClick={askForPhoto}
            disabled={busy}
            className="w-full rounded-xl bg-jade-mid text-cream text-sm font-bold py-2.5
              leading-tight disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            📷 Scan the table
            <span className="block text-[10px] font-normal text-cream/60">
              your hand in a row, discards anywhere around it
            </span>
          </button>
          <p className="text-[10px] text-cream/40 leading-snug">
            Opens your camera or photo library. Line your tiles up in one touching row;
            the longest row becomes your hand and every other face-up tile counts as a
            discard. Runs on your phone, free, no key needed.
          </p>

          {/* --- busy ----------------------------------------------------- */}
          {busy && (
            <div className="flex items-center gap-2.5 rounded-lg bg-jade-dark/70 p-2.5">
              {preview && <img src={preview} alt="" className="w-12 h-12 object-cover rounded-md" />}
              <span className="text-xs text-cream/80 animate-pulse">{status || 'Reading the tiles…'}</span>
            </div>
          )}

          {/* --- error ---------------------------------------------------- */}
          {error && !busy && (
            <div className="text-[11px] text-red-300 bg-red-900/30 rounded-md px-2 py-1.5 leading-snug">
              {error}
            </div>
          )}

          {/* --- review --------------------------------------------------- */}
          {result && result.hand.length + result.discards.length > 0 && !busy && (
            <div className="rounded-xl bg-jade-dark/70 ring-1 ring-gold/30 p-2.5 space-y-2.5">
              <div className="flex items-start gap-2.5">
                {preview && (
                  <img src={preview} alt="the photo you took" className="w-14 h-14 object-cover rounded-md shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gold">
                    Found {result.hand.length + result.discards.length} tiles
                  </div>
                  <p className="text-[10px] text-cream/60 leading-snug mt-0.5">
                    Tap a tile to remove it or move it to the other group.
                  </p>
                </div>
              </div>

              {SECTIONS.map(({ key, label, hint }) => (
                <div key={key}>
                  <div className="text-[11px] font-bold text-cream/80 mb-1">
                    {label} · {result[key].length}{' '}
                    <span className="font-normal text-cream/40">{hint}</span>
                  </div>
                  {result[key].length === 0 ? (
                    <div className="text-[10px] text-cream/35 px-1">none</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {result[key].map((t, i) => {
                        const isSel = selected && selected.section === key && selected.index === i;
                        return (
                          <div key={i} className={`flex flex-col items-center rounded-md ${isSel ? 'bg-gold/30 p-0.5' : ''}`}>
                            <Tile
                              id={t.id}
                              size="md"
                              onClick={() => setSelected(isSel ? null : { section: key, index: i })}
                              highlight={t.confidence === 'low'}
                              dead={overflow[key].has(i)}
                            />
                            {overflow[key].has(i) ? (
                              <span className="text-[8px] font-bold text-red-400">
                                {isBonus(t.id) ? 'have it' : '5th copy'}
                              </span>
                            ) : t.confidence === 'low' ? (
                              <span className="text-[8px] font-bold text-gold/90">check</span>
                            ) : (
                              <span className="text-[8px] text-transparent">ok</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {selected && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={moveSelected}
                    className="flex-1 rounded-lg bg-jade-mid text-cream text-xs font-semibold py-1.5"
                  >
                    ⇅ Move to {selected.section === 'hand' ? 'discards' : 'my hand'}
                  </button>
                  <button
                    type="button"
                    onClick={removeSelected}
                    className="flex-1 rounded-lg bg-red-900/60 text-cream text-xs font-semibold py-1.5"
                  >
                    ✕ Remove
                  </button>
                </div>
              )}

              {(lowCount > 0 || overflowCount > 0 || result.notes) && (
                <div className="space-y-1">
                  {overflowCount > 0 && (
                    <p className="text-[10px] text-red-300 leading-snug">
                      {overflowCount} tile{overflowCount === 1 ? '' : 's'} struck through would be a
                      5th copy of a type — they will not be added.
                    </p>
                  )}
                  {lowCount > 0 && (
                    <p className="text-[10px] text-gold/80 leading-snug">
                      {lowCount} gold-ringed tile{lowCount === 1 ? '' : 's'} came back as uncertain —
                      worth a second look.
                    </p>
                  )}
                  {result.notes && <p className="text-[10px] text-cream/60 leading-snug">◦ {result.notes}</p>}
                </div>
              )}
              <p className="text-[10px] text-cream/40 leading-snug">
                Your own claimed sets: add them with “+ add a claimed meld”. If they sat apart
                from your row in the photo, they’ll show under Discards — remove them there.
              </p>

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={commit}
                  disabled={total === 0}
                  className="flex-1 rounded-xl bg-gold text-jade-dark text-xs font-extrabold py-2 disabled:opacity-40"
                >
                  Add {keepHand.length} to hand, {keepDiscards.length} to discards
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 rounded-xl bg-jade-mid text-cream/60 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
