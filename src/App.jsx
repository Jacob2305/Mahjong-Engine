import React, { useState, useCallback, useRef } from 'react';
import TilePicker from './components/TilePicker.jsx';
import HandDisplay from './components/HandDisplay.jsx';
import DiscardPool from './components/DiscardPool.jsx';
import GameContext from './components/GameContext.jsx';
import AdvisorSheet from './components/AdvisorSheet.jsx';
import MeldBuilder from './components/MeldBuilder.jsx';
import PhotoImport from './components/PhotoImport.jsx';
import { advise } from './engine/advisor.js';
import { isBonus, TILE_INDEX, tileName } from './engine/tiles.js';

const STORAGE_KEY = 'mcr-advisor-state-v1';
// Kept out of the game-state blob so Reset can't wipe it.
const API_KEY_STORAGE = 'mcr-advisor-api-key';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

const DEFAULT_CONTEXT = {
  seatWind: 'east',
  prevalentWind: 'east',
  round: '',
  lastDiscard: null,
  canChow: true,
};

export default function App() {
  const saved = loadState();
  const [zone, setZone] = useState('hand');
  const [handIds, setHandIds] = useState(saved?.handIds || []);
  const [melds, setMelds] = useState(saved?.melds || []);
  const [discards, setDiscards] = useState(saved?.discards || {});
  // The most-recent tile added to the discard pool = "the tile just thrown".
  const [lastDiscardId, setLastDiscardId] = useState(saved?.lastDiscardId || null);
  // The tile YOU most recently discarded (highlighted green in the pool).
  const [myDiscardId, setMyDiscardId] = useState(saved?.myDiscardId || null);
  const [context, setContext] = useState({ ...DEFAULT_CONTEXT, ...(saved?.context || {}) });
  const [advice, setAdvice] = useState(null);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [apiKey, setApiKey] = useState(loadApiKey);
  const discardRef = useRef(null);

  const updateApiKey = (key) => {
    setApiKey(key);
    try {
      if (key) localStorage.setItem(API_KEY_STORAGE, key);
      else localStorage.removeItem(API_KEY_STORAGE);
    } catch {
      /* ignore */
    }
  };

  // persist
  const persist = useCallback((next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const syncPersist = (over = {}) =>
    persist({ handIds, melds, discards, context, lastDiscardId, myDiscardId, ...over });

  // copies of a tile already committed across hand + melds + discards
  const countCopies = useCallback(
    (id) => {
      let n = handIds.filter((x) => x === id).length;
      for (const m of melds) n += m.tiles.filter((x) => x === id).length;
      n += discards[id] || 0;
      return n;
    },
    [handIds, melds, discards],
  );

  const remaining = useCallback(
    (id) => {
      if (isBonus(id)) return 1 - handIds.filter((x) => x === id).length;
      return 4 - countCopies(id);
    },
    [handIds, melds, discards, countCopies],
  );

  const handConcealedCount = handIds.filter((x) => !isBonus(x)).length;
  const handTotalSlots = handConcealedCount + melds.length * 3;

  // --- tile picking ---------------------------------------------------------
  // `target` says where the tile goes: 'hand' (press & hold) or 'discards'
  // (tap). Defaults to the focused zone for any other caller.
  const pickTile = (id, target = zone) => {
    if (isBonus(id)) {
      if (remaining(id) <= 0) return;
      const next = [...handIds, id];
      setHandIds(next);
      syncPersist({ handIds: next });
      return;
    }
    if (target === 'hand') {
      if (remaining(id) <= 0) return;
      // soft cap: don't exceed 14 concealed slots
      if (handConcealedCount + melds.length * 3 >= 14) return;
      const next = [...handIds, id];
      setHandIds(next);
      syncPersist({ handIds: next });
    } else {
      if (remaining(id) <= 0) return;
      const next = { ...discards, [id]: (discards[id] || 0) + 1 };
      setDiscards(next);
      setLastDiscardId(id);
      // logging an opponent's discard clears your own "just discarded" marker
      setMyDiscardId(null);
      syncPersist({ discards: next, lastDiscardId: id, myDiscardId: null });
    }
  };

  // Tapping a tile in your hand = discarding it: remove from hand AND drop it
  // into the seen-discards pool automatically (no need to switch zones).
  const discardFromHand = (id) => {
    const idx = handIds.indexOf(id);
    if (idx === -1) return;
    const nextHand = handIds.slice();
    nextHand.splice(idx, 1);
    if (isBonus(id)) {
      // bonus tiles aren't tracked in the discard pool
      setHandIds(nextHand);
      syncPersist({ handIds: nextHand });
      return;
    }
    const nextDiscards = { ...discards, [id]: (discards[id] || 0) + 1 };
    setHandIds(nextHand);
    setDiscards(nextDiscards);
    setMyDiscardId(id);
    syncPersist({ handIds: nextHand, discards: nextDiscards, myDiscardId: id });
  };

  const removeDiscard = (id) => {
    const n = (discards[id] || 0) - 1;
    const next = { ...discards };
    if (n <= 0) delete next[id];
    else next[id] = n;
    setDiscards(next);
    // If we just removed the tile we were treating as "last thrown", drop it.
    const nextLast = id === lastDiscardId ? null : lastDiscardId;
    setLastDiscardId(nextLast);
    syncPersist({ discards: next, lastDiscardId: nextLast });
  };

  const addMeld = (meld) => {
    // ensure copies available
    for (const t of meld.tiles) {
      if (!isBonus(t) && countCopies(t) + meld.tiles.filter((x) => x === t).length > 4) {
        // not enough copies; bail
        return false;
      }
    }
    const next = [...melds, meld];
    setMelds(next);
    syncPersist({ melds: next });
    return true;
  };

  const removeMeld = (i) => {
    const next = melds.slice();
    next.splice(i, 1);
    setMelds(next);
    syncPersist({ melds: next });
  };

  const updateContext = (next) => {
    setContext(next);
    syncPersist({ context: next });
  };

  // --- bulk import (from a photo) -------------------------------------------
  // Adds a batch of recognised tiles in one commit. The accounting is done on
  // local copies rather than through `remaining`, because state updates don't
  // land until after this runs — so a batch containing five 5-circles has to be
  // caught here, not on the next render. Returns what actually landed.
  const importTiles = (ids, target) => {
    let nextHand = [...handIds];
    let nextDiscards = { ...discards };
    let added = 0;
    let skipped = 0;

    const copiesOf = (id) => {
      let n = nextHand.filter((x) => x === id).length;
      for (const m of melds) n += m.tiles.filter((x) => x === id).length;
      return n + (nextDiscards[id] || 0);
    };
    const slotsUsed = () =>
      nextHand.filter((x) => !isBonus(x)).length + melds.length * 3;

    for (const id of ids) {
      // Bonus tiles are only ever modelled as yours, and there is one of each.
      if (isBonus(id)) {
        if (nextHand.includes(id)) skipped++;
        else {
          nextHand.push(id);
          added++;
        }
        continue;
      }
      if (copiesOf(id) >= 4) {
        skipped++;
        continue;
      }
      if (target === 'hand') {
        if (slotsUsed() >= 14) {
          skipped++;
          continue;
        }
        nextHand.push(id);
      } else {
        nextDiscards = { ...nextDiscards, [id]: (nextDiscards[id] || 0) + 1 };
      }
      added++;
    }

    setHandIds(nextHand);
    setDiscards(nextDiscards);
    // Deliberately leaves `lastDiscardId` alone: a whole-table scan has no single
    // "just thrown" tile, and guessing one would produce bogus claim advice.
    syncPersist({ handIds: nextHand, discards: nextDiscards });
    return { added, skipped };
  };

  // --- actions --------------------------------------------------------------
  // The system plays for you: it claims an approved meld and/or auto-discards
  // the recommended tile straight into the pool, then shows what it did.
  const makeMove = () => {
    let newHand = [...handIds];
    let newMelds = [...melds];
    let newDiscards = { ...discards };
    let newLast = lastDiscardId;
    const log = [];
    const played = { thrownId: null, claimed: null };

    const concealedCount = (h) => h.filter((x) => !isBonus(x)).length;
    const inDiscardMode = (h, m) => concealedCount(h) % 3 === 2; // holds 14 -> must discard

    // --- Phase 1: claim an opponent's discard (only when waiting on 13) ------
    if (!inDiscardMode(newHand, newMelds) && newLast) {
      const res = advise({
        handIds: newHand,
        melds: newMelds,
        discards: newDiscards,
        context: { ...context, lastDiscard: newLast },
      });
      const ma = res.meldAdvice;
      if (ma && ma.recommendation === 'claim' && ma.meldTiles) {
        // Tiles the meld needs from our hand = meld tiles minus the claimed copy.
        const fromHand = [...ma.meldTiles];
        const ci = fromHand.indexOf(newLast);
        if (ci !== -1) fromHand.splice(ci, 1);

        const tmp = [...newHand];
        let ok = true;
        for (const t of fromHand) {
          const idx = tmp.indexOf(t);
          if (idx === -1) { ok = false; break; }
          tmp.splice(idx, 1);
        }
        if (ok) {
          newHand = tmp;
          newMelds = [...newMelds, { type: ma.meldType, tiles: ma.meldTiles }];
          played.claimed = { type: ma.meldType, tiles: ma.meldTiles };
          // The claimed tile leaves the discard pile and joins our meld.
          if (newDiscards[newLast]) {
            const n = newDiscards[newLast] - 1;
            if (n <= 0) delete newDiscards[newLast];
            else newDiscards[newLast] = n;
          }
          log.push(`Claimed ${ma.meldType.toUpperCase()} on ${tileName(newLast)}.`);
          newLast = null;
        }
      } else if (ma && ma.recommendation === 'skip') {
        log.push(`Skipped claiming ${tileName(newLast)} — ${ma.reason}`);
      }
    }

    // --- Phase 2: auto-discard when holding 14 ------------------------------
    if (inDiscardMode(newHand, newMelds)) {
      const res2 = advise({
        handIds: newHand,
        melds: newMelds,
        discards: newDiscards,
        context: { ...context, lastDiscard: null },
      });
      const rd = res2.recommendedDiscard;
      if (rd) {
        const idx = newHand.indexOf(rd.id);
        if (idx !== -1) {
          newHand.splice(idx, 1);
          newDiscards = { ...newDiscards, [rd.id]: (newDiscards[rd.id] || 0) + 1 };
          played.thrownId = rd.id;
          log.push(`Discarded ${tileName(rd.id)} — ${rd.reason}`);
        }
      }
    }

    // commit new state
    const newMyDiscard = played.thrownId || myDiscardId;
    setHandIds(newHand);
    setMelds(newMelds);
    setDiscards(newDiscards);
    setLastDiscardId(newLast);
    setMyDiscardId(newMyDiscard);
    persist({
      handIds: newHand,
      melds: newMelds,
      discards: newDiscards,
      context,
      lastDiscardId: newLast,
      myDiscardId: newMyDiscard,
    });

    // After we throw a tile the turn passes to opponents — jump to the Discards
    // box, centre it, and highlight what we just threw.
    if (played.thrownId) {
      setZone('discards');
      requestAnimationFrame(() => {
        discardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    if (log.length === 0) {
      log.push(
        concealedCount(newHand) % 3 === 1
          ? 'Nothing to do yet — draw a tile (add it to your hand) or tap an opponent’s discard, then play again.'
          : 'No move available with the current tiles.',
      );
    }

    const finalAdvice = advise({
      handIds: newHand,
      melds: newMelds,
      discards: newDiscards,
      context: { ...context, lastDiscard: newLast },
    });
    setAdvice({ ...finalAdvice, moveLog: log, played });
    setShowAdvisor(true);
  };

  const resetRound = () => {
    setHandIds([]);
    setMelds([]);
    setDiscards({});
    setLastDiscardId(null);
    setMyDiscardId(null);
    setContext({ ...DEFAULT_CONTEXT, seatWind: context.seatWind, prevalentWind: context.prevalentWind });
    setAdvice(null);
    setShowAdvisor(false);
    persist({ handIds: [], melds: [], discards: {}, context: DEFAULT_CONTEXT, lastDiscardId: null, myDiscardId: null });
  };

  // Toggle whether the last discard came from the left player (chow legality).
  const toggleChow = () => {
    const next = { ...context, canChow: !context.canChow };
    setContext(next);
    syncPersist({ context: next });
  };

  const countWarn =
    handTotalSlots !== 13 && handTotalSlots !== 14 && handTotalSlots > 0;

  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 px-3 pb-36 pt-2 space-y-2 max-w-md w-full mx-auto">
        {/* Hand — tap the box to target it */}
        <HandDisplay
          handIds={handIds}
          melds={melds}
          onRemoveTile={discardFromHand}
          onRemoveMeld={removeMeld}
          active={zone === 'hand'}
          onActivate={() => setZone('hand')}
        />

        <MeldBuilder onAdd={addMeld} remaining={remaining} />

        {/* Snap a photo instead of tapping 14 tiles */}
        <PhotoImport
          onImport={importTiles}
          remaining={remaining}
          apiKey={apiKey}
          onApiKeyChange={updateApiKey}
        />

        {/* Discards — tap the box to target it */}
        <div ref={discardRef} className="scroll-mt-3">
          <DiscardPool
            discards={discards}
            onRemove={removeDiscard}
            active={zone === 'discards'}
            onActivate={() => setZone('discards')}
            lastId={lastDiscardId}
            myDiscardId={myDiscardId}
          />
        </div>

        {countWarn && (
          <div className="text-[11px] text-amber-300 bg-amber-900/20 rounded-md px-2 py-1.5">
            Heads up: you have {handTotalSlots} tiles. A playing hand is normally
            13 (waiting) or 14 (after a draw, ready to discard).
          </div>
        )}

        {/* Tile picker */}
        <div className="rounded-lg bg-jade-dark/40 p-2.5">
          <TilePicker remaining={remaining} onPick={pickTile} zone={zone} />
        </div>

        {/* Inline advice / move result (replaces the old popup) */}
        {advice && <AdvisorSheet advice={advice} />}

        {/* Game context — pinned to the very bottom so it doesn't eat space */}
        <GameContext context={context} onChange={updateContext} />
      </main>

      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-jade-deep/95 backdrop-blur border-t border-white/10 px-3 py-2.5">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            type="button"
            onClick={resetRound}
            className="px-3 rounded-xl bg-jade-mid text-cream/80 text-xs font-semibold"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={toggleChow}
            className={`px-3 rounded-xl text-xs font-semibold flex flex-col items-center justify-center leading-tight ${
              context.canChow
                ? 'bg-gold/80 text-jade-dark'
                : 'bg-jade-mid text-cream/70'
            }`}
          >
            <span>Left player</span>
            <span className="text-[10px]">{context.canChow ? 'YES (chow ok)' : 'NO'}</span>
          </button>
          <button
            type="button"
            onClick={makeMove}
            className="flex-1 rounded-xl bg-gold text-jade-dark font-extrabold py-3 text-base shadow-lg active:scale-[0.99] transition-transform"
          >
            ▶ Make My Move
          </button>
        </div>
      </div>
    </div>
  );
}
