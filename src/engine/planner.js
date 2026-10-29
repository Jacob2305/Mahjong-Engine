// ---------------------------------------------------------------------------
// Planner: play for hands that can actually be declared (8+ points), and keep
// backup routes open so the hand can pivot when the tiles a plan needs run out.
//
// 1. findTargets(): ONE search over the current hand for complete, legal (8+)
//    hands a few tiles away ("targets"), each scored with the full MCR scorer.
// 2. evaluateHand(): for a given hand (e.g. after a candidate discard), how many
//    tiles each target still needs, whether those tiles are still live, and a
//    rough chance of drawing them in the draws left.
// 3. planValue(): the chance that at least one of the best few DIFFERENT plans
//    (different headline patterns) comes in. More good routes = more flexibility.
//
// Pure functions; used by discardEval.js and advisor.js.
// ---------------------------------------------------------------------------

import { TILE_IDS } from './tiles.js';
import { bestScore, MIN_POINTS } from './scoring.js';
import { liveOf } from './tilePool.js';
import { headlineOf } from './idealHand.js';

const canChowAt = (i) => i < 27 && i % 9 <= 6;

// counts: concealed counts (13 or 14 tiles). Returns targets:
// [{ key, target: counts34 (concealed part of the finished hand), picks, pairIdx,
//    points, reasons, headline, selfDrawOnly }]. Liveness is NOT checked here;
// evaluateHand does it. selfDrawOnly: worth 8+ only if you draw the winning tile.
// The chance model below assumes you draw every needed tile yourself, which is
// exactly the self-draw case.
export function findTargets(counts, melds = [], ctx = {}, opts = {}) {
  // timeMs: stop searching after this long and keep what was found (closest first).
  const { maxMissing = 5, maxTargets = 4000, nodeLimit = 1_500_000, timeMs = 250 } = opts;
  const deadline = performance.now() + timeMs;
  const needSets = 4 - melds.length;
  if (needSets < 0) return [];

  const avail = counts.slice();
  const picks = [];
  let pairIdx = -1;
  let nodes = 0;
  const found = new Map();

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
    for (let i = 0; i < 34; i++) if (c[i] > 4) return;
    const key = c.join('');
    if (found.has(key)) return;
    // How the finished hand scores. You'll usually claim tiles, which opens the
    // hand, so plans are valued WITHOUT Concealed Hand (+2). An open hand that
    // scores nothing else is a Chicken Hand (8). Plans that only reach 8 by staying
    // concealed, or by drawing the last tile yourself, are kept for the very end
    // (one tile away) only; evaluateHand enforces that.
    const concealedNow = melds.length === 0;
    const ptsOf = (r) => Number((r.match(/\+(\d+)$/) || [0, 0])[1]);
    const byDiscard = bestScore(c, melds, { ...ctx, winType: 'discard' });
    let open;
    if (concealedNow) {
      const rest = byDiscard.reasons.filter((r) => !r.startsWith('Concealed Hand'));
      const pts = rest.reduce((a, r) => a + ptsOf(r), 0);
      open = pts === 0
        ? { points: 8, reasons: ['Chicken Hand 无番和 +8'], chicken: true }
        : { points: pts, reasons: rest, chicken: false };
    } else {
      open = { points: byDiscard.points, reasons: byDiscard.reasons, chicken: byDiscard.reasons.some((r) => r.startsWith('Chicken Hand')) };
    }

    let finish;
    let sc;
    if (open.points >= MIN_POINTS) {
      finish = 'open';
      sc = open;
    } else if (byDiscard.points >= MIN_POINTS) {
      finish = 'concealed';
      sc = byDiscard;
    } else {
      sc = bestScore(c, melds, { ...ctx, winType: 'selfdraw' });
      if (sc.points < MIN_POINTS) return;
      finish = 'selfdraw';
    }
    found.set(key, {
      // 'open': 8+ even after claiming (claims allowed); 'concealed': needs the
      // Concealed Hand bonus; 'selfdraw': needs a self-drawn last tile.
      finish,
      selfDrawOnly: finish === 'selfdraw',
      chicken: finish === 'open' && open.chicken,
      concealedNow,
      // Scoring if you win off a discard while still concealed (for the last tile).
      concealedPoints: byDiscard.points,
      concealedReasons: byDiscard.reasons,
      melds,
      ctx,
      key,
      target: c,
      picks: picks.map((p) => ({ ...p })),
      pairIdx,
      missing,
      points: sc.points,
      reasons: sc.reasons,
      headline: headlineOf(sc.reasons),
    });
  }

  let limit = 0; // current search depth (tiles missing), raised one step at a time
  let outOfTime = false;
  function rec(i, setsLeft, pairUsed, missing) {
    if (missing > limit || outOfTime) return;
    if ((++nodes & 1023) === 0 && (nodes > nodeLimit || performance.now() > deadline)) {
      outOfTime = true;
      return;
    }
    if (setsLeft === 0 && pairUsed) {
      evaluate(missing);
      return;
    }
    if (i >= 34) return;

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
    rec(i + 1, setsLeft, pairUsed, missing);
  }

  // Closest hands first: everything 1 tile away, then 2, ... so when time runs
  // out, the hands that matter most have already been found.
  for (limit = 1; limit <= maxMissing && !outOfTime; limit++) rec(0, needSets, false, 0);
  return [...found.values()]
    .sort((a, b) => a.missing - b.missing || b.points - a.points)
    .slice(0, maxTargets);
}

// P(at least k successes in n tries), each hitting with probability p.
function atLeast(k, n, p) {
  if (k <= 0) return 1;
  if (k > n || p <= 0) return 0;
  if (p >= 1) return 1;
  let below = 0;
  let term = Math.pow(1 - p, n); // P(X = 0)
  for (let x = 0; x < k; x++) {
    below += term;
    term *= ((n - x) / (x + 1)) * (p / (1 - p));
  }
  return Math.max(0, 1 - below);
}

// How many draws you probably have left, from how many discards have been logged
// (about 70 tiles get drawn after the deal, shared by 4 players).
export function estimateDrawsLeft(discards = {}) {
  const thrown = Object.values(discards).reduce((a, b) => a + b, 0);
  return Math.max(2, Math.min(18, Math.round((70 - thrown) / 4)));
}

// Each turn you draw one tile, and each of the 3 opponents throws one. Opponents
// throw tiles they don't want, so a given live tile shows up in their discards a
// bit less often than in your draws.
const OPPONENTS = 3;
const DISCARD_RATE = 0.5;

// Which set of the target each missing tile is for (pung / chow / pair).
function missingBySet(counts, t) {
  const remain = counts.slice();
  const take = (idx) => {
    if (remain[idx] > 0) {
      remain[idx]--;
      return null;
    }
    return idx;
  };
  const groups = [];
  for (const p of t.picks) {
    const idxs = p.type === 'pung' ? [p.idx, p.idx, p.idx] : [p.idx, p.idx + 1, p.idx + 2];
    const miss = idxs.map(take).filter((x) => x !== null);
    if (miss.length) groups.push({ kind: p.type, miss });
  }
  const pairMiss = [t.pairIdx, t.pairIdx].map(take).filter((x) => x !== null);
  if (pairMiss.length) groups.push({ kind: 'pair', miss: pairMiss });
  return groups;
}

// Chance of completing one set within `turns`. The set's LAST missing tile may be
// claimed (pung: from any opponent, chow: from the left player) when the plan
// allows claims; earlier missing tiles must be drawn. Pairs are drawn.
function setChance(group, livePer, unseen, turns, claimsAllowed) {
  const miss = group.miss;
  const extra =
    !claimsAllowed || group.kind === 'pair' ? 0 : group.kind === 'pung' ? OPPONENTS * DISCARD_RATE : DISCARD_RATE;
  let chance = 1;
  miss.forEach((idx, k) => {
    const p = livePer[idx] / unseen;
    const last = k === miss.length - 1;
    const tries = last ? Math.round(turns * (1 + extra)) : turns;
    chance *= atLeast(1, tries, p);
  });
  return chance;
}

// For a hand (concealed counts), rate every target. Returns targets that can
// still be completed, each with { need: [{ idx, id, count, live }], missing, chance },
// best first, plus `dead`: closest targets that are impossible because a tile they
// need is all gone (for "switching plans" explanations).
//
// Chance model: you draw once per turn; pung tiles can also be claimed from any
// opponent's discard and chow tiles from the left player's, but only for plans
// that stay 8+ once the hand is open. The very last tile (the win) can be taken
// from any player's discard unless the plan only counts as a self-draw.
export function evaluateHand(counts, targets, pool, drawsLeft) {
  const livePer = TILE_IDS.map((id) => liveOf(pool, id));
  const unseen = Math.max(1, livePer.reduce((a, b) => a + b, 0));

  const ok = [];
  const dead = [];
  for (const t of targets) {
    const need = [];
    let missing = 0;
    let impossible = null;
    for (let i = 0; i < 34; i++) {
      const k = t.target[i] - counts[i];
      if (k <= 0) continue;
      if (k > livePer[i]) impossible = impossible || TILE_IDS[i];
      need.push({ idx: i, id: TILE_IDS[i], count: k, live: livePer[i] });
      missing += k;
    }
    if (impossible) {
      dead.push({ ...t, missing, deadTile: impossible });
      continue;
    }
    const finish = t.finish || 'open';
    // Concealed-only and self-draw-only plans: only when one tile away.
    if (finish !== 'open' && missing > 1) continue;
    // Claims save draws, so an open plan can need a few more tiles than draws left.
    if (missing > drawsLeft * 2) continue;

    let chance;
    let shown = {};
    if (missing === 1) {
      const p = need[0].live / unseen;
      if (t.chicken) {
        // Chicken Hand: the hand must already be open, the win must come off a
        // discard (a self-draw adds a point), and the wait must score nothing.
        if (t.concealedNow) continue;
        const exact = bestScore(t.target, t.melds, { ...t.ctx, winType: 'discard', winningTile: need[0].id });
        if (exact.points < MIN_POINTS) continue;
        chance = atLeast(1, Math.round(drawsLeft * OPPONENTS * DISCARD_RATE), p);
      } else {
        // Draw it, or (unless self-draw only) win on anyone's discard.
        const extra = finish === 'selfdraw' ? 0 : OPPONENTS * DISCARD_RATE;
        chance = atLeast(1, Math.round(drawsLeft * (1 + extra)), p);
        // Winning off a discard while still concealed adds Concealed Hand back.
        if (finish === 'open' && t.concealedNow) {
          shown = { points: t.concealedPoints, reasons: t.concealedReasons };
        }
      }
    } else {
      chance = 1;
      for (const g of missingBySet(counts, t)) {
        chance *= setChance(g, livePer, unseen, drawsLeft, finish === 'open');
      }
      // Chicken Hand also needs a no-point wait and a win off a discard.
      if (t.chicken) chance *= 0.5;
    }
    ok.push({ ...t, ...shown, need, missing, chance });
  }
  // Mostly about winning at all; a bigger hand is a small bonus.
  const worth = (g) => g.chance * (1 + Math.min(g.points, 64) / 64);
  ok.sort((a, b) => worth(b) - worth(a) || a.missing - b.missing);
  dead.sort((a, b) => a.missing - b.missing || b.points - a.points);
  return { goals: ok, dead };
}

// The best plan per headline (distinct directions), best first.
export function distinctPlans(goals, max = 4) {
  const seen = new Set();
  const out = [];
  for (const g of goals) {
    if (seen.has(g.headline)) continue;
    seen.add(g.headline);
    out.push(g);
    if (out.length >= max) break;
  }
  return out;
}

// Chance that at least one route comes in. Routes are counted by the TILES they
// need, not by name: 30 different Chicken Hand shapes are 30 routes, which is the
// flexibility that lets the hand pivot. A route that needs mostly the same tiles as
// one already counted adds only a little (they tend to succeed or fail together).
// `plans` (one per name) is what the explanation and plan cards show.
export function planValue(goals, k = 3, maxRoutes = 10) {
  const plans = distinctPlans(goals, k);
  const chosen = [];
  let none = 1;
  for (const g of goals.slice(0, 80)) {
    if (chosen.length >= maxRoutes) break;
    const total = g.need.reduce((a, n) => a + n.count, 0) || 1;
    let overlap = 0;
    for (const c of chosen) {
      let shared = 0;
      for (const n of g.need) {
        const m = c.need.find((x) => x.idx === n.idx);
        if (m) shared += Math.min(n.count, m.count);
      }
      overlap = Math.max(overlap, shared / total);
    }
    if (chosen.length && overlap >= 0.999) continue; // same tiles: same route
    none *= 1 - g.chance * (1 - 0.8 * overlap);
    chosen.push(g);
  }
  return { value: 1 - none, plans, routes: chosen.length };
}
