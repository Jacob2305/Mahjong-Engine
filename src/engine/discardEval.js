// ---------------------------------------------------------------------------
// Discard evaluator.
//
// For a 14-tile concealed hand (length-34 counts), rank every possible discard
// by a composite score blending resulting shanten, number of live outs, and a
// small bonus for shedding isolated/dead tiles. Generates a human reason for
// the top pick.
// ---------------------------------------------------------------------------

import { TILE_IDS, tileName, isSuited, isHonor } from './tiles.js';
import { getShanten } from './shanten.js';
import { getUsefulTiles, countLiveOuts } from './usefulTiles.js';
import { liveOf } from './tilePool.js';
import { bestScore, MIN_POINTS } from './scoring.js';

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

export function evaluateDiscards(counts, melds, pool, ctx = {}) {
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

  options.sort(
    (a, b) =>
      b.score - a.score ||
      a.shantenAfter - b.shantenAfter ||
      b.outs - a.outs,
  );

  const top = options[0] || null;
  const reason = top ? buildReason(top) : '';
  return { ranked: options, recommended: top, reason };
}

function buildReason(opt) {
  const parts = [];
  if (opt.isolated) {
    parts.push('it is isolated with no neighbouring tiles to build a set');
  }
  if (opt.tileLive <= 1) {
    parts.push(
      opt.tileLive === 0
        ? 'all copies are already gone (dead)'
        : 'only 1 live copy remains',
    );
  }
  if (parts.length === 0) {
    parts.push('it contributes least to your strongest shape');
  }
  let shantenWord;
  if (opt.shantenAfter <= 0) {
    shantenWord = opt.valueShort
      ? `it leaves you one tile from complete, but the best that shape scores is ${opt.tenpaiPoints}pts (under the 8-point minimum) — so keep building value`
      : 'it leaves you ready to win with a legal 8-point-plus hand';
  } else {
    shantenWord = `it leaves you ${opt.shantenAfter} useful tile${
      opt.shantenAfter === 1 ? '' : 's'
    } from being ready`;
  }
  return `Throw ${opt.name} — ${parts.join(', ')}; ${shantenWord}, with ${opt.outs} live draw${
    opt.outs === 1 ? '' : 's'
  } that help.`;
}
