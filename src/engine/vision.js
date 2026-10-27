// ---------------------------------------------------------------------------
// Photo -> tiles recognition.
//
// Takes a photo (camera capture or camera roll) and returns the tile ids it
// contains, so you can fill in your hand or the discard pool without tapping
// fourteen tiles one at a time.
//
// Recognition runs through Claude's vision API. Unlike the rest of engine/, this
// module is NOT pure: it touches the DOM (canvas, for downscaling) and the
// network. The output is deliberately only a list of *candidate* tile ids — the
// UI always shows them for review before anything is committed, because a misread
// tile would silently poison every piece of advice downstream.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { TILE_IDS, FLOWERS, SEASONS, TILE_INDEX, isBonus } from './tiles.js';

// Every id the model is allowed to emit. Used as a JSON-schema enum, which is
// what stops it inventing notation like "bamboo3" or "5m".
export const RECOGNIZABLE_IDS = [...TILE_IDS, ...FLOWERS, ...SEASONS];

const isValidId = (id) => TILE_INDEX[id] !== undefined || isBonus(id);

// Claude's vision guidance: no accuracy gain above ~1568px on the long edge, and
// the request has a hard size ceiling. Phone photos are 3000-4000px — downscale.
const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

export const MODEL = 'claude-opus-5';

// --- image prep -------------------------------------------------------------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

// Downscale to MAX_EDGE and re-encode as JPEG. Returns a bare base64 string (no
// data: prefix, no newlines) plus a data URL for the preview thumbnail.
export async function prepareImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mediaType: 'image/jpeg',
    previewUrl: dataUrl,
    width: w,
    height: h,
  };
}

// --- prompt -----------------------------------------------------------------

const NOTATION = [
  'Tile id notation (use these exact strings, nothing else):',
  '- man1..man9  CHARACTERS suit (wan). A Chinese numeral on top, the wan glyph below.',
  '- sou1..sou9  BAMBOO suit. N bamboo sticks. Watch out: sou1 is usually drawn as',
  '              a BIRD (peacock/sparrow), not as a single stick.',
  '- pin1..pin9  CIRCLES suit. N printed dots/circles.',
  '- wind_east, wind_south, wind_west, wind_north  (the four wind glyphs)',
  '- dragon_red (a red glyph), dragon_green (a green glyph),',
  '  dragon_white (a blank tile, or one with just an empty rectangular frame)',
  '- flower1..flower4, season1..season4  bonus tiles: colourful pictorial art',
  '  (plum/orchid/chrysanthemum/bamboo, spring/summer/autumn/winter), usually with',
  '  a small number in a corner. Use that number when you can read it, otherwise',
  '  pick an unused one from the right group.',
].join('\n');

const MODE_BRIEF = {
  hand: [
    'This photo shows ONE PLAYER OWN HAND: a single row of tiles, faces toward the',
    'camera. Report every tile in that row, left to right. A normal hand is 13 or',
    '14 tiles, so if you end up with a very different count, re-examine the photo',
    'before answering. If some tiles are exposed melds set slightly apart from the',
    'rest, still report them, and mention the split in notes.',
  ].join('\n'),

  table: [
    'This photo shows the TABLE / DISCARD POOL: tiles that have been thrown out,',
    'face up in the middle. Report every discarded tile you can see, including',
    'repeats — four separate 5-circles means four separate entries. Do NOT report',
    'face-down tiles, tiles standing upright in a rack with their backs to you, or',
    'the undrawn wall.',
  ].join('\n'),
};

const SYSTEM = [
  'You identify mahjong tiles in photographs for a Chinese Official Mahjong (MCR)',
  'assistant. Be precise and do not guess: a wrong tile makes the assistant give',
  'wrong advice, so an honest low confidence or a skipped tile is much better than',
  'a confident mistake.',
  '',
  NOTATION,
  '',
  'Method, in order:',
  '1. Locate the tiles the brief asks for, and work along them in a consistent order.',
  '2. For each tile decide the suit/category FIRST (numeral+wan / dots / bamboo /',
  '   honor / pictorial), then the number. Count dots and sticks one at a time.',
  '3. Emit one array entry per PHYSICAL tile — duplicates each get their own entry.',
  '4. Mark a tile low confidence whenever it is blurred, angled, cropped, partly',
  '   covered, or you hesitated between two readings.',
  '5. Omit a tile entirely only when you genuinely cannot tell what it is, and say',
  '   so in notes.',
  '',
  'Put anything the user should double-check in notes (one or two short sentences,',
  'plain English, no markdown). Use an empty string when the read was clean.',
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    tiles: {
      type: 'array',
      description: 'One entry per physical tile, in reading order.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: RECOGNIZABLE_IDS },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['id', 'confidence'],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'string',
      description: 'Ambiguities or skipped tiles. Empty string if the read was clean.',
    },
  },
  required: ['tiles', 'notes'],
  additionalProperties: false,
};

// --- recognition ------------------------------------------------------------

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError)
    return 'That API key was rejected. Check it and try again.';
  if (err instanceof Anthropic.PermissionDeniedError)
    return 'That key does not have access to the Claude API.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Rate limited. Wait a few seconds and try again.';
  if (err instanceof Anthropic.BadRequestError)
    return 'The request was rejected: ' + err.message;
  if (err instanceof Anthropic.APIConnectionError)
    return 'Could not reach the Claude API. Check your connection.';
  if (err instanceof Anthropic.APIError)
    return 'Claude API error ' + err.status + ': ' + err.message;
  return (err && err.message) || 'Recognition failed.';
}

// image: the { base64, mediaType } from prepareImage.
// mode:  'hand' | 'table'
// Returns { tiles: [{ id, confidence }], notes, dropped, usage }.
export async function recognizeTiles({ image, mode = 'hand', apiKey, model = MODEL }) {
  if (!apiKey) throw new Error('No API key set.');
  const brief = MODE_BRIEF[mode] || MODE_BRIEF.hand;

  // The key lives in this browser, so this is a personal-use client. It is never
  // sent anywhere but api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
            },
            { type: 'text', text: brief },
          ],
        },
      ],
    });
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  if (response.stop_reason === 'refusal')
    throw new Error('Claude declined to process that image.');
  if (response.stop_reason === 'max_tokens')
    throw new Error('The response was cut off. Try a tighter crop of just the tiles.');

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Claude replied with something unreadable. Try again.');
  }

  // Trust nothing: the schema enum should already guarantee valid ids, but the
  // hand is what the whole engine runs on, so filter again here.
  const raw = Array.isArray(parsed.tiles) ? parsed.tiles : [];
  const tiles = [];
  let dropped = 0;
  for (const t of raw) {
    const id = t && typeof t.id === 'string' ? t.id : null;
    if (id && isValidId(id)) {
      tiles.push({ id, confidence: t.confidence === 'low' ? 'low' : 'high' });
    } else {
      dropped++;
    }
  }

  return {
    tiles,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    dropped,
    usage: response.usage,
  };
}
