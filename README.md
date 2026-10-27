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

```bash
npm run build
```

Then drag the generated **`dist/`** folder onto
[netlify.com/drop](https://app.netlify.com/drop) — no account needed — and you'll
get a permanent shareable link in about 10 seconds.

## Fill from a photo 📷

Instead of tapping in fourteen tiles, open **📷 Fill from a photo** and shoot
either your hand or the table — the picker offers your camera *and* your camera
roll. Claude reads the tiles, then shows you what it found so you can drop
anything it got wrong before it reaches the engine.

- **🀫 My hand** — one row of your tiles, faces toward the camera.
- **🀄 The table** — the discards face-up in the middle. Repeats are counted.

Notes:

- This needs **your own Anthropic API key** (the one feature that isn't offline).
  Paste it once; it's kept in `localStorage` under `mcr-advisor-api-key`, never
  bundled, and sent only to `api.anthropic.com`. **Anyone with access to the
  browser or devtools can read it** — use a key you're happy to rotate, and don't
  ship a build with a key entered.
- Recognition is good but not perfect. Uncertain tiles come back gold-ringed and
  labelled `check`; anything that would be a 5th copy of a type is struck through
  and never imported. The review step is mandatory by design — one misread tile
  changes every discard recommendation.
- Fill the frame with just the tiles and shoot square-on. Photos are downscaled to
  1568px before upload.

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
node src/engine/engine.test.mjs
node src/engine/scenarios.test.mjs
```
