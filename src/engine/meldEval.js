// ---------------------------------------------------------------------------
// Meld (chow / pung / kong) claim evaluator.
//
// Given the tile an opponent just discarded, decide whether claiming it is
// worth it. We compare hand shanten with vs. without the claim, factor in the
// value of the resulting meld (dragons / seat / prevalent winds), and the loss
// of concealed-hand bonuses, then emit a claim/skip recommendation + reason.
// ---------------------------------------------------------------------------

import { TILE_IDS, TILE_INDEX, tileName, isSuited, idToTile } from './tiles.js';
import { getShanten } from './shanten.js';
import { legalWinGoals } from './idealHand.js';

const DRAGON_IDX = new Set([31, 32, 33]);
const WIND_IDX = { east: 27, south: 28, west: 29, north: 30 };

// How far the SHAPE is from complete (not whether it reaches 8 points; the plan
// cards show that): "one tile from a complete hand" / "2 tiles from that".
const away = (n) => (n <= 0 ? 'one tile from a complete hand' : `${n + 1} tiles from a complete hand`);

function isValueTile(idx, seatWind, prevalentWind) {
  if (DRAGON_IDX.has(idx)) return { value: true, label: 'dragon pung (+2)' };
  if (idx === WIND_IDX[seatWind]) return { value: true, label: 'seat-wind pung (+2)' };
  if (idx === WIND_IDX[prevalentWind])
    return { value: true, label: 'prevalent-wind pung (+2)' };
  return { value: false, label: '' };
}

// Best (lowest) shanten achievable after discarding one tile from a hand.
function bestDiscardShanten(counts, m) {
  let best = 99;
  const work = counts.slice();
  for (let i = 0; i < 34; i++) {
    if (work[i] === 0) continue;
    work[i]--;
    const sh = getShanten(work, m).shanten;
    work[i]++;
    if (sh < best) best = sh;
  }
  return best === 99 ? getShanten(counts, m).shanten : best;
}

// Does a viable, legal (>=8pt) winning hand still exist within reach after a
// claim? Uses the real goal search, so it accounts for fan combinations and
// won't be fooled into thinking an impossible pattern is still open.
function hasDecentPath(counts, melds, pool, seatWind, prevalentWind) {
  const goals = legalWinGoals(
    counts,
    melds,
    pool,
    { seatWind, prevalentWind },
    { maxMissing: 4, maxGoals: 1 },
  );
  return goals.length > 0;
}

// Find chow shapes the discard completes using two concealed tiles.
function chowShapes(counts, idx) {
  if (idx >= 27) return []; // honors can't chow
  const base = idx % 9;
  const shapes = [];
  // (idx-2, idx-1)
  if (base >= 2 && counts[idx - 2] > 0 && counts[idx - 1] > 0)
    shapes.push([idx - 2, idx - 1]);
  // (idx-1, idx+1)
  if (base >= 1 && base <= 7 && counts[idx - 1] > 0 && counts[idx + 1] > 0)
    shapes.push([idx - 1, idx + 1]);
  // (idx+1, idx+2)
  if (base <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0)
    shapes.push([idx + 1, idx + 2]);
  return shapes;
}

// counts: concealed counts (13-tile hand before claiming)
// melds:  existing claimed melds
// discardId: the tile just thrown
// canChowFromThisPlayer: chow is only legal from the left neighbour
export function evaluateMeld(
  counts,
  melds,
  pool,
  discardId,
  { seatWind, prevalentWind, canChow = true } = {},
) {
  const idx = TILE_INDEX[discardId];
  if (idx === undefined) return null;

  const m = melds.length;
  const shantenIfSkip = getShanten(counts, m).shanten;
  const tName = tileName(discardId);
  const valInfo = isValueTile(idx, seatWind, prevalentWind);

  const candidates = [];

  // ---- PUNG ----------------------------------------------------------------
  if (counts[idx] >= 2) {
    const after = counts.slice();
    after[idx] -= 2;
    const newMelds = [...melds, { type: 'pung', tiles: [discardId, discardId, discardId] }];
    const shantenIfClaim = bestDiscardShanten(after, m + 1);
    const improves = shantenIfSkip - shantenIfClaim;
    const decent = hasDecentPath(after, newMelds, pool, seatWind, prevalentWind);

    let recommendation = 'skip';
    let reason;
    if (valInfo.value && improves >= 0) {
      recommendation = 'claim';
      reason = `Take the ${tName} as a triplet — it scores a ${valInfo.label} and ${
        improves >= 1
          ? (shantenIfClaim <= 0 ? 'puts you one tile from a complete hand' : `brings you to ${away(shantenIfClaim)}`)
          : 'banks guaranteed points without slowing you down'
      }.`;
    } else if (improves >= 1 && decent) {
      recommendation = 'claim';
      reason = `Take the ${tName} as a triplet — it ${shantenIfClaim <= 0 ? 'puts you one tile from a complete hand' : `brings you to ${away(shantenIfClaim)}`} and an 8-point-plus hand is still reachable.`;
    } else if (improves >= 1 && !decent) {
      reason = `Leave the ${tName}. Taking it gets you to ${away(shantenIfClaim)}, but it locks the hand under 8 points — you'd be unable to legally win.`;
    } else {
      reason = `Leave the ${tName} — taking it as a triplet wouldn't get you any closer (still ${away(shantenIfClaim)}) and would give up your concealed-hand bonus.`;
    }

    candidates.push({
      meldType: 'pung',
      tile: idToTile(discardId),
      meldTiles: [discardId, discardId, discardId],
      recommendation,
      reason,
      shantenIfClaim,
      shantenIfSkip,
      value: valInfo.value,
    });
  }

  // ---- KONG ----------------------------------------------------------------
  if (counts[idx] >= 3) {
    const after = counts.slice();
    after[idx] -= 3;
    // Kong draws a replacement tile; treat resulting concealed as 13-equiv.
    const shantenIfClaim = getShanten(after, m + 1).shanten;
    const committedPungs =
      melds.filter((x) => x.type === 'pung' || x.type === 'kong').length;
    const recommend = valInfo.value || committedPungs >= 3;
    candidates.push({
      meldType: 'kong',
      tile: idToTile(discardId),
      meldTiles: [discardId, discardId, discardId, discardId],
      recommendation: recommend ? 'claim' : 'skip',
      reason: recommend
        ? `Claim the ${tName} kong — ${
            valInfo.value ? `it's a ${valInfo.label} ` : 'you are committed to pungs '
          }and you draw a replacement tile.`
        : `Skip the ${tName} kong — it's not a value tile and exposes a triplet you could keep concealed.`,
      shantenIfClaim,
      shantenIfSkip,
      value: valInfo.value,
    });
  }

  // ---- CHOW (left player only) --------------------------------------------
  const shapes = isSuited(discardId) ? chowShapes(counts, idx) : [];
  if (shapes.length > 0) {
    // pick the shape giving the best resulting shanten
    let bestShape = null;
    let bestSh = 99;
    for (const sh of shapes) {
      const after = counts.slice();
      after[sh[0]]--;
      after[sh[1]]--;
      const val = bestDiscardShanten(after, m + 1);
      if (val < bestSh) { bestSh = val; bestShape = sh; }
    }
    const after = counts.slice();
    after[bestShape[0]]--;
    after[bestShape[1]]--;
    const newMelds = [
      ...melds,
      { type: 'chow', tiles: [TILE_IDS[bestShape[0]], discardId, TILE_IDS[bestShape[1]]] },
    ];
    const improves = shantenIfSkip - bestSh;
    const decent = hasDecentPath(after, newMelds, pool, seatWind, prevalentWind);

    let recommendation = 'skip';
    let reason;
    if (!canChow) {
      reason = `You can only take a run from the player on your left, so ${tName} isn't claimable as a run right now.`;
    } else if (improves >= 1 && decent) {
      recommendation = 'claim';
      reason = `Take the ${tName} into a run — it ${bestSh <= 0 ? 'puts you one tile from a complete hand' : `brings you to ${away(bestSh)}`} and an 8-point-plus hand is still reachable. Heads up: opening your hand drops the concealed bonus (−2 to −4 pts).`;
    } else if (improves >= 1 && !decent) {
      reason = `Leave the ${tName} — making the run gets you to ${away(bestSh)}, but no 8-point hand remains, and you'd surrender the concealed-hand bonus.`;
    } else {
      reason = `Leave the ${tName} — taking it into a run wouldn't get you any closer (still ${away(bestSh)}) and would cost your concealed-hand bonus.`;
    }

    candidates.push({
      meldType: 'chow',
      tile: idToTile(discardId),
      meldTiles: newMelds[newMelds.length - 1].tiles,
      recommendation,
      reason,
      shantenIfClaim: bestSh,
      shantenIfSkip,
      value: false,
      chowLegal: canChow,
    });
  }

  if (candidates.length === 0) {
    return {
      tile: idToTile(discardId),
      meldType: null,
      recommendation: 'skip',
      reason: `You can't form any meld with ${tName} from your current hand.`,
      shantenIfClaim: shantenIfSkip,
      shantenIfSkip,
    };
  }

  // Prefer a recommended claim; otherwise the best-shanten candidate.
  candidates.sort((a, b) => {
    const ca = a.recommendation === 'claim' ? 0 : 1;
    const cb = b.recommendation === 'claim' ? 0 : 1;
    return ca - cb || a.shantenIfClaim - b.shantenIfClaim;
  });
  return candidates[0];
}
