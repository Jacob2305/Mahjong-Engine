// Tests for live-camera advice. Run with: node src/engine/liveAdvice.test.mjs
import { liveHand, summarizeAdvice, planLine } from './liveAdvice.js';
import { advise } from './advisor.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
}
const row = (ids) => ids.map((id) => ({ id, counted: true, inHand: true }));

const hand14 = ['man1', 'man2', 'man3', 'man5', 'man6', 'pin2', 'pin3', 'pin4', 'sou7', 'sou8', 'sou9', 'wind_east', 'dragon_red', 'dragon_red'];

{
  const h = liveHand(row(hand14));
  ok('14 in the hand row → ready', h.ready && h.have === 14 && h.need === 14);
  ok('key ignores order', h.key === liveHand(row([...hand14].reverse())).key);
}
{
  const h = liveHand(row(hand14.slice(0, 13)));
  ok('13 → not ready', !h.ready && h.have === 13 && !h.problem);
}
{
  const dets = [...row(hand14.slice(0, 13)), { id: 'flower1', counted: true, inHand: true }];
  ok('flowers do not count', liveHand(dets).have === 13);
  const notCounted = [...row(hand14.slice(0, 13)), { id: 'man9', counted: false, inHand: true }];
  ok('weak (red) tiles do not count', liveHand(notCounted).have === 13);
}
{
  const melds = [{ type: 'pung', tiles: ['sou1', 'sou1', 'sou1'] }];
  const h = liveHand(row(hand14.slice(0, 11)), melds);
  ok('one claimed set → 11 is a full hand', h.ready && h.need === 11);
}
{
  const five = ['man1', 'man1', 'man1', 'man1', 'man1', ...hand14.slice(5)];
  const h = liveHand(row(five));
  ok('a 5th copy is flagged, not advised', !h.ready && /misread/.test(h.problem || ''), h.problem);
}
{
  const s = summarizeAdvice(advise({ handIds: hand14, melds: [], discards: {}, context: {} }));
  ok('advice has a throw from the hand', s.discard && hand14.includes(s.discard.id), JSON.stringify(s.discard));
  ok('summary is plain data (worker-safe)', JSON.parse(JSON.stringify(s)).discard.id === s.discard.id);
  ok('plan line reads', typeof planLine(s.plan) === 'string' && planLine(s.plan).length > 10, planLine(s.plan));
  console.log('   ', `throw ${s.discard.id}: ${s.discard.short}`);
  console.log('   ', planLine(s.plan));
}
{
  // Self-drawn complete flush → win, not a throw.
  const flush = ['man1', 'man1', 'man1', 'man2', 'man3', 'man4', 'man5', 'man6', 'man7', 'man7', 'man8', 'man8', 'man9', 'man9'];
  const s = summarizeAdvice(advise({ handIds: flush, melds: [], discards: {}, context: {} }));
  ok('complete 8+ hand → declare the win', s.win && s.win.points >= 8, JSON.stringify(s.win));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
