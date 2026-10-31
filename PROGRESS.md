# PROGRESS — Mahjong Engine (MCR Hand Advisor)

**Picking up on another computer:**
```bash
git fetch && git checkout main && git pull   # everything is merged into main (2026-10-31)
npm install
npm run dev            # http://localhost:5173
npm test               # all engine tests (scripts/test.mjs, works on Windows too)
```
Then open this folder in Claude Code and say **"read PROGRESS.md and continue"**.
Keep this file updated (and pushed) after every step.

---

## 1. Where things stand (2026-10-31)

| Repo / branch | State |
|---|---|
| **Mahjong-Engine `main`** | **Everything**: smarter engine + Declare-the-win + live camera (Stage 1+) + Clear buttons + photo resets the hand. `live-camera` was fast-forwarded into `main` on 2026-10-31. Work on `main` (or a new branch off it) from now on. |
| Mahjong-Engine `live-camera`, `smarter-engine` | Old branches, fully contained in `main`. Can be deleted. |
| **Calculator (`../Mahjong-Scoring-Calculator`) `fix-fan-table`** | Real MCR scoring fixes (see §5). Pushed. **Not merged yet** — worth merging, it changes real scores. The engine already uses these fixed files (`src/engine/mcr/`). |
| Calculator `main` | Live app (on-device scanner, home-screen brackets, suit bar, false-win penalties). |

**Next decision for the user:** merge `fix-fan-table` → `main` in the calculator.

**⚠ Important finding (2026-10-31): the engine's strength depends on the computer's speed.**
`findTargets()` stops after 250 ms of *time*, so a slower or busier machine finds fewer plans
and plays worse. Same commit (`2ca47aa`), same 100 deals (seed 2024): **54% wins on the Linux
laptop vs 42% on the other laptop**. So the sim isn't deterministic across machines, and
the "3 routes vs 10" comparison (§4) is partly measuring speed. Fix next: replace the time
limit with a **work limit** (a fixed node count tuned so a phone finishes in ~1 s), then
re-run sim4 on one machine for 10 vs 3 routes. Until then, compare versions on the same
machine with nothing else running.

## 2. User preferences (keep these)
- **Everything free**: no paid APIs/keys. The Claude/Gemini photo readers were replaced by
  the on-device model.
- UI: short and clean. One-line reasons with "Show more"; hide tile pickers until a box is
  tapped; picker opens right under the box; plan cards compact, tap for details.
- MCR strategy views (encoded in the planner): you usually win off others' discards, so
  **don't count on Concealed Hand / fully concealed**; **Chicken Hand is fine** if nothing
  else will score (open hand, win off a discard, no-point wait).
- House rule: false win = pay **10 each** if under 8 fan, **20 each** if not a winning hand
  (calculator).
- Workflow: plan first for big changes, work on a branch, push often, update this file.

---

## 3. How the app works

### Photo scan (on-device AI)
- `public/models/mahjong-tiles.onnx` — YOLO11n tile detector (42 classes, 640×640), trained
  in Google Colab on the Roboflow dataset by Jon Chan (CC BY 4.0,
  https://universe.roboflow.com/jon-chan-gnsoa/mahjong-baq4s). **This is the only trained AI
  in the project**; its learned knowledge is the weights in that file.
- `src/engine/vision.js` loads it with onnxruntime-web (lazy, ~25 MB first time) and runs it.
- `src/engine/detect.js` (pure, tested): decode boxes, class names → ids (`1B→sou1`,
  `1C→man1`, `1D→pin1`, `EW→wind_east`, `RD→dragon_red`, `nF→flower n`, `nS→season n`),
  split one photo: **longest touching row (5+) = my hand, everything else = discards**.
- `src/components/PhotoImport.jsx`: "📷 Scan hand/table" → review (drag between My hand /
  Discards, tap to move/remove) → add both.

### Advice engine (rules + search + probability — NOT machine learning)
It recomputes from scratch on every "Make My Move"; nothing is learned or stored between
games. It's only as good as its rules and assumptions; it improves when the code changes.
- `src/engine/mcr/` — full MCR scorer (81 fans) copied from the calculator; `mcr/index.js`
  converts tile ids. `scoring.js` `bestScore()` wraps it (cached).
- `src/engine/planner.js`:
  - `findTargets()`: one search for complete hands worth 8+ near your tiles, closest first
    (1 tile away, then 2, …), 250 ms budget. Each target is valued **as an open hand**
    (no Concealed Hand); nothing else scoring = Chicken Hand (8). `finish`: 'open',
    'concealed' (needs the bonus), 'selfdraw' (needs a self-drawn last tile) — the latter two
    only count when one tile away.
  - `evaluateHand()`: per hand, drop targets needing a tile with 0 live copies; chance of
    getting the rest: one draw per turn, plus claims — pung's last tile from any of 3
    opponents, chow's last tile only from the left player, pair tiles drawn; winning tile
    from anyone unless self-draw only. Constants: `OPPONENTS = 3`, `DISCARD_RATE = 0.5`.
    Chicken Hand: open only, off a discard, wait must score nothing (exact check one away,
    ×0.5 further out).
  - `planValue()`: chance at least one route comes in; routes counted by the **tiles they
    need** (many Chicken Hand shapes = many routes); overlapping routes add less.
  - `lookAhead()`: for a candidate throw, average over every possible next tile (weighted
    by copies left) of your best reply (win if legal, else best throw).
- `src/engine/discardEval.js`: rates every throw by `planValue`, re-ranks the top 3 with
  `lookAhead`; old tile-efficiency score breaks ties / covers early game. Builds the reason:
  `short` (one line) + `details` (plan, backups, chances, look-ahead).
- `src/engine/claimEval.js` `planClaim()`: claim a pung/chow only if plan value after the
  claim + best throw beats skipping by >1 point.
- `src/engine/advisor.js` `advise()`: wires it together; plan cards come from the same plans.
- Old modules still present: `idealHand.js` (`assemble`, `headlineOf` used),
  `meldEval.js` (no longer used by advise), `targetHands.js` (legacy list).

### UI
`App.jsx` (state, Make My Move), `HandDisplay`, `DiscardPool`, `TilePicker` (groups
Sticks/Numbers/Dots/Symbols; tap → selected box, hold → other box), `AdvisorSheet`
("Move played" card + "Hands I'm building"), `IdealHand` (compact plan card).

### Simulators (a scoreboard, not training)
- `npm run sim` — solo: one player drawing alone (older, mainly for quick checks).
- `npm run sim4` — **4-player**: advisor (seat 0) vs 3 simple opponents (no claims, keep
  closest to complete, win when legal incl. off the advisor's discards); advisor claims via
  `advise()`. Same random deals each run (`--seed`), so versions compare fairly.

---

## 4. Results — 4-player sim (100 games, seed 2024)
| | old (`main`) | claims-aware planner (`d0129ab`) | open-hand values + Chicken (`3ff35cf`) | look-ahead (`2ca47aa`) |
|---|---|---|---|---|
| advisor wins | 19% | 38% | **49%** | 42% other laptop · **54%** Linux laptop (14 self-drawn, 40 off a discard; avg 11.8) |
| advisor's discard let an opponent win | 16% | 11% | 12% | 8% · 8% |
| opponent won otherwise | 47% | 37% | 30% | 32% · 27% |
| draw | 18% | 14% | 9% | 18% · 11% |
| avg / slowest decision | 0.15 s / 2.6 s | 0.5 s / 8.0 s | 0.53 s / 8.7 s | 0.68 s / 3.3 s (159 claims) |

**Look-ahead result (2026-10-29): 42%, down from 49%.** Fewer deal-ins (12%→8%) but many
more draws (9%→18%). This column includes two commits since `3ff35cf`: `f2643df` (route
counting by tiles + closest-first search with a 250 ms budget) and `2ca47aa` (look-ahead).
100 games has about ±5% noise, so the drop is likely real but not certain. Next: run sim4
on `f2643df` alone to see which change caused it (the time budget may cut off good plans),
and/or run 300 games.

**Finding the cause (2026-10-29, 100 games seed 2024 unless noted):** re-ran on this laptop:
`3ff35cf` 49% (same as before, so not the machine); `f2643df` alone 42% (the drop is there,
not the look-ahead); current with no time limit 45% (30 s worst move); current with old
top-3-plan scoring 40%; current with **3 routes instead of 10** 48%.
Bigger check, same 300 new deals (seeds 1–3, run 9 at once so times are a bit high):

| | wins | advisor dealt in | slowest move |
|---|---|---|---|
| `3ff35cf` (no time limit) | **51.3%** | 7.3% | 37 s |
| look-ahead, 10 routes | 43.7% | 10.0% | 4.5 s |
| look-ahead, **3 routes** (now in code) | 47.3% | 9.7% | 4.1 s |

**Applied:** `planValue()` `maxRoutes` 10 → 3. Still ~4 points behind `3ff35cf`, which
searches without a time limit (but can take 30+ s per move). Next to try: raise the
`findTargets()` time limit (250 ms → e.g. 600 ms) or make it a work limit, and check wins
vs slowest move with `npm run sim4 -- --seed 1` (2, 3).

Opponents are simple bots that never claim, so real games are harder; the comparison
between versions is what matters.

---

## 5. Done (history, condensed)
- **2026-10-31:** Clear buttons (bottom right of My Hand and Seen Discards; My Hand's clears
  the claimed sets too). A photo that finds your hand row now **resets** the hand (concealed
  tiles and claimed sets) instead of adding to it; discards are still added. Review button
  reads "Set hand (N), add M to discards"; the 5th-copy check ignores the hand being replaced.
  Merged everything into `main`.
- **On-device scanner** replaced the paid Claude reader (merged to `main`).
- **Engine rewrite** (`smarter-engine`): full MCR scorer; planner with live-tile awareness
  (fixed: plans asking for dead tiles); claims-aware chances; open-hand valuation; Chicken
  Hand rules; planner-based claims; tile-based route counting; closest-first search with
  time budget (worst case 8.7 s → ~0.8 s); one-draw look-ahead.
- **Calculator scorer bugs found & fixed** (`fix-fan-table`, copied into `src/engine/mcr/`):
  Two Concealed Pungs 4→2; Two Concealed Kongs 2→8; added All Simples (2), Concealed Kong
  (2), Two Melded Kongs (4); suited pung values were text so Pung of Terminals / Triple Pung
  never scored; Mixed Straight / Mixed Shifted Chows could count twice. Still missing: Last
  Tile 和绝张 (needs a UI flag).
- **UI**: picker hidden until a box is tapped, opens under it, closes after a move; tile
  groups; "📷 Scan hand/table" at top; Move played card with one-line reasons + Show more;
  compact plan cards (points per pattern, "keep it concealed" / "only if you draw the last
  tile" hints); no nested buttons.

---

## 6. Next up

### A. Live video / camera mode — **Stage 1 done (2026-10-29, branch `live-camera`)**
**User's answers:** phone **held in hand**, **physical tiles** at a table, start with Stage 1.

**Stage 1 (done, not yet phone-tested):** "🎥 Live camera" button under "📷 Scan hand/table"
(only shown if the browser has a camera API). Opens `LiveCamera.jsx`: full-screen back
camera, "◉ Read now" grabs the current frame (`prepareFrame()` in `vision.js`) and sends it
through the same scan → review → add as a photo (`scan()` in `PhotoImport.jsx`). Camera
turns off on Close/after Read now. Needs **https** (Netlify) or localhost — a phone on the
dev server's LAN address (http) will show the "needs the https link" message.
To check on a phone: `npm run build`, drop `dist/` on Netlify, open on the phone, point at
real tiles, Read now, check the review.

**Live boxes (2026-10-30):** while the camera is open the model runs on the video
(one frame at a time, ~150 ms rest) and draws a box per tile: green = sure (≥0.75), gold =
check (0.30–0.75), red dashed = weak guess not read (0.15–0.30); thick = hand row. Labels are
short names + score (e.g. `7竹 83`). Top bar shows counts + ms per frame; "Boxes on/off"
toggle. Code: `detectFrame()` in `vision.js`, overlay in `LiveCamera.jsx`; `decode()` takes
an optional `minScore`. Not yet tested on a phone.

**Why video read worse than photos, and fixes (2026-10-30):** user saw photos read far
better than the live view at the same angle. Cause is mostly picture quality, not the model:
video frames skip the phone's photo processing (multi-frame merge, sharpening, denoise), blur
more, are compressed harder, maybe lower resolution, and 16:9 frames shrink tiles more in the
640 input. Done:
1. Camera asks for up to 3840×2160 and shows what it really sends ("camera W×H" in the top
   bar); continuous focus where supported.
2. Read now takes a real still photo via `ImageCapture.takePhoto()` (Android Chrome); falls
   back to the video frame elsewhere (iPhone Safari). A note under the button says which.
3. Live boxes look at the frame in two overlapping halves (`halfCrops()` in `detect.js`,
   15% overlap each way, merged with `nms()`): ~2× pixels per tile, ~2× time per frame.
   Offline on the user's screenshot: sure 10→11, far-set 南 0.36→0.72, but one die was
   read as 3-Circles (0.45). Photo path (Read now / Scan) still uses the whole image.
Next if still weak: vote across frames; then retrain with frames from real-angle video.

**User test after that (2026-10-30):** camera 2160×3840, ~500 ms per frame. Tiles are now
found, but labels mostly gold/red → reading the faces at this angle is the model's weak spot
(needs training on these angles). Added:
- **Zoom** (pinch, slider, 1×/2×/3×): camera's own zoom where `getCapabilities().zoom`
  exists (Android Chrome), else digital crop of the 4K frame (up to 4×, `zoomRegion()`).
  The model only sees what's on screen.
- **Frame voting** (`src/engine/tracker.js`, tested): boxes matched across frames by overlap,
  guesses added up with older frames fading (×0.75/frame); label = most votes, score = its
  average. Reset on zoom change.
- **Read now** with boxes on = adds exactly what the boxes show (voted, green + gold) → review.
  Boxes off = photo (Android, 1× only) or the current view, scanned as before.
- **Save frame**: downloads the visible area at full resolution as JPEG — for sending test
  frames and building the retraining set.
Next: user sends saved frames → test offline (venv in scratchpad has onnxruntime) → start
the Roboflow retraining set (pre-label with the current model, fix by hand).

**Live advice on the video (2026-10-30):** when the hand row is a full hand (14 tiles,
minus 3 per claimed set; flowers and red/weak boxes don't count) and the same for two
frames, `advise()` runs in a Web Worker (`src/engine/advise.worker.js`, so the video keeps
moving) and the overlay shows: a magenta "✕ THROW" box on that tile, and a top-left card
with the tile, "Throw X" and one line "Going for <plan> · N pts · needs …" — or
"🀄 Declare the win · N pts" for a complete 8+ hand. Uses the app's claimed sets, logged
discards and winds (passed App → PhotoImport → LiveCamera as `game`). A 5th copy of a tile
shows "check the hand" instead of advice. Card stays 2 s if a tile blinks out. Logic in
`src/engine/liveAdvice.js` (tested). Not yet phone-tested. (Also covers PROGRESS B4 for the
camera only; Make My Move still runs advise() on the main thread.)

**First real photo (user's table, steep angle, 2026-10-30):** ran the model on it offline.
Hand row: all 14 tiles found, ~13 read right (one upside-down character tile read as 3萬,
flagged gold). Missed: an angled discard at the far left (not found at all), the flower
tile 菊3 in the middle (weak 0.14 guess, wrong: 5 dots), a 南 on a wall-side set (0.36).
→ Discards/flowers at angles are the weak spot; more such photos in the training set would help.

Original notes (Stage 2+ still to do):
Idea: point the phone at the table and let the app watch, instead of taking photos.
- **How:** browser camera (`getUserMedia`) → run the same tile model on frames ~1–3×/s
  (try onnxruntime-web's WebGPU provider for speed) → keep a **table state** and accept a
  change only when it's stable for ~1 s (ignore hands/blur): new tile in my row = draw;
  tile gone from row + new one in the middle = my discard; new tile in the middle otherwise
  = opponent discard → instant claim/skip/win advice.
- **Hard parts:**
  - Camera placement: own tiles stand facing the player, so a flat phone can't read them;
    likely a stand/gooseneck behind or beside the player, angled over the hand toward the
    middle.
  - Model retraining for that angle: steep views, upright tiles, rotated discards, motion
    blur, fingers. Record video at the real setup → extract frames → label in Roboflow
    (add to the existing project, same class names) → retrain in Colab → replace the .onnx.
  - Who discarded what (position in the middle, turn order, or one-tap confirm).
  - Opponents' melds are at the far edges, small/upside down: log what's clear, tap to add
    the rest (they mostly matter as used-up tiles).
  - Phone heat/battery: scan a few times a second, not 30.
- **Stages:** (1) ~~live viewfinder + "Read now" button reusing the photo pipeline~~ done;
  (2) auto-watch my row and the middle with one-tap confirm (the real project, mostly a
  training-data problem); (3) full table tracking (turn order, who threw what, opponents'
  melds when visible, auto claim/win prompts); throughout: collect frames from real games
  and retrain.
- **Open questions for the user (ask first):**
  1. Where would the phone sit during play (stand behind, propped at the seat, other)?
  2. Physical tiles at a table, or an app/website? (If an app, screen capture is far
     easier than a camera.)

### B. Engine
1. Record the look-ahead sim result (§4).
2. ~~Win on a discard isn't advised~~ **Done (2026-10-29):** `findWin()` in `advisor.js`
   (also `advise().winAdvice`). Make My Move checks it first: if the last discard (holding
   13) or the drawn tile (holding 14, = last tile added, or `context.drawnTile`) makes a
   legal 8+ hand, it changes nothing and shows a "Declare the win 🀄" card with points and
   fans (`WinCard` in `AdvisorSheet.jsx`). Tests: `win.test.mjs`. Not yet browser-tested.
3. Kong claims in `planClaim` (currently pung/chow only).
4. Speed on phones: move `advise()` into a Web Worker, show "Thinking…".
5. Defence: danger rating per discard, weighed against plan value.
6. Auto-tune constants (`DISCARD_RATE`, Chicken ×0.5, claim margin, route overlap 0.8, plan
   weights) by running `sim4` over combinations and keeping the best — first step toward
   the engine "learning". Bigger later: self-play neural network built on `sim4`.

### C. Housekeeping
- Merge `smarter-engine` → `main`; calculator `fix-fan-table` → `main`.
- Add Last Tile 和绝张 to the calculator (needs a UI flag), copy scorer files into
  `src/engine/mcr/`.
- Old modules (`meldEval.js`, `targetHands.js`) could be removed once nothing needs them.

---

## Reference
- Model class order: `1B 1C 1D 1F 1S 2B … 9D EW GD NW RD SW WD WW`
  (B bamboo, C characters, D dots, F flower, S season).
- Retraining recipe (Colab, free T4 GPU): `pip install ultralytics roboflow` → Roboflow
  download snippet (YOLOv11 format; keep the API key private) →
  `YOLO('yolo11n.pt').train(data=..., epochs=60, imgsz=640, batch=32, fliplr=0.0, patience=15)`
  (**fliplr=0**: mirrored characters aren't real tiles) → `best.export(format='onnx', imgsz=640, simplify=True)`
  → copy `best.onnx` to `public/models/mahjong-tiles.onnx` in both projects. If classes change,
  update `MODEL_CLASSES` in `detect.js` (both projects).
- Confidence: score ≥ 0.75 → `high`, else `low` (gold "check" ring).
- Code is copied between the two repos (calculator ↔ engine), not shared.
