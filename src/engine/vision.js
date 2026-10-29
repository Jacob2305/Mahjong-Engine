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

import { INPUT_SIZE, letterbox, toTensorData, decode, splitTable } from './detect.js';

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

// Downscale to MAX_EDGE and re-encode as JPEG. Returns a bare base64 string (no
// data: prefix, no newlines) plus a data URL for the preview thumbnail.
export async function prepareImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mediaType: 'image/jpeg',
    previewUrl: dataUrl,
    width: w,
    height: h,
  };
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

// image: the result of prepareImage().
// onStatus(text|null): progress for the UI (first-time model download).
// Returns { hand: [{ id, confidence }], discards: [{ id, confidence }], notes }.
export async function recognizeTiles({ image, onStatus = () => {} }) {
  if (!sessionPromise) onStatus('Loading the scanner (first time only)…');
  let session;
  try {
    session = await loadSession();
  } catch {
    throw new Error('The scanner could not load. Check your connection and try again.');
  } finally {
    onStatus(null);
  }

  const img = await loadDataUrl(image.previewUrl);
  const box = letterbox(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = INPUT_SIZE;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.fillStyle = 'rgb(114,114,114)'; // YOLO's usual padding colour
  g.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  g.drawImage(img, box.padX, box.padY, box.w, box.h);
  const { data } = g.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const input = new ort.Tensor('float32', toTensorData(data), [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const outputs = await session.run({ [session.inputNames[0]]: input });
  const out = outputs[session.outputNames[0]];
  const { hand, discards } = splitTable(decode(out.data, out.dims, box));

  let notes = '';
  if (hand.length === 0 && discards.length > 0) {
    notes = 'No row of 5+ tiles found, so everything is treated as discards.';
  }
  return { hand, discards, notes };
}
