// ---------------------------------------------------------------------------
// Claim decisions with the planner.
//
// When an opponent throws a tile you could take (pung from anyone, chow only from
// the player on your left), compare your plan chances:
//   skip  → the 13 tiles you hold now;
//   claim → after taking the set and throwing your best discard.
// Claim only if it clearly raises the chance that one of your 8+ point plans comes
// in. Same numbers as the discard advice, so the explanations agree.
// Returns the same shape the UI already uses (recommendation, meldType, meldTiles,
// reason, shantenIfClaim, shantenIfSkip).
// ---------------------------------------------------------------------------

import { TILE_IDS, TILE_INDEX, idToTile, tileName, isSuited } from './tiles.js';
import { getShanten } from './shanten.js';
import { findTargets, evaluateHand, planValue } from './planner.js';
import { evaluateDiscards } from './discardEval.js';

const MARGIN = 0.01; // claim must add at least 1 percentage point
const pct = (x) => `${Math.round(x * 100)}%`;

// Every set you could make with the discard: pung, and chows when it's legal.
function claimOptions(counts, idx, canChow) {
  const id = TILE_IDS[idx];
  const opts = [];
  if (counts[idx] >= 2) opts.push({ meldType: 'pung', fromHand: [idx, idx], tiles: [id, id, id] });
  if (canChow && isSuited(id)) {
    const v = idx % 9;
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      if (v + a < 0 || v + b > 8) continue;
      const i1 = idx + a;
      const i2 = idx + b;
      if (counts[i1] > 0 && counts[i2] > 0) {
        const low = Math.min(i1, idx);
        opts.push({ meldType: 'chow', fromHand: [i1, i2], tiles: [low, low + 1, low + 2].map((i) => TILE_IDS[i]) });
      }
    }
  }
  return opts;
}

export function planClaim(counts, melds, pool, discardId, { seatWind, prevalentWind, canChow = true, drawsLeft = 12 } = {}) {
  const idx = TILE_INDEX[discardId];
  if (idx === undefined) return null;
  const ctx = { seatWind, prevalentWind };
  const name = tileName(discardId);
  const shantenIfSkip = getShanten(counts, melds.length).shanten;

  const options = claimOptions(counts, idx, canChow);
  if (!options.length) {
    const chowOnly = !canChow && isSuited(discardId) && claimOptions(counts, idx, true).length > 0;
    return {
      tile: idToTile(discardId),
      meldType: chowOnly ? 'chow' : null,
      recommendation: 'skip',
      reason: chowOnly
        ? `You can only take a run from the player on your left, so ${name} isn't claimable as a run right now.`
        : `You can't form any set with ${name} from your hand.`,
      shantenIfClaim: shantenIfSkip,
      shantenIfSkip,
    };
  }

  // Skip: plan value of the hand as it is.
  let targets = findTargets(counts, melds, ctx, { maxMissing: 5 });
  if (targets.length < 3) targets = findTargets(counts, melds, ctx, { maxMissing: 6, nodeLimit: 400_000 });
  const skip = planValue(evaluateHand(counts, targets, pool, drawsLeft).goals);

  // Each claim: take the set, then the best discard from what's left.
  for (const o of options) {
    const after = counts.slice();
    for (const i of o.fromHand) after[i]--;
    const newMelds = [...melds, { type: o.meldType, tiles: o.tiles }];
    const ev = evaluateDiscards(after, newMelds, pool, ctx, { drawsLeft });
    o.value = ev.recommended ? ev.recommended.planValue : 0;
    o.plan = ev.recommended?.plans?.[0] || null;
    o.thenThrow = ev.recommended?.id || null;
    o.shantenIfClaim = ev.recommended ? ev.recommended.shantenAfter : getShanten(after, newMelds.length).shanten;
  }
  options.sort((a, b) => b.value - a.value);
  const best = options[0];
  const claim = best.value > skip.value + MARGIN;
  const setName = best.meldType === 'pung' ? 'a pung' : 'a run';

  const reason = claim
    ? `Take the ${name} as ${setName} — your chance of an 8+ hand goes from ${pct(skip.value)} to ${pct(best.value)}` +
      (best.plan ? ` (plan: ${best.plan.headline})` : '') +
      (best.thenThrow ? `, then throw ${tileName(best.thenThrow)}.` : '.')
    : best.value <= 0.005 && skip.value <= 0.005
      ? `Leave the ${name} — taking it doesn't open up any 8-point hand.`
      : `Leave the ${name} — taking it as ${setName} would ${best.value < skip.value ? 'lower' : 'barely change'} your chance of an 8+ hand (${pct(skip.value)} → ${pct(best.value)}).`;

  return {
    tile: idToTile(discardId),
    meldType: best.meldType,
    meldTiles: best.tiles,
    recommendation: claim ? 'claim' : 'skip',
    reason,
    shantenIfClaim: best.shantenIfClaim,
    shantenIfSkip,
    chanceIfClaim: best.value,
    chanceIfSkip: skip.value,
  };
}
