// ---------------------------------------------------------------------------
// On-device tile detection: turns the YOLO model's raw output into tile ids and
// splits one table photo into "my hand" and "discards".
//
// Pure functions only (no browser APIs), so detect.test.mjs runs them in Node.
// The browser side (loading the model, running it) lives in vision.js.
// Ported from Mahjong-Scoring-Calculator/src/scan/detect.js.
// ---------------------------------------------------------------------------

export const INPUT_SIZE = 640;

// Class order baked into public/models/mahjong-tiles.onnx (from its metadata).
// <number><B bamboo | C characters | D dots | F flower | S season>,
// winds EW/SW/WW/NW, dragons RD/GD/WD.
export const MODEL_CLASSES = [
  '1B', '1C', '1D', '1F', '1S', '2B', '2C', '2D', '2F', '2S', '3B', '3C', '3D', '3F', '3S',
  '4B', '4C', '4D', '4F', '4S', '5B', '5C', '5D', '6B', '6C', '6D', '7B', '7C', '7D',
  '8B', '8C', '8D', '9B', '9C', '9D', 'EW', 'GD', 'NW', 'RD', 'SW', 'WD', 'WW',
];

const HONOURS = {
  EW: 'wind_east', SW: 'wind_south', WW: 'wind_west', NW: 'wind_north',
  RD: 'dragon_red', GD: 'dragon_green', WD: 'dragon_white',
};
const SUIT = { B: 'sou', C: 'man', D: 'pin', F: 'flower', S: 'season' };

// Model class name → this app's tile id (engine/tiles.js).
export function toTileId(cls) {
  return HONOURS[cls] || SUIT[cls[1]] + cls[0];
}

export const MIN_SCORE = 0.3; // drop guesses below this
const NMS_IOU = 0.5;
export const HIGH_CONFIDENCE = 0.75;
const MIN_HAND_ROW = 5; // a row needs at least this many tiles to count as the hand

// Fit an image into the square model input, centred, keeping its shape.
export function letterbox(width, height, size = INPUT_SIZE) {
  const scale = Math.min(size / width, size / height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return { scale, w, h, padX: Math.floor((size - w) / 2), padY: Math.floor((size - h) / 2) };
}

// RGBA pixels of the letterboxed input → float32 CHW tensor data in 0..1.
export function toTensorData(rgba, size = INPUT_SIZE) {
  const n = size * size;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 255;
    out[n + i] = rgba[i * 4 + 1] / 255;
    out[2 * n + i] = rgba[i * 4 + 2] / 255;
  }
  return out;
}

function iou(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

// Raw output [1, 4 + classes, anchors] → boxes in original image pixels.
// `box` = the letterbox() used for the input. `minScore` can be lowered to also
// see weak guesses (the live camera draws them as "not counted").
export function decode(output, dims, box, minScore = MIN_SCORE) {
  const [, rows, anchors] = dims;
  const classes = rows - 4;
  const found = [];
  for (let a = 0; a < anchors; a++) {
    let best = -1;
    let score = 0;
    for (let c = 0; c < classes; c++) {
      const s = output[(4 + c) * anchors + a];
      if (s > score) { best = c; score = s; }
    }
    if (score < minScore) continue;
    const cx = (output[a] - box.padX) / box.scale;
    const cy = (output[anchors + a] - box.padY) / box.scale;
    const w = output[2 * anchors + a] / box.scale;
    const h = output[3 * anchors + a] / box.scale;
    found.push({
      id: toTileId(MODEL_CLASSES[best]), score,
      x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2,
    });
  }
  // One box per tile: keep the most confident, drop heavy overlaps of any class.
  found.sort((p, q) => q.score - p.score);
  const kept = [];
  for (const d of found) if (kept.every((k) => iou(k, d) < NMS_IOU)) kept.push(d);
  return kept;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// Group tiles that sit side by side into rows (connected chains). Chaining
// neighbour to neighbour tolerates a slightly slanted row.
export function findRows(dets) {
  const tileW = median(dets.map((d) => d.x2 - d.x1));
  const tileH = median(dets.map((d) => d.y2 - d.y1));
  const parent = dets.map((_, i) => i);
  const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < dets.length; i++) {
    for (let j = i + 1; j < dets.length; j++) {
      const a = dets[i];
      const b = dets[j];
      const dy = Math.abs((a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2);
      const gap = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2); // < 0 when they overlap
      if (dy < tileH * 0.5 && gap < tileW * 0.35 && gap > -tileW * 0.5) parent[root(i)] = root(j);
    }
  }
  const groups = new Map();
  dets.forEach((d, i) => {
    const r = root(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(d);
  });
  return [...groups.values()].map((row) => row.sort((p, q) => p.x1 - q.x1));
}

const confidenceOf = (score) => (score >= HIGH_CONFIDENCE ? 'high' : 'low');
const toTile = (d) => ({ id: d.id, confidence: confidenceOf(d.score), score: d.score, box: [d.x1, d.y1, d.x2, d.y2] });

// Detections → { hand, discards }, each a list of { id, confidence, score, box }.
// The longest row (MIN_HAND_ROW+ tiles) is the hand; on a tie, the row lowest in
// the photo (nearest the camera). Everything else is a discard (scattered tiles
// and other players' revealed sets are all seen tiles).
export function splitTable(dets) {
  if (!dets.length) return { hand: [], discards: [] };
  const rows = findRows(dets);
  const bottom = (row) => Math.max(...row.map((d) => d.y2));
  const handRow = rows
    .filter((r) => r.length >= MIN_HAND_ROW)
    .sort((a, b) => b.length - a.length || bottom(b) - bottom(a))[0] || [];
  const discards = dets
    .filter((d) => !handRow.includes(d))
    .sort((a, b) => (a.y1 + a.y2) - (b.y1 + b.y2) || a.x1 - b.x1);
  return { hand: handRow.map(toTile), discards: discards.map(toTile) };
}
