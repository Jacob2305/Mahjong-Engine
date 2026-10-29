// ---------------------------------------------------------------------------
// MCR hand scorer (fan / points).
//
// Chinese Official Mahjong requires a winning hand to total at least 8 points
// (flowers don't count). This scores a COMPLETE hand with the full 81-fan scorer
// in ./mcr/ (copied from Mahjong-Scoring-Calculator, where it is tested), so the
// engine judges "is this a legal win?" exactly like the calculator does.
//
// Scored as a win BY DISCARD unless ctx.winType says otherwise: that includes
// Concealed Hand (+2) for a concealed hand, and a self-draw would only add more,
// so it's the safe baseline for planning.
// ---------------------------------------------------------------------------

import { TILE_IDS } from './tiles.js';
import { scoreMcr } from './mcr/index.js';

export const MIN_POINTS = 8;

const cache = new Map();
const CACHE_LIMIT = 50000;

// counts: length-34 concealed counts (winning tile included).
// melds: claimed melds [{ type, tiles }]. ctx: { seatWind, prevalentWind, winType?, winningTile? }.
// Returns { points, reasons: ['Half Flush 混一色 +6', ...], complete }.
export function bestScore(counts, melds = [], ctx = {}) {
  const key = `${counts.join('')}|${melds.map((m) => m.tiles.join(',')).join(';')}|${ctx.seatWind}|${ctx.prevalentWind}|${ctx.winType || 'discard'}|${ctx.winningTile || ''}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const concealed = [];
  counts.forEach((n, i) => {
    for (let k = 0; k < n; k++) concealed.push(TILE_IDS[i]);
  });
  const r = scoreMcr(concealed, melds, [], ctx);
  const out = r.complete
    ? {
        points: r.fanTotal,
        reasons: r.fans
          .filter((f) => f.id !== 'flower')
          .map((f) => `${f.name} ${f.nameCn}${f.count > 1 ? ` ×${f.count}` : ''} +${f.total}`),
        complete: true,
      }
    : { points: 0, reasons: [], complete: false };

  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, out);
  return out;
}

export const isLegalWin = (counts, melds, ctx) => bestScore(counts, melds, ctx).points >= MIN_POINTS;
