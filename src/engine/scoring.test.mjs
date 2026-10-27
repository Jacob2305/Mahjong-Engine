import { idsToCounts } from './tiles.js';
import { bestScore, isLegalWin } from './scoring.js';

const ctx = { seatWind:'east', prevalentWind:'east' };
function show(name, ids, melds=[]) {
  const r = bestScore(idsToCounts(ids), melds, ctx);
  console.log(`\n${name}: ${r.points} pts  ${r.points>=8?'(LEGAL WIN)':'(NOT enough)'}`);
  console.log('   ', r.reasons.join(', '));
  return r.points;
}

// User's example: Mixed Shifted Chows (6) + All Chows (2)
show('Mixed Shifted + All Chows',
  ['man1','man2','man3','sou2','sou3','sou4','pin3','pin4','pin5','man5','man6','man7','pin9','pin9']);

// Cheap all-chows hand that should be < 8
show('Cheap mixed chows',
  ['man2','man3','man4','man5','man6','man7','sou2','sou3','sou4','pin6','pin7','pin8','pin2','pin2']);

// Full flush
show('Full Flush pins',
  ['pin1','pin2','pin3','pin4','pin5','pin6','pin7','pin8','pin9','pin1','pin1','pin2','pin3','pin4']);

// Seven pairs
show('Seven pairs',
  ['man1','man1','man3','man3','sou5','sou5','sou7','sou7','pin2','pin2','pin4','pin4','pin8','pin8']);

// Dragon pung + half flush
show('Two dragon pungs + half flush',
  ['man1','man2','man3','man4','man5','man6','dragon_red','dragon_red','dragon_red','dragon_green','dragon_green','dragon_green','man9','man9']);
