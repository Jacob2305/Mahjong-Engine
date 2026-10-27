import React, { useRef, useState } from 'react';
import Tile from './Tile.jsx';
import { prepareImage, recognizeTiles } from '../engine/vision.js';
import { isBonus } from '../engine/tiles.js';

// Photo -> tiles. Snap your hand or the table, Claude reads the tiles, you review
// the result, then it goes into the hand or the discard pool.
//
// The review step is not optional by design: recognition is good but not perfect,
// and a single misread tile changes every discard recommendation. Nothing reaches
// the engine until you have looked at it.
export default function PhotoImport({ onImport, remaining, apiKey, onApiKeyChange }) {
  const [open, setOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [mode, setMode] = useState('hand');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null); // { tiles:[{id,confidence}], notes }
  const fileRef = useRef(null);
  const pendingMode = useRef('hand');

  const needsKey = !apiKey;

  const reset = () => {
    setResult(null);
    setPreview(null);
    setError(null);
  };

  const askForPhoto = (m) => {
    pendingMode.current = m;
    setMode(m);
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
      const res = await recognizeTiles({ image, mode: pendingMode.current, apiKey });
      setResult(res);
      if (res.tiles.length === 0) {
        setError('No tiles were recognised in that photo. Try better light, or get closer.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Drop a tile the recognition got wrong.
  const removeAt = (i) => {
    setResult((r) => {
      if (!r) return r;
      const tiles = r.tiles.slice();
      tiles.splice(i, 1);
      return { ...r, tiles };
    });
  };

  // Flag any tile that would push a type past its four physical copies — usually
  // the sign of a double-counted tile in the photo.
  const overflow = new Set();
  if (result) {
    const used = {};
    result.tiles.forEach((t, i) => {
      used[t.id] = (used[t.id] || 0) + 1;
      if (used[t.id] > remaining(t.id)) overflow.add(i);
    });
  }

  const keepable = result ? result.tiles.filter((_, i) => !overflow.has(i)) : [];
  const lowCount = keepable.filter((t) => t.confidence === 'low').length;

  const commit = (target) => {
    const res = onImport(keepable.map((t) => t.id), target);
    reset();
    if (res && res.skipped > 0) {
      setError(
        `Added ${res.added}. Skipped ${res.skipped} that would not fit — check the ` +
          'hand size and the copies already logged.',
      );
    }
  };

  const saveKey = () => {
    onApiKeyChange(keyDraft.trim());
    setKeyDraft('');
    setEditingKey(false);
  };

  return (
    <div className="rounded-lg bg-jade-dark/50 p-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-semibold text-cream/90">📷 Fill from a photo</span>
        <span className="text-gold text-xs">{open ? '▼ hide' : '▶ show'}</span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5">
          {/* --- API key --------------------------------------------------- */}
          {needsKey || editingKey ? (
            <div className="rounded-lg bg-jade-dark/70 p-2.5 space-y-2">
              <p className="text-[11px] text-cream/70 leading-snug">
                Reading tiles from a photo uses Claude&rsquo;s vision API, so it needs
                your own Anthropic API key. It is stored only in this browser and
                sent only to api.anthropic.com.
              </p>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md bg-jade-deep text-cream text-xs px-2 py-1.5
                  ring-1 ring-white/15 focus:ring-gold outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveKey}
                  disabled={!keyDraft.trim()}
                  className="flex-1 rounded-md bg-gold text-jade-dark text-xs font-bold py-1.5
                    disabled:opacity-40"
                >
                  Save key
                </button>
                {!needsKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingKey(false);
                      setKeyDraft('');
                    }}
                    className="px-3 rounded-md bg-jade-mid text-cream/70 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="block text-[10px] text-gold/80 underline"
              >
                Get a key from the Anthropic Console
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[10px] text-cream/50">
              <span>✓ API key saved in this browser</span>
              <button
                type="button"
                onClick={() => setEditingKey(true)}
                className="text-gold/80 underline"
              >
                change
              </button>
            </div>
          )}

          {/* --- capture buttons ------------------------------------------ */}
          {!needsKey && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => askForPhoto('hand')}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-jade-mid text-cream text-xs font-bold py-2.5
                    leading-tight disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  🀫 My hand
                  <span className="block text-[9px] font-normal text-cream/60">
                    a row of your tiles
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => askForPhoto('table')}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-jade-mid text-cream text-xs font-bold py-2.5
                    leading-tight disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  🀄 The table
                  <span className="block text-[9px] font-normal text-cream/60">
                    discards in the middle
                  </span>
                </button>
              </div>
              <p className="text-[10px] text-cream/40 leading-snug">
                Opens your camera or your photo library. Fill the frame with just the
                tiles and keep them square-on for the best read.
              </p>
            </>
          )}

          {/* --- busy ----------------------------------------------------- */}
          {busy && (
            <div className="flex items-center gap-2.5 rounded-lg bg-jade-dark/70 p-2.5">
              {preview && (
                <img src={preview} alt="" className="w-12 h-12 object-cover rounded-md" />
              )}
              <span className="text-xs text-cream/80 animate-pulse">
                Reading the tiles…
              </span>
            </div>
          )}

          {/* --- error ---------------------------------------------------- */}
          {error && !busy && (
            <div className="text-[11px] text-red-300 bg-red-900/30 rounded-md px-2 py-1.5 leading-snug">
              {error}
            </div>
          )}

          {/* --- review --------------------------------------------------- */}
          {result && result.tiles.length > 0 && !busy && (
            <div className="rounded-xl bg-jade-dark/70 ring-1 ring-gold/30 p-2.5 space-y-2">
              <div className="flex items-start gap-2.5">
                {preview && (
                  <img
                    src={preview}
                    alt="the photo you took"
                    className="w-14 h-14 object-cover rounded-md shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-gold">
                    Found {result.tiles.length} tile{result.tiles.length === 1 ? '' : 's'}
                  </div>
                  <p className="text-[10px] text-cream/60 leading-snug mt-0.5">
                    Check these against your tiles, then tap any wrong one to drop it.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {result.tiles.map((t, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <Tile
                      id={t.id}
                      size="md"
                      onClick={() => removeAt(i)}
                      highlight={t.confidence === 'low'}
                      dead={overflow.has(i)}
                    />
                    {overflow.has(i) ? (
                      <span className="text-[8px] font-bold text-red-400">
                        {isBonus(t.id) ? 'have it' : '5th copy'}
                      </span>
                    ) : t.confidence === 'low' ? (
                      <span className="text-[8px] font-bold text-gold/90">check</span>
                    ) : (
                      <span className="text-[8px] text-transparent">ok</span>
                    )}
                  </div>
                ))}
              </div>

              {(lowCount > 0 || overflow.size > 0 || result.notes) && (
                <div className="space-y-1">
                  {overflow.size > 0 && (
                    <p className="text-[10px] text-red-300 leading-snug">
                      {overflow.size} tile{overflow.size === 1 ? '' : 's'} struck through
                      would be a 5th copy of a type — they will not be added.
                    </p>
                  )}
                  {lowCount > 0 && (
                    <p className="text-[10px] text-gold/80 leading-snug">
                      {lowCount} gold-ringed tile{lowCount === 1 ? '' : 's'} came back as
                      uncertain — worth a second look.
                    </p>
                  )}
                  {result.notes && (
                    <p className="text-[10px] text-cream/60 leading-snug">
                      ◦ {result.notes}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => commit(mode === 'table' ? 'discards' : 'hand')}
                  disabled={keepable.length === 0}
                  className="flex-1 rounded-xl bg-gold text-jade-dark text-xs font-extrabold py-2
                    disabled:opacity-40"
                >
                  Add {keepable.length} to {mode === 'table' ? 'discards' : 'my hand'}
                </button>
                <button
                  type="button"
                  onClick={() => commit(mode === 'table' ? 'hand' : 'discards')}
                  disabled={keepable.length === 0}
                  className="px-3 rounded-xl bg-jade-mid text-cream/80 text-xs font-semibold
                    disabled:opacity-40"
                >
                  {mode === 'table' ? 'to hand' : 'to discards'}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="px-3 rounded-xl bg-jade-mid text-cream/60 text-xs font-semibold"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
