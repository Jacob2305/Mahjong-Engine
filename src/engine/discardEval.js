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
  const reason = top ? buildReason(top, options, lost) : '';
  return { ranked: options, recommended: top, reason, drawsLeft };
}

// "3-Bamboo, East Wind ×2"
function needText(need) {
  return need
    .map((n) => `${tileName(n.id)}${n.count > 1 ? ` ×${n.count}` : ''} (${n.live} left)`)
    .join(', ');
}
const pct = (x) => `${Math.max(1, Math.round(x * 100))}%`;

function buildReason(opt, ranked, lost) {
  const name = opt.name;
  const plan = opt.plans[0];

  if (!plan || opt.planValue < 0.005) {
    // No 8-point hand in reach yet: say so, and explain the efficiency choice.
    const parts = [];
    if (opt.isolated) parts.push('it connects to nothing in your hand');
    if (opt.tileLive <= 1) parts.push(opt.tileLive === 0 ? 'every other copy is already gone' : 'only 1 other copy is left');
    if (!parts.length) parts.push('it is the least useful tile for your shape');
    return `Throw ${name}: ${parts.join(', ')}. No 8-point hand is close yet, so this keeps the most ` +
      `flexible shape (${opt.shantenAfter <= 0 ? 'ready' : `${opt.shantenAfter} tile${opt.shantenAfter === 1 ? '' : 's'} from ready`}, ` +
      `${opt.outs} useful draws left).`;
  }

  const sentences = [];
  if (lost && lost.missing < plan.missing && lost.headline !== plan.headline) {
    sentences.push(`${lost.headline} is out: every ${tileName(lost.deadTile)} is gone.`);
  }
  sentences.push(
    `Plan: ${plan.headline} (${plan.points} pts${plan.selfDrawOnly ? ', only if you draw the winning tile yourself' : ''}), ` +
      `needs ${needText(plan.need)}, about ${pct(plan.chance)} to come in.`,
  );
  const backups = opt.plans.slice(1, 3);
  if (backups.length) {
    sentences.push(
      `Backup: ${backups.map((b) => `${b.headline} (needs ${b.need.length ? needText(b.need) : 'nothing more'})`).join('; ')}.`,
    );
  }
  // Why this tile and not another.
  const usedBy = opt.plans.filter((g) => !opt.keepsTarget(g)).map((g) => g.headline);
  let why;
  if (!usedBy.length) why = `it isn't part of any of these plans`;
  else {
    const next = ranked.find((o) => o !== opt);
    why = `it's the tile your plans need least` +
      (next ? ` (throwing ${next.name} instead would drop your chances to ${pct(next.planValue)})` : '');
  }
  sentences.unshift(`Throw ${name}: ${why}. Chance one of your plans comes in: ${pct(opt.planValue)}.`);
  return sentences.join(' ');
}
