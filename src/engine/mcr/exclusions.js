// ---------------------------------------------------------------------------
// Non-Repeat Principle — implied-fan exclusion table
// ---------------------------------------------------------------------------
//
// If a higher fan implies a lower one, only the higher is scored. The map below
// reads "presence of <key> removes ALL instances of <listed ids>". This covers
// the spec's explicit exclusions plus the common structural implications. It is
// a practical approximation of the full MCR implied-fan graph, which is large.

export const EXCLUSIONS = {
  bigFourWinds: ['littleFourWinds', 'bigThreeWinds', 'prevalentWind', 'seatWind', 'pungTerminalsHonors', 'oneVoidedSuit', 'allPungs'],
  bigThreeDragons: ['littleThreeDragons', 'twoDragonPungs', 'dragonPung'],
  littleFourWinds: ['bigThreeWinds', 'pungTerminalsHonors'],
  littleThreeDragons: ['twoDragonPungs', 'dragonPung'],
  twoDragonPungs: ['dragonPung'],

  allGreen: ['noHonors'],
  allHonors: ['allPungs', 'pungTerminalsHonors', 'allTerminalsAndHonors', 'outsideHand', 'halfFlush'],
  allTerminals: ['allPungs', 'pungTerminalsHonors', 'noHonors', 'allTerminalsAndHonors', 'outsideHand'],
  allTerminalsAndHonors: ['allPungs', 'outsideHand', 'pungTerminalsHonors'],

  // Melded Hand is always won on the pair, so it already includes the single wait.
  meldedHand: ['pairWait'],

  fourConcealedPungs: ['threeConcealedPungs', 'twoConcealedPungs', 'allPungs'],
  threeConcealedPungs: ['twoConcealedPungs'],

  fourKongs: ['threeKongs', 'twoConcealedKongs', 'twoMeldedKongs', 'meldedKong', 'allPungs'],
  threeKongs: ['twoConcealedKongs', 'twoMeldedKongs'],

  fullFlush: ['halfFlush', 'oneVoidedSuit', 'noHonors'],
  nineGates: ['fullFlush', 'concealedHand', 'noHonors', 'oneVoidedSuit', 'pungTerminalsHonors'],

  quadrupleChow: ['pureTripleChow', 'pureDoubleChow', 'tileHog'],
  pureTripleChow: ['pureDoubleChow'],
  fourPureShiftedPungs: ['pureShiftedPungs'],

  fourShiftedChows: ['pureShiftedChows', 'shortStraight'],
  pureStraight: ['shortStraight', 'twoTerminalChows'],
  mixedTripleChow: ['mixedDoubleChow'],

  triplePung: ['doublePung'],

  upperTiles: ['upperFour', 'noHonors'],
  lowerTiles: ['lowerFour', 'noHonors'],
  middleTiles: ['noHonors', 'allSimples'],
  allSimples: ['noHonors'],
  allFives: ['allSimples', 'noHonors'],
  upperFour: ['noHonors'],
  lowerFour: ['noHonors'],

  allEvenPungs: ['allPungs', 'allSimples'],

  sevenPairs: ['concealedHand'],
  sevenShiftedPairs: ['sevenPairs', 'fullFlush', 'oneVoidedSuit', 'noHonors', 'concealedHand'],

  pureTerminalChows: ['fullFlush', 'twoTerminalChows', 'pureDoubleChow', 'allChows'],
  threeSuitedTerminalChows: ['twoTerminalChows', 'mixedDoubleChow', 'allChows', 'noHonors'],

  knittedStraight: ['oneVoidedSuit'],
  greaterHonorsKnitted: ['lesserHonorsKnitted', 'allTypes', 'noHonors'],
  lesserHonorsKnitted: ['allTypes', 'oneVoidedSuit'],
  thirteenOrphans: ['allTypes'],
}

// Remove every implied lower fan from the list of detected fan instances.
export function applyExclusions(fans) {
  const present = new Set(fans.map((f) => f.id))
  const toRemove = new Set()
  for (const id of present) {
    const ex = EXCLUSIONS[id]
    if (ex) for (const r of ex) toRemove.add(r)
  }
  return fans.filter((f) => !toRemove.has(f.id))
}
