// Win detection: advise() should say "declare the win" for a legal 8+ hand,
// both off an opponent's discard and on a self-drawn tile, and not for <8.
import { advise } from './advisor.js';

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  got=${JSON.stringify(got)}`); }
};
const ctx = { seatWind: 'east', prevalentWind: 'east' };

// Full flush in characters, waiting on 9-man (pair) — easily 8+.
const flush13 = ['man1','man1','man1','man2','man3','man4','man5','man6','man7','man7','man8','man8','man9'];
let a = advise({ handIds: flush13, melds: [], discards: {}, context: { ...ctx, lastDiscard: 'man9' } });
check('win off a discard is detected', a.winAdvice?.legal && a.winAdvice.winType === 'discard', a.winAdvice);
check('win reports 8+ points', a.winAdvice?.points >= 8, a.winAdvice?.points);

// Same tile not winning: discard that doesn't complete the hand.
a = advise({ handIds: flush13, melds: [], discards: {}, context: { ...ctx, lastDiscard: 'pin5' } });
check('non-completing discard → no win', a.winAdvice === null, a.winAdvice);

// Self-drawn: 14 tiles, last one drawn completes the flush.
a = advise({ handIds: [...flush13, 'man9'], melds: [], discards: {}, context: ctx });
check('self-drawn win is detected', a.winAdvice?.legal && a.winAdvice.winType === 'selfdraw', a.winAdvice);

// Complete but cheap: mixed suits, no scoring patterns worth 8 on a discard.
const cheap13 = ['man2','man3','man4','pin3','pin4','pin5','sou6','sou7','sou8','man6','man7','pin8','pin8'];
a = advise({ handIds: cheap13, melds: [],discards: {}, context: { ...ctx, lastDiscard: 'man8' } });
check('complete under 8 → not legal', a.winAdvice && !a.winAdvice.legal, a.winAdvice);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
