# Progress: on-device tile scanner

Keep this file up to date after every step. On another computer:
`git pull`, open this folder in Claude Code, and say **"read PROGRESS.md and continue"**.

## Goal
Replace the Claude-API photo reader (needed a paid Anthropic key) with the free on-device
YOLO tile model from the sister project `Mahjong-Scoring-Calculator`. One photo of the table
fills both your hand and the discard pool.

**Split rule (decided with the user):**
- The **longest row** of touching tiles (5+ tiles) = **my hand**.
- **Everything else** = **discards**: scattered tiles, and other players' short rows of
  revealed sets (they are seen tiles too).
- No row of 5+ → all tiles are discards.

Branch: `on-device-scanner`, merged into `main` on 2026-10-29.

## Steps
- [x] 0. Branch + this file
- [x] 1. Model + runtime: copy `mahjong-tiles.onnx` into `public/models/`, add
      `onnxruntime-web`, remove `@anthropic-ai/sdk`, Vite `optimizeDeps.exclude`
- [x] 2. `src/engine/detect.js`: decode model output, map class names to this app's ids,
      split hand row vs discards (+ `detect.test.mjs`)
- [x] 3. `src/engine/vision.js`: run the model in the browser instead of calling Claude
- [x] 4. `PhotoImport.jsx` / `App.jsx`: no API key; one photo → review with "My hand" and
      "Discards" sections; commit both
- [x] 5. README + `netlify.toml`
- [x] 6. Verify end to end (tests, build, phone-size browser test), merge to `main`

## Where to pick up
**The on-device scanner is done and merged into `main`.** Ideas for next steps:
- Test with real photos of a table (hand row + discards) and note any misreads here.
- If angled discard photos misread a lot, add such photos to the Roboflow dataset,
  retrain in Colab (see the calculator's README), and copy the new `.onnx` into both
  projects' `public/models/`.
- Possibly: detect your own claimed sets in the photo instead of adding them by hand.

## Changes after the scanner (2026-10-29)
- Scan panel moved to the top of the page; the "📷 Scan the table" button shows straight
  away (no show/hide toggle).
- Review screen: drag a tile between "My hand" and "Discards" to fix the side; tap still
  opens Move / Remove. Touch-tested in a phone-size browser.

## Current work: smarter engine (branch `smarter-engine`)
Plan: play for legal 8+ hands from the start, keep backup plans open so it can pivot when
needed tiles die, explanations that match the real decision, measured by `npm run sim`.

- [x] 1. Simulation harness: `scripts/simulate.mjs` (`npm run sim`, options `--games`,
      `--turns`, `--seed`, `--strategy engine|random`). Judges wins with the full scorer.
- [x] 2. Full MCR scorer: `src/engine/mcr/` (copied from the calculator) + `mcr/index.js`
      adapter for tile ids. `scoring.js` `bestScore()` now uses it (same output shape,
      cached). Scores as a win by discard, so Concealed Hand +2 is included.
      While checking it, found and fixed fan-table bugs in the calculator (branch
      `fix-fan-table` there, pushed, not merged yet): Two Concealed Pungs 4→2, Two Concealed
      Kongs 2→8; added All Simples (2), Concealed Kong (2), Two Melded Kongs (4).
      Still missing: Last Tile 和绝张 (needs a UI flag).
- [ ] 3. Goals respect the wall (`idealHand.js`): no goal may need a tile with 0 live copies;
      rank goals by reach likelihood × value.
- [ ] 4. Value-aware discards with backup plans (`discardEval.js`).
- [ ] 5. Explanations built from the actual decision.
- [ ] 6. Speed check (< 1 s per decision), Web Worker if needed.
- [ ] 7. Verify (tests, sim before/after, browser) and merge.

Known bug to fix in step 3 (probe): with both remaining Red Dragons discarded, the advice
said "keeps you aimed at Mixed Straight (1 tile still needed)" and the needed tile was the
dead Red Dragon.

## Engine review (2026-10-29)
How the advisor picks a discard (`discardEval.js`): for each tile, the resulting shanten
(tiles from ready) dominates, then live outs, a bonus for isolated/dead tiles, and only at
one-away does it check the 8-point minimum. Goal hands (`idealHand.js`) are computed but
only used in the explanation text, not in choosing the discard.

Measured:
- Speed: `advise()` median ~45 ms, worst ~280 ms on a laptop (fine; phones maybe 3-5x).
- Solo simulation, 150 games × 18 draws, no claims, no wins off discards, judged by the
  calculator's full scorer: random discards 0% wins / 0% complete; engine **9% legal 8+
  wins, 17% complete shapes, 61% one-away at the end**. About half its completed hands
  were under 8 points, so they can't be declared.
- Its scorer (`scoring.js`) is a simplified subset. On 300 random concealed hands vs the
  calculator's full 81-fan scorer: same 8-point verdict 79% (92% if the Concealed Hand +2
  bonus, which it leaves out on purpose, is ignored); exact same points only 15-19%.
- No defence: it doesn't consider whether a discard could hand an opponent the win.

Suggested next steps (not started):
1. Use the calculator's full scorer (`../Mahjong-Scoring-Calculator/src/engine/scorer.js`
   + `fanRules.js`, `exclusions.js`, `decompose.js`, `tiles.js`; ids differ: `m1` vs `man1`).
2. Make discard choice value-aware: rank discards by progress toward legal 8+ goals,
   not raw shanten.
3. Keep a simulation script in the repo to measure each change (the numbers above).
4. Later: defence (danger rating of each discard from what opponents threw/claimed).

## Results (2026-10-29)
- Engine tests: detect 15, engine 6, scenarios 5, value 2 passing (plus autoplay/scoring).
- Phone-size Chrome test with a rendered table photo (13-tile hand row, 5 scattered
  discards, another player's set of three 2-dots): all 21 tiles read in ~2.7 s, hand and
  discards split correctly, both saved into the app in one tap.
- Known: the test artwork draws the white dragon as a fully blank tile and the model
  missed those; real white dragons (blue frame) were in the training data.

## How to run and check
```bash
npm install
npm run dev                                   # http://localhost:5173
for t in src/engine/*.test.mjs; do node "$t"; done   # engine tests
npm run build
```

## Reference (sister project, same parent folder)
- Model: `../Mahjong-Scoring-Calculator/public/models/mahjong-tiles.onnx` (YOLO11n, 640×640,
  42 classes, trained on the Roboflow dataset by Jon Chan, CC BY 4.0,
  https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s).
- Working browser code to port: `../Mahjong-Scoring-Calculator/src/scan/detect.js` (pure
  decode/NMS) and `src/scan/localScan.js` (onnxruntime-web loading).
- Model class order: `1B 1C 1D 1F 1S 2B … 9D EW GD NW RD SW WD WW`
  (B bamboo, C characters, D dots, F flower, S season).

## Decisions and notes
- Confidence: model score ≥ 0.75 → `high`, else `low` (shown with the gold "check" ring).
- Discard photos are often angled with rotated tiles; the model is weaker there than on
  bird's-eye hands. The review step catches mistakes. More discard-pile training photos
  would help later.
- Code is copied from the calculator rather than shared (separate repos).
