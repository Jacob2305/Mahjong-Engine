import { advise } from './advisor.js';
import { tileName } from './tiles.js';

// Mirror App.makeMove for a 13-tile hand with a claimable dragon discard.
let handIds = ['dragon_red','dragon_red','man2','man3','man4','sou5','sou6','sou7','pin1','pin1','pin2','pin3','wind_west'];
let melds = [];
let discards = { 'dragon_red': 1 };       // opponent threw a red dragon
let last = 'dragon_red';
const ctx = { seatWind:'east', prevalentWind:'east' };
const log = [];
const concealed = h => h.length; // no bonus here

// Phase 1: claim
if (concealed(handIds) % 3 === 1 && last) {
  const res = advise({ handIds, melds, discards, context:{...ctx, lastDiscard:last} });
  const ma = res.meldAdvice;
  if (ma && ma.recommendation === 'claim') {
    const fromHand = [...ma.meldTiles];
    fromHand.splice(fromHand.indexOf(last), 1);
    const tmp = [...handIds];
    for (const t of fromHand) tmp.splice(tmp.indexOf(t), 1);
    handIds = tmp;
    melds = [...melds, { type: ma.meldType, tiles: ma.meldTiles }];
    discards = { ...discards }; delete discards[last];
    log.push(`Claimed ${ma.meldType} on ${tileName(last)}`);
    last = null;
  }
}
// Phase 2: discard (now 11 concealed -> discard mode)
if (concealed(handIds) % 3 === 2) {
  const res = advise({ handIds, melds, discards, context:{...ctx, lastDiscard:null} });
  const rd = res.recommendedDiscard;
  if (rd) {
    handIds.splice(handIds.indexOf(rd.id), 1);
    discards = { ...discards, [rd.id]: (discards[rd.id]||0)+1 };
    log.push(`Discarded ${tileName(rd.id)}`);
  }
}

console.log('LOG:'); log.forEach(l => console.log('  - ' + l));
console.log('hand now:', handIds.join(' '));
console.log('melds now:', JSON.stringify(melds));
console.log('discards now:', JSON.stringify(discards));

const okClaim = melds.length === 1 && melds[0].type === 'pung';
const okDiscard = log.some(l => l.startsWith('Discarded'));
const okHandSize = handIds.length === 10; // 13 -2 claim -1 discard
console.log(`\n${okClaim?'PASS':'FAIL'} claimed pung`);
console.log(`${okDiscard?'PASS':'FAIL'} auto-discarded`);
console.log(`${okHandSize?'PASS':'FAIL'} hand size 10 (got ${handIds.length})`);
