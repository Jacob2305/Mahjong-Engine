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
  const { maxMissing = 5, maxTargets = 600, nodeLimit = 1_500_000 } = opts;
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
    // Legal off a discard is best; legal only when you draw the last tile yourself
    // (self-draw adds Fully Concealed / Self-Drawn) still counts, flagged.
    let sc = bestScore(c, melds, { ...ctx, winType: 'discard' });
    let selfDrawOnly = false;
    if (sc.points < MIN_POINTS) {
      sc = bestScore(c, melds, { ...ctx, winType: 'selfdraw' });
      if (sc.points < MIN_POINTS) return;
      selfDrawOnly = true;
    }
    found.set(key, {
      selfDrawOnly,
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

  function rec(i, setsLeft, pairUsed, missing) {
    if (missing > maxMissing || ++nodes > nodeLimit) return;
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

  rec(0, needSets, false, 0);
  return [...found.values()]
    .sort((a, b) => a.missing - b.missing || b.points - a.points)
    .slice(0, maxTargets);
}

// P(at least k successes in n draws), each draw hitting with probability p.
function atLeast(k, n, p) {
  if (k <= 0) return 1;
  if (k > n || p <= 0) return 0;
  let below = 0;
  let term = Math.pow(1 - p, n); // P(X = 0)
  for (let x = 0; x < k; x++) {
    below += term;
    term *= ((n - x) / (x + 1)) * (p / (1 - p || 1e-9));
  }
  return Math.max(0, 1 - below);
}

// How many draws you likely have left, from how many discards have been logged
// (about 70 tiles get drawn after the deal, shared by 4 players).
export function estimateDrawsLeft(discards = {}) {
  const thrown = Object.values(discards).reduce((a, b) => a + b, 0);
  return Math.max(2, Math.min(18, Math.round((70 - thrown) / 4)));
}

// For a hand (concealed counts), rate every target. Returns targets that can
// still be completed, each with { need: [{ idx, id, count, live }], missing, chance },
// best first, plus `dead`: closest targets that are impossible because a tile they
// need is all gone (for "switching plans" explanations).
export function evaluateHand(counts, targets, pool, drawsLeft) {
  let unseen = 0;
  for (let i = 0; i < 34; i++) unseen += liveOf(pool, TILE_IDS[i]);
  unseen = Math.max(1, unseen);

  const ok = [];
  const dead = [];
  for (const t of targets) {
    const need = [];
    let missing = 0;
    let impossible = null;
    for (let i = 0; i < 34; i++) {
      const k = t.target[i] - counts[i];
      if (k <= 0) continue;
      const live = liveOf(pool, TILE_IDS[i]);
      if (k > live) impossible = impossible || TILE_IDS[i];
      need.push({ idx: i, id: TILE_IDS[i], count: k, live });
      missing += k;
    }
    if (impossible) {
      dead.push({ ...t, missing, deadTile: impossible });
      continue;
    }
    if (missing > drawsLeft) continue;
    // Chance of drawing every needed tile (treated as independent). Each draw
    // also needs a junk tile to throw, which a hand short of its target always has.
    let chance = 1;
    for (const n of need) chance *= atLeast(n.count, drawsLeft, n.live / unseen);
    ok.push({ ...t, need, missing, chance });
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

// Chance that at least one of the top few different plans comes in.
// Rewards having backups, not just one strong route.
export function planValue(goals, k = 3) {
  const plans = distinctPlans(goals, k);
  let none = 1;
  for (const g of plans) none *= 1 - g.chance;
  return { value: 1 - none, plans };
}
