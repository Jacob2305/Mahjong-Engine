// ---------------------------------------------------------------------------
// Solo simulation: how good is the advisor at actually winning?
//
// One player, a shuffled wall, 13 starting tiles, then each turn: draw a tile,
// declare a win if the hand is complete AND worth 8+ points (judged by the full
// MCR scorer, as a self-drawn win), otherwise throw the advisor's recommended
// discard. No opponents, no claims, no wins off discards, so real games win more
// often; the point is comparing versions of the engine on identical walls.
//
//   npm run sim                        # default 150 games × 18 draws
//   npm run sim -- --games 50 --turns 18 --seed 1 --strategy random
// ---------------------------------------------------------------------------

import { advise } from '../src/engine/advisor.js';
import { TILE_IDS, idsToCounts } from '../src/engine/tiles.js';
import { getShanten } from '../src/engine/shanten.js';
import { scoreMcr } from '../src/engine/mcr/index.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const GAMES = Number(arg('games', 150));
const TURNS = Number(arg('turns', 18));
const SEED = Number(arg('seed', 12345));
const STRATEGY = arg('strategy', 'engine');

let seed = SEED;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function shuffledWall() {
  const w = [];
  for (const id of TILE_IDS) for (let k = 0; k < 4; k++) w.push(id);
  for (let i = w.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}

const CTX = { seatWind: 'east', prevalentWind: 'east' };
function winPoints(hand, drawn) {
  if (getShanten(idsToCounts(hand), 0).shanten !== -1) return null; // not complete
  const r = scoreMcr(hand, [], [], { ...CTX, winType: 'selfdraw', winningTile: drawn });
  return r.complete ? r.fanTotal : null;
}

const pickers = {
  random: (hand) => hand[Math.floor(rnd() * hand.length)],
  engine: (hand, discards) =>
    advise({ handIds: hand, melds: [], discards, context: CTX }).recommendedDiscard.id,
};
const pick = pickers[STRATEGY];
if (!pick) throw new Error(`Unknown strategy ${STRATEGY}`);

let wins = 0;
let completeEver = 0;
let underEight = 0; // times a complete hand was worth < 8, so it couldn't be declared
let winPointsTotal = 0;
let tenpaiAtEnd = 0;
let decisions = 0;
let decisionMs = 0;
let slowest = 0;
const started = performance.now();

for (let g = 0; g < GAMES; g++) {
  const wall = shuffledWall();
  const hand = wall.splice(0, 13);
  const discards = {};
  let won = false;
  let wasComplete = false;
  for (let t = 0; t < TURNS; t++) {
    const drawn = wall.shift();
    hand.push(drawn);
    const pts = winPoints(hand, drawn);
    if (pts !== null) {
      wasComplete = true;
      if (pts >= 8) {
        won = true;
        winPointsTotal += pts;
        break;
      }
      underEight++;
    }
    const t0 = performance.now();
    const d = pick(hand, discards);
    const ms = performance.now() - t0;
    decisions++;
    decisionMs += ms;
    slowest = Math.max(slowest, ms);
    hand.splice(hand.indexOf(d), 1);
    discards[d] = (discards[d] || 0) + 1;
  }
  if (won) wins++;
  if (wasComplete) completeEver++;
  if (!won && getShanten(idsToCounts(hand), 0).shanten === 0) tenpaiAtEnd++;
}

const pct = (n) => `${((100 * n) / GAMES).toFixed(1)}%`;
console.log(`strategy=${STRATEGY} games=${GAMES} turns=${TURNS} seed=${SEED}`);
console.log(`  legal 8+ wins:          ${pct(wins)}  (avg ${wins ? (winPointsTotal / wins).toFixed(1) : '-'} points)`);
console.log(`  complete at some point: ${pct(completeEver)}`);
console.log(`  complete but under 8:   ${underEight} times`);
console.log(`  one away at the end:    ${pct(tenpaiAtEnd)}`);
console.log(`  decision time:          avg ${(decisionMs / Math.max(1, decisions)).toFixed(0)} ms, slowest ${slowest.toFixed(0)} ms`);
console.log(`  total: ${((performance.now() - started) / 1000).toFixed(0)} s`);
