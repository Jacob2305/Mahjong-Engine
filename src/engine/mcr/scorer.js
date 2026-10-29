// ---------------------------------------------------------------------------
// Scorer — orchestrates decompose → detect → exclude → maximize
// ---------------------------------------------------------------------------

import { decomposeHand, countTiles } from './decompose.js'
import { FANS, detectStandardFans } from './fanRules.js'
import { applyExclusions } from './exclusions.js'
import { isHonor, isSuited, isWind, isDragon, isTerminalOrHonor } from './tiles.js'

const pointsOf = (id) => FANS[id][2]

function tierOf(p) {
  if (p >= 64) return 'gold'
  if (p >= 24) return 'orange'
  if (p >= 8) return 'blue'
  return 'gray'
}

// Situational fans that depend on context rather than tile structure.
function situationalFans(ctx, hasMeld, flowerCount) {
  const list = []
  if (ctx.winType === 'selfdraw') list.push(hasMeld ? 'selfDraw' : 'fullyConcealed')
  else if (!hasMeld) list.push('concealedHand') // discard, fully concealed

  const f = ctx.flags || {}
  if (f.lastTile) list.push(ctx.winType === 'selfdraw' ? 'lastTileDraw' : 'lastTileClaim')
  if (f.kongReplacement) list.push('outWithReplacement')
  if (f.robbingKong) list.push('robbingKong')

  for (let i = 0; i < flowerCount; i++) list.push('flower')
  return list
}

// Classify the wait from the user-designated winning tile and a decomposition.
// The winning tile is always in the concealed hand. Returns a fan id or null.
// Folded into per-decomposition scoring so the best reading wins.
export function computeWait(parsing, W) {
  if (!W) return null

  if (parsing.sets) {
    // Standard hand
    if (parsing.pair.tile === W) return 'pairWait'
    let edge = null
    for (const s of parsing.sets) {
      if (s.type !== 'chow' || !s.tiles.includes(W)) continue
      const v = Number(W[1])
      if (v === s.value + 1) return 'closedWait' // middle of the chow
      if ((s.value === 1 && v === 3) || (s.value === 7 && v === 7)) edge = 'edgeWait'
      // a tile at the open end of a run is a two-sided wait — no bonus
    }
    return edge
  }

  switch (parsing.type) {
    case 'sevenPairs':
      return 'pairWait' // completing the final pair is a single wait
    case 'thirteenOrphans':
      return countTiles(parsing.tiles)[W] === 2 ? 'pairWait' : null
    case 'knittedStraight':
      return parsing.rest && parsing.rest.pair === W ? 'pairWait' : null
    default:
      return null // honors-and-knitted has no pair to single-wait on
  }
}

// ---- special (non-standard) hand detectors --------------------------------
const RESIDUE_CLASS = (v) => ((v - 1) % 3) // 0:{1,4,7} 1:{2,5,8} 2:{3,6,9}

function detectSevenPairs(tiles) {
  if (tiles.length !== 14) return null
  const c = countTiles(tiles)
  if (!Object.values(c).every((n) => n % 2 === 0)) return null
  const fans = ['sevenPairs', ...flatCompositionFans(tiles)]

  // Seven Shifted Pairs: one suit, seven consecutive distinct pairs
  const suits = new Set(tiles.map((t) => t[0]))
  const distinct = Object.keys(c)
  if (suits.size === 1 && isSuited(tiles[0]) && distinct.length === 7 &&
      Object.values(c).every((n) => n === 2)) {
    const vals = distinct.map((t) => Number(t[1])).sort((a, b) => a - b)
    if (vals[6] - vals[0] === 6) fans.push('sevenShiftedPairs')
  }
  return { fans, parsing: { type: 'sevenPairs', tiles } }
}

const ORPHAN_SET = ['m1', 'm9', 's1', 's9', 'p1', 'p9', 'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw']
function detectThirteenOrphans(tiles) {
  if (tiles.length !== 14) return null
  const c = countTiles(tiles)
  if (!tiles.every((t) => ORPHAN_SET.includes(t))) return null
  if (ORPHAN_SET.some((t) => !c[t])) return null // need all 13
  if (Object.values(c).filter((n) => n === 2).length !== 1) return null
  return { fans: ['thirteenOrphans'], parsing: { type: 'thirteenOrphans', tiles } }
}

// All-singles knitted + honors hands (全不靠 / 七星不靠)
function detectHonorsKnitted(tiles) {
  if (tiles.length !== 14) return null
  const c = countTiles(tiles)
  if (Object.values(c).some((n) => n > 1)) return null // all singles

  const honors = tiles.filter(isHonor)
  const suited = tiles.filter(isSuited)
  if (honors.length + suited.length !== 14) return null

  // each suit may only use one residue class; classes must be distinct per suit
  const classBySuit = {}
  for (const t of suited) {
    const cls = RESIDUE_CLASS(Number(t[1]))
    if (classBySuit[t[0]] === undefined) classBySuit[t[0]] = cls
    else if (classBySuit[t[0]] !== cls) return null
  }
  const usedClasses = Object.values(classBySuit)
  if (new Set(usedClasses).size !== usedClasses.length) return null // classes collide

  const fan = honors.length === 7 ? 'greaterHonorsKnitted' : 'lesserHonorsKnitted'
  return { fans: [fan], parsing: { type: 'honorsKnitted', tiles } }
}

// Knitted Straight (组合龙): 1-4-7 / 2-5-8 / 3-6-9 across the three suits,
// plus a remaining set + pair.
function detectKnittedStraight(tiles, ctx) {
  if (tiles.length < 14) return null
  const suitPerms = [
    ['m', 's', 'p'], ['m', 'p', 's'], ['s', 'm', 'p'],
    ['s', 'p', 'm'], ['p', 'm', 's'], ['p', 's', 'm'],
  ]
  const classes = [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
  for (const perm of suitPerms) {
    const knitted = []
    for (let i = 0; i < 3; i++) for (const v of classes[i]) knitted.push(perm[i] + v)
    const c = countTiles(tiles)
    if (knitted.some((t) => !c[t])) continue
    for (const t of knitted) c[t]--
    const rest = []
    for (const id in c) for (let i = 0; i < c[id]; i++) rest.push(id)
    if (rest.length !== 5) continue
    // remaining 5 must be exactly one set + one pair
    const dec = require_oneSetOnePair(rest)
    if (!dec) continue
    const fans = ['knittedStraight']
    // honor / dragon pung credit from the remaining pung
    const set = dec.set
    if (set.type === 'pung' || set.type === 'kong') {
      const tile = set.tiles[0]
      if (isDragon(tile)) fans.push('dragonPung')
      else if (isWind(tile)) {
        if (tile[1] === ctx.prevalentWind) fans.push('prevalentWind')
        if (tile[1] === ctx.seatWind) fans.push('seatWind')
        if (tile[1] !== ctx.prevalentWind && tile[1] !== ctx.seatWind) fans.push('pungTerminalsHonors')
      } else if (isTerminalOrHonor(tile)) fans.push('pungTerminalsHonors')
    }
    if (!tiles.some(isHonor)) fans.push('noHonors')
    return { fans, parsing: { type: 'knittedStraight', tiles, knitted, rest: dec } }
  }
  return null
}

function require_oneSetOnePair(rest) {
  const c = countTiles(rest)
  const ids = Object.keys(c)
  // try pair choice
  for (const pairId of ids) {
    if (c[pairId] < 2) continue
    const c2 = { ...c }
    c2[pairId] -= 2
    const remaining = []
    for (const id in c2) for (let i = 0; i < c2[id]; i++) remaining.push(id)
    if (remaining.length !== 3) continue
    const set = asSet(remaining)
    if (set) return { set, pair: pairId }
  }
  return null
}

function asSet(three) {
  const [a, b, cc] = three.slice().sort()
  if (a === b && b === cc) return { type: 'pung', tiles: three }
  if (isSuited(a) && a[0] === b[0] && b[0] === cc[0]) {
    const v = [a, b, cc].map((t) => Number(t[1])).sort((x, y) => x - y)
    if (v[1] === v[0] + 1 && v[2] === v[1] + 1) return { type: 'chow', tiles: three }
  }
  return null
}

// Composition fans for a flat list of tiles (used by special hands).
function flatCompositionFans(tiles) {
  const out = []
  const suits = new Set()
  let hasHonor = false, hasWind = false, hasDragon = false, allSuited = true
  for (const t of tiles) {
    if (isSuited(t)) suits.add(t[0])
    else { allSuited = false; hasHonor = true; if (isWind(t)) hasWind = true; if (isDragon(t)) hasDragon = true }
  }
  if (suits.size === 1 && !hasHonor) out.push('fullFlush')
  else if (suits.size === 1 && hasHonor) out.push('halfFlush')
  if (suits.size === 2) out.push('oneVoidedSuit')
  if (!hasHonor) out.push('noHonors')
  if (suits.size === 3 && hasWind && hasDragon) out.push('allTypes')
  if (allSuited) {
    const vals = tiles.map((t) => Number(t[1]))
    const within = (lo, hi) => vals.every((v) => v >= lo && v <= hi)
    if (within(7, 9)) out.push('upperTiles'); else if (within(6, 9)) out.push('upperFour')
    if (within(1, 3)) out.push('lowerTiles'); else if (within(1, 4)) out.push('lowerFour')
    if (within(4, 6)) out.push('middleTiles')
    if (within(2, 8)) out.push('allSimples')
  }
  return out
}

// ---- main entry ------------------------------------------------------------
export function scoreHand({ concealed = [], melded = [], flowers = [], ctx }) {
  const context = {
    seatWind: ctx?.seatWind ?? 'e',
    prevalentWind: ctx?.prevalentWind ?? 'e',
    winType: ctx?.winType ?? 'discard',
    winningTile: ctx?.winningTile ?? null,
    flags: ctx?.flags ?? {},
  }
  const flowerCount = flowers.length
  const hasMeld = melded.length > 0
  const allNonFlower = [...concealed, ...melded]

  // Build candidate fan-lists from every valid interpretation.
  const candidates = []

  for (const parsing of decomposeHand(concealed, melded)) {
    candidates.push({ fans: detectStandardFans(parsing, context), parsing })
  }

  if (!hasMeld) {
    const sp = detectSevenPairs(concealed)
    if (sp) candidates.push(sp)
    const to = detectThirteenOrphans(concealed)
    if (to) candidates.push(to)
    const hk = detectHonorsKnitted(concealed)
    if (hk) candidates.push(hk)
  }
  const ks = detectKnittedStraight(allNonFlower, context)
  if (ks) candidates.push(ks)

  const situational = situationalFans(context, hasMeld, flowerCount)

  if (candidates.length === 0) {
    return { complete: false, valid: false, total: flowerCount, fanTotal: 0, flowerPts: flowerCount, fans: [], transfers: null, ctx: context }
  }

  // Score each candidate; keep the highest fan total.
  let best = null
  for (const cand of candidates) {
    const waitId = computeWait(cand.parsing, context.winningTile)
    const candFans = cand.fans.map((id) => (typeof id === 'string' ? { id } : id))
    const all = [...candFans, ...situational.map((id) => ({ id }))]
    if (waitId) all.push({ id: waitId })
    const instances = applyExclusions(all)
    let fanTotal = 0, flowerPts = 0
    for (const f of instances) {
      if (f.id === 'flower') flowerPts += 1
      else fanTotal += pointsOf(f.id)
    }
    if (!best || fanTotal > best.fanTotal) {
      best = { fanTotal, flowerPts, instances, parsing: cand.parsing }
    }
  }

  // Chicken Hand: a complete hand that scores no other fan is worth the
  // 8-point minimum on its own.
  if (best.fanTotal === 0) {
    best.instances.push({ id: 'chickenHand' })
    best.fanTotal = 8
  }

  // Aggregate identical fans for display.
  const counts = {}
  for (const f of best.instances) counts[f.id] = (counts[f.id] || 0) + 1
  const fans = Object.entries(counts)
    .map(([id, count]) => {
      const [name, nameCn, points, desc] = FANS[id]
      return { id, name, nameCn, points, count, total: points * count, desc, tier: tierOf(points) }
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))

  const fanTotal = best.fanTotal
  const total = fanTotal + best.flowerPts
  const valid = fanTotal >= 8
  const transfers = valid ? computeTransfers(context.winType, total) : null

  return {
    complete: true,
    valid,
    total,
    fanTotal,
    flowerPts: best.flowerPts,
    fans,
    transfers,
    ctx: context,
    handType: best.parsing.type || 'standard',
  }
}

// MCR payments: base 8 per non-winner + hand value from payer(s).
function computeTransfers(winType, handValue) {
  if (winType === 'selfdraw') {
    const each = 8 + handValue
    return { winType, each, winnerTotal: each * 3 }
  }
  const discarder = 8 + handValue
  const others = 8
  return { winType, discarder, others, winnerTotal: discarder + others * 2 }
}

// House rule for a false win declaration: the declarer pays each other player
// this much. Under 8 fan = a complete hand that isn't worth enough;
// not winning = the tiles don't form a winning hand at all.
export const FALSE_WIN_PENALTY = { underEight: 10, notWinning: 20 }

// Quick completeness check for enabling the Calculate button.
export function isWinningHand(concealed, melded, flowers = []) {
  return scoreHand({ concealed, melded, flowers, ctx: {} }).complete
}
