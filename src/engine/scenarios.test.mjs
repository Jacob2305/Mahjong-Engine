import { advise } from './advisor.js';

let pass=0, fail=0;
function ok(name, cond, extra='') { if(cond){pass++;console.log('PASS  '+name);} else {fail++;console.log('FAIL  '+name+'  '+extra);} }

// Pung claim YES: two red dragons in hand, dragon discarded -> claim
const a1 = advise({
  handIds:['dragon_red','dragon_red','man2','man3','man4','sou5','sou6','sou7','pin1','pin1','pin2','pin3','wind_east'],
  melds:[], discards:{}, context:{seatWind:'east',prevalentWind:'east',lastDiscard:'dragon_red',canChow:true},
});
ok('pung claim dragon = claim', a1.meldAdvice && a1.meldAdvice.recommendation==='claim', JSON.stringify(a1.meldAdvice));
console.log('   reason:', a1.meldAdvice && a1.meldAdvice.reason);

// Chow claim: left player throws man4 completing man3-man4-man5 area
const a2 = advise({
  handIds:['man3','man5','man6','man7','man8','sou2','sou3','sou4','pin5','pin6','pin7','dragon_green','dragon_green'],
  melds:[], discards:{}, context:{seatWind:'east',prevalentWind:'east',lastDiscard:'man4',canChow:true},
});
ok('chow advice present', a2.meldAdvice && a2.meldAdvice.meldType==='chow', JSON.stringify(a2.meldAdvice));
console.log('   reason:', a2.meldAdvice && a2.meldAdvice.reason);

// Chow illegal when not from left player
const a3 = advise({
  handIds:['man3','man5','man6','man7','man8','sou2','sou3','sou4','pin5','pin6','pin7','dragon_green','dragon_green'],
  melds:[], discards:{}, context:{seatWind:'east',prevalentWind:'east',lastDiscard:'man4',canChow:false},
});
ok('chow blocked when not left', a3.meldAdvice && a3.meldAdvice.recommendation==='skip', JSON.stringify(a3.meldAdvice));

// Seven pairs path: 5 pairs + 4 singles (14 tiles)
const a4 = advise({
  handIds:['man1','man1','man3','man3','sou5','sou5','sou7','sou7','pin2','pin2','pin4','pin6','pin8','dragon_red'],
  melds:[], discards:{}, context:{seatWind:'east',prevalentWind:'east'},
});
ok('seven pairs is a target', a4.targetHands.some(t=>t.key==='sevenpairs'), a4.targetHands.map(t=>t.key).join(','));
console.log('   targets:', a4.targetHands.map(t=>`${t.name}(s${t.shanten})`).join(', '));

// Dead tile awareness: man9 isolated with 3 copies already discarded -> recommend discarding it
const a5 = advise({
  handIds:['man9','man2','man3','man4','sou5','sou6','sou7','pin1','pin2','pin3','pin5','pin5','wind_east','wind_east'],
  melds:[], discards:{'man9':3}, context:{seatWind:'east',prevalentWind:'east'},
});
ok('dead isolated man9 recommended discard', a5.recommendedDiscard && a5.recommendedDiscard.id==='man9', a5.recommendedDiscard && a5.recommendedDiscard.id);
console.log('   reason:', a5.recommendedDiscard && a5.recommendedDiscard.reason);

console.log(`\n${pass} passed, ${fail} failed`);
