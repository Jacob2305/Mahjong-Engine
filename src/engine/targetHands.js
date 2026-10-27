// ---------------------------------------------------------------------------
// Hand-target archetypes + ranker.
//
// Each archetype defines a point value and a shanten function over the
// concealed counts. Distance toward most archetypes is computed by zeroing the
// tiles that are *not allowed* in that pattern and reusing the standard
// decomposition — fewer usable tiles naturally yields higher shanten, which is
// exactly "how many useful draws away" you are. A few special hands (seven
// pairs, thirteen orphans, knitted) use their dedicated calculators.
//
// The ranker scores each by pointValue * proximity * outs availability and
// returns the top few realistic targets.
// ---------------------------------------------------------------------------

import { TILE_IDS, TILE_INDEX, idToTile } from './tiles.js';
import {
  structuredShanten,
  sevenPairsShanten,
  thirteenOrphansShanten,
  honorsKnittedShanten,
  knittedStraightShanten,
} from './shanten.js';
import { liveOf } from './tilePool.js';

// indices for suits / categories
const MAN = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const SOU = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const PIN = [18, 19, 20, 21, 22, 23, 24, 25, 26];
const HONORS = [27, 28, 29, 30, 31, 32, 33];
const SUIT_GROUPS = [MAN, SOU, PIN];
const TERMINALS = [0, 8, 9, 17, 18, 26];

// Keep only the allowed indices (zero the rest) before measuring shanten.
function restrict(counts, allowedSet) {
  const c = new Array(34).fill(0);
  for (let i = 0; i < 34; i++) if (allowedSet.has(i)) c[i] = counts[i];
  return c;
}

function valueRangeIndices(lo, hi) {
  const idx = [];
  for (const g of SUIT_GROUPS) {
    for (let v = lo; v <= hi; v++) idx.push(g[v - 1]);
  }
  return idx;
}

// fullFlush: min over the three suits, single suit only.
function fullFlushShanten(counts, m) {
  let best = 8;
  for (const g of SUIT_GROUPS) {
    const sh = structuredShanten(restrict(counts, new Set(g)), m);
    if (sh < best) best = sh;
  }
  return best;
}

// halfFlush: one suit + honors.
function halfFlushShanten(counts, m) {
  let best = 8;
  for (const g of SUIT_GROUPS) {
    const sh = structuredShanten(restrict(counts, new Set([...g, ...HONORS])), m);
    if (sh < best) best = sh;
  }
  return best;
}

const ALL_TERMINAL_HONOR = new Set([...TERMINALS, ...HONORS]);

// --- chow-combination targets (straights, shifted/triple chows) ------------
//
// These hands require SPECIFIC chows (e.g. 123/456/789 across suits). Distance
// is: pretend the required chows are completed sets, count tiles still missing
// for them, and add the standard shanten of forming the remaining set + pair
// from the leftover tiles. Chows already satisfied by a claimed meld are free.
//
// A chow is identified by { suit: 0|1|2 (man/sou/pin), low: 0..6 } where `low`
// is the 0-based value of its lowest tile.
function fixedChowsShanten(counts, melds, chowList) {
  const meldChows = melds
    .filter((mm) => mm.type === 'chow')
    .map((mm) => {
      const low = Math.min(...mm.tiles.map((t) => TILE_INDEX[t]));
      return { suit: Math.floor(low / 9), low: low % 9 };
    });

  const c = counts.slice();
  let missing = 0;
  let fromConcealed = 0;
  for (const req of chowList) {
    const mi = meldChows.findIndex((mc) => mc.suit === req.suit && mc.low === req.low);
    if (mi >= 0) {
      meldChows.splice(mi, 1); // covered by a meld — free
      continue;
    }
    fromConcealed++;
    const base = req.suit * 9 + req.low;
    for (let k = 0; k < 3; k++) {
      if (c[base + k] > 0) c[base + k]--;
      else missing++;
    }
  }
  const M = melds.length + fromConcealed;
  if (M > 4) return 99; // can't fit these chows alongside existing melds
  return structuredShanten(c, M) + missing;
}

const SUIT_PERMS3 = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

// Pre-built instance lists (each instance is one valid chow-triple).
const PURE_STRAIGHT = [0, 1, 2].map((s) => [
  { suit: s, low: 0 }, { suit: s, low: 3 }, { suit: s, low: 6 },
]);
const MIXED_STRAIGHT = SUIT_PERMS3.map((p) => [
  { suit: p[0], low: 0 }, { suit: p[1], low: 3 }, { suit: p[2], low: 6 },
]);
const MIXED_TRIPLE = [0, 1, 2, 3, 4, 5, 6].map((k) => [
  { suit: 0, low: k }, { suit: 1, low: k }, { suit: 2, low: k },
]);
const MIXED_SHIFTED = [];
for (let k = 0; k <= 4; k++)
  for (const p of SUIT_PERMS3)
    MIXED_SHIFTED.push([
      { suit: p[0], low: k }, { suit: p[1], low: k + 1 }, { suit: p[2], low: k + 2 },
    ]);
const PURE_SHIFTED = [];
for (const s of [0, 1, 2]) {
  for (let k = 0; k <= 4; k++)
    PURE_SHIFTED.push([{ suit: s, low: k }, { suit: s, low: k + 1 }, { suit: s, low: k + 2 }]);
  for (let k = 0; k <= 2; k++)
    PURE_SHIFTED.push([{ suit: s, low: k }, { suit: s, low: k + 2 }, { suit: s, low: k + 4 }]);
}

// min shanten across all instances of a chow-combination pattern
const chowComboShanten = (instances) => (counts, melds) => {
  let best = 99;
  for (const inst of instances) {
    const sh = fixedChowsShanten(counts, melds, inst);
    if (sh < best) best = sh;
  }
  return best;
};

// The archetype table. shantenFn(counts, openMelds, melds) -> number.
export const ARCHETYPES = [
  {
    key: 'fullflush',
    name: 'Full Flush',
    nameChinese: '清一色',
    points: 24,
    shantenFn: (c, m) => fullFlushShanten(c, m),
  },
  {
    key: 'halfflush',
    name: 'Half Flush',
    nameChinese: '混一色',
    points: 6,
    shantenFn: (c, m) => halfFlushShanten(c, m),
  },
  {
    key: 'allpungs',
    name: 'All Pungs',
    nameChinese: '碰碰和',
    points: 6,
    shantenFn: (c, m) => structuredShanten(c, m, { noSeq: true }),
  },
  {
    key: 'allchows',
    name: 'All Chows',
    nameChinese: '平和',
    points: 2,
    shantenFn: (c, m) => structuredShanten(c, m, { noTriplet: true }),
  },
  {
    key: 'sevenpairs',
    name: 'Seven Pairs',
    nameChinese: '七對',
    points: 24,
    concealedOnly: true,
    shantenFn: (c, m) => (m > 0 ? 99 : sevenPairsShanten(c)),
  },
  {
    key: 'thirteenorphans',
    name: 'Thirteen Orphans',
    nameChinese: '十三幺',
    points: 88,
    concealedOnly: true,
    shantenFn: (c, m) => (m > 0 ? 99 : thirteenOrphansShanten(c)),
  },
  {
    key: 'alltermhonor',
    name: 'All Terminals & Honors',
    nameChinese: '混老頭',
    points: 32,
    shantenFn: (c, m) =>
      structuredShanten(restrict(c, ALL_TERMINAL_HONOR), m, { noSeq: true }),
  },
  {
    key: 'uppertiles',
    name: 'Upper Tiles',
    nameChinese: '大于五',
    points: 24,
    shantenFn: (c, m) =>
      structuredShanten(restrict(c, new Set(valueRangeIndices(7, 9))), m),
  },
  {
    key: 'middletiles',
    name: 'Middle Tiles',
    nameChinese: '中',
    points: 24,
    shantenFn: (c, m) =>
      structuredShanten(restrict(c, new Set(valueRangeIndices(4, 6))), m),
  },
  {
    key: 'lowertiles',
    name: 'Lower Tiles',
    nameChinese: '小于五',
    points: 24,
    shantenFn: (c, m) =>
      structuredShanten(restrict(c, new Set(valueRangeIndices(1, 3))), m),
  },
  {
    key: 'knittedstraight',
    name: 'Knitted Straight',
    nameChinese: '組合龍',
    points: 12,
    concealedOnly: true,
    shantenFn: (c, m) => (m > 0 ? 99 : knittedStraightShanten(c)),
  },
  {
    key: 'honorsknitted',
    name: 'Honors & Knitted',
    nameChinese: '全不靠',
    points: 12,
    concealedOnly: true,
    shantenFn: (c, m) => (m > 0 ? 99 : honorsKnittedShanten(c)),
  },
  // chow-combination hands (need the actual melds, not just the count)
  {
    key: 'purestraight',
    name: 'Pure Straight',
    nameChinese: '清龙',
    points: 16,
    shantenFn: (c, m, melds) => chowComboShanten(PURE_STRAIGHT)(c, melds),
  },
  {
    key: 'mixedstraight',
    name: 'Mixed Straight',
    nameChinese: '花龙',
    points: 8,
    shantenFn: (c, m, melds) => chowComboShanten(MIXED_STRAIGHT)(c, melds),
  },
  {
    key: 'pureshifted',
    name: 'Pure Shifted Chows',
    nameChinese: '一色三步高',
    points: 16,
    shantenFn: (c, m, melds) => chowComboShanten(PURE_SHIFTED)(c, melds),
  },
  {
    key: 'mixedtriple',
    name: 'Mixed Triple Chow',
    nameChinese: '三色三同顺',
    points: 8,
    shantenFn: (c, m, melds) => chowComboShanten(MIXED_TRIPLE)(c, melds),
  },
  {
    key: 'mixedshifted',
    name: 'Mixed Shifted Chows',
    nameChinese: '三色三步高',
    points: 6,
    shantenFn: (c, m, melds) => chowComboShanten(MIXED_SHIFTED)(c, melds),
  },
];

// Outs toward a specific archetype: tiles that lower its shanten.
function archetypeOuts(arch, counts, m, melds, pool) {
  const cur = arch.shantenFn(counts, m, melds);
  const work = counts.slice();
  const tiles = [];
  let liveTotal = 0;
  for (let i = 0; i < 34; i++) {
    if (work[i] >= 4) continue;
    const live = liveOf(pool, TILE_IDS[i]);
    work[i]++;
    const ns = arch.shantenFn(work, m, melds);
    work[i]--;
    if (ns < cur) {
      tiles.push(idToTile(TILE_IDS[i]));
      liveTotal += live;
    }
  }
  return { cur, tiles, liveTotal };
}

export function rankTargetHands(counts, melds, pool, seatWind, prevalentWind) {
  const m = melds.length;
  const results = [];

  for (const arch of ARCHETYPES) {
    if (arch.concealedOnly && m > 0) continue;
    const sh = arch.shantenFn(counts, m, melds);
    if (sh > 4 || sh >= 8) continue; // too far / impossible

    const { tiles, liveTotal } = archetypeOuts(arch, counts, m, melds, pool);
    const proximity = 1 / (sh + 1);
    const outsFactor = Math.min(1, liveTotal / 8 + 0.15);
    const compositeScore = arch.points * proximity * outsFactor;

    results.push({
      key: arch.key,
      name: arch.name,
      nameChinese: arch.nameChinese,
      pointValue: arch.points,
      shanten: sh,
      outsCount: liveTotal,
      outsTiles: tiles,
      compositeScore: Math.round(compositeScore * 100) / 100,
    });
  }

  // Closest bets first: shanten dominates. Among equally-close hands prefer the
  // higher-value (then better-supplied) one, so a tenpai legal hand always
  // leads and more ambitious hands follow.
  results.sort(
    (a, b) =>
      a.shanten - b.shanten ||
      b.pointValue - a.pointValue ||
      b.outsCount - a.outsCount,
  );

  return results.slice(0, 3);
}
