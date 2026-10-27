// ---------------------------------------------------------------------------
// Ideal-hand / goal builder.
//
// Searches for COMPLETE, LEGAL (>= 8 point) winning hands closest to the tiles
// you currently hold — the concrete hands the bot is "going for". Every
// candidate is scored with the real MCR scorer and rejected below 8 points, so
// a goal always shows a genuinely winnable hand (with its fan COMBINATION that
// adds up to >= 8, e.g. Mixed Shifted Chows 6 + All Chows 2), never a bare
// 2-point pattern and never something the melds make impossible (a flush across
// two melded suits simply never scores as a flush, so it can't appear).
//
// `legalWinGoals` returns several distinct directions (keyed by their headline
// pattern), closest first. Each goal lists the full 14-tile shape split into
// sets, marking tiles you have vs. tiles you still need to draw.
// ---------------------------------------------------------------------------

import { TILE_IDS } from './tiles.js';
import { bestScore, MIN_POINTS } from './scoring.js';
import { liveOf } from './tilePool.js';

const canChowAt = (i) => i < 27 && i % 9 <= 6;

const stripPts = (r) => r.replace(/\s*\+\d+$/, '');

// The headline = the single highest-scoring fan (the pattern that defines the
// direction). The full combination is kept separately as `fans`.
function headlineOf(reasons) {
  let headline = reasons[0] ? stripPts(reasons[0]) : 'a legal hand';
  let hp = -1;
  for (const r of reasons) {
    const mm = r.match(/\+(\d+)$/);
    const v = mm ? Number(mm[1]) : 0;
    if (v > hp) {
      hp = v;
      headline = stripPts(r);
    }
  }
  return headline;
}

function assignTile(ix, remain, pool) {
  const id = TILE_IDS[ix];
  let have = false;
  if (remain[ix] > 0) {
    have = true;
    remain[ix]--;
  }
  return { id, have, live: pool ? liveOf(pool, id) : 4 };
}

// Turn a found candidate into the display object the UI renders.
function assemble(counts, melds, pool, cand) {
  const groups = [];
  for (const md of melds) {
    groups.push({
      kind: md.type,
      tiles: md.tiles.map((id) => ({ id, have: true, live: pool ? liveOf(pool, id) : 4 })),
    });
  }

  const remain = counts.slice();
  const setGroups = cand.picks
    .map((p) => ({
      kind: p.type,
      idxs: p.type === 'pung' ? [p.idx, p.idx, p.idx] : [p.idx, p.idx + 1, p.idx + 2],
    }))
    .sort((a, b) => a.idxs[0] - b.idxs[0]);

  for (const g of setGroups) {
    groups.push({ kind: g.kind, tiles: g.idxs.map((ix) => assignTile(ix, remain, pool)) });
  }
  groups.push({
    kind: 'pair',
    tiles: [cand.pairIdx, cand.pairIdx].map((ix) => assignTile(ix, remain, pool)),
  });

  return {
    missing: cand.missing,
    points: cand.points,
    fans: cand.reasons.map(stripPts),
    headline: headlineOf(cand.reasons),
    groups,
    needTiles: groups.flatMap((g) => g.tiles).filter((t) => !t.have),
  };
}

// counts: concealed hand counts (length-34). melds: claimed melds.
// Returns up to `maxGoals` distinct legal-win directions, closest first.
export function legalWinGoals(
  counts,
  melds = [],
  pool = null,
  ctx = {},
  { maxMissing = 5, maxGoals = 4 } = {},
) {
  const needSets = 4 - melds.length;
  if (needSets < 0) return [];

  const avail = counts.slice();
  const picks = [];
  let pairIdx = -1;
  let nodes = 0;
  const byHeadline = new Map();

  function evaluate(missing) {
    const c = new Array(34).fill(0);
    for (const p of picks) {
      if (p.type === 'pung') c[p.idx] += 3;
      else {
        c[p.idx] += 1;
        c[p.idx + 1] += 1;
        c[p.idx + 2] += 1;
      }
    }
    c[pairIdx] += 2;
    for (let i = 0; i < 34; i++) if (c[i] > 4) return; // impossible (>4 copies)

    const sc = bestScore(c, melds, ctx);
    if (sc.points < MIN_POINTS) return; // must reach the 8-point minimum

    const h = headlineOf(sc.reasons);
    const prev = byHeadline.get(h);
    if (
      !prev ||
      missing < prev.missing ||
      (missing === prev.missing && sc.points > prev.points)
    ) {
      byHeadline.set(h, {
        picks: picks.map((p) => ({ ...p })),
        pairIdx,
        missing,
        points: sc.points,
        reasons: sc.reasons,
      });
    }
  }

  function rec(i, setsLeft, pairUsed, missing) {
    if (missing > maxMissing) return;
    if (++nodes > 3_000_000) return; // safety valve
    if (setsLeft === 0 && pairUsed) {
      evaluate(missing);
      return;
    }
    if (i >= 34) return;

    // tile-using branches first so close, low-missing goals surface early
    if (setsLeft > 0) {
      const upng = Math.min(3, avail[i]);
      avail[i] -= upng;
      picks.push({ type: 'pung', idx: i });
      rec(i, setsLeft - 1, pairUsed, missing + (3 - upng));
      picks.pop();
      avail[i] += upng;

      if (canChowAt(i)) {
        const u0 = avail[i] > 0 ? 1 : 0;
        const u1 = avail[i + 1] > 0 ? 1 : 0;
        const u2 = avail[i + 2] > 0 ? 1 : 0;
        avail[i] -= u0;
        avail[i + 1] -= u1;
        avail[i + 2] -= u2;
        picks.push({ type: 'chow', idx: i });
        rec(i, setsLeft - 1, pairUsed, missing + (3 - u0 - u1 - u2));
        picks.pop();
        avail[i] += u0;
        avail[i + 1] += u1;
        avail[i + 2] += u2;
      }
    }

    if (!pairUsed) {
      const u = Math.min(2, avail[i]);
      avail[i] -= u;
      const prev = pairIdx;
      pairIdx = i;
      rec(i, setsLeft, true, missing + (2 - u));
      pairIdx = prev;
      avail[i] += u;
    }

    rec(i + 1, setsLeft, pairUsed, missing); // leave leftover copies as floaters
  }

  rec(0, needSets, false, 0);

  const goals = [...byHeadline.values()].map((c) => assemble(counts, melds, pool, c));
  goals.sort((a, b) => a.missing - b.missing || b.points - a.points);
  return goals.slice(0, maxGoals);
}

// Convenience: the single closest legal win (or null).
export function closestLegalWin(counts, melds = [], pool = null, ctx = {}, maxMissing = 6) {
  return legalWinGoals(counts, melds, pool, ctx, { maxMissing, maxGoals: 1 })[0] || null;
}
