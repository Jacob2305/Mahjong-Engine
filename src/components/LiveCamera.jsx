import React, { useEffect, useRef, useState } from 'react';
import { detectFrame, preloadScanner, prepareImage, prepareFrame } from '../engine/vision.js';
import { tileShort } from '../engine/tiles.js';

// Box colours on the live view.
const COLORS = {
  sure: '#22c55e', // green: confident, will be read
  check: '#f5b400', // gold: will be read, but worth checking
  weak: '#ef4444', // red, dashed: a weak guess, NOT read
};
const HIGH = 0.75;

// Full-screen live camera. While it's open the tile model runs on the video a few
// times a second and draws a box around everything it thinks is a tile, so you can
// see what it finds (and what it misses) before tapping "Read now". Read now sends
// the current frame through the same scan + review as a photo. The camera is
// switched off when this closes.
//
// Read now takes a real photo from the camera where the browser allows it
// (ImageCapture: Android Chrome) — sharper than a video frame — and falls back to
// the current video frame elsewhere (iPhone Safari). onCapture gets the image.
const canTakePhoto = typeof window !== 'undefined' && 'ImageCapture' in window;

export default function LiveCamera({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [stats, setStats] = useState(null); // { hand, other, weak, ms }
  const [loadingModel, setLoadingModel] = useState(true);
  const [resolution, setResolution] = useState(null); // 'W×H' the camera actually sends
  const [capturing, setCapturing] = useState(false);

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
          // Ask for as much as the camera gives: more pixels per tile for the model.
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        // Keep refocusing as the phone moves, where supported.
        try {
          const caps = track.getCapabilities?.() || {};
          if (caps.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {
          /* not supported: fine */
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

  // --- live boxes -----------------------------------------------------------
  // One detection at a time: start the next as soon as the last is drawn (plus a
  // short rest so the phone doesn't run hot).
  useEffect(() => {
    if (!ready || !showBoxes || capturing) {
      clearCanvas(canvasRef.current);
      return undefined;
    }
    preloadScanner();
    let stop = false;
    let timer = null;
    const tick = async () => {
      if (stop) return;
      const t0 = performance.now();
      try {
        const res = await detectFrame(videoRef.current);
        if (stop) return;
        setLoadingModel(false);
        draw(canvasRef.current, videoRef.current, res.dets);
        setStats({
          hand: res.dets.filter((d) => d.inHand).length,
          other: res.dets.filter((d) => d.counted && !d.inHand).length,
          weak: res.dets.filter((d) => !d.counted).length,
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
  }, [ready, showBoxes, capturing]);

  const readNow = async () => {
    setCapturing(true);
    let image = null;
    if (canTakePhoto) {
      try {
        const blob = await new window.ImageCapture(streamRef.current.getVideoTracks()[0]).takePhoto();
        image = await prepareImage(blob);
      } catch {
        image = null; // fall back to the video frame
      }
    }
    try {
      image ||= prepareFrame(videoRef.current);
    } catch (err) {
      setError(err.message);
      setCapturing(false);
      return;
    }
    onCapture(image);
  };

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

      <div className="flex-1 relative overflow-hidden">
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
      </div>

      {showBoxes && (
        <div className="flex justify-center gap-3 px-3 pt-2 text-[10px] text-cream/75">
          <Legend color={COLORS.sure} label="sure" />
          <Legend color={COLORS.check} label="check" />
          <Legend color={COLORS.weak} label="weak, not read" dashed />
          <span className="text-cream/50">thick = hand row</span>
        </div>
      )}
      <div className="p-4 pb-6">
        <button
          type="button"
          onClick={readNow}
          disabled={!ready || !!error || capturing}
          className="w-full rounded-2xl bg-gold text-jade-dark font-extrabold py-4 text-lg shadow-lg
            disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {capturing ? 'Taking the photo…' : '◉ Read now'}
        </button>
        <p className="mt-1.5 text-center text-[10px] text-cream/45">
          {canTakePhoto ? 'Read now takes a full photo (sharper than the video)' : 'Read now uses the current video frame'}
        </p>
      </div>
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
// object-contain placement inside the same box.
function draw(canvas, video, dets) {
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
  const s = Math.min(cw / vw, ch / vh);
  const ox = (cw - vw * s) / 2;
  const oy = (ch - vh * s) / 2;

  g.font = 'bold 11px system-ui, sans-serif';
  g.textBaseline = 'bottom';
  for (const d of dets) {
    const x = ox + d.x1 * s;
    const y = oy + d.y1 * s;
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
}
