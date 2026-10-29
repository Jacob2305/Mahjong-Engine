// ---------------------------------------------------------------------------
// Discard evaluator.
//
// For a 14-tile concealed hand (length-34 counts), rank every possible discard.
// Main criterion (planner.js): after this discard, how likely is it that at least
// one of your best few legal (8+ point) plans comes in, counting only tiles that
// are still live. Tie-break / fallback when no 8-point hand is in reach yet: tile
// efficiency (resulting shanten, live outs, isolated/dead tiles).
// The reason text is built from the same numbers that made the decision.
// ---------------------------------------------------------------------------

import { TILE_IDS, tileName, isSuited, isHonor } from './tiles.js';
import { getShanten } from './shanten.js';
import { getUsefulTiles, countLiveOuts } from './usefulTiles.js';
import { liveOf } from './tilePool.js';
import { bestScore, MIN_POINTS } from './scoring.js';
import { findTargets, evaluateHand, planValue } from './planner.js';

// Does any tile complete this 13-tile hand for a legal (>= 8 pt) win?
// Returns { hasLegal, bestPoints } where bestPoints is the max over completions.
function tenpaiValue(counts, melds, ctx) {
  const m = melds.length;
  const work = counts.slice();
  let hasLegal = false;
  let bestPoints = 0;
  for (let i = 0; i < 34; i++) {
    if (work[i] >= 4) continue;
    work[i]++;
    if (getShanten(work, m).shanten === -1) {
      const p = bestScore(work, melds, ctx).points;
      if (p > bestPoints) bestPoints = p;
      if (p >= MIN_POINTS) hasLegal = true;
    }
    work[i]--;
    if (hasLegal) break;
  }
  return { hasLegal, bestPoints };
}

// A tile is "isolated" when it can't currently combine with anything: a lone
// honor, or a suited tile with no copy of itself and nothing within 2 ranks.
function isIsolated(counts, i) {
  if (counts[i] >= 2) return false; // pair/triplet -> not isolated
  const id = TILE_IDS[i];
  if (isHonor(id)) return counts[i] === 1; // lone honor
  if (!isSuited(id)) return false;
  const base = i % 9;
  for (let d = -2; d <= 2; d++) {
    if (d === 0) continue;
    const nb = base + d;
    if (nb < 0 || nb > 8) continue;
    if (counts[i + d] > 0) return false;
  }
  return true;
}

// opts.drawsLeft: how many draws you probably have left (see planner.estimateDrawsLeft).
export function evaluateDiscards(counts, melds, pool, ctx = {}, opts = {}) {
  const drawsLeft = opts.drawsLeft ?? 12;
  const openMelds = melds.length;
  const options = [];
  const work = counts.slice();

  for (let i = 0; i < 34; i++) {
    if (work[i] === 0) continue;
    const id = TILE_IDS[i];

    work[i]--;
    const sh = getShanten(work, openMelds).shanten;
    const useful = getUsefulTiles(work, openMelds, pool);
    const outs = countLiveOuts(useful);
    const outKinds = useful.length;

    // Value awareness: if this discard reaches a structural tenpai, is it a
    // legal (>= 8 pt) one? A dead-end tenpai that can never reach 8 is worse
    // than staying flexible.
    let valueShort = false;
    let tenpaiPoints = null;
    if (sh === 0) {
      const tv = tenpaiValue(work, melds, ctx);
      valueShort = !tv.hasLegal;
      tenpaiPoints = tv.bestPoints;
    }
    work[i]++;

    const isolated = isIsolated(counts, i);
    const tileLive = liveOf(pool, id);

    // Lower resulting shanten dominates; then more outs; small bonus for
    // dumping isolated/near-dead tiles. A real >=8 tenpai is rewarded, while a
    // value-short tenpai is penalised below a flexible 1-shanten.
    let score =
      (8 - sh) * 1000 +
      outs * 6 +
      outKinds * 3 +
      (isolated ? 40 : 0) +
      (tileLive <= 1 ? 15 : 0);
    // Mild nudge: prefer a legal >=8 tenpai over a value-short one, but never
    // enough to keep a worse shape or hold dead tiles.
    if (sh === 0) score += valueShort ? -150 : 400;

    options.push({
      id,
      index: i,
      tile: id,
      name: tileName(id),
      shantenAfter: sh,
      outs,
      outKinds,
      isolated,
      tileLive,
      valueShort,
      tenpaiPoints,
      score,
    });
  }

  // --- plans: one target search, then rate every discard against it ---------
  let targets = findTargets(counts, melds, ctx, { maxMissing: 5 });
  if (targets.length < 3) {
    targets = findTargets(counts, melds, ctx, { maxMissing: 6, nodeLimit: 400_000 });
  }
  for (const o of options) {
    const after = counts.slice();
    after[o.index]--;
    const { goals } = evaluateHand(after, targets, pool, drawsLeft);
    const pv = planValue(goals);
    o.planValue = pv.value;
    o.plans = pv.plans;
    o.keepsTarget = (g) => g.target[o.index] <= after[o.index];
  }
  // Plans dominate; efficiency (score up to ~8000) only separates near-ties.
  for (const o of options) o.total = o.planValue + o.score * 1e-6;

  options.sort(
    (a, b) =>
      b.total - a.total ||
      a.shantenAfter - b.shantenAfter ||
      b.outs - a.outs,
  );

  const top = options[0] || null;
  // A plan that would be closest but is impossible now (a tile it needs is all gone).
  const lost = evaluateHand(counts, targets, pool, drawsLeft).dead[0] || null;
  const r = top ? buildReason(top, options, lost) : { short: '', details: [] };
  return {
    ranked: options,
    recommended: top,
    reasonShort: r.short,
    reasonDetails: r.details,
    reason: [r.short, ...r.details].join(' '), // full text, for older callers
    drawsLeft,
  };
}

// "3-Bamboo, East Wind ×2"
function needText(need) {
  return need
    .map((n) => `${tileName(n.id)}${n.count > 1 ? ` ×${n.count}` : ''} (${n.live} left)`)
    .join(', ');
}
const pct = (x) => `${Math.max(1, Math.round(x * 100))}%`;

// Returns { short, details: [lines] }: one line for why this tile, the rest on demand.
function buildReason(opt, ranked, lost) {
  const plan = opt.plans[0];

  if (!plan || opt.planValue < 0.005) {
    const why = opt.isolated
      ? 'It connects to nothing in your hand.'
      : opt.tileLive === 0
        ? 'Every other copy is already gone.'
        : 'It is the least useful tile for your shape.';
    return {
      short: `${why} No 8-point hand is close yet.`,
      details: [
        `Keeping the most flexible shape: ${opt.shantenAfter <= 0 ? 'ready' : `${opt.shantenAfter} tile${opt.shantenAfter === 1 ? '' : 's'} from ready`}, ` +
          `${opt.outs} useful draws left.`,
        'Aim to line up a scoring pattern (a flush, a straight, shifted or mixed runs) before committing.',
      ],
    };
  }

  const usedBy = opt.plans.filter((g) => !opt.keepsTarget(g));
  const short = usedBy.length
    ? `Least needed tile — keeps ${plan.headline} on track.`
    : `Not part of your plan (${plan.headline}).`;

  const details = [];
  if (lost && lost.missing < plan.missing && lost.headline !== plan.headline) {
    details.push(`${lost.headline} is out: every ${tileName(lost.deadTile)} is gone, so the plan switched.`);
  }
  details.push(
    `Plan: ${plan.headline} (${plan.points} pts${plan.selfDrawOnly ? ', only if you draw the winning tile yourself' : ''}), ` +
      `needs ${needText(plan.need)}.`,
  );
  for (const b of opt.plans.slice(1, 3)) {
    details.push(`Backup: ${b.headline} (${b.points} pts), needs ${b.need.length ? needText(b.need) : 'nothing more'}.`);
  }
  const next = ranked.find((o) => o !== opt);
  details.push(
    `Rough chance one of these comes in from your own draws: ${pct(opt.planValue)}` +
      (next ? ` (throwing ${next.name} instead: ${pct(next.planValue)}).` : '.'),
  );
  return { short, details };
}
