import React, { useEffect, useRef, useState } from 'react';

// Full-screen live camera. Hold the phone over the tiles and tap "Read now":
// the current frame goes through the same on-device scan + review as a photo.
// The camera is switched off when this closes.
export default function LiveCamera({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext) {
        setError('The camera needs the https link — open the Netlify site, or localhost on this computer.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 text-cream">
        <span className="text-xs text-cream/70">Hold square-on over the tiles, fill the frame.</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold"
        >
          ✕ Close
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedData={() => setReady(true)}
          className="absolute inset-0 w-full h-full object-contain"
        />
        {error && (
          <div className="absolute inset-x-4 top-1/3 rounded-xl bg-red-900/80 p-3 text-sm text-cream leading-snug">
            {error}
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/70 animate-pulse">
            Starting the camera…
          </div>
        )}
      </div>

      <div className="p-4 pb-6">
        <button
          type="button"
          onClick={() => onCapture(videoRef.current)}
          disabled={!ready || !!error}
          className="w-full rounded-2xl bg-gold text-jade-dark font-extrabold py-4 text-lg shadow-lg
            disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          ◉ Read now
        </button>
      </div>
    </div>
  );
}
