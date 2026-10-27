// Quick sanity tests for the engine. Run with: node src/engine/engine.test.mjs
import { idsToCounts } from './tiles.js';
import { getShanten, sevenPairsShanten } from './shanten.js';
import { buildTilePool } from './tilePool.js';
import { advise } from './advisor.js';

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got} want=${want}`);
}

// 1. Winning standard hand: 123m 456m 789m 11p + EE  -> -1 (complete)
eq('complete hand',
  getShanten(idsToCounts(['man1','man2','man3','man4','man5','man6','man7','man8','man9','pin1','pin1','pin1','wind_east','wind_east']), 0).shanten,
  -1);

// 2. Tenpai: 123m 456m 789m EE RR (13 tiles, shanpon wait) -> 0
eq('tenpai shanpon',
  getShanten(idsToCounts(['man1','man2','man3','man4','man5','man6','man7','man8','man9','wind_east','wind_east','dragon_red','dragon_red']), 0).shanten,
  0);

// 3. Seven pairs with 6 pairs + 1 single -> tenpai 0
eq('seven pairs tenpai',
  sevenPairsShanten(idsToCounts(['man1','man1','man2','man2','man3','man3','sou5','sou5','pin7','pin7','pin8','pin8','dragon_red'])),
  0);

// 4. Five pairs -> seven pairs shanten 2 (6 - 5 = 1? need 7 distinct).
// 5 pairs + 3 singles = 13 tiles, kinds=8 -> 6-5+0 = 1
eq('five pairs',
  sevenPairsShanten(idsToCounts(['man1','man1','man2','man2','man3','man3','sou5','sou5','pin7','pin7','pin1','pin2','dragon_red'])),
  1);

// 5. Far hand (13 isolated-ish honors/terminals) standard shanten high
const far = getShanten(idsToCounts(['man1','man4','man7','sou2','sou5','sou8','pin3','pin6','pin9','wind_east','wind_south','wind_west','dragon_red']), 0).shanten;
console.log('INFO far-hand shanten =', far);

// 6. advise() on a 14-tile hand returns a discard recommendation
const adv = advise({
  handIds: ['man1','man2','man3','man4','man5','man6','man7','man8','man9','pin1','pin1','wind_east','wind_west','sou9'],
  melds: [], discards: {}, context: { seatWind: 'east', prevalentWind: 'east' },
});
console.log('INFO advise discard =', adv.recommendedDiscard && adv.recommendedDiscard.id, 'shanten', adv.handShanten);
eq('advise has discard', !!adv.recommendedDiscard, true);

// 7. Full flush detection: 10 pin tiles
const adv2 = advise({
  handIds: ['pin1','pin1','pin2','pin3','pin4','pin5','pin6','pin7','pin8','pin9','man1','man2','wind_east'],
  melds: [], discards: {}, context: { seatWind: 'east', prevalentWind: 'east' },
});
console.log('INFO targets:', adv2.targetHands.map(t => `${t.name}(s${t.shanten},sc${t.compositeScore})`).join(', '));
eq('full flush is a top target', adv2.targetHands.some(t => t.key === 'fullflush'), true);

console.log(`\n${pass} passed, ${fail} failed`);
