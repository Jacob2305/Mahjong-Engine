// ---------------------------------------------------------------------------
// Tile definitions & helpers
// ---------------------------------------------------------------------------
//
// Internal tile representation is a short string id:
//   Suited:  'm1'..'m9'  (Characters/万 Man)
//            's1'..'s9'  (Bamboo/竹 Sou)
//            'p1'..'p9'  (Circles/筒 Pin)
//   Winds:   'we' East 东, 'ws' South 南, 'ww' West 西, 'wn' North 北
//   Dragons: 'dr' Red 中, 'dg' Green 發, 'dw' White 白
//   Flowers: 'f1'..'f4'   Seasons: 'y1'..'y4'  (bonus tiles, scored separately)
//
// A tile may appear up to 4 times in a hand (flowers/seasons only once each).

const SUIT_NAMES = { m: 'man', s: 'sou', p: 'pin' }

export const WIND_ORDER = ['e', 's', 'w', 'n']
export const DRAGON_ORDER = ['r', 'g', 'w']

// Image filenames in the FluffyStuff/riichi-mahjong-tiles "Regular" set.
const IMAGE_BASE =
  'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/'

const IMAGE_MAP = {
  we: 'Ton', ws: 'Nan', ww: 'Shaa', wn: 'Pei',
  dr: 'Chun', dg: 'Hatsu', dw: 'Haku',
}

// Parse a tile id into structured form. Cached for speed.
const parseCache = new Map()
export function parseTile(id) {
  let t = parseCache.get(id)
  if (t) return t
  const a = id[0]
  if (a === 'm' || a === 's' || a === 'p') {
    t = { id, kind: 'suit', suit: a, value: Number(id[1]) }
  } else if (a === 'w') {
    t = { id, kind: 'wind', suit: 'wind', value: id[1] } // e/s/w/n
  } else if (a === 'd') {
    t = { id, kind: 'dragon', suit: 'dragon', value: id[1] } // r/g/w
  } else if (a === 'f') {
    t = { id, kind: 'flower', suit: 'flower', value: Number(id[1]) }
  } else if (a === 'y') {
    t = { id, kind: 'season', suit: 'season', value: Number(id[1]) }
  } else {
    throw new Error('Unknown tile id: ' + id)
  }
  parseCache.set(id, t)
  return t
}

export const isSuited = (id) => 'msp'.includes(id[0])
export const isWind = (id) => id[0] === 'w'
export const isDragon = (id) => id[0] === 'd'
export const isHonor = (id) => id[0] === 'w' || id[0] === 'd'
export const isFlower = (id) => id[0] === 'f' || id[0] === 'y'
export const isBonus = isFlower
export const isTerminal = (id) => isSuited(id) && (id[1] === '1' || id[1] === '9')
export const isSimple = (id) => isSuited(id) && id[1] !== '1' && id[1] !== '9'
export const isTerminalOrHonor = (id) => isHonor(id) || isTerminal(id)

export function suitOf(id) {
  const a = id[0]
  if (a === 'm' || a === 's' || a === 'p') return a
  if (a === 'w') return 'wind'
  if (a === 'd') return 'dragon'
  return a === 'f' ? 'flower' : 'season'
}

export function valueOf(id) {
  return parseTile(id).value
}

// Display label (Chinese where natural).
const SUIT_CHAR = { m: '万', s: '条', p: '筒' }
const WIND_CHAR = { e: '东', s: '南', w: '西', n: '北' }
const DRAGON_CHAR = { r: '中', g: '發', w: '白' }
const FLOWER_CHAR = ['梅', '兰', '竹', '菊'] // plum, orchid, bamboo, chrysanthemum
const SEASON_CHAR = ['春', '夏', '秋', '冬'] // spring, summer, autumn, winter

export function tileLabel(id) {
  const t = parseTile(id)
  if (t.kind === 'suit') return id[1]
  if (t.kind === 'wind') return WIND_CHAR[t.value]
  if (t.kind === 'dragon') return DRAGON_CHAR[t.value]
  if (t.kind === 'flower') return FLOWER_CHAR[t.value - 1]
  return SEASON_CHAR[t.value - 1]
}

export function tileSubLabel(id) {
  const t = parseTile(id)
  if (t.kind === 'suit') return SUIT_CHAR[t.suit]
  return ''
}

// Full human name in English for fan descriptions.
export function tileName(id) {
  const t = parseTile(id)
  if (t.kind === 'suit') return `${t.value} ${SUIT_NAMES[t.suit]}`
  if (t.kind === 'wind')
    return { e: 'East', s: 'South', w: 'West', n: 'North' }[t.value] + ' Wind'
  if (t.kind === 'dragon')
    return { r: 'Red', g: 'Green', w: 'White' }[t.value] + ' Dragon'
  if (t.kind === 'flower') return `Flower ${t.value}`
  return `Season ${t.value}`
}

export function tileImage(id) {
  if (IMAGE_MAP[id]) return IMAGE_BASE + IMAGE_MAP[id] + '.svg'
  if (isSuited(id)) {
    const name = { m: 'Man', s: 'Sou', p: 'Pin' }[id[0]]
    return IMAGE_BASE + name + id[1] + '.svg'
  }
  return null // flowers/seasons: rendered as CSS tiles
}

// Suit accent color used for CSS-drawn flower/season tiles.
export function tileAccent(id) {
  const t = parseTile(id)
  if (t.kind === 'flower') return '#b8472f'
  if (t.kind === 'season') return '#2f7bb8'
  return '#3d2c16'
}

// ---------------------------------------------------------------------------
// The picker catalog, grouped into sections.
// ---------------------------------------------------------------------------
const range = (n) => Array.from({ length: n }, (_, i) => i + 1)

export const TILE_SECTIONS = [
  { key: 'man', label: 'Characters 万', tiles: range(9).map((n) => 'm' + n) },
  { key: 'sou', label: 'Bamboo 条', tiles: range(9).map((n) => 's' + n) },
  { key: 'pin', label: 'Circles 筒', tiles: range(9).map((n) => 'p' + n) },
  { key: 'wind', label: 'Winds 风', tiles: ['we', 'ws', 'ww', 'wn'] },
  { key: 'dragon', label: 'Dragons 箭', tiles: ['dr', 'dg', 'dw'] },
]

// Sort helper to display a hand in a sensible order.
const SUIT_RANK = { m: 0, s: 1, p: 2, wind: 3, dragon: 4, flower: 5, season: 6 }
const WIND_RANK = { e: 0, s: 1, w: 2, n: 3 }
const DRAGON_RANK = { r: 0, g: 1, w: 2 }
export function tileSortKey(id) {
  const t = parseTile(id)
  let v = t.value
  if (t.kind === 'wind') v = WIND_RANK[t.value]
  else if (t.kind === 'dragon') v = DRAGON_RANK[t.value]
  return SUIT_RANK[t.suit] * 100 + v
}

export function sortTiles(ids) {
  return [...ids].sort((a, b) => tileSortKey(a) - tileSortKey(b))
}
