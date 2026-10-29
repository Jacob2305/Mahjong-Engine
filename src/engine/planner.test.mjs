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

// 3. Backups add value: two different live routes beat one.
{
  const one = planValue([{ headline: 'A', chance: 0.3 }]);
  const two = planValue([{ headline: 'A', chance: 0.3 }, { headline: 'B', chance: 0.2 }]);
  const dup = planValue([{ headline: 'A', chance: 0.3 }, { headline: 'A', chance: 0.2 }]);
  ok('a different backup plan raises the value', two.value > one.value);
  ok('the same plan twice does not count as a backup', dup.value === one.value);
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
