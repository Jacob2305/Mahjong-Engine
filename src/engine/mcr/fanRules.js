// ---------------------------------------------------------------------------
// Fan (番) pattern detectors — Chinese Official (MCR) rules
// ---------------------------------------------------------------------------
//
// FANS is the canonical catalog: id -> [English, Chinese, points, description].
// Detectors return a flat list of { id } instances. The scorer then applies the
// exclusion table (exclusions.js), sums points, and checks the 8-point minimum.
//
// Where the source spec's point tiers disagreed with the official 2006 MCR
// table (e.g. All Pungs), the official value is used.

import {
  isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, isDragon,
} from './tiles.js'

export const FANS = {
  // 88
  bigFourWinds: ['Big Four Winds', '大四喜', 88, 'Pungs/kongs of all four winds.'],
  bigThreeDragons: ['Big Three Dragons', '大三元', 88, 'Pungs/kongs of all three dragons.'],
  allGreen: ['All Green', '绿一色', 88, 'Only green tiles: Sou 2,3,4,6,8 and Green Dragon.'],
  nineGates: ['Nine Gates', '九莲宝灯', 88, 'Concealed 1112345678999 in one suit plus any tile of it.'],
  fourKongs: ['Four Kongs', '四杠', 88, 'Four kongs.'],
  sevenShiftedPairs: ['Seven Shifted Pairs', '连七对', 88, 'Seven consecutive pairs in one suit.'],
  thirteenOrphans: ['Thirteen Orphans', '十三幺', 88, 'One of each terminal and honor plus a duplicate.'],
  // 64
  allTerminals: ['All Terminals', '清幺九', 64, 'Every set is a pung of terminals (1s and 9s).'],
  littleFourWinds: ['Little Four Winds', '小四喜', 64, 'Three wind pungs plus a pair of the fourth wind.'],
  littleThreeDragons: ['Little Three Dragons', '小三元', 64, 'Two dragon pungs plus a pair of the third dragon.'],
  allHonors: ['All Honors', '字一色', 64, 'Entire hand is winds and dragons.'],
  fourConcealedPungs: ['Four Concealed Pungs', '四暗刻', 64, 'Four concealed pungs/kongs.'],
  pureTerminalChows: ['Pure Terminal Chows', '一色双龙会', 64, '123+123+789+789 and a pair of 5s, one suit.'],
  // 48
  quadrupleChow: ['Quadruple Chow', '一色四同顺', 48, 'Four identical chows in one suit.'],
  fourPureShiftedPungs: ['Four Pure Shifted Pungs', '一色四节高', 48, 'Four pungs shifted up by one in one suit.'],
  // 32
  fourShiftedChows: ['Four Shifted Chows', '一色四步高', 32, 'Four chows in one suit each shifted by 1 or 2.'],
  threeKongs: ['Three Kongs', '三杠', 32, 'Three kongs.'],
  allTerminalsAndHonors: ['All Terminals and Honors', '混幺九', 32, 'Only pungs of terminals and honors.'],
  // 24
  sevenPairs: ['Seven Pairs', '七对', 24, 'Seven pairs.'],
  greaterHonorsKnitted: ['Greater Honors and Knitted Tiles', '七星不靠', 24, 'All seven honors plus a knitted run of singles.'],
  allEvenPungs: ['All Even Pungs', '全双刻', 24, 'Four pungs of even numbers plus an even pair.'],
  fullFlush: ['Full Flush', '清一色', 24, 'All tiles in a single suit, no honors.'],
  pureTripleChow: ['Pure Triple Chow', '一色三同顺', 24, 'Three identical chows in one suit.'],
  pureShiftedPungs: ['Pure Shifted Pungs', '一色三节高', 24, 'Three pungs shifted up by one in one suit.'],
  upperTiles: ['Upper Tiles', '全大', 24, 'Every tile is a 7, 8 or 9.'],
  middleTiles: ['Middle Tiles', '全中', 24, 'Every tile is a 4, 5 or 6.'],
  lowerTiles: ['Lower Tiles', '全小', 24, 'Every tile is a 1, 2 or 3.'],
  // 16
  pureStraight: ['Pure Straight', '清龙', 16, '123, 456 and 789 in a single suit.'],
  threeSuitedTerminalChows: ['Three-Suited Terminal Chows', '三色双龙会', 16, '123+789 in two suits plus a pair of 5s in the third.'],
  pureShiftedChows: ['Pure Shifted Chows', '一色三步高', 16, 'Three chows in one suit shifted by 1 or 2.'],
  allFives: ['All Fives', '全带五', 16, 'Every set and the pair contains a 5.'],
  triplePung: ['Triple Pung', '三色三同刻', 16, 'Pungs of the same number in all three suits.'],
  threeConcealedPungs: ['Three Concealed Pungs', '三暗刻', 16, 'Three concealed pungs/kongs.'],
  // 12
  lesserHonorsKnitted: ['Lesser Honors and Knitted Tiles', '全不靠', 12, 'Single honors and a knitted run, no sets.'],
  knittedStraight: ['Knitted Straight', '组合龙', 12, '1-4-7 / 2-5-8 / 3-6-9 split across the three suits.'],
  upperFour: ['Upper Four', '大于五', 12, 'Every tile is a 6, 7, 8 or 9.'],
  lowerFour: ['Lower Four', '小于五', 12, 'Every tile is a 1, 2, 3 or 4.'],
  bigThreeWinds: ['Big Three Winds', '三风刻', 12, 'Pungs/kongs of three winds.'],
  // 8
  mixedStraight: ['Mixed Straight', '花龙', 8, '123, 456, 789 spread across the three suits.'],
  reversibleTiles: ['Reversible Tiles', '推不倒', 8, 'Only point-symmetric tiles.'],
  mixedTripleChow: ['Mixed Triple Chow', '三色三同顺', 8, 'The same chow in all three suits.'],
  mixedShiftedPungs: ['Mixed Shifted Pungs', '三色三节高', 8, 'Three pungs shifted by one across the suits.'],
  lastTileDraw: ['Last-Tile Draw', '妙手回春', 8, 'Self-drawing the very last tile of the wall.'],
  lastTileClaim: ['Last-Tile Claim', '海底捞月', 8, 'Winning on the very last discard.'],
  outWithReplacement: ['Out with Replacement Tile', '岭上开花', 8, 'Winning on the tile drawn after a kong.'],
  robbingKong: ['Robbing the Kong', '抢杠和', 8, 'Winning on a tile added to an exposed pung.'],
  chickenHand: ['Chicken Hand', '无番和', 8, 'A valid winning hand that scores no other fan.'],
  // 6
  allPungs: ['All Pungs', '碰碰和', 6, 'Four pungs/kongs and a pair.'],
  halfFlush: ['Half Flush', '混一色', 6, 'One suit plus honors.'],
  mixedShiftedChows: ['Mixed Shifted Chows', '三色三步高', 6, 'Three chows across the suits shifted by one.'],
  allTypes: ['All Types', '五门齐', 6, 'Tiles from all three suits, winds and dragons.'],
  meldedHand: ['Melded Hand', '全求人', 6, 'All four sets melded, won on the pair by discard.'],
  twoDragonPungs: ['Two Dragon Pungs', '双箭刻', 6, 'Two pungs/kongs of dragons.'],
  // 4
  outsideHand: ['Outside Hand', '全带幺', 4, 'Every set and the pair contains a terminal or honor.'],
  fullyConcealed: ['Fully Concealed Hand', '不求人', 4, 'Self-drawn win with a fully concealed hand.'],
  twoConcealedPungs: ['Two Concealed Pungs', '双暗刻', 2, 'Two concealed pungs/kongs.'],
  concealedKong: ['Concealed Kong', '暗杠', 2, 'A concealed kong.'],
  allSimples: ['All Simples', '断幺', 2, 'No terminals (1s and 9s) or honors.'],
  // 2
  dragonPung: ['Dragon Pung', '箭刻', 2, 'A pung/kong of any dragon.'],
  prevalentWind: ['Prevalent Wind', '圈风刻', 2, 'A pung/kong of the prevalent (round) wind.'],
  seatWind: ['Seat Wind', '门风刻', 2, 'A pung/kong of your seat wind.'],
  concealedHand: ['Concealed Hand', '门前清', 2, 'Fully concealed hand won by discard.'],
  allChows: ['All Chows', '平和', 2, 'Four chows and a non-honor pair.'],
  tileHog: ['Tile Hog', '四归一', 2, 'All four of a tile used without forming a kong.'],
  doublePung: ['Double Pung', '双同刻', 2, 'Two pungs of the same number in two suits.'],
  twoConcealedKongs: ['Two Concealed Kongs', '双暗杠', 8, 'Two concealed kongs.'],
  twoMeldedKongs: ['Two Melded Kongs', '双明杠', 4, 'Two exposed kongs.'],
  // 1
  pureDoubleChow: ['Pure Double Chow', '一般高', 1, 'Two identical chows in one suit.'],
  mixedDoubleChow: ['Mixed Double Chow', '喜相逢', 1, 'The same chow in two different suits.'],
  shortStraight: ['Short Straight', '连六', 1, 'Two chows forming six consecutive tiles in one suit.'],
  twoTerminalChows: ['Two Terminal Chows', '老少副', 1, '123 and 789 in the same suit.'],
  pungTerminalsHonors: ['Pung of Terminals or Honors', '幺九刻', 1, 'A pung/kong of terminals or guest winds.'],
  meldedKong: ['Melded Kong', '明杠', 1, 'An exposed kong.'],
  oneVoidedSuit: ['One Voided Suit', '缺一门', 1, 'The hand is missing one of the three suits.'],
  noHonors: ['No Honors', '无字', 1, 'No wind or dragon tiles.'],
  selfDraw: ['Self-Drawn', '自摸', 1, 'Won by drawing the winning tile.'],
  flower: ['Flower', '花牌', 1, 'A flower or season tile.'],
  edgeWait: ['Edge Wait', '边张', 1, 'Waiting on the 3 of 123 or the 7 of 789.'],
  closedWait: ['Closed Wait', '坎张', 1, 'Waiting on the middle tile of a chow.'],
  pairWait: ['Single Wait', '单钓将', 1, 'Waiting to complete the pair.'],
}

// --- small helpers ----------------------------------------------------------
const combos = (arr, k) => {
  const res = []
  const rec = (start, cur) => {
    if (cur.length === k) return res.push([...cur])
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]); rec(i + 1, cur); cur.pop()
    }
  }
  rec(0, [])
  return res
}

const GREEN = new Set(['s2', 's3', 's4', 's6', 's8', 'dg'])
const REVERSIBLE = new Set(['p1', 'p2', 'p3', 'p4', 'p5', 'p8', 'p9', 's2', 's4', 's5', 's6', 's8', 's9', 'dw'])

// Does a set contain a tile of the given value? (chow spans low..low+2)
const setHasValue = (s, v) =>
  s.type === 'chow' ? v >= s.value && v <= s.value + 2 : s.value === v
const setHasTerminalOrHonor = (s) =>
  s.type === 'chow' ? (s.value === 1 || s.value === 7) : isTerminalOrHonor(s.tiles[0])

// ---------------------------------------------------------------------------
// Detect every fan that applies to one standard decomposition.
// ---------------------------------------------------------------------------
export function detectStandardFans(parsing, ctx) {
  const out = []
  const add = (id) => out.push({ id })

  const sets = parsing.sets
  const chows = sets.filter((s) => s.type === 'chow')
  const pungs = sets.filter((s) => s.type !== 'chow') // pung or kong
  const kongs = sets.filter((s) => s.type === 'kong')
  const pair = parsing.pair
  const pairTile = pair.tile
  const allTiles = sets.flatMap((s) => s.tiles).concat([pairTile, pairTile])

  // ---- whole-hand suit / range composition -------------------------------
  addCompositionFans(out, allTiles, sets, pair)

  // ---- honors: winds & dragons -------------------------------------------
  const windPungs = pungs.filter((p) => p.suit === 'wind')
  const dragonPungs = pungs.filter((p) => p.suit === 'dragon')
  const pairIsWind = isWind(pairTile)
  const pairIsDragon = isDragon(pairTile)

  if (windPungs.length === 4) add('bigFourWinds')
  else if (windPungs.length === 3 && pairIsWind) add('littleFourWinds')
  else if (windPungs.length === 3) add('bigThreeWinds')

  if (dragonPungs.length === 3) add('bigThreeDragons')
  else if (dragonPungs.length === 2 && pairIsDragon) add('littleThreeDragons')
  else if (dragonPungs.length === 2) add('twoDragonPungs')
  else if (dragonPungs.length === 1) add('dragonPung')

  // seat / prevalent winds + pung of terminals-or-honors
  for (const p of windPungs) {
    if (p.value === ctx.prevalentWind) add('prevalentWind')
    if (p.value === ctx.seatWind) add('seatWind')
    if (p.value !== ctx.prevalentWind && p.value !== ctx.seatWind) add('pungTerminalsHonors')
  }
  for (const p of pungs) {
    if (isSuited(p.tiles[0]) && (p.value === 1 || p.value === 9)) add('pungTerminalsHonors')
  }

  // ---- pung structure -----------------------------------------------------
  if (pungs.length === 4) add('allPungs')
  // All Even Pungs
  if (
    pungs.length === 4 &&
    pungs.every((p) => isSuited(p.tiles[0]) && p.value % 2 === 0) &&
    isSuited(pairTile) && Number(pairTile[1]) % 2 === 0
  ) add('allEvenPungs')

  detectPungShiftAndPungEquality(out, pungs)

  // ---- chow structure -----------------------------------------------------
  detectChowFans(out, chows)

  // All Chows (平和): four chows + suited pair
  if (chows.length === 4 && isSuited(pairTile)) add('allChows')

  // ---- kongs --------------------------------------------------------------
  if (kongs.length === 4) add('fourKongs')
  else if (kongs.length === 3) add('threeKongs')
  const concealedKongs = kongs.filter((k) => k.concealed).length
  const meldedKongs = kongs.length - concealedKongs
  if (concealedKongs >= 2) add('twoConcealedKongs')
  else if (concealedKongs === 1) add('concealedKong')
  if (meldedKongs >= 2) add('twoMeldedKongs')
  else if (meldedKongs === 1) add('meldedKong')

  // Melded Hand: all four sets exposed, won on the pair by discard
  if (sets.length === 4 && sets.every((s) => !s.concealed) && ctx.winType === 'discard') add('meldedHand')

  // ---- concealed pungs (with discard heuristic) ---------------------------
  let cp = pungs.filter((p) => p.concealed).length
  if (ctx.winType === 'discard') {
    const pairCompletes = ctx.winningTile && pair.tile === ctx.winningTile
    if (!pairCompletes && chows.length === 0 && cp > 0) cp -= 1 // discard completed a pung
  }
  if (cp >= 4) add('fourConcealedPungs')
  else if (cp === 3) add('threeConcealedPungs')
  else if (cp === 2) add('twoConcealedPungs')

  // ---- Tile Hog (four of one tile, not declared as a kong) ----------------
  const nonKongCount = Object.create(null)
  for (const s of sets) if (s.type !== 'kong') for (const t of s.tiles) nonKongCount[t] = (nonKongCount[t] || 0) + 1
  nonKongCount[pairTile] = (nonKongCount[pairTile] || 0) + 2
  for (const id in nonKongCount) if (nonKongCount[id] === 4) add('tileHog')

  // ---- Pure / Three-Suited Terminal Chows --------------------------------
  detectTerminalChowHands(out, chows, pairTile)

  // ---- Nine Gates ---------------------------------------------------------
  if (isNineGates(parsing, ctx)) add('nineGates')

  return out
}

// Suit flush / range / honor-composition fans computed from the flat tile list.
function addCompositionFans(out, allTiles, sets, pair) {
  const add = (id) => out.push({ id })
  const suits = new Set()
  let hasHonor = false, hasWind = false, hasDragon = false, allSuited = true
  for (const t of allTiles) {
    if (isSuited(t)) suits.add(t[0])
    else { allSuited = false; hasHonor = true; if (isWind(t)) hasWind = true; if (isDragon(t)) hasDragon = true }
  }

  if (suits.size === 1 && !hasHonor) add('fullFlush')
  else if (suits.size === 1 && hasHonor) add('halfFlush')
  if (suits.size === 2) add('oneVoidedSuit')
  if (!hasHonor) add('noHonors')

  // All Types: all three suits + winds + dragons present
  if (suits.size === 3 && hasWind && hasDragon) add('allTypes')

  // All Green
  if (allTiles.every((t) => GREEN.has(t))) add('allGreen')
  // Reversible Tiles
  if (allTiles.every((t) => REVERSIBLE.has(t))) add('reversibleTiles')
  // All Honors
  if (allTiles.every((t) => isHonor(t))) add('allHonors')

  // Range fans (suited only)
  if (allSuited) {
    const vals = allTiles.map((t) => Number(t[1]))
    const within = (lo, hi) => vals.every((v) => v >= lo && v <= hi)
    if (within(7, 9)) add('upperTiles')
    else if (within(6, 9)) add('upperFour')
    if (within(1, 3)) add('lowerTiles')
    else if (within(1, 4)) add('lowerFour')
    if (within(4, 6)) add('middleTiles')
    if (within(2, 8)) add('allSimples')
    // All Terminals: every tile a terminal
    if (allTiles.every((t) => isTerminal(t))) add('allTerminals')
  }

  // All Terminals and Honors: only pungs of terminals/honors, mixed
  if (
    sets.every((s) => s.type !== 'chow') &&
    allTiles.every((t) => isTerminalOrHonor(t)) &&
    hasHonor && allTiles.some((t) => isTerminal(t))
  ) add('allTerminalsAndHonors')

  // Outside Hand: every set + pair contains a terminal or honor
  if (sets.every(setHasTerminalOrHonor) && isTerminalOrHonor(pair.tile)) add('outsideHand')

  // All Fives: every set + pair contains a 5
  if (sets.every((s) => setHasValue(s, 5)) && setHasValue({ type: 'pair', value: Number(pair.tile[1]) }, 5) && isSuited(pair.tile)) add('allFives')
}

function detectPungShiftAndPungEquality(out, pungs) {
  const add = (id) => out.push({ id })
  const suited = pungs.filter((p) => isSuited(p.tiles[0])).map((p) => ({ suit: p.suit, value: p.value }))

  // Pure shifted pungs (same suit, consecutive values)
  for (const suit of ['m', 's', 'p']) {
    const vs = suited.filter((p) => p.suit === suit).map((p) => p.value).sort((a, b) => a - b)
    const uniq = [...new Set(vs)]
    // four shifted
    for (const c of combos(uniq, 4)) if (c[1] === c[0] + 1 && c[2] === c[1] + 1 && c[3] === c[2] + 1) add('fourPureShiftedPungs')
    if (!out.some((f) => f.id === 'fourPureShiftedPungs')) {
      for (const c of combos(uniq, 3)) if (c[1] === c[0] + 1 && c[2] === c[1] + 1) { add('pureShiftedPungs'); break }
    }
  }

  // Triple / Double pung (same number across suits)
  for (let v = 1; v <= 9; v++) {
    const suitsWith = new Set(suited.filter((p) => p.value === v).map((p) => p.suit))
    if (suitsWith.size === 3) add('triplePung')
    else if (suitsWith.size === 2) add('doublePung')
  }

  // Mixed shifted pungs: three suits, consecutive values, one per suit
  for (const c of combos(suited, 3)) {
    const ss = new Set(c.map((p) => p.suit))
    if (ss.size !== 3) continue
    const vs = c.map((p) => p.value).sort((a, b) => a - b)
    if (vs[1] === vs[0] + 1 && vs[2] === vs[1] + 1) { add('mixedShiftedPungs'); break }
  }
}

function detectChowFans(out, chows) {
  const add = (id) => out.push({ id })
  const arr = chows.map((c) => ({ suit: c.suit, low: c.value }))

  // identical-chow groups (pure double / triple / quadruple)
  const groups = {}
  for (const c of arr) groups[c.suit + c.low] = (groups[c.suit + c.low] || 0) + 1
  for (const k in groups) {
    if (groups[k] >= 4) add('quadrupleChow')
    else if (groups[k] === 3) add('pureTripleChow')
    else if (groups[k] === 2) add('pureDoubleChow')
  }

  // mixed triple / double (same low, different suits)
  for (let low = 1; low <= 7; low++) {
    const suitsWith = new Set(arr.filter((c) => c.low === low).map((c) => c.suit))
    if (suitsWith.size === 3) add('mixedTripleChow')
    else if (suitsWith.size === 2) add('mixedDoubleChow')
  }

  // same-suit straights / shifts
  let sawFourShift = false
  for (const suit of ['m', 's', 'p']) {
    const lows = [...new Set(arr.filter((c) => c.suit === suit).map((c) => c.low))].sort((a, b) => a - b)
    // four shifted (step 1 or 2)
    for (const c of combos(lows, 4)) {
      const step = c[1] - c[0]
      if ((step === 1 || step === 2) && c[2] - c[1] === step && c[3] - c[2] === step) { add('fourShiftedChows'); sawFourShift = true }
    }
    // pure straight 1/4/7
    if (lows.includes(1) && lows.includes(4) && lows.includes(7)) add('pureStraight')
    // pure shifted (3 chows, step 1 or 2)
    if (!sawFourShift) {
      for (const c of combos(lows, 3)) {
        const step = c[1] - c[0]
        if ((step === 1 || step === 2) && c[2] - c[1] === step) { add('pureShiftedChows'); break }
      }
    }
    // short straight (lows differ by 3) & two terminal chows (1 & 7)
    for (const c of combos(lows, 2)) {
      if (c[1] - c[0] === 3) add('shortStraight')
    }
    if (lows.includes(1) && lows.includes(7)) add('twoTerminalChows')
  }

  // mixed straight (1/4/7 spread one per suit) & mixed shifted chows. Each is a
  // three-chow pattern, so it scores at most once even when a chow is repeated.
  let mixedStraight = false, mixedShifted = false
  for (const c of combos(arr, 3)) {
    if (new Set(c.map((x) => x.suit)).size !== 3) continue
    const lows = c.map((x) => x.low).sort((a, b) => a - b)
    if (!mixedStraight && lows[0] === 1 && lows[1] === 4 && lows[2] === 7) { add('mixedStraight'); mixedStraight = true }
    if (!mixedShifted && lows[1] === lows[0] + 1 && lows[2] === lows[1] + 1) { add('mixedShiftedChows'); mixedShifted = true }
  }
}

// Pure Terminal Chows (一色双龙会) and Three-Suited Terminal Chows (三色双龙会)
function detectTerminalChowHands(out, chows, pairTile) {
  if (chows.length !== 4) return
  const byKey = chows.map((c) => c.suit + c.value)
  // Pure: 123,123,789,789 + pair 55 all one suit
  for (const suit of ['m', 's', 'p']) {
    const need = [suit + '1', suit + '1', suit + '7', suit + '7']
    if (sameMultiset(byKey, need) && pairTile === suit + '5') out.push({ id: 'pureTerminalChows' })
  }
  // Three-suited: 123+789 in two suits + 55 pair in the third
  if (isSuited(pairTile) && pairTile[1] === '5') {
    const pairSuit = pairTile[0]
    const others = ['m', 's', 'p'].filter((s) => s !== pairSuit)
    const need = [others[0] + '1', others[0] + '7', others[1] + '1', others[1] + '7']
    if (sameMultiset(byKey, need)) out.push({ id: 'threeSuitedTerminalChows' })
  }
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false
  const c = {}
  for (const x of a) c[x] = (c[x] || 0) + 1
  for (const x of b) { if (!c[x]) return false; c[x]-- }
  return true
}

// Nine Gates: concealed, single suit, pattern 1112345678999 + one extra of suit.
function isNineGates(parsing, ctx) {
  if (parsing.sets.some((s) => !s.concealed)) return false
  const tiles = parsing.sets.flatMap((s) => s.tiles).concat([parsing.pair.tile, parsing.pair.tile])
  if (tiles.length !== 14) return false
  const suit = tiles[0][0]
  if (!'msp'.includes(suit)) return false
  if (!tiles.every((t) => t[0] === suit)) return false
  const cnt = Array(10).fill(0)
  for (const t of tiles) cnt[Number(t[1])]++
  if (cnt[1] < 3 || cnt[9] < 3) return false
  for (let v = 2; v <= 8; v++) if (cnt[v] < 1) return false
  return true
}
