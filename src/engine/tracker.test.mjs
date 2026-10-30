// Tests for live-camera frame voting. Run with: node src/engine/tracker.test.mjs
import { createTracker } from './tracker.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
}
const det = (id, score, x, y = 0) => ({ id, score, x1: x, y1: y, x2: x + 50, y2: y + 70 });

// A flickering tile settles on the guess it gets most often.
{
  const tr = createTracker();
  let out;
  for (const [id, s] of [['man7', 0.5], ['man9', 0.55], ['man7', 0.5], ['man7', 0.45], ['man9', 0.4]]) {
    out = tr.update([det(id, s, 100 + Math.random() * 4)]);
  }
  ok('one track for one tile', out.length === 1, JSON.stringify(out));
  ok('label = most-voted guess', out[0].id === 'man7', out[0].id);
  ok('frames counted', out[0].frames === 5);
  ok('score is an average (0..1)', out[0].score > 0 && out[0].score < 0.6, `${out[0].score}`);
}

// Two tiles side by side stay separate.
{
  const tr = createTracker();
  tr.update([det('pin1', 0.9, 0), det('pin2', 0.9, 60)]);
  const out = tr.update([det('pin1', 0.9, 2), det('pin2', 0.9, 62)]);
  ok('neighbours keep their own tracks', out.length === 2 && out.every((t) => t.frames === 2));
}

// A tile that disappears for a while is dropped; a short gap is kept.
{
  const tr = createTracker();
  tr.update([det('sou3', 0.8, 0)]);
  let out = tr.update([]);
  ok('a missing tile is not shown that frame', out.length === 0);
  out = tr.update([det('sou3', 0.8, 1)]);
  ok('it comes back on the same track', out.length === 1 && out[0].frames === 2);
  for (let i = 0; i < 6; i++) tr.update([]);
  out = tr.update([det('sou3', 0.8, 1)]);
  ok('after a long gap it starts fresh', out[0].frames === 1);
}

// Recent frames count more: a tile that changes (camera moved to another tile) follows.
{
  const tr = createTracker();
  let out;
  for (let i = 0; i < 3; i++) out = tr.update([det('man1', 0.6, 0)]);
  for (let i = 0; i < 4; i++) out = tr.update([det('man2', 0.6, 0)]);
  ok('newer guesses win over older ones', out[0].id === 'man2', out[0].id);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
