// Tests for the planner (play for legal 8+ hands, with backups).
// Run with: node src/engine/planner.test.mjs
import { advise } from './advisor.js';
import { findTargets, evaluateHand, planValue } from './planner.js';
import { idsToCounts } from './tiles.js';
import { buildTilePool } from './tilePool.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
}
const ctx = { seatWind: 'south', prevalentWind: 'south' };

// 1. No plan may need a tile whose copies are all gone (the original bug: the
//    plan was "Mixed Straight, needs Red Dragon" with every Red Dragon discarded).
{
  const hand = ['dragon_red', 'dragon_red', 'man1', 'man2', 'man3', 'pin4', 'pin5', 'pin6', 'sou7', 'sou8', 'sou9', 'wind_east', 'wind_east', 'sou2'];
  const a = advise({ handIds: hand, melds: [], discards: { dragon_red: 2 }, context: ctx });
  const goals = [a.idealHand, ...a.alternativeGoals].filter(Boolean);
  ok('goals exist', goals.length > 0);
  ok('no goal needs a dead tile', goals.every((g) => g.needTiles.every((t) => t.live > 0)),
    goals.map((g) => g.needTiles.map((t) => `${t.id}:${t.live}`).join(' ')).join(' | '));
  ok('explanation never asks for the dead Red Dragon', !/needs[^.]*Red/.test(a.recommendedDiscard.reason), a.recommendedDiscard.reason);
}

// 2. Pivot: the same hand, but now the East winds are gone and the Red Dragons
//    are live, so the plan must switch to the dragons.
{
  const hand = ['dragon_red', 'dragon_red', 'man1', 'man2', 'man3', 'pin4', 'pin5', 'pin6', 'sou7', 'sou8', 'sou9', 'wind_east', 'wind_east', 'sou2'];
  const counts = idsToCounts(hand);
  const targets = findTargets(counts, [], ctx);
  const liveEast = evaluateHand(counts, targets, buildTilePool({ dragon_red: 2 }, hand, []), 12).goals;
  const liveRed = evaluateHand(counts, targets, buildTilePool({ wind_east: 2 }, hand, []), 12).goals;
  const needs = (goals) => new Set(goals.slice(0, 5).flatMap((g) => g.need.map((n) => n.id)));
  ok('with Red Dragons dead, plans never need them', !needs(liveEast).has('dragon_red'));
  ok('with East Winds dead, plans never need them', !needs(liveRed).has('wind_east'));
}

// 3. Backups add value: routes count by the tiles they need, not their name.
{
  const needA = ['sou3'], needB = ['pin7'];
  const route = (headline, chance, ids) => ({ headline, chance, need: ids.map((id) => ({ idx: id.length + id.charCodeAt(3), id, count: 1 })) });
  const one = planValue([route('A', 0.3, needA)]);
  const two = planValue([route('A', 0.3, needA), route('B', 0.2, needB)]);
  const sameName = planValue([route('Chicken', 0.3, needA), route('Chicken', 0.2, needB)]);
  const sameTiles = planValue([route('A', 0.3, needA), route('B', 0.2, needA)]);
  ok('a second route with different tiles raises the value', two.value > one.value);
  ok('same name but different tiles still counts (e.g. many Chicken Hand shapes)', sameName.value > one.value);
  ok('a route needing exactly the same tiles adds nothing', Math.abs(sameTiles.value - one.value) < 1e-9);
}

// 4. A dead isolated tile goes when the rest is one tile from a hand that's
//    legal by self-draw (Fully Concealed Hand).
{
  const hand = ['man9', 'man2', 'man3', 'man4', 'sou5', 'sou6', 'sou7', 'pin1', 'pin2', 'pin3', 'pin5', 'pin5', 'wind_east', 'wind_east'];
  const a = advise({ handIds: hand, melds: [], discards: { man9: 3 }, context: { seatWind: 'east', prevalentWind: 'east' } });
  ok('throws the dead 9-Characters', a.recommendedDiscard.id === 'man9', a.recommendedDiscard.id);
  ok('explanation states the plan and its chance', /Plan: .*Rough chance .*\d+%/.test(a.recommendedDiscard.reason), a.recommendedDiscard.reason);
  ok('short reason is one short line', a.recommendedDiscard.short.length < 90, a.recommendedDiscard.short);
  ok('plan named after its pattern, not Concealed Hand', !/Concealed Hand/.test(a.idealHand.headline), a.idealHand.headline);
}

// 5. Chicken Hand: allowed, but only open, off a discard, with a wait that scores
//    nothing. Claimed 1-2-3 Characters; waiting on 4- or 7-Characters.
{
  const melds = [{ type: 'chow', tiles: ['man1', 'man2', 'man3'] }];
  const hand = ['sou3', 'sou4', 'sou5', 'pin6', 'pin7', 'pin8', 'man5', 'man6', 'wind_north', 'wind_north'];
  const ectx = { seatWind: 'east', prevalentWind: 'east' };
  const counts = idsToCounts(hand);
  const goals = evaluateHand(counts, findTargets(counts, melds, ectx), buildTilePool({}, hand, melds), 12).goals;
  const chickenWins = goals.filter((g) => g.chicken && g.missing === 1).map((g) => g.need[0].id);
  ok('Chicken Hand on 7-Characters is a plan', chickenWins.includes('man7'), chickenWins.join(','));
  ok('4-Characters (adds Short Straight +1) is not', !chickenWins.includes('man4'), chickenWins.join(','));
}
// 6. A concealed hand can't finish as a Chicken Hand (Concealed Hand adds 2).
{
  const hand = ['man1', 'man2', 'man3', 'sou3', 'sou4', 'sou5', 'pin6', 'pin7', 'pin8', 'man5', 'man6', 'wind_north', 'wind_north'];
  const ectx = { seatWind: 'east', prevalentWind: 'east' };
  const counts = idsToCounts(hand);
  const goals = evaluateHand(counts, findTargets(counts, [], ectx), buildTilePool({}, hand, []), 12).goals;
  ok('no one-away Chicken Hand while concealed', !goals.some((g) => g.chicken && g.missing === 1));
}
// 7. Plans that need the Concealed Hand bonus are not planned from far away.
{
  const hand = ['man2', 'man3', 'man4', 'man6', 'man7', 'man8', 'pin3', 'pin4', 'sou5', 'sou5', 'dragon_white', 'dragon_white', 'wind_west'];
  const counts = idsToCounts(hand);
  const goals = evaluateHand(counts, findTargets(counts, [], ctx), buildTilePool({}, hand, []), 14).goals;
  ok('only open plans when 2+ tiles away', goals.filter((g) => g.missing > 1).every((g) => g.finish === 'open'));
  ok('open plans are scored without Concealed Hand', goals.filter((g) => g.missing > 1).every((g) => !g.reasons.some((r) => r.startsWith('Concealed Hand'))));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
