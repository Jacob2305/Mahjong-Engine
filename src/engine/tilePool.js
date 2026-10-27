// ---------------------------------------------------------------------------
// Live / dead tile availability tracking.
//
// For every one of the 34 tile types we know the total in the wall (4) and how
// many copies have been removed from the live wall — either seen in the
// discard pool, sitting in our concealed hand, or locked in one of our melds.
// `live` = how many copies could still be drawn / claimed.
// ---------------------------------------------------------------------------

import { TILE_IDS, TILE_INDEX, idsToCounts } from './tiles.js';

// discards: { [tileId]: number }  (seen discard counts)
// handIds:  string[]              (concealed hand)
// melds:    { type, tiles: string[] }[]
export function buildTilePool(discards = {}, handIds = [], melds = []) {
  const seen = new Array(34).fill(0);

  for (const id in discards) {
    const idx = TILE_INDEX[id];
    if (idx !== undefined) seen[idx] += discards[id];
  }

  const handCounts = idsToCounts(handIds);
  for (let i = 0; i < 34; i++) seen[i] += handCounts[i];

  for (const meld of melds) {
    const mc = idsToCounts(meld.tiles || []);
    for (let i = 0; i < 34; i++) seen[i] += mc[i];
  }

  const pool = {};
  for (let i = 0; i < 34; i++) {
    const id = TILE_IDS[i];
    const used = seen[i];
    pool[id] = {
      total: 4,
      seen: used,
      live: Math.max(0, 4 - used),
    };
  }
  return pool;
}

// How many copies of a tile remain available to DRAW, i.e. excluding the
// copies already counted in our own hand (those we already hold).
// `pool.live` already subtracts hand copies, so this is just pool.live.
export function liveOf(pool, id) {
  return pool[id] ? pool[id].live : 4;
}
