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

Branch: `on-device-scanner` (merge into `main` when done).

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
- [ ] 6. Verify end to end (tests, build, phone-size browser test), merge to `main`

## Where to pick up
Step 6: end-to-end check. Build, serve with `npx vite preview`, open on a phone-size
screen, scan a table photo (hand row + scattered discards), review, add, and confirm the
hand and discard pool fill correctly. Then merge `on-device-scanner` into `main` and push.

Step 5 done: README rewritten for the on-device scanner (with dataset credit),
`netlify.toml` added (same as the calculator's).

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
