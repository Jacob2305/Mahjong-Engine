// ---------------------------------------------------------------------------
// Tile definitions, IDs and helpers.
//
// We use a canonical 34-tile index space for all engine math:
//   0-8   : man 1-9
//   9-17  : sou 1-9
//   18-26 : pin 1-9
//   27-30 : winds  E, S, W, N
//   31-33 : dragons R(red/中), G(green/發), W(white/白)
// Flowers / seasons are bonus tiles and live OUTSIDE this index space — they
// never affect shanten and are tracked separately.
// ---------------------------------------------------------------------------

export const SUITS = ['man', 'sou', 'pin'];
export const WINDS = ['east', 'south', 'west', 'north'];
export const DRAGONS = ['red', 'green', 'white'];

// Build the ordered list of 34 canonical tile ids.
export const TILE_IDS = [];
for (const s of SUITS) for (let v = 1; v <= 9; v++) TILE_IDS.push(`${s}${v}`);
for (const w of WINDS) TILE_IDS.push(`wind_${w}`);
for (const d of DRAGONS) TILE_IDS.push(`dragon_${d}`);

// id -> index lookup
export const TILE_INDEX = {};
TILE_IDS.forEach((id, i) => { TILE_INDEX[id] = i; });

export const NUM_TILE_TYPES = 34; // honors + suited (no bonus tiles)

// Bonus tiles (tracked, but excluded from shanten math)
export const FLOWERS = [1, 2, 3, 4].map((v) => `flower${v}`);
export const SEASONS = [1, 2, 3, 4].map((v) => `season${v}`);

// --- id <-> tile object ----------------------------------------------------

export function tileToId(tile) {
  if (typeof tile === 'string') return tile;
  if (tile.suit === 'man' || tile.suit === 'sou' || tile.suit === 'pin')
    return `${tile.suit}${tile.value}`;
  if (tile.suit === 'wind') return `wind_${tile.value}`;
  if (tile.suit === 'dragon') return `dragon_${tile.value}`;
  if (tile.suit === 'flower' || tile.suit === 'season')
    return `${tile.suit}${tile.value}`;
  return '';
}

export function idToTile(id) {
  if (id.startsWith('wind_')) return { suit: 'wind', value: id.slice(5) };
  if (id.startsWith('dragon_')) return { suit: 'dragon', value: id.slice(7) };
  if (id.startsWith('flower')) return { suit: 'flower', value: Number(id.slice(6)) };
  if (id.startsWith('season')) return { suit: 'season', value: Number(id.slice(6)) };
  const suit = id.slice(0, 3);
  const value = Number(id.slice(3));
  return { suit, value };
}

export function isBonus(id) {
  return id.startsWith('flower') || id.startsWith('season');
}

export function isHonor(id) {
  return id.startsWith('wind_') || id.startsWith('dragon_');
}

export function isSuited(id) {
  return id.startsWith('man') || id.startsWith('sou') || id.startsWith('pin');
}

export function isTerminal(id) {
  if (!isSuited(id)) return false;
  const v = Number(id.slice(3));
  return v === 1 || v === 9;
}

export function isTerminalOrHonor(id) {
  return isHonor(id) || isTerminal(id);
}

// --- display names ---------------------------------------------------------

const SUIT_LABEL = { man: '万', sou: '竹', pin: '筒' };
const WIND_LABEL = { east: 'East 東', south: 'South 南', west: 'West 西', north: 'North 北' };
const WIND_SHORT = { east: '東', south: '南', west: '西', north: '北' };
const DRAGON_LABEL = { red: 'Red 中', green: 'Green 發', white: 'White 白' };
const DRAGON_SHORT = { red: '中', green: '發', white: '白' };

export function tileName(id) {
  if (id.startsWith('wind_')) return WIND_LABEL[id.slice(5)];
  if (id.startsWith('dragon_')) return DRAGON_LABEL[id.slice(7)];
  if (id.startsWith('flower')) return `Flower ${id.slice(6)}`;
  if (id.startsWith('season')) return `Season ${id.slice(6)}`;
  const suit = id.slice(0, 3);
  const v = id.slice(3);
  const names = { man: 'Characters', sou: 'Bamboo', pin: 'Circles' };
  return `${v}-${names[suit]}`;
}

// Short label used inside a tile chip when no image is available.
export function tileShort(id) {
  if (id.startsWith('wind_')) return WIND_SHORT[id.slice(5)];
  if (id.startsWith('dragon_')) return DRAGON_SHORT[id.slice(7)];
  if (id.startsWith('flower')) return `F${id.slice(6)}`;
  if (id.startsWith('season')) return `S${id.slice(6)}`;
  const suit = id.slice(0, 3);
  const v = id.slice(3);
  return `${v}${SUIT_LABEL[suit]}`;
}

// --- image mapping (FluffyStuff riichi-mahjong-tiles) ----------------------

const IMG_BASE =
  'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/';

const WIND_FILE = { east: 'Ton', south: 'Nan', west: 'Shaa', north: 'Pei' };
const DRAGON_FILE = { red: 'Chun', green: 'Hatsu', white: 'Haku' };

// Returns an image URL, or null when no artwork exists (flowers/seasons ->
// the UI falls back to a styled inline chip).
export function tileImageUrl(id) {
  if (id.startsWith('wind_')) return `${IMG_BASE}${WIND_FILE[id.slice(5)]}.svg`;
  if (id.startsWith('dragon_')) return `${IMG_BASE}${DRAGON_FILE[id.slice(7)]}.svg`;
  if (id.startsWith('man')) return `${IMG_BASE}Man${id.slice(3)}.svg`;
  if (id.startsWith('sou')) return `${IMG_BASE}Sou${id.slice(3)}.svg`;
  if (id.startsWith('pin')) return `${IMG_BASE}Pin${id.slice(3)}.svg`;
  return null; // flowers / seasons
}

// --- count helpers ---------------------------------------------------------

// Convert an array of tile ids into a length-34 count array (bonus ignored).
export function idsToCounts(ids) {
  const counts = new Array(NUM_TILE_TYPES).fill(0);
  for (const id of ids) {
    const idx = TILE_INDEX[id];
    if (idx !== undefined) counts[idx]++;
  }
  return counts;
}

// Group ids by picker section for the UI.
export const PICKER_SECTIONS = [
  { label: 'Characters 万', ids: TILE_IDS.slice(0, 9) },
  { label: 'Bamboo 竹', ids: TILE_IDS.slice(9, 18) },
  { label: 'Circles 筒', ids: TILE_IDS.slice(18, 27) },
  { label: 'Winds', ids: TILE_IDS.slice(27, 31) },
  { label: 'Dragons', ids: TILE_IDS.slice(31, 34) },
  { label: 'Flowers / Seasons', ids: [...FLOWERS, ...SEASONS] },
];
