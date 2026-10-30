// Tests for the photo tile detector's pure logic. Run with: node src/engine/detect.test.mjs
import { MODEL_CLASSES, toTileId, decode, letterbox, splitTable, nms, halfCrops } from './detect.js';
import { TILE_IDS, FLOWERS, SEASONS } from './tiles.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
}

// Class names map onto every app tile id exactly once.
{
  const valid = new Set([...TILE_IDS, ...FLOWERS, ...SEASONS]);
  const ids = MODEL_CLASSES.map(toTileId);
  ok('42 classes', MODEL_CLASSES.length === 42);
  ok('every class maps to a valid id', ids.every((id) => valid.has(id)), ids.filter((id) => !valid.has(id)).join(' '));
  ok('one-to-one', new Set(ids).size === 42);
  ok('1B→sou1, 9C→man9, 5D→pin5',
    toTileId('1B') === 'sou1' && toTileId('9C') === 'man9' && toTileId('5D') === 'pin5');
  ok('honours and bonus',
    toTileId('SW') === 'wind_south' && toTileId('WD') === 'dragon_white' && toTileId('2F') === 'flower2' && toTileId('3S') === 'season3');
}

// Fake model output: [cls, x, y, score?] in a 640×640 input, 40×50 boxes.
function fake(tiles, anchors = 64) {
  const rows = 4 + MODEL_CLASSES.length;
  const data = new Float32Array(rows * anchors);
  tiles.forEach(([cls, x, y, score = 0.9], a) => {
    data[a] = x; data[anchors + a] = y; data[2 * anchors + a] = 40; data[3 * anchors + a] = 50;
    data[(4 + MODEL_CLASSES.indexOf(cls)) * anchors + a] = score;
  });
  return { data, dims: [1, rows, anchors] };
}
const noPad = { scale: 1, padX: 0, padY: 0 };
const row = (classes, x0, y, step = 42) => classes.map((c, i) => [c, x0 + i * step, y]);
const run = (tiles) => { const { data, dims } = fake(tiles); return splitTable(decode(data, dims, noPad)); };
const ids = (list) => list.map((t) => t.id).join(' ');

{
  const { data, dims } = fake([['1B', 100, 100], ['1B', 102, 101, 0.6], ['RD', 300, 100, 0.2]]);
  const d = decode(data, dims, noPad);
  ok('duplicate box dropped, low score dropped', d.length === 1 && d[0].id === 'sou1', JSON.stringify(d));
  const [m] = (() => { const f = fake([['5D', 320, 320]]); return decode(f.data, f.dims, letterbox(1280, 640)); })();
  ok('boxes mapped back to original pixels', Math.round(m.x1) === 600 && Math.round(m.y1) === 270, JSON.stringify(m));
}

// Hand row + scattered discards.
{
  const hand = row(['1C', '2C', '3C', '4D', '5D', '6D', '7B', '8B', '9B', 'EW', 'EW', 'RD', 'RD'], 40, 560);
  const scattered = [['3B', 100, 120], ['NW', 300, 200], ['9D', 500, 90], ['GD', 220, 330]];
  const r = run([...scattered, ...hand]);
  ok('longest row is the hand, left to right', ids(r.hand) === 'man1 man2 man3 pin4 pin5 pin6 sou7 sou8 sou9 wind_east wind_east dragon_red dragon_red', ids(r.hand));
  ok('scattered tiles are discards', r.discards.length === 4, ids(r.discards));
}
// Another player's revealed set (short row) counts as discards.
{
  const hand = row(['1C', '2C', '3C', '4D', '5D', '6D', '7B', '8B'], 40, 560);
  const meld = row(['WD', 'WD', 'WD'], 300, 100);
  const r = run([...meld, ...hand]);
  ok('short row of 3 goes to discards', r.hand.length === 8 && ids(r.discards) === 'dragon_white dragon_white dragon_white', ids(r.discards));
}
// Two equal rows: the one nearer the bottom (camera) is the hand.
{
  const top = row(['1C', '2C', '3C', '4C', '5C'], 40, 100);
  const bottom = row(['1D', '2D', '3D', '4D', '5D'], 40, 500);
  const r = run([...top, ...bottom]);
  ok('tie → bottom row is the hand', ids(r.hand) === 'pin1 pin2 pin3 pin4 pin5', ids(r.hand));
}
// No row of 5+: everything is discards. A slanted row still chains.
{
  const r = run([['1C', 100, 100], ['2C', 142, 100], ['9D', 400, 300], ['EW', 300, 500]]);
  ok('no long row → all discards', r.hand.length === 0 && r.discards.length === 4);
  const slanted = ['1C', '2C', '3C', '4C', '5C', '6C', '7C'].map((c, i) => [c, 40 + i * 42, 300 + i * 8]);
  ok('slightly slanted row still found', run(slanted).hand.length === 7);
  ok('empty photo', run([]).hand.length === 0);
}
// Confidence bands.
{
  const r = run(row(['1C', '2C', '3C', '4C', '5C'], 40, 300).map((t, i) => [...t, i === 0 ? 0.5 : 0.9]));
  ok('low score flagged for checking', r.hand[0].confidence === 'low' && r.hand[1].confidence === 'high');
}

// Live camera halves: overlap in the middle, cover the whole frame.
{
  const [a, b] = halfCrops(1920, 1080);
  ok('landscape halves split the width', a.sx === 0 && a.sh === 1080 && b.sx + b.sw === 1920);
  ok('halves overlap by 2×15% in the middle', a.sx + a.sw - b.sx === Math.round(1920 * 0.3), `${a.sx + a.sw - b.sx}`);
  const [c, d] = halfCrops(1080, 1920);
  ok('portrait halves split the height', c.sy === 0 && c.sw === 1080 && d.sy + d.sh === 1920);
  // Same tile seen by both halves → one box, the more confident one.
  const t = (score, x) => ({ id: 'man1', score, x1: x, y1: 0, x2: x + 50, y2: 70 });
  const kept = nms([t(0.6, 900), t(0.9, 903), t(0.8, 1200)]);
  ok('merge keeps one box per tile', kept.length === 2 && kept[0].score === 0.9, JSON.stringify(kept));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
