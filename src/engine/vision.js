// ---------------------------------------------------------------------------
// Photo -> tiles recognition, on the device.
//
// Takes a photo (camera capture or camera roll) of your hand and/or the table and
// returns the tiles it contains, split into "my hand" (the longest row of
// touching tiles) and "discards" (everything else). See detect.js for the rules.
//
// A small YOLO tile model (public/models/mahjong-tiles.onnx) runs in the browser
// with onnxruntime-web: free, no key, no server, offline once loaded. Unlike the
// rest of engine/, this module is NOT pure: it touches the DOM (canvas) and
// downloads the model. The UI always shows the result for review before anything
// is committed, because a misread tile would silently poison the advice.
// ---------------------------------------------------------------------------

import { INPUT_SIZE, MIN_SCORE, letterbox, toTensorData, decode, nms, halfCrops, splitTable } from './detect.js';

// Phone photos are 3000-4000px; the model sees 640px, so downscale early.
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

// Served from public/models/ (copied as-is into dist/ by `npm run build`).
const MODEL_URL = `${import.meta.env.BASE_URL}models/mahjong-tiles.onnx`;

// --- image prep -------------------------------------------------------------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

// Draw any image source (Image, video frame) downscaled to MAX_EDGE and re-encode
// as JPEG. Returns a bare base64 string (no data: prefix) plus a data URL for the
// preview thumbnail.
function encodeSource(source, srcW, srcH) {
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mediaType: 'image/jpeg',
    previewUrl: dataUrl,
    width: w,
    height: h,
  };
}

// A photo file or Blob (camera capture, camera roll, or a live-camera still).
export async function prepareImage(file) {
  const img = await loadImage(file);
  return encodeSource(img, img.width, img.height);
}

// The current frame of a playing <video> (live camera). Same shape as prepareImage().
export function prepareFrame(video) {
  if (!video || !video.videoWidth) throw new Error('The camera is not ready yet — try again in a moment.');
  return encodeSource(video, video.videoWidth, video.videoHeight);
}

// --- recognition ------------------------------------------------------------

// The runtime + model (~25 MB) load only the first time someone scans; the
// browser caches them after that.
let sessionPromise = null;
let ort = null;
function loadSession() {
  sessionPromise ||= (async () => {
    ort = await import('onnxruntime-web/wasm');
    const { default: wasmUrl } = await import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url');
    ort.env.wasm.wasmPaths = { wasm: wasmUrl };
    ort.env.wasm.numThreads = 1; // threads need server headers Netlify Drop doesn't set
    return ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

// Start downloading the model early (e.g. when the photo panel opens).
export function preloadScanner() {
  loadSession().catch(() => {});
}

function loadDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read.'));
    img.src = url;
  });
}

// Run the model on any drawable source (Image, playing <video>) of size w×h, or
// on one part of it (`crop` = { sx, sy, sw, sh }). Returns decoded detections with
// boxes in the full source's pixels.
async function runModel(source, w, h, minScore, crop = { sx: 0, sy: 0, sw: w, sh: h }) {
  const session = await loadSession();
  const box = letterbox(crop.sw, crop.sh);
  const canvas = (runModel.canvas ||= document.createElement('canvas'));
  canvas.width = canvas.height = INPUT_SIZE;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.fillStyle = 'rgb(114,114,114)'; // YOLO's usual padding colour
  g.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  g.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, box.padX, box.padY, box.w, box.h);
  const { data } = g.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const input = new ort.Tensor('float32', toTensorData(data), [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const out = outputs[session.outputNames[0]];
  return decode(out.data, out.dims, box, minScore).map((d) => ({
    ...d,
    x1: d.x1 + crop.sx, x2: d.x2 + crop.sx, y1: d.y1 + crop.sy, y2: d.y2 + crop.sy,
  }));
}

// Live camera: detect tiles in the current video frame, looking at it in two
// overlapping halves (more pixels per tile), and keep weak guesses (score >=
// WEAK_SCORE) so the overlay can show near-misses. Each detection:
// { id, score, x1, y1, x2, y2, counted, inHand } in video pixels. `counted` =
// strong enough to be read; `inHand` = part of the hand row.
export const WEAK_SCORE = 0.15;
export async function detectFrame(video) {
  if (!video || !video.videoWidth) return { dets: [], width: 0, height: 0 };
  const w = video.videoWidth;
  const h = video.videoHeight;
  const parts = [];
  for (const crop of halfCrops(w, h)) parts.push(...(await runModel(video, w, h, WEAK_SCORE, crop)));
  const all = nms(parts);
  const counted = all.filter((d) => d.score >= MIN_SCORE);
  const { hand } = splitTable(counted);
  const handBoxes = new Set(hand.map((t) => t.box.join(',')));
  const dets = all.map((d) => ({
    ...d,
    counted: d.score >= MIN_SCORE,
    inHand: handBoxes.has([d.x1, d.y1, d.x2, d.y2].join(',')),
  }));
  return { dets, width: w, height: h };
}

// image: the result of prepareImage().
// onStatus(text|null): progress for the UI (first-time model download).
// Returns { hand: [{ id, confidence }], discards: [{ id, confidence }], notes }.
export async function recognizeTiles({ image, onStatus = () => {} }) {
  if (!sessionPromise) onStatus('Loading the scanner (first time only)…');
  try {
    await loadSession();
  } catch {
    throw new Error('The scanner could not load. Check your connection and try again.');
  } finally {
    onStatus(null);
  }

  const img = await loadDataUrl(image.previewUrl);
  const { hand, discards } = splitTable(await runModel(img, img.width, img.height));

  let notes = '';
  if (hand.length === 0 && discards.length > 0) {
    notes = 'No row of 5+ tiles found, so everything is treated as discards.';
  }
  return { hand, discards, notes };
}
