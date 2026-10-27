// ---------------------------------------------------------------------------
// Shanten calculator.
//
// Convention: shanten = number of tile-swaps away from a *complete* hand.
//   -1 = winning hand (agari)
//    0 = tenpai (one tile from winning)
//    n = n tiles away
//
// All functions operate on a length-34 `counts` array (see tiles.js index map)
// representing the CONCEALED portion of the hand. `openMelds` is the number of
// already-claimed melds (each counts as one completed set).
// ---------------------------------------------------------------------------

// --- standard hand: 4 sets + 1 pair ---------------------------------------
//
// Recursive decomposition. We try, at each tile index, to form triplets,
// sequences, a pair, and partial sets (taatsu), then evaluate via the classic
// formula:  shanten = 8 - 2*sets - usefulPartials - hasPair
// where usefulPartials is capped so sets+partials never exceeds 4 (the pair is
// the separate 5th block).
//
// opts.noSeq      -> disallow sequences (used for All Pungs targets)
// opts.noTriplet  -> disallow triplets  (used for All Chows targets)
export function structuredShanten(counts, openMelds = 0, opts = {}) {
  const { noSeq = false, noTriplet = false } = opts;
  const c = counts.slice();
  let best = 8;

  function evaluate(sets, partials, pair) {
    // Cap at 4 sets so callers that pre-fix sets (via openMelds) and pass extra
    // tiles can't over-credit a 5th set into a negative shanten.
    const totalSets = Math.min(sets + openMelds, 4);
    let useful = Math.min(partials, 4 - totalSets);
    if (useful < 0) useful = 0;
    const sh = 8 - 2 * totalSets - useful - (pair ? 1 : 0);
    if (sh < best) best = sh;
  }

  function dfs(i, sets, partials, pair) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) {
      evaluate(sets, partials, pair);
      return;
    }

    const suited = i < 27;
    const base = i % 9; // 0-based value within the suit (0 => value 1)

    // Triplet
    if (!noTriplet && c[i] >= 3) {
      c[i] -= 3;
      dfs(i, sets + 1, partials, pair);
      c[i] += 3;
    }
    // Sequence i, i+1, i+2 (within one suit)
    if (!noSeq && suited && base <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      dfs(i, sets + 1, partials, pair);
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    // Pair used as THE pair
    if (c[i] >= 2 && !pair) {
      c[i] -= 2;
      dfs(i, sets, partials, true);
      c[i] += 2;
    }
    // Pair used as a partial set (toward a triplet)
    if (!noTriplet && c[i] >= 2) {
      c[i] -= 2;
      dfs(i, sets, partials + 1, pair);
      c[i] += 2;
    }
    // Partial sequences
    if (!noSeq && suited) {
      if (base <= 7 && c[i + 1] > 0) {
        c[i]--; c[i + 1]--;
        dfs(i, sets, partials + 1, pair);
        c[i]++; c[i + 1]++;
      }
      if (base <= 6 && c[i + 2] > 0) {
        c[i]--; c[i + 2]--;
        dfs(i, sets, partials + 1, pair);
        c[i]++; c[i + 2]++;
      }
    }
    // Leave one copy floating, continue at the same index.
    c[i]--;
    dfs(i, sets, partials, pair);
    c[i]++;
  }

  dfs(0, 0, 0, false);
  return best;
}

// --- seven pairs ----------------------------------------------------------
export function sevenPairsShanten(counts) {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  // Need 7 distinct pairs; if fewer than 7 distinct kinds we must also draw
  // new kinds.
  return 6 - pairs + Math.max(0, 7 - kinds);
}

// --- thirteen orphans (十三幺, 88 pts in MCR) ------------------------------
const TERMINAL_HONOR_IDX = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export function thirteenOrphansShanten(counts) {
  let unique = 0;
  let hasPair = false;
  for (const i of TERMINAL_HONOR_IDX) {
    if (counts[i] >= 1) unique++;
    if (counts[i] >= 2) hasPair = true;
  }
  return 13 - unique - (hasPair ? 1 : 0);
}

// --- knitted (組合龍 / 全不靠) — approximate, used only for target hints ---
// Knitted tiles: 1,4,7 in one suit, 2,5,8 in another, 3,6,9 in the third.
const SUIT_OFFSET = { man: 0, sou: 9, pin: 18 };
const KNIT_GROUPS = [
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
];
// All 6 ways to assign the three knitted groups to the three suits.
const SUIT_PERMS = [
  ['man', 'sou', 'pin'],
  ['man', 'pin', 'sou'],
  ['sou', 'man', 'pin'],
  ['sou', 'pin', 'man'],
  ['pin', 'man', 'sou'],
  ['pin', 'sou', 'man'],
];

// "Honors and Knitted Tiles" (全不靠): 14 single tiles, no sets, no pair.
// Up to 9 knitted singles + up to 7 honor singles, 14 distinct needed.
export function honorsKnittedShanten(counts) {
  let best = 13;
  let honorsPresent = 0;
  for (let i = 27; i < 34; i++) if (counts[i] >= 1) honorsPresent++;
  for (const perm of SUIT_PERMS) {
    let knit = 0;
    for (let g = 0; g < 3; g++) {
      const suit = perm[g];
      for (const v of KNIT_GROUPS[g]) {
        if (counts[SUIT_OFFSET[suit] + (v - 1)] >= 1) knit++;
      }
    }
    const matched = Math.min(14, knit + honorsPresent);
    const sh = 13 - matched;
    if (sh < best) best = sh;
  }
  return best;
}

// Knitted Straight (組合龍, 12 pts): the 9 knitted tiles act as three sets,
// plus one ordinary set and a pair. Rough estimate for ranking only.
export function knittedStraightShanten(counts) {
  let best = 14;
  for (const perm of SUIT_PERMS) {
    const c = counts.slice();
    let knitPresent = 0;
    for (let g = 0; g < 3; g++) {
      const suit = perm[g];
      for (const v of KNIT_GROUPS[g]) {
        const idx = SUIT_OFFSET[suit] + (v - 1);
        if (c[idx] >= 1) { knitPresent++; c[idx]--; }
      }
    }
    const missingKnit = 9 - knitPresent;
    // Leftover tiles must yield one set + a pair (5 tiles). Estimate how close.
    let hasPair = false;
    let hasSetish = 0;
    for (let i = 0; i < 34; i++) {
      if (c[i] >= 2) hasPair = true;
    }
    // crude: one more set needs ~2 effective tiles, pair needs ~1
    const extra = (hasPair ? 1 : 2) + 1; // remaining blocks to assemble
    const sh = missingKnit + extra - 1;
    if (sh < best) best = sh;
  }
  return best;
}

// --- overall (the safe minimum used by all core advice) -------------------
// Only includes hand types we compute *exactly*: standard, seven pairs,
// thirteen orphans. Knitted variants are approximate and surfaced only as
// target suggestions, never folded into the authoritative shanten.
export function getShanten(counts, openMelds = 0) {
  const std = structuredShanten(counts, openMelds, {});
  let best = std;
  let type = 'standard';
  if (openMelds === 0) {
    const sp = sevenPairsShanten(counts);
    if (sp < best) { best = sp; type = 'sevenpairs'; }
    const to = thirteenOrphansShanten(counts);
    if (to < best) { best = to; type = 'thirteenorphans'; }
  }
  return { shanten: best, type };
}
