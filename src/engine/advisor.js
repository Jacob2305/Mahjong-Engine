// ---------------------------------------------------------------------------
// Main advisor orchestrator.
//
// Takes the full game state and returns the advice object the UI renders.
// All sub-calculations are pure; this just wires them together and chooses the
// "playing hand" (after the best discard when holding 14 tiles).
// ---------------------------------------------------------------------------

import { TILE_IDS, TILE_INDEX, idsToCounts, idToTile } from './tiles.js';
import { buildTilePool, liveOf } from './tilePool.js';
import { getShanten } from './shanten.js';
import { evaluateDiscards } from './discardEval.js';
import { evaluateMeld } from './meldEval.js';
import { rankTargetHands } from './targetHands.js';
import { bestScore, MIN_POINTS } from './scoring.js';
import { assemble } from './idealHand.js';
import { findTargets, evaluateHand, distinctPlans, estimateDrawsLeft } from './planner.js';

// Every tile that structurally completes the hand, with its MCR point value.
// In MCR a completion only counts as a WIN when it scores >= 8 points.
function getWinningTiles(counts, m, pool, melds, ctx) {
  const work = counts.slice();
  const wins = [];
  for (let i = 0; i < 34; i++) {
    if (work[i] >= 4) continue;
    work[i]++;
    const sh = getShanten(work, m).shanten;
    if (sh === -1) {
      const score = bestScore(work, melds, ctx);
      wins.push({
        tile: idToTile(TILE_IDS[i]),
        id: TILE_IDS[i],
        liveCopies: liveOf(pool, TILE_IDS[i]),
        points: score.points,
        legal: score.points >= MIN_POINTS,
        reasons: score.reasons,
      });
    }
    work[i]--;
  }
  return wins;
}

// Best draw tiles (outs) when 1 away — tiles that bring you to tenpai.
function getBestDraws(counts, m, pool) {
  const cur = getShanten(counts, m).shanten;
  const work = counts.slice();
  const draws = [];
  for (let i = 0; i < 34; i++) {
    if (work[i] >= 4) continue;
    work[i]++;
    const sh = getShanten(work, m).shanten;
    work[i]--;
    if (sh < cur) {
      draws.push({ tile: idToTile(TILE_IDS[i]), id: TILE_IDS[i], liveCopies: liveOf(pool, TILE_IDS[i]) });
    }
  }
  draws.sort((a, b) => b.liveCopies - a.liveCopies);
  return draws;
}

export function advise(gameState) {
  const {
    handIds = [],
    melds = [],
    discards = {},
    context = {},
  } = gameState;
  const {
    seatWind = 'east',
    prevalentWind = 'east',
    lastDiscard = null,
    canChow = true,
  } = context;

  const pool = buildTilePool(discards, handIds, melds);
  const counts = idsToCounts(handIds);
  const m = melds.length;
  const scoreCtx = { seatWind, prevalentWind };
  // Draws you probably have left; the simulator passes the exact number.
  const drawsLeft = context.drawsLeft ?? estimateDrawsLeft(discards);

  // 14-tile (mod 3 == 2) -> discard mode.
  const discardMode = handIds.length % 3 === 2;

  let recommendedDiscard = null;
  let playingCounts = counts;
  let chosenPlans = null; // the plans the discard decision was based on

  if (discardMode && handIds.length > 0) {
    const evald = evaluateDiscards(counts, melds, pool, scoreCtx, { drawsLeft });
    if (evald.recommended) {
      recommendedDiscard = {
        tile: idToTile(evald.recommended.id),
        id: evald.recommended.id,
        reason: evald.reason,
        shantenAfter: evald.recommended.shantenAfter,
        outsAfter: evald.recommended.outs,
        chance: evald.recommended.planValue,
      };
      chosenPlans = evald.recommended.plans;
      playingCounts = counts.slice();
      playingCounts[TILE_INDEX[evald.recommended.id]]--;
    }
  }

  const playShanten = getShanten(playingCounts, m).shanten;

  // Tenpai / distance status -------------------------------------------------
  // MCR rule: a completion is only a legal WIN at >= 8 points. A structurally
  // complete hand worth < 8 is "value short" — not yet a real tenpai.
  let tenpaiStatus;
  if (playShanten <= 0) {
    const allWins = getWinningTiles(playingCounts, m, pool, melds, scoreCtx);
    const legalWins = allWins.filter((w) => w.legal);
    if (legalWins.length > 0) {
      tenpaiStatus = {
        isTenpai: true,
        shantenNumber: 0,
        winningTiles: legalWins.sort((a, b) => b.points - a.points || b.liveCopies - a.liveCopies),
      };
    } else {
      // structurally tenpai but every wait scores < 8
      tenpaiStatus = {
        isTenpai: false,
        valueShort: true,
        shantenNumber: 0,
        winningTiles: [],
        shortWins: allWins.sort((a, b) => b.points - a.points),
        minPoints: MIN_POINTS,
      };
    }
  } else {
    tenpaiStatus = {
      isTenpai: false,
      shantenNumber: playShanten,
      winningTiles: [],
      bestDraws: playShanten === 1 ? getBestDraws(playingCounts, m, pool).slice(0, 6) : [],
    };
  }

  // The concrete hands we're going for: legal (8+ point) plans that only need
  // tiles that are still live, best chance first. With 14 tiles these are the
  // exact plans the discard was chosen for; otherwise search the current hand.
  if (!chosenPlans) {
    const targets = findTargets(playingCounts, melds, scoreCtx, { maxMissing: 5 });
    chosenPlans = distinctPlans(evaluateHand(playingCounts, targets, pool, drawsLeft).goals, 4);
  }
  const goals = chosenPlans.map((g) => ({
    ...assemble(playingCounts, melds, pool, g),
    chance: g.chance,
  }));
  const idealHand = goals[0] || null;
  const alternativeGoals = goals.slice(1);

  // Legacy archetype list (kept for engine tests; UI uses goals instead).
  const targetHands = rankTargetHands(playingCounts, melds, pool, seatWind, prevalentWind);

  // Meld advice --------------------------------------------------------------
  let meldAdvice = null;
  if (lastDiscard) {
    const res = evaluateMeld(counts, melds, pool, lastDiscard, {
      seatWind,
      prevalentWind,
      canChow,
    });
    meldAdvice = res;
  }

  return {
    discardMode,
    handShanten: playShanten,
    recommendedDiscard,
    meldAdvice,
    targetHands,
    tenpaiStatus,
    idealHand,
    alternativeGoals,
    liveTileMap: pool,
  };
}
