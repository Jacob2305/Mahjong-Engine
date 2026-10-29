// ---------------------------------------------------------------------------
// Full MCR scorer (all 81 fan + the non-repeat exclusions), copied from the sister
// project Mahjong-Scoring-Calculator (src/engine/), where it is tested. The files
// in this folder use that project's tile ids (m1, s9, p5, we, dr, f1, y1); this
// adapter converts from this app's ids (man1, sou9, pin5, wind_east, dragon_red,
// flower1, season1). To update: copy the calculator's files over these.
// ---------------------------------------------------------------------------

import { scoreHand } from './scorer.js';

const SUIT = { man: 'm', sou: 's', pin: 'p' };
const WIND = { east: 'e', south: 's', west: 'w', north: 'n' };
const DRAGON = { red: 'r', green: 'g', white: 'w' };

// This app's tile id → the calculator's tile id.
export function toMcrId(id) {
  if (id.startsWith('wind_')) return 'w' + WIND[id.slice(5)];
  if (id.startsWith('dragon_')) return 'd' + DRAGON[id.slice(7)];
  if (id.startsWith('flower')) return 'f' + id.slice(6);
  if (id.startsWith('season')) return 'y' + id.slice(6);
  return SUIT[id.slice(0, 3)] + id.slice(3);
}

// concealed: this app's ids (the winning tile included). melds: [{ tiles: ids }].
// ctx: { winType: 'discard'|'selfdraw', winningTile, seatWind, prevalentWind } with
// this app's names ('east' or 'wind_east' both work for winds).
// Returns the calculator's result: { complete, valid, fanTotal, fans, ... }.
export function scoreMcr(concealed, melds = [], flowers = [], ctx = {}) {
  const wind = (w) => (w ? WIND[String(w).replace('wind_', '')] || 'e' : 'e');
  return scoreHand({
    concealed: concealed.map(toMcrId),
    melded: melds.flatMap((m) => (m.tiles || []).map(toMcrId)),
    flowers: flowers.map(toMcrId),
    ctx: {
      winType: ctx.winType || 'discard',
      winningTile: ctx.winningTile ? toMcrId(ctx.winningTile) : null,
      seatWind: wind(ctx.seatWind),
      prevalentWind: wind(ctx.prevalentWind),
      flags: ctx.flags || {},
    },
  });
}
