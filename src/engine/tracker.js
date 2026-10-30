// ---------------------------------------------------------------------------
// Live camera: steady tile labels by voting across frames.
//
// Each frame the model gives a box and a best guess per tile, and the guess for
// the same tile can flicker between frames. A track follows one tile across
// frames (matched by box overlap) and adds up its guesses, weighted by score,
// with older frames fading out. The label shown is the guess with the most
// votes; its strength is that guess's average score over the recent frames.
//
// Pure (no browser APIs) so tracker.test.mjs runs it in Node.
// ---------------------------------------------------------------------------

const MATCH_IOU = 0.3; // same tile if boxes overlap this much
const DECAY = 0.75; // each older frame counts 75% as much as the next
const MAX_MISSED = 4; // drop a track after this many frames without its tile

function iou(a, b) {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (w <= 0 || h <= 0) return 0;
  const inter = w * h;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

export function createTracker() {
  let tracks = [];
  let nextId = 1;

  // dets: [{ id, score, x1, y1, x2, y2 }] from one frame (any score).
  // Returns the current tracks as detections with steady labels:
  // [{ track, id, score, x1, y1, x2, y2, frames }] where `score` is the voted
  // label's average score and `frames` how many frames have seen this tile.
  function update(dets) {
    for (const t of tracks) {
      for (const k of Object.keys(t.votes)) t.votes[k] *= DECAY;
      t.weight *= DECAY;
      t.missed++;
    }

    // Greedy matching, best overlaps first.
    const pairs = [];
    dets.forEach((d, di) => {
      tracks.forEach((t, ti) => {
        const o = iou(d, t.box);
        if (o >= MATCH_IOU) pairs.push([o, di, ti]);
      });
    });
    pairs.sort((a, b) => b[0] - a[0]);
    const usedD = new Set();
    const usedT = new Set();
    for (const [, di, ti] of pairs) {
      if (usedD.has(di) || usedT.has(ti)) continue;
      usedD.add(di);
      usedT.add(ti);
      add(tracks[ti], dets[di]);
    }
    dets.forEach((d, di) => {
      if (usedD.has(di)) return;
      const t = { track: nextId++, votes: {}, weight: 0, frames: 0, missed: 0, box: d };
      add(t, d);
      tracks.push(t);
    });

    tracks = tracks.filter((t) => t.missed <= MAX_MISSED);
    return tracks.filter((t) => t.missed === 0).map(view);
  }

  function add(t, d) {
    t.votes[d.id] = (t.votes[d.id] || 0) + d.score;
    t.weight += 1;
    t.frames++;
    t.missed = 0;
    t.box = { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 };
  }

  function view(t) {
    let id = null;
    let best = -1;
    for (const [k, v] of Object.entries(t.votes)) if (v > best) { best = v; id = k; }
    return { track: t.track, id, score: best / t.weight, frames: t.frames, ...t.box };
  }

  return { update, reset: () => { tracks = []; } };
}
