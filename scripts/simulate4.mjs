// ---------------------------------------------------------------------------
// 4-player simulation: the advisor (seat 0, East) against three simple opponents.
//
// Each turn a player draws; they win if the hand is complete AND worth 8+ points
// (full MCR scorer), otherwise they discard. After every discard, the other
// players can win on it (8+ by discard), and the advisor may claim it (pung from
// anyone, chow only from the player on its left = seat 3) if advise() says so.
// Opponents: discard to stay closest to a complete hand (no claims, no plans).
// The wall ends the hand as a draw when it runs out.
//
//   npm run sim4                      # 100 games
//   npm run sim4 -- --games 50 --seed 7
// ---------------------------------------------------------------------------

import { advise } from '../src/engine/advisor.js';
import { TILE_IDS, TILE_INDEX, idsToCounts } from '../src/engine/tiles.js';
import { getShanten } from '../src/engine/shanten.js';
import { scoreMcr } from '../src/engine/mcr/index.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const GAMES = Number(arg('games', 100));
const SEED = Number(arg('seed', 2024));

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

const SEATS = ['east', 'south', 'west', 'north'];
const PREVALENT = 'east';

// Points if `hand` (concealed, winning tile included) + melds is a legal win, else null.
function winPoints(hand, melds, winningTile, winType, seat) {
  if (getShanten(idsToCounts(hand), melds.length).shanten !== -1) return null;
  const r = scoreMcr(hand, melds, [], { winType, winningTile, seatWind: SEATS[seat], prevalentWind: PREVALENT });
  return r.complete && r.fanTotal >= 8 ? r.fanTotal : null;
}

// Simple opponent: throw the tile that leaves the hand closest to complete;
// among ties, the least connected tile (honors/isolated first).
function opponentDiscard(hand) {
  const counts = idsToCounts(hand);
  let best = null;
  for (const id of new Set(hand)) {
    const i = TILE_INDEX[id];
    counts[i]--;
    const sh = getShanten(counts, 0).shanten;
    counts[i]++;
    let links = counts[i] - 1;
    if (i < 27) for (const d of [-2, -1, 1, 2]) {
      const j = i + d;
      if (j >= 0 && j < 27 && Math.floor(j / 9) === Math.floor(i / 9)) links += counts[j];
    }
    const score = sh * 100 + links + rnd() * 0.5;
    if (!best || score < best.score) best = { id, score };
  }
  return best.id;
}

const stats = { engineWin: 0, engineSelf: 0, engineRon: 0, dealIn: 0, oppWin: 0, draw: 0, points: 0, claims: 0, decisions: 0, ms: 0, slowest: 0 };
const timed = (fn) => {
  const t = performance.now();
  const r = fn();
  const ms = performance.now() - t;
  stats.decisions++;
  stats.ms += ms;
  stats.slowest = Math.max(stats.slowest, ms);
  return r;
};
const started = performance.now();

for (let g = 0; g < GAMES; g++) {
  const wall = shuffledWall();
  const hands = [0, 1, 2, 3].map(() => wall.splice(0, 13));
  const melds = [[], [], [], []];
  const discards = {};
  let turn = 0;
  let over = null;
  let skipDraw = false; // after a claim the claimer discards without drawing

  const engineDiscard = () => {
    const a = timed(() => advise({ handIds: hands[0], melds: melds[0], discards, context: { seatWind: 'east', prevalentWind: PREVALENT, lastDiscard: null } }));
    return a.recommendedDiscard ? a.recommendedDiscard.id : hands[0][hands[0].length - 1];
  };

  while (!over) {
    const p = turn;
    if (!skipDraw) {
      if (!wall.length) { over = 'draw'; break; }
      const drawn = wall.shift();
      hands[p].push(drawn);
      const pts = winPoints(hands[p], melds[p], drawn, 'selfdraw', p);
      if (pts !== null) {
        over = p === 0 ? 'engineSelf' : 'oppWin';
        if (p === 0) stats.points += pts;
        break;
      }
    }
    skipDraw = false;

    const d = p === 0 ? engineDiscard() : opponentDiscard(hands[p]);
    hands[p].splice(hands[p].indexOf(d), 1);
    discards[d] = (discards[d] || 0) + 1;

    // Someone wins on the discard (next players first).
    for (let k = 1; k <= 3 && !over; k++) {
      const q = (p + k) % 4;
      const pts = winPoints([...hands[q], d], melds[q], d, 'discard', q);
      if (pts !== null) {
        if (q === 0) { over = 'engineRon'; stats.points += pts; }
        else over = p === 0 ? 'dealIn' : 'oppWin';
      }
    }
    if (over) break;

    // The advisor may claim an opponent's discard.
    if (p !== 0) {
      const c = idsToCounts(hands[0]);
      const i = TILE_INDEX[d];
      const fromLeft = p === 3;
      const v = i % 9;
      const chowShape = fromLeft && i < 27 && [[-2, -1], [-1, 1], [1, 2]].some(([a, b]) => v + a >= 0 && v + b <= 8 && c[i + a] > 0 && c[i + b] > 0);
      if (c[i] >= 2 || chowShape) {
        const a = timed(() => advise({ handIds: hands[0], melds: melds[0], discards, context: { seatWind: 'east', prevalentWind: PREVALENT, lastDiscard: d, canChow: fromLeft } }));
        const ma = a.meldAdvice;
        if (ma && ma.recommendation === 'claim' && ma.meldTiles && (ma.meldType === 'pung' || ma.meldType === 'chow')) {
          const need = [...ma.meldTiles];
          need.splice(need.indexOf(d), 1);
          const h = [...hands[0]];
          if (need.every((t) => { const x = h.indexOf(t); if (x < 0) return false; h.splice(x, 1); return true; })) {
            hands[0] = h;
            melds[0] = [...melds[0], { type: ma.meldType, tiles: ma.meldTiles }];
            discards[d]--;
            if (!discards[d]) delete discards[d];
            stats.claims++;
            turn = 0;
            skipDraw = true;
            continue;
          }
        }
      }
    }
    turn = (p + 1) % 4;
  }
  if (over === 'engineSelf') { stats.engineWin++; stats.engineSelf++; }
  else if (over === 'engineRon') { stats.engineWin++; stats.engineRon++; }
  else stats[over]++;
  if ((g + 1) % 10 === 0) process.stderr.write(`  ${g + 1}/${GAMES} games\n`);
}

const pct = (n) => `${((100 * n) / GAMES).toFixed(1)}%`;
console.log(`4-player sim: games=${GAMES} seed=${SEED}`);
console.log(`  advisor wins:        ${pct(stats.engineWin)}  (self-drawn ${stats.engineSelf}, off a discard ${stats.engineRon}; avg ${stats.engineWin ? (stats.points / stats.engineWin).toFixed(1) : '-'} pts)`);
console.log(`  advisor dealt in:    ${pct(stats.dealIn)}`);
console.log(`  an opponent won:     ${pct(stats.oppWin)}  (not off the advisor)`);
console.log(`  draw (wall empty):   ${pct(stats.draw)}`);
console.log(`  claims made:         ${stats.claims} (${(stats.claims / GAMES).toFixed(1)} per game)`);
console.log(`  decision time:       avg ${(stats.ms / Math.max(1, stats.decisions)).toFixed(0)} ms, slowest ${stats.slowest.toFixed(0)} ms`);
console.log(`  total: ${((performance.now() - started) / 1000).toFixed(0)} s`);
