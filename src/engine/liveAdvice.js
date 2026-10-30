// ---------------------------------------------------------------------------
// Live camera advice: when the camera sees your whole hand in a row, say what to
// throw and which hand you're going for, right on the video.
//
// Pure (no browser APIs): liveAdvice.test.mjs runs it in Node, and
// advise.worker.js runs advise() + summarizeAdvice() off the main thread so the
// video doesn't freeze while it thinks.
// ---------------------------------------------------------------------------

import { isBonus, tileName } from './tiles.js';

// The hand row from the live boxes, if it's a full hand ready to throw from:
// 14 tiles, or 14 − 3 per claimed set. Flowers/seasons don't count.
// dets: marked detections (counted, inHand). Returns
// { ready, ids, key, have, need, problem }.
export function liveHand(dets, melds = []) {
  const ids = dets.filter((d) => d.inHand && d.counted && !isBonus(d.id)).map((d) => d.id);
  const need = 14 - 3 * melds.length;
  const key = [...ids].sort().join(',');
  const base = { ids, key, have: ids.length, need };
  if (ids.length !== need) return { ...base, ready: false, problem: null };

  // A 5th copy means a misread tile: don't advise on it.
  const copies = {};
  for (const id of [...ids, ...melds.flatMap((m) => m.tiles)]) copies[id] = (copies[id] || 0) + 1;
  const over = Object.keys(copies).find((id) => copies[id] > 4);
  if (over) return { ...base, ready: false, problem: `5 × ${tileName(over)} — one is misread` };
  return { ...base, ready: true, problem: null };
}

// Just what the video overlay shows, from advise()'s result (small and safe to
// send back from a worker).
export function summarizeAdvice(advice) {
  const win = advice.winAdvice?.legal
    ? { points: advice.winAdvice.points, fans: advice.winAdvice.reasons.slice(0, 3) }
    : null;
  const d = advice.recommendedDiscard;
  const plan = advice.idealHand
    ? {
        headline: advice.idealHand.headline,
        points: advice.idealHand.points,
        missing: advice.idealHand.missing,
        needIds: (advice.idealHand.needTiles || []).slice(0, 4).map((t) => t.id),
      }
    : null;
  return {
    win,
    discard: d ? { id: d.id, short: d.short || d.reason || '' } : null,
    plan,
  };
}

// One line for the overlay: "Going for Half Flush 混一色 · 12 pts · needs 3-Bamboo, 9-Bamboo".
export function planLine(plan) {
  if (!plan) return 'No 8-point hand in reach yet — keeping it flexible';
  const needs = plan.needIds.length
    ? ` · needs ${plan.needIds.map(tileName).join(', ')}${plan.missing > plan.needIds.length ? '…' : ''}`
    : '';
  return `Going for ${plan.headline} · ${plan.points} pts${plan.missing === 0 ? ' · complete' : needs}`;
}
