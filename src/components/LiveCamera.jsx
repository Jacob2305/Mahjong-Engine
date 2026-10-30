import React, { useEffect, useRef, useState } from 'react';
import {
  detectFrame,
  preloadScanner,
  prepareImage,
  prepareFrame,
  zoomRegion,
  frameBlob,
} from '../engine/vision.js';
import { markTiles } from '../engine/detect.js';
import { createTracker } from '../engine/tracker.js';
import { tileShort, tileName } from '../engine/tiles.js';
import { liveHand, planLine } from '../engine/liveAdvice.js';
import Tile from './Tile.jsx';

// Box colours on the live view.
const COLORS = {
  sure: '#22c55e', // green: confident, will be read
  check: '#f5b400', // gold: will be read, but worth checking
  weak: '#ef4444', // red, dashed: a weak guess, NOT read
  throw: '#e879f9', // magenta: the tile to throw
};
const ADVICE_HOLD_MS = 2000; // keep the advice up this long if a tile blinks out
const HIGH = 0.75;
const DIGITAL_MAX = 4; // digital zoom limit (the 4K stream has room for it)

// ImageCapture (a real still photo from the camera): Android Chrome. iPhone
// Safari doesn't have it, so the video frame is used there.
const canTakePhoto = typeof window !== 'undefined' && 'ImageCapture' in window;

// Full-screen live camera.
// - Boxes: the tile model runs on the video a few times a second and outlines
//   every tile it sees. Labels are voted across frames (tracker.js) so they settle
//   instead of flickering.
// - Zoom: pinch or the slider. Uses the camera's own zoom where the phone offers
//   it, otherwise crops the 4K picture; either way the model only looks at what's
//   on screen, so zooming in gives every tile more pixels.
// - Read now: with boxes on, adds exactly what the boxes show (green + gold).
//   With boxes off, takes a photo (or the video frame) and scans it.
// - Save frame: downloads what the model sees, for testing and training.
// - Advice: when the hand row is a full hand (14 tiles, minus 3 per claimed set)
//   and steady for two frames, the engine (in a worker, so the video keeps
//   moving) marks the tile to throw and says which hand it's going for.
//   `game` = the app's { melds, discards, context } so the advice matches.
// The camera is switched off when this closes.
export default function LiveCamera({ onCapture, onClose, game = {} }) {
  const melds = game.melds || [];
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackerRef = useRef(createTracker());
  const latestRef = useRef(null); // { dets, split } from the last frame
  const zoomRef = useRef(1);
  const throwRef = useRef(null); // tile id to mark on the video
  const pinchRef = useRef({ pointers: new Map(), d0: 0, z0: 1 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [stats, setStats] = useState(null); // { hand, other, weak, ms }
  const [loadingModel, setLoadingModel] = useState(true);
  const [resolution, setResolution] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomInfo, setZoomInfo] = useState({ hw: false, min: 1, max: DIGITAL_MAX, step: 0.1 });
  const [note, setNote] = useState(null);
  // Advice
  const workerRef = useRef(null);
  const prevKeyRef = useRef(null); // hand seen last frame (must repeat to ask)
  const askedKeyRef = useRef(null); // hand the worker is working on / did
  const seenAtRef = useRef(0); // last time the advised hand was in view
  const adviceRef = useRef(null);
  const [hand, setHand] = useState(null); // liveHand() of the current frame
  const [advice, setAdvice] = useState(null); // { key, summary }
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL('../engine/advise.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const { key, ok, summary } = e.data;
      if (key !== askedKeyRef.current) return; // an older hand
      setThinking(false);
      if (ok) {
        seenAtRef.current = Date.now();
        adviceRef.current = { key, summary };
        setAdvice(adviceRef.current);
      }
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  // Called every frame with liveHand(): ask once the same full hand shows twice.
  const askAdvice = (h) => {
    if (!h.ready) {
      prevKeyRef.current = null;
      return;
    }
    if (adviceRef.current && h.key === adviceRef.current.key) seenAtRef.current = Date.now();
    if (h.key === prevKeyRef.current && h.key !== askedKeyRef.current && workerRef.current) {
      askedKeyRef.current = h.key;
      setThinking(true);
      workerRef.current.postMessage({
        key: h.key,
        state: {
          handIds: h.ids,
          melds,
          discards: game.discards || {},
          context: { ...(game.context || {}), lastDiscard: null },
        },
      });
    }
    prevKeyRef.current = h.key;
  };

  // --- camera ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext) {
        setError('The camera needs the https link — open the Netlify site, or localhost on this computer.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // As much as the camera gives: more pixels per tile for the model.
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        try {
          if (caps.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {
          /* not supported: fine */
        }
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          const start = track.getSettings?.().zoom ?? caps.zoom.min;
          setZoomInfo({ hw: true, min: caps.zoom.min, max: Math.min(caps.zoom.max, 10), step: caps.zoom.step || 0.1 });
          zoomRef.current = start;
          setZoom(start);
        }
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
      } catch (err) {
        if (cancelled) return;
        setError(
          err.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
            : err.name === 'NotFoundError' || err.name === 'OverconstrainedError'
              ? 'No camera was found on this device.'
              : 'The camera could not start. Close other apps using it and try again.',
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // --- zoom -----------------------------------------------------------------
  const digitalZoom = () => (zoomInfo.hw ? 1 : zoomRef.current);
  const region = () => {
    const z = digitalZoom();
    return z > 1.001 ? zoomRegion(videoRef.current, z) : null;
  };
  const applyZoom = (z) => {
    const next = Math.min(zoomInfo.max, Math.max(zoomInfo.min, Math.round(z / zoomInfo.step) * zoomInfo.step));
    if (Math.abs(next - zoomRef.current) < 1e-6) return;
    zoomRef.current = next;
    setZoom(next);
    trackerRef.current.reset(); // boxes move when the view changes
    if (zoomInfo.hw) {
      streamRef.current?.getVideoTracks()[0]
        ?.applyConstraints({ advanced: [{ zoom: next }] })
        .catch(() => {});
    }
  };

  // Pinch with two fingers on the picture.
  const onPointerDown = (e) => {
    const p = pinchRef.current;
    p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pointers.size === 2) {
      const [a, b] = [...p.pointers.values()];
      p.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      p.z0 = zoomRef.current;
    }
  };
  const onPointerMove = (e) => {
    const p = pinchRef.current;
    if (!p.pointers.has(e.pointerId)) return;
    p.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (p.pointers.size === 2) {
      const [a, b] = [...p.pointers.values()];
      applyZoom(p.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / p.d0));
    }
  };
  const onPointerUp = (e) => pinchRef.current.pointers.delete(e.pointerId);

  // --- live boxes -----------------------------------------------------------
  // One detection at a time: the next starts once the last is drawn (plus a short
  // rest so the phone doesn't run hot).
  useEffect(() => {
    if (!ready || !showBoxes || capturing) {
      clearCanvas(canvasRef.current);
      latestRef.current = null;
      return undefined;
    }
    preloadScanner();
    let stop = false;
    let timer = null;
    const tick = async () => {
      if (stop) return;
      const t0 = performance.now();
      try {
        const raw = await detectFrame(videoRef.current, region());
        if (stop) return;
        const marked = markTiles(trackerRef.current.update(raw));
        latestRef.current = marked;
        setLoadingModel(false);
        const h = liveHand(marked.dets, melds);
        setHand(h);
        askAdvice(h);
        const a = adviceRef.current;
        throwRef.current = a && h.key === a.key && !a.summary.win ? a.summary.discard?.id : null;
        draw(canvasRef.current, videoRef.current, marked.dets, digitalZoom(), throwRef.current);
        setStats({
          hand: marked.dets.filter((d) => d.inHand).length,
          other: marked.dets.filter((d) => d.counted && !d.inHand).length,
          weak: marked.dets.filter((d) => !d.counted).length,
          ms: Math.round(performance.now() - t0),
        });
      } catch {
        if (!stop) setError('The scanner could not load. Check your connection and try again.');
        return;
      }
      timer = setTimeout(tick, 150);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [ready, showBoxes, capturing, zoomInfo]);

  // --- actions --------------------------------------------------------------
  const readNow = async () => {
    const live = showBoxes ? latestRef.current : null;
    const r = region();
    setCapturing(true);
    try {
      // Boxes on: add what they show (steady, voted labels).
      if (live && live.split.hand.length + live.split.discards.length > 0) {
        const notes = live.split.hand.length === 0 ? 'No row of 5+ tiles found, so everything is treated as discards.' : '';
        onCapture({ image: prepareFrame(videoRef.current, r), result: { ...live.split, notes } });
        return;
      }
      // Boxes off (or nothing seen): a photo, or the video frame.
      let image = null;
      if (canTakePhoto && !r) {
        try {
          const blob = await new window.ImageCapture(streamRef.current.getVideoTracks()[0]).takePhoto();
          image = await prepareImage(blob);
        } catch {
          image = null; // fall back to the video frame
        }
      }
      onCapture({ image: image || prepareFrame(videoRef.current, r) });
    } catch (err) {
      setError(err.message);
      setCapturing(false);
    }
  };

  const saveFrame = async () => {
    try {
      const blob = await frameBlob(videoRef.current, region());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `mahjong-frame-${stamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNote('Frame saved');
    } catch (err) {
      setNote(err.message);
    }
    setTimeout(() => setNote(null), 2000);
  };

  // Keep the card up for a moment if a tile blinks out of the row.
  const adviceLive =
    showBoxes && advice && hand && (hand.key === advice.key || Date.now() - seenAtRef.current < ADVICE_HOLD_MS);

  const dz = digitalZoom();
  const hasLiveTiles = showBoxes && stats && stats.hand + stats.other > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-cream">
        <button
          type="button"
          onClick={() => setShowBoxes((b) => !b)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${showBoxes ? 'bg-gold text-jade-dark' : 'bg-white/15'}`}
        >
          ▢ Boxes {showBoxes ? 'on' : 'off'}
        </button>
        <span className="text-[11px] text-cream/70 text-center leading-tight">
          {stats && showBoxes
            ? `Hand row ${stats.hand} · other ${stats.other} · weak ${stats.weak} · ${stats.ms} ms`
            : 'Hold square-on over the tiles'}
          {resolution && <span className="block text-cream/45">camera {resolution}</span>}
        </span>
        <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold">
          ✕ Close
        </button>
      </div>

      <div
        className="flex-1 relative overflow-hidden"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedData={(e) => {
            setReady(true);
            setResolution(`${e.currentTarget.videoWidth}×${e.currentTarget.videoHeight}`);
          }}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: dz > 1 ? `scale(${dz})` : undefined }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        {error && (
          <div className="absolute inset-x-4 top-1/3 rounded-xl bg-red-900/80 p-3 text-sm text-cream leading-snug">
            {error}
          </div>
        )}
        {!error && (!ready || (showBoxes && loadingModel)) && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-cream/80 animate-pulse">
              {!ready ? 'Starting the camera…' : 'Loading the scanner (first time only)…'}
            </span>
          </div>
        )}
        {showBoxes && ready && !error && (
          <AdviceCard advice={adviceLive ? advice.summary : null} hand={hand} thinking={thinking} />
        )}
        {note && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-cream">{note}</span>
          </div>
        )}
      </div>

      {/* zoom */}
      <div className="flex items-center gap-2 px-4 pt-2 text-cream">
        <span className="text-[11px] w-10 tabular-nums">{zoom.toFixed(1)}×</span>
        <input
          type="range"
          min={zoomInfo.min}
          max={zoomInfo.max}
          step={zoomInfo.step}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="flex-1 accent-amber-400"
          aria-label="Zoom"
        />
        {[1, 2, 3].filter((z) => z >= zoomInfo.min && z <= zoomInfo.max).map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => applyZoom(z)}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${Math.abs(zoom - z) < 0.05 ? 'bg-gold text-jade-dark' : 'bg-white/15'}`}
          >
            {z}×
          </button>
        ))}
      </div>

      {showBoxes && (
        <div className="flex justify-center gap-3 px-3 pt-2 text-[10px] text-cream/75">
          <Legend color={COLORS.sure} label="sure" />
          <Legend color={COLORS.check} label="check" />
          <Legend color={COLORS.weak} label="weak, not read" dashed />
          <Legend color={COLORS.throw} label="throw" />
          <span className="text-cream/50">thick = hand row</span>
        </div>
      )}
      <div className="flex gap-2 p-4 pb-2">
        <button
          type="button"
          onClick={saveFrame}
          disabled={!ready || !!error}
          className="rounded-2xl bg-white/15 text-cream text-xs font-semibold px-3 disabled:opacity-40"
        >
          ⤓ Save
          <br />
          frame
        </button>
        <button
          type="button"
          onClick={readNow}
          disabled={!ready || !!error || capturing}
          className="flex-1 rounded-2xl bg-gold text-jade-dark font-extrabold py-4 text-lg shadow-lg
            disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {capturing ? 'Reading…' : '◉ Read now'}
        </button>
      </div>
      <p className="pb-4 text-center text-[10px] text-cream/45">
        {hasLiveTiles
          ? 'Read now adds what the boxes show (green + gold)'
          : canTakePhoto && dz <= 1
            ? 'Read now takes a full photo and scans it'
            : 'Read now scans the current view'}
        {zoomInfo.hw ? ' · camera zoom' : ' · digital zoom'}
      </p>
    </div>
  );
}

// Top-left of the video: what to throw and the plan, in a couple of lines.
function AdviceCard({ advice, hand, thinking }) {
  let body;
  if (advice?.win) {
    body = (
      <div>
        <div className="text-sm font-extrabold text-gold">🀄 Declare the win · {advice.win.points} pts</div>
        <div className="text-[10px] text-cream/75 leading-snug">{advice.win.fans.join(' · ')}</div>
      </div>
    );
  } else if (advice?.discard) {
    body = (
      <div className="flex items-start gap-2">
        <div className="shrink-0 rounded-md ring-2 ring-fuchsia-400">
          <Tile id={advice.discard.id} size="sm" />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold text-fuchsia-300">Throw {tileName(advice.discard.id)}</div>
          <div className="text-[10px] text-cream/80 leading-snug">{planLine(advice.plan)}</div>
        </div>
      </div>
    );
  } else if (hand?.problem) {
    body = <div className="text-[11px] text-amber-300">Check the hand: {hand.problem}</div>;
  } else if (thinking) {
    body = <div className="text-[11px] text-cream/80 animate-pulse">Thinking about your hand…</div>;
  } else if (hand && hand.have > 0) {
    body = (
      <div className="text-[11px] text-cream/70">
        Hand row {hand.have}/{hand.need} — get the whole hand in the row for advice
      </div>
    );
  } else {
    return null;
  }
  return (
    <div className="absolute left-2 top-2 max-w-[78%] rounded-xl bg-black/70 px-2.5 py-2 pointer-events-none">
      {body}
    </div>
  );
}

function Legend({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ border: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      {label}
    </span>
  );
}

function clearCanvas(canvas) {
  canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// Draw detections (video pixels) onto the overlay canvas, matching the video's
// object-contain placement and its digital zoom (CSS scale about the centre).
function draw(canvas, video, dets, zoom = 1, throwId = null) {
  if (!canvas || !video) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cw, ch);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const s = Math.min(cw / vw, ch / vh) * zoom;
  const px = (x) => cw / 2 + (x - vw / 2) * s;
  const py = (y) => ch / 2 + (y - vh / 2) * s;

  g.font = 'bold 11px system-ui, sans-serif';
  g.textBaseline = 'bottom';
  // The tile to throw: one hand-row box with that id (rightmost, if several).
  const throwBox = throwId
    ? dets.filter((d) => d.inHand && d.id === throwId).sort((a, b) => b.x1 - a.x1)[0]
    : null;
  for (const d of dets) {
    const x = px(d.x1);
    const y = py(d.y1);
    const w = (d.x2 - d.x1) * s;
    const h = (d.y2 - d.y1) * s;
    const color = !d.counted ? COLORS.weak : d.score >= HIGH ? COLORS.sure : COLORS.check;
    g.strokeStyle = color;
    g.lineWidth = d.inHand ? 3 : 2;
    g.setLineDash(d.counted ? [] : [4, 3]);
    g.strokeRect(x, y, w, h);

    const label = `${tileShort(d.id)} ${Math.round(d.score * 100)}`;
    const tw = g.measureText(label).width + 6;
    const ly = y > 14 ? y : y + h + 14; // above the box, or below if at the top edge
    g.setLineDash([]);
    g.fillStyle = color;
    g.fillRect(x, ly - 14, tw, 14);
    g.fillStyle = '#000';
    g.fillText(label, x + 3, ly - 1);
  }
  if (throwBox) {
    const x = px(throwBox.x1);
    const y = py(throwBox.y1);
    const w = (throwBox.x2 - throwBox.x1) * s;
    const h = (throwBox.y2 - throwBox.y1) * s;
    g.setLineDash([]);
    g.strokeStyle = COLORS.throw;
    g.lineWidth = 5;
    g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    const tag = '✕ THROW';
    const tw = g.measureText(tag).width + 8;
    g.fillStyle = COLORS.throw;
    g.fillRect(x + w / 2 - tw / 2, y + h + 5, tw, 15);
    g.fillStyle = '#000';
    g.fillText(tag, x + w / 2 - tw / 2 + 4, y + h + 19);
  }
}
