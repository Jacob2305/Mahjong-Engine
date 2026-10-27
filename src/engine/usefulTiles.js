// ---------------------------------------------------------------------------
// Useful-tile ("outs") calculator.
//
// Given a hand (concealed counts + openMelds) it finds every tile type that,
// if drawn, would reduce the hand's shanten by 1 — these are the outs. Each is
// reported with how many live copies remain (from the tile pool).
// ---------------------------------------------------------------------------

import { TILE_IDS } from './tiles.js';
import { getShanten } from './shanten.js';
import { liveOf } from './tilePool.js';

// Returns { id, index, newShanten, liveCopies }[] sorted by live copies desc.
export function getUsefulTiles(counts, openMelds, pool) {
  const cur = getShanten(counts, openMelds).shanten;
  const out = [];
  const work = counts.slice();
  for (let i = 0; i < 34; i++) {
    if (work[i] >= 4) continue;
    const id = TILE_IDS[i];
    const live = liveOf(pool, id);
    work[i]++;
    const ns = getShanten(work, openMelds).shanten;
    work[i]--;
    if (ns < cur) {
      out.push({ id, index: i, newShanten: ns, liveCopies: live });
    }
  }
  out.sort((a, b) => b.liveCopies - a.liveCopies);
  return out;
}

// Total live outs (sum of live copies across useful tiles).
export function countLiveOuts(usefulList) {
  return usefulList.reduce((a, u) => a + u.liveCopies, 0);
}
