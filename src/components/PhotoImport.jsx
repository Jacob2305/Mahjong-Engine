import React, { useRef, useState } from 'react';
import Tile from './Tile.jsx';
import LiveCamera from './LiveCamera.jsx';
import { prepareImage, prepareFrame, recognizeTiles, preloadScanner } from '../engine/vision.js';
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null); // { hand: [...], discards: [...], notes }
  const [selected, setSelected] = useState(null); // { section, index }
  const [drag, setDrag] = useState(null); // { section, index, id, x, y, over }
  const [camera, setCamera] = useState(false);
  const fileRef = useRef(null);
  const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const sectionRefs = { hand: useRef(null), discards: useRef(null) };
  const press = useRef(null);
  const justDragged = useRef(false); // swallow the click that follows a drag

  const reset = () => {
    setResult(null);
    setPreview(null);
    setError(null);
    setSelected(null);
  };

  const askForPhoto = () => {
    preloadScanner();
    reset();
    // Reset .value so re-picking the same file still fires onChange.
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  // Photo or camera frame -> recognised tiles -> review screen.
  // `getImage` returns the prepared image (prepareImage / prepareFrame).
  const scan = async (getImage) => {
    reset();
    setBusy(true);
    try {
      const image = await getImage();
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

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) scan(() => prepareImage(file));
  };

  const openCamera = () => {
    preloadScanner();
    reset();
    setCamera(true);
  };

  // Grab the frame before the camera closes, then scan it like a photo.
  const onCameraCapture = (video) => {
    let image;
    try {
      image = prepareFrame(video);
    } catch (err) {
      setError(err.message);
      return;
    }
    setCamera(false);
    scan(() => image);
  };

  // Move one tile to the end of the other section.
  const moveTile = (section, index) => {
    const other = section === 'hand' ? 'discards' : 'hand';
    setResult((r) => ({
      ...r,
      [section]: r[section].filter((_, i) => i !== index),
      [other]: [...r[other], r[section][index]],
    }));
    setSelected(null);
  };

  // --- drag a tile to the other section (pointer events: touch + mouse) ------
  const sectionAt = (x, y) => {
    for (const { key } of SECTIONS) {
      const r = sectionRefs[key].current?.getBoundingClientRect();
      if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  };
  const onPointerDown = (e, section, index, id) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { section, index, id, x0: e.clientX, y0: e.clientY, dragging: false };
  };
  const onPointerMove = (e) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 8) return;
    p.dragging = true;
    setDrag({ section: p.section, index: p.index, id: p.id, x: e.clientX, y: e.clientY, over: sectionAt(e.clientX, e.clientY) });
  };
  const onPointerUp = (e) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    justDragged.current = p.dragging;
    if (!p.dragging) return; // a tap: onClick selects the tile
    setDrag(null);
    const over = sectionAt(e.clientX, e.clientY);
    if (over && over !== p.section) moveTile(p.section, p.index);
  };
  const onPointerCancel = () => {
    press.current = null;
    setDrag(null);
  };

  const removeSelected = () => {
    const { section, index } = selected;
    setResult((r) => ({ ...r, [section]: r[section].filter((_, i) => i !== index) }));
    setSelected(null);
  };
  const moveSelected = () => moveTile(selected.section, selected.index);

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
        <div className="space-y-2.5">
          {/* --- capture -------------------------------------------------- */}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          <button
            type="button"
            onClick={askForPhoto}
            disabled={busy}
            className="w-full rounded-xl bg-jade-mid text-cream text-sm font-bold py-2.5
              leading-tight disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            📷 Scan hand/table
            <span className="block text-[10px] font-normal text-cream/60">
              tiles in a row are your hand, everything else is counted as discards
            </span>
          </button>
          {hasCamera && (
            <button
              type="button"
              onClick={openCamera}
              disabled={busy}
              className="w-full rounded-xl bg-jade-mid/70 text-cream text-sm font-bold py-2
                leading-tight disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              🎥 Live camera
              <span className="block text-[10px] font-normal text-cream/60">
                point at the tiles and tap Read now
              </span>
            </button>
          )}

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
                    Drag a tile to the other group if it landed on the wrong side, or tap it to remove it.
                  </p>
                </div>
              </div>

              {SECTIONS.map(({ key, label, hint }) => (
                <div
                  key={key}
                  ref={sectionRefs[key]}
                  className={`rounded-lg p-1.5 -mx-1.5 transition-colors ${
                    drag && drag.over === key && drag.section !== key ? 'bg-gold/20 ring-2 ring-gold' : ''
                  }`}
                >
                  <div className="text-[11px] font-bold text-cream/80 mb-1">
                    {label} · {result[key].length}{' '}
                    <span className="font-normal text-cream/40">{hint}</span>
                  </div>
                  {result[key].length === 0 ? (
                    <div className="text-[10px] text-cream/35 px-1 py-3">none — drag tiles here</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {result[key].map((t, i) => {
                        const isSel = selected && selected.section === key && selected.index === i;
                        const dragging = drag && drag.section === key && drag.index === i;
                        return (
                          <div
                            key={i}
                            className={`flex flex-col items-center rounded-md ${isSel ? 'bg-gold/30 p-0.5' : ''} ${dragging ? 'opacity-30' : ''}`}
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => onPointerDown(e, key, i, t.id)}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerCancel}
                            onClick={() => {
                              if (justDragged.current) {
                                justDragged.current = false;
                                return;
                              }
                              setSelected(isSel ? null : { section: key, index: i });
                            }}
                          >
                            <Tile
                              id={t.id}
                              size="md"
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

      {camera && <LiveCamera onCapture={onCameraCapture} onClose={() => setCamera(false)} />}

      {/* The tile being dragged follows the finger. */}
      {drag && (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - 18, top: drag.y - 30 }}>
          <Tile id={drag.id} size="md" />
        </div>
      )}
    </div>
  );
}
