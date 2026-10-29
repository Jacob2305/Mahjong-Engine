// ---------------------------------------------------------------------------
// Hand decomposition (recursive backtracking)
// ---------------------------------------------------------------------------
//
// A standard winning hand = 4 sets (chow / pung / kong) + 1 pair.
// Melded tiles are decomposed into complete sets only; concealed tiles are
// decomposed into the remaining sets + the single pair. We enumerate ALL valid
// decompositions so the scorer can pick the highest-scoring interpretation.
//
// Kongs are physical 4-tile sets, so a hand with k kongs holds 14 + k tiles.
// Because we partition the actual tiles, kong arithmetic falls out naturally.

import { isSuited } from './tiles.js'

// Canonical processing order — guarantees each partition is generated once.
const ORDER = [
  'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9',
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
  'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9',
  'we', 'ws', 'ww', 'wn', 'dr', 'dg', 'dw',
]

export function countTiles(ids) {
  const c = Object.create(null)
  for (const id of ids) c[id] = (c[id] || 0) + 1
  return c
}

function nextTile(counts) {
  for (const id of ORDER) if (counts[id] > 0) return id
  return null
}

function makeSet(type, tiles) {
  const a = tiles[0]
  return {
    type,
    tiles,
    suit: a[0] === 'm' || a[0] === 's' || a[0] === 'p'
      ? a[0]
      : a[0] === 'w'
        ? 'wind'
        : 'dragon',
    // chow value = lowest tile value; pung/kong value = the repeated tile value
    value: type === 'chow' ? Number(a[1]) : a.length === 2 ? a[1] : Number(a[1]),
  }
}

// Returns array of decompositions: { sets: [...], pair: id|null }
// needPair controls whether exactly one pair must be present.
export function decompose(counts, needPair) {
  const results = []
  const sets = []

  function recurse(counts, pair) {
    const id = nextTile(counts)
    if (id === null) {
      if (needPair && !pair) return
      results.push({ sets: sets.map((s) => ({ ...s, tiles: [...s.tiles] })), pair })
      return
    }

    // Pair
    if (needPair && !pair && counts[id] >= 2) {
      counts[id] -= 2
      recurse(counts, id)
      counts[id] += 2
    }

    // Kong (consume all 4)
    if (counts[id] >= 4) {
      counts[id] -= 4
      sets.push(makeSet('kong', [id, id, id, id]))
      recurse(counts, pair)
      sets.pop()
      counts[id] += 4
    }

    // Pung
    if (counts[id] >= 3) {
      counts[id] -= 3
      sets.push(makeSet('pung', [id, id, id]))
      recurse(counts, pair)
      sets.pop()
      counts[id] += 3
    }

    // Chow
    if (isSuited(id)) {
      const v = Number(id[1])
      if (v <= 7) {
        const b = id[0] + (v + 1)
        const c = id[0] + (v + 2)
        if (counts[b] > 0 && counts[c] > 0) {
          counts[id]--
          counts[b]--
          counts[c]--
          sets.push(makeSet('chow', [id, b, c]))
          recurse(counts, pair)
          sets.pop()
          counts[id]++
          counts[b]++
          counts[c]++
        }
      }
    }
  }

  recurse(counts, null)
  return results
}

// Decompose a hand split into concealed + melded tile lists into all valid
// standard parsings. Each parsing tags every set with `concealed: bool`.
export function decomposeHand(concealed, melded) {
  const meldCounts = countTiles(melded)
  const meldDecomps = melded.length
    ? decompose(meldCounts, false).filter((d) => d.pair === null)
    : [{ sets: [], pair: null }]
  if (meldDecomps.length === 0) return []

  const concCounts = countTiles(concealed)
  const concDecomps = decompose(concCounts, true)

  const parsings = []
  for (const md of meldDecomps) {
    const meldSets = md.sets.map((s) => ({ ...s, concealed: false }))
    for (const cd of concDecomps) {
      if (cd.pair === null) continue
      const concSets = cd.sets.map((s) => ({ ...s, concealed: true }))
      if (meldSets.length + concSets.length !== 4) continue
      parsings.push({
        sets: [...meldSets, ...concSets],
        pair: { tile: cd.pair, concealed: true },
      })
    }
  }
  return parsings
}
