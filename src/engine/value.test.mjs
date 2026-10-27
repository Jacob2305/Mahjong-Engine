import { advise } from './advisor.js';
const ctx = { seatWind:'east', prevalentWind:'east' };
let pass=0,fail=0; const ok=(n,c,x='')=>{c?(pass++,console.log('PASS '+n)):(fail++,console.log('FAIL '+n+' '+x));};

// Value-short: 13-tile cheap tenpai (3 chows + 2 pairs, sub-8 waits)
const a = advise({ handIds:['man2','man3','man4','sou5','sou6','sou7','pin1','pin2','pin3','pin5','pin5','wind_east','wind_east'], melds:[], discards:{}, context:ctx });
console.log('  shanten', a.handShanten, 'isTenpai', a.tenpaiStatus.isTenpai, 'valueShort', a.tenpaiStatus.valueShort);
ok('cheap tenpai flagged value-short', a.tenpaiStatus.shantenNumber===0 && a.tenpaiStatus.isTenpai===false && a.tenpaiStatus.valueShort===true);

// Legal tenpai: half flush + dragon pungs waiting, scores >=8
const b = advise({ handIds:['man1','man2','man3','man4','man5','man6','dragon_red','dragon_red','dragon_red','dragon_green','dragon_green','man9','man9'], melds:[], discards:{}, context:ctx });
console.log('  isTenpai', b.tenpaiStatus.isTenpai, 'waits', (b.tenpaiStatus.winningTiles||[]).map(w=>w.id+':'+w.points+'p').join(', '));
ok('legal >=8 tenpai recognized', b.tenpaiStatus.isTenpai===true && b.tenpaiStatus.winningTiles.every(w=>w.points>=8));

console.log(`\n${pass} passed, ${fail} failed`);
