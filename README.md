# MCR Hand Advisor 🀄

A real-time **Chinese Official Mahjong (MCR)** hand advisor — a phone-first,
fully client-side web app. Enter your hand, the tiles you've seen discarded, and
the game context, and it tells you what to discard, what hands to aim for,
whether to claim a meld, and which tiles are still live.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build & deploy

`dist/` is build output and isn't committed.

- **Netlify from GitHub (recommended):** connect the repo in Netlify. `netlify.toml`
  runs `npm run build` and publishes `dist/`, so every push to `main` redeploys.
- **Netlify Drop:** run `npm run build` and drag `dist/` onto
  [app.netlify.com/drop](https://app.netlify.com/drop).

## Fill from a photo 📷

Open **📷 Fill from a photo → Scan the table** and take (or pick) one photo of the
table. A small tile-detection model runs **on your phone** (onnxruntime-web, model in
`public/models/mahjong-tiles.onnx`): free, no API key, no server, works offline once
loaded. The first scan downloads ~25 MB; the browser caches it after that.

- **The longest row of touching tiles (5+) is your hand.** Line your tiles up in one row.
- **Every other face-up tile is a discard**: scattered tiles and other players' short
  rows of revealed sets (all seen tiles).
- You review both groups before anything is added: tap a tile to **move** it to the
  other group or **remove** it. Uncertain tiles are gold-ringed `check`; anything that
  would be a 5th copy is struck through and never imported.
- Your own claimed sets go in with **“+ add a claimed meld”** as before.
- Best results: shoot from above, good light, tiles filling the frame. Angled photos of
  discard piles are the hardest case.

Code: `src/engine/detect.js` (pure: decode, class map, hand/discard split; tested by
`detect.test.mjs`) and `src/engine/vision.js` (loads and runs the model).

Model: YOLO11n trained in the sister project *Mahjong-Scoring-Calculator* on the
[Mahjong dataset by Jon Chan](https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s)
(Roboflow Universe, CC BY 4.0). To update it, copy a new `mahjong-tiles.onnx` into
`public/models/`; if the class list changes, update `MODEL_CLASSES` in `detect.js`.

## How to use

1. **Pick the active zone** (Hand 手牌 / Discards 牌河) at the top.
2. Tap tiles in the picker — they go to the active zone. Tap a tile already in
   your hand or the discard pile to remove it.
3. Add any exposed melds with **“+ add a claimed meld”**.
4. Set your **seat / prevalent wind**. To check a claim, set **Last player
   discard** and tick the left-player box if a chow would be legal.
5. Tap **🀄 Advise Me**.

## Engine

Pure, side-effect-free functions in `src/engine/`:

- `shanten.js` — exact shanten for standard hands, seven pairs, thirteen
  orphans; approximate knitted variants for target hints.
- `usefulTiles.js` / `discardEval.js` — outs and discard ranking + reasoning.
- `meldEval.js` — chow/pung/kong claim evaluation.
- `targetHands.js` — MCR archetype ranker (Full Flush, All Pungs, Seven Pairs,
  Upper/Middle/Lower Tiles, etc.).
- `advisor.js` — orchestrator returning the advice object the UI renders.

Sanity tests:

```bash
for t in src/engine/*.test.mjs; do node "$t"; done
```
