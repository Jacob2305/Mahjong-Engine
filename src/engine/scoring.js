// ---------------------------------------------------------------------------
// MCR hand scorer (fan / points).
//
// Chinese Official Mahjong requires a winning hand to total at least 8 points
// from combined fan. This module scores a COMPLETE hand and returns its best
// (maximum) point total across all valid decompositions, plus a human-readable
// breakdown. It is used to gate winning tiles / tenpai: a structurally complete
// hand that scores < 8 is NOT a legal win.
//
// This is a practical subset of the full 81-fan table — it covers the common
// and high-value patterns and sums combinations (the rule the engine needs to
// know whether 8 points is reachable). It is intentionally conservative about
// concealed/self-draw bonuses so it won't over-state a hand's value.
// ---------------------------------------------------------------------------

import { TILE_INDEX } from './tiles.js';

const DRAGONS = new Set([31, 32, 33]);
const WIND_IDX = { east: 27, south: 28, west: 29, north: 30 };

const suitOf = (idx) => (idx < 27 ? Math.floor(idx / 9) : 3);
const isHonorIdx = (idx) => idx >= 27;
const isTerminalIdx = (idx) => idx < 27 && (idx % 9 === 0 || idx % 9 === 8);
const isTermHonor = (idx) => isHonorIdx(idx) || isTerminalIdx(idx);

function setTiles(s) {
  if (s.type === 'chow') return [s.idx, s.idx + 1, s.idx + 2];
  return [s.idx, s.idx, s.idx];
}

// All 3-combinations of an array.
function combos3(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      for (let k = j + 1; k < arr.length; k++) out.push([arr[i], arr[j], arr[k]]);
  return out;
}
function anyPair(arr, pred) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (pred(arr[i], arr[j])) return true;
  return false;
}

// Score one standard decomposition (4 sets + pair).
export function scoreStandardDecomp(sets, pairIdx, ctx) {
  const { seatWind = 'east', prevalentWind = 'east', concealed = true } = ctx;
  let pts = 0;
  const reasons = [];
  const add = (p, name) => {
    if (p > 0) {
      pts += p;
      reasons.push(`${name} +${p}`);
    }
  };

  const chows = sets.filter((s) => s.type === 'chow');
  const pungs = sets.filter((s) => s.type === 'pung' || s.type === 'kong');

  const tiles = [];
  for (const s of sets) tiles.push(...setTiles(s));
  tiles.push(pairIdx, pairIdx);

  const suitsUsed = new Set();
  let honors = false;
  for (const t of tiles) {
    if (t < 27) suitsUsed.add(suitOf(t));
    else honors = true;
  }

  const allTermHonor = tiles.every(isTermHonor);

  // ---- the big "whole hand" fan (highest first; some short-circuit) --------
  if (suitsUsed.size === 0) {
    add(64, 'All Honors 字一色');
  } else if (allTermHonor && pungs.length === 4) {
    add(32, 'All Terminals & Honors 混幺九');
  }

  // Flush
  if (suitsUsed.size === 1 && !honors) add(24, 'Full Flush 清一色');
  else if (suitsUsed.size === 1 && honors) add(6, 'Half Flush 混一色');

  // All Pungs / All Chows
  if (chows.length === 0 && pungs.length === 4) add(6, 'All Pungs 碰碰和');
  if (pungs.length === 0 && chows.length === 4 && pairIdx < 27)
    add(2, 'All Chows 平和');

  // All Simples (no terminals or honors anywhere)
  if (tiles.every((t) => t < 27 && t % 9 !== 0 && t % 9 !== 8))
    add(2, 'All Simples 断幺');

  // Outside Hand (every set & pair contains a terminal/honor) — unless it's the
  // bigger All-Terminals-&-Honors already counted.
  if (!allTermHonor) {
    const setHasTH = (s) =>
      s.type === 'chow' ? s.idx % 9 === 0 || s.idx % 9 === 6 : isTermHonor(s.idx);
    if (sets.every(setHasTH) && isTermHonor(pairIdx)) add(4, 'Outside Hand 全带幺');
  }

  // ---- chow structures -----------------------------------------------------
  const cd = chows.map((c) => ({ suit: suitOf(c.idx), low: c.idx % 9 }));
  const triples = combos3(cd);
  const sorted = (t) => t.map((x) => x.low).sort((a, b) => a - b);
  const threeSuits = (t) => new Set(t.map((x) => x.suit)).size === 3;
  const sameSuit = (t) => new Set(t.map((x) => x.suit)).size === 1;
  const sameLow = (t) => new Set(t.map((x) => x.low)).size === 1;
  const consec = (t) => {
    const l = sorted(t);
    return l[1] - l[0] === 1 && l[2] - l[1] === 1;
  };
  const shifted = (t) => {
    const l = sorted(t);
    return (l[1] - l[0] === 1 && l[2] - l[1] === 1) || (l[1] - l[0] === 2 && l[2] - l[1] === 2);
  };

  let bigChow = false;
  // Pure Straight 123/456/789 one suit
  for (const suit of [0, 1, 2]) {
    const lows = new Set(cd.filter((c) => c.suit === suit).map((c) => c.low));
    if (lows.has(0) && lows.has(3) && lows.has(6)) {
      add(16, 'Pure Straight 清龙');
      bigChow = true;
      break;
    }
  }
  // Mixed Straight 123/456/789 across three suits
  if (
    cd.some((a) => a.low === 0) &&
    cd.some((a) => a.low === 3) &&
    cd.some((a) => a.low === 6) &&
    triples.some((t) => threeSuits(t) && JSON.stringify(sorted(t)) === '[0,3,6]')
  ) {
    add(8, 'Mixed Straight 花龙');
    bigChow = true;
  }
  if (triples.some((t) => sameSuit(t) && sameLow(t))) {
    add(24, 'Pure Triple Chow 一色三同顺');
    bigChow = true;
  }
  if (triples.some((t) => sameSuit(t) && shifted(t))) {
    add(16, 'Pure Shifted Chows 一色三步高');
    bigChow = true;
  }
  if (triples.some((t) => threeSuits(t) && sameLow(t))) {
    add(8, 'Mixed Triple Chow 三色三同顺');
    bigChow = true;
  }
  if (triples.some((t) => threeSuits(t) && consec(t))) {
    add(6, 'Mixed Shifted Chows 三色三步高');
    bigChow = true;
  }

  // Smaller two-chow fan only when no larger chow structure consumed them.
  if (!bigChow) {
    if (anyPair(cd, (a, b) => a.suit === b.suit && a.low === b.low))
      add(1, 'Pure Double Chow 一般高');
    else if (anyPair(cd, (a, b) => a.suit !== b.suit && a.low === b.low))
      add(1, 'Mixed Double Chow 喜相逢');
    if (anyPair(cd, (a, b) => a.suit === b.suit && Math.abs(a.low - b.low) === 3))
      add(1, 'Short Straight 连六');
    if (
      anyPair(
        cd,
        (a, b) => a.suit === b.suit && ((a.low === 0 && b.low === 6) || (a.low === 6 && b.low === 0)),
      )
    )
      add(1, 'Two Terminal Chows 老少副');
  }

  // ---- pung / honor fan ----------------------------------------------------
  let concealedPungs = 0;
  const pungVals = [];
  for (const p of pungs) {
    if (p.concealed) concealedPungs++;
    const yakuhai =
      DRAGONS.has(p.idx) ||
      p.idx === WIND_IDX[prevalentWind] ||
      p.idx === WIND_IDX[seatWind];
    if (DRAGONS.has(p.idx)) add(2, 'Dragon Pung 箭刻');
    if (p.idx === WIND_IDX[prevalentWind]) add(2, 'Prevalent Wind 圈风刻');
    if (p.idx === WIND_IDX[seatWind]) add(2, 'Seat Wind 门风刻');
    if (!yakuhai && isTermHonor(p.idx)) add(1, 'Pung of Terminals/Honors 幺九刻');
    if (p.idx < 27) pungVals.push({ suit: suitOf(p.idx), val: p.idx % 9 });
    if (p.type === 'kong') add(p.concealed ? 2 : 1, p.concealed ? 'Concealed Kong 暗杠' : 'Melded Kong 明杠');
  }
  if (anyPair(pungVals, (a, b) => a.val === b.val && a.suit !== b.suit))
    add(2, 'Double Pung 双同刻');
  if (concealedPungs === 4) add(64, 'Four Concealed Pungs 四暗刻');
  else if (concealedPungs === 3) add(16, 'Three Concealed Pungs 三暗刻');
  else if (concealedPungs === 2) add(2, 'Two Concealed Pungs 双暗刻');

  // Fully concealed hand (no melds). Assumed won by discard (conservative).
  if (concealed) add(2, 'Fully Concealed Hand 门前清');

  return { points: pts, reasons };
}

function sevenPairsScore(counts, ctx) {
  let pairs = 0;
  let kinds = 0;
  const tiles = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 2) {
      pairs++;
      kinds++;
      tiles.push(i, i);
    } else if (counts[i] !== 0) {
      return null; // not a clean 7-pairs shape
    }
  }
  if (pairs !== 7) return null;

  let pts = 24;
  const reasons = ['Seven Pairs 七对 +24'];
  const suitsUsed = new Set();
  let honors = false;
  for (const t of tiles) {
    if (t < 27) suitsUsed.add(suitOf(t));
    else honors = true;
  }
  if (suitsUsed.size === 1 && !honors) {
    pts += 24;
    reasons.push('Full Flush 清一色 +24');
  } else if (suitsUsed.size === 1 && honors) {
    pts += 6;
    reasons.push('Half Flush 混一色 +6');
  }
  if (tiles.every((t) => t < 27 && t % 9 !== 0 && t % 9 !== 8)) {
    pts += 2;
    reasons.push('All Simples 断幺 +2');
  }
  pts += 2;
  reasons.push('Fully Concealed Hand 门前清 +2');
  return { points: pts, reasons };
}

// Convert a claimed meld {type, tiles:[ids]} into a set descriptor.
function meldToSet(meld) {
  const idxs = meld.tiles.map((t) => TILE_INDEX[t]);
  const low = Math.min(...idxs);
  if (meld.type === 'chow') return { type: 'chow', idx: low, concealed: false };
  if (meld.type === 'kong') return { type: 'kong', idx: idxs[0], concealed: false };
  return { type: 'pung', idx: idxs[0], concealed: false };
}

// Enumerate complete decompositions of concealed counts into exactly n sets.
function decomposeSets(c, n) {
  if (n === 0) {
    for (let i = 0; i < 34; i++) if (c[i] !== 0) return [];
    return [[]];
  }
  let i = 0;
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return [];
  const out = [];
  if (c[i] >= 3) {
    c[i] -= 3;
    for (const rest of decomposeSets(c, n - 1)) out.push([{ type: 'pung', idx: i }, ...rest]);
    c[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--;
    for (const rest of decomposeSets(c, n - 1)) out.push([{ type: 'chow', idx: i }, ...rest]);
    c[i]++; c[i + 1]++; c[i + 2]++;
  }
  return out;
}

// Best (maximum) score for a complete hand. Returns { points, reasons }.
// `points` is 0 if the hand isn't structurally complete.
export function bestScore(counts, melds = [], ctx = {}) {
  let best = -1;
  let bestReasons = [];
  const meldSets = melds.map(meldToSet);
  const needSets = 4 - melds.length;
  const concealed = melds.length === 0;

  const total = counts.reduce((a, b) => a + b, 0);
  if (needSets >= 0 && total === needSets * 3 + 2) {
    const c = counts.slice();
    for (let p = 0; p < 34; p++) {
      if (c[p] >= 2) {
        c[p] -= 2;
        for (const dec of decomposeSets(c, needSets)) {
          const concealedSets = dec.map((s) => ({ ...s, concealed: true }));
          const r = scoreStandardDecomp(meldSets.concat(concealedSets), p, {
            ...ctx,
            concealed,
          });
          if (r.points > best) {
            best = r.points;
            bestReasons = r.reasons;
          }
        }
        c[p] += 2;
      }
    }
  }

  if (concealed) {
    const sp = sevenPairsScore(counts, ctx);
    if (sp && sp.points > best) {
      best = sp.points;
      bestReasons = sp.reasons;
    }
  }

  return { points: best < 0 ? 0 : best, reasons: bestReasons, complete: best >= 0 };
}

export const MIN_POINTS = 8;
export const isLegalWin = (counts, melds, ctx) => bestScore(counts, melds, ctx).points >= MIN_POINTS;
