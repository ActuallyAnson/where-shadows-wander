# Getting started

How to run Where Shadows Wander on your laptop, test it without a headset, and try it on a Pico or Quest. For why things are built this way, see the [ADRs](adr/) and the [GDD](GDD.md).

## 1. What you need

- **Node.js** 22.12 or newer 22.x (the repo's `.nvmrc` says `22.12.0`). Node 20.19+ and 24+ also work.
- **Google Chrome** on your laptop.
- **Git**, and access to the GitHub repo.
- Optional: a **webcam** (for hand shapes), a **Pico or Quest** headset on the same Wi-Fi as your laptop.

## 2. First-time setup

```sh
git clone https://github.com/ActuallyAnson/where-shadows-wander.git
cd where-shadows-wander
nvm use            # if you use nvm; picks Node from .nvmrc
npm ci             # installs the exact versions in package-lock.json
npm run check      # should end with all tests passing
```

Use `npm ci`, not `npm install`, so you get exactly the pinned versions. IWSDK and three.js are pinned on purpose (see [ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md)).

## 3. Start the dev server

```sh
npm run dev
```

You'll see something like:

```
➜  Local:   https://localhost:8081/
➜  Network: https://192.168.1.95:8081/
[IWSDK] Runtime ready at https://localhost:8081/
```

- **Local** is for your laptop. **Network** is your laptop's Wi-Fi address, for a headset.
- A separate Chromium window may open. That's IWSDK's managed browser, used by the scripted tests in section 8. You can ignore it.
- Lines saying `Sourcemap ... points to missing source files` are harmless.
- Stop with **Ctrl+C**. If port 8081 stays busy afterwards, run `npm run dev:down`.

## 4. Try it in the emulator (no headset)

The dev server adds IWER, an emulated Quest 3 with hands, sitting in a fake living room.

1. Open **https://localhost:8081/** in your own Chrome, not the managed window.
2. Chrome warns "Your connection is not private". The dev server uses a self-signed certificate. Click **Advanced**, then **Proceed to localhost**.
3. Click **Enter XR**. The fake room appears behind the app, standing in for passthrough.
4. In the emulator toolbar, open the input menu and choose **Hands**. Dots appear on each finger joint, orange for the right hand and blue for the left.
5. Use the hand panels to try pose presets, the pinch slider, and the move/rotate handles.
6. Exit XR, then press **Copy report** (bottom left) to see what the app measured: hands, planes, anchors, frame rate.

The emulator's hands are perfect and synthetic. It's for checking that code works, not how tracking feels.

## 5. Test hands without a headset: the Hand Lab

The Hand Lab is mock mode (`?mock=1`): the game runs in a normal browser with hands from a mock source instead of a headset.

1. With `npm run dev` running, open **https://localhost:8081/?mock=1** in a normal Chrome tab, or press **Open Hand Lab** (top left) on the game page. Don't use the window `npm run dev` opens by itself: it drops `?mock=1` when the page reloads, and its downloads don't reach your Downloads folder (recordings don't need them: see below).
2. Pick a **Source** in the panel on the right:
   - **Synthetic:** choose **Left** or **Right**, then click a shape (or press 0–6). **Hide** takes a hand away (as if tracking were lost) and **Jitter** adds a few millimetres of tracking noise. Keys: R/L pick a hand, arrows move it (Shift for depth), Q/E roll, Z/X turn, T/Y tilt the fingers up or down, Space pauses. Lantern gestures: P pinches (press again to let go: the log shows a pinch-release where the fingertips met), G moves the hand over the stand-in lantern (then 2 for a fist covers the flame), B brings it back. The **Lantern gestures** box logs each gesture.
   - **Script:** every shape on the right hand, then the left, in a loop.
   - **Replay…:** pick a `.handrec.json`, or drag one onto the page.
   - **Webcam:** your own hands. Allow camera access; the first start downloads the hand model (about 8 MB). The status line shows the tracking rate and MediaPipe's time per frame, which runs in the background and doesn't slow the page.
3. Drag to look around the hands, scroll to zoom. The cards show each hand's palm direction, thumb–index gap, finger spread and finger curl. The big label is the shape the hand is posed as (Synthetic and Script); the rough guess under it only knows flat, fist and open until the classifier lands.
4. **● Record**, then **Stop and download**, saves a `.handrec.json` into the repo's `recordings/` folder through the dev server (the message under Source says where). On a built page without the dev server it downloads to your Downloads folder instead.
5. **Calibration:** with real hands, press **Calibrate right** (or left) and hold that hand flat, fingers straight and together, for 2 seconds. Curl is then measured from your own straight, which removes the webcam's offset (it reads straight fingers as somewhat bent). It's remembered in this browser; **Clear** removes it. The **Shape guide** shows a picture of each shape and how to make it.
6. **Guided recording** prompts you through every shape, right hand then left (84 s: each shape held 4.5 s with 2 s rests, with a picture of each), and saves a recording with **shape labels**: which shape each hand was asked to make, and when. Those are what the classifier is scored against (#12). Use it with the **Webcam** source. With **Script** it gives a labelled synthetic recording. Press **Stop guided** to end early; you keep the labels for the prompts you finished.

The Hand Lab also shows the hands' **shadows** on a stand-in paper screen (the tabletop theatre) with the lantern on the near table edge. Shadow puppets are made with the hand turned toward the screen: tilt a synthetic hand with T/Y. Add `&stage=wall` for a wall-sized screen further away, and `&debug=shadow` to draw the collision capsules (red), outline (green) and each joint projected separately (blue dots, which sit on the red lines' ends at the normal shadow size). The same options work in XR, where the screen is placed in front of you when the session starts.

You can also choose the source in the address: `?mock=1&src=script`, `?mock=1&src=webcam`, or `?mock=1&src=replay&file=recordings/emulator-demo.handrec.json`. Adding `&record=10` records ten seconds the same way a headset does.

**Webcam bench.** https://localhost:8081/webcam.html is the older single-purpose page: it shows the camera image with the tracked landmarks drawn over it, and the same feature cards.

Video stays in your browser. Webcam depth is approximate and the camera sees your hands from the front, so use the webcam for shapes, not tracking quality. Details: [ADR 0004](adr/0004-webcam-bench-and-hand-recordings.md).

## 6. Try it on a headset

We develop on a Pico and confirm on a Quest ([ADR 0003](adr/0003-pico-as-stand-in-test-device.md)).

**Over your Wi-Fi (fastest):**

1. Put the laptop and headset on the same Wi-Fi, and run `npm run dev`.
2. In the headset browser, open the **Network** address from section 3, e.g. `https://192.168.1.95:8081/`.
3. Accept the certificate warning (usually **Advanced**, then **Proceed**; the wording varies by browser).
4. Make sure the headset's room or space setup is done.
5. Press **Enter XR**, allow hand tracking and spatial data, and put the controllers down.
6. Look around for about 30 seconds and move your hands in front of you. Dots should follow your fingers (orange right, blue left).
7. Exit XR and press **Copy report**. Paste it into the team chat or an issue.

**From the hosted build:** once GitHub Pages is set up (section 11), use that HTTPS link instead. There's no certificate warning, and it works away from your Wi-Fi.

**To record hand data on a headset,** add `?record=20` to the address, for example `https://192.168.1.95:8081/?record=20&note=fist then flat hand`. Recording starts when a hand is first tracked and lasts 20 seconds. After you exit XR the page sends the file to the dev server, which saves it into `recordings/` on the computer running `npm run dev` (the button at the bottom right says where). If the page was not served by a dev server (a built page), press **Download recording** instead.

**To record labelled hand shapes on a headset,** use `?record&script=shapes`, for example `https://192.168.1.95:8081/?record&script=shapes`. A panel in front of you says "Raise your hands to start", then prompts each shape with a countdown, right hand then left. It takes 84 seconds and the file carries shape labels. Follow the prompts as closely as you can: the labels say what you were asked to do, not what your hand did.

## 7. View a recording

Open a `.handrec.json` in the Hand Recording Player (ask the project owner for the link; it's a private page they share). The player doesn't show shape labels yet, and may not open version 2 files (with labels) until it's updated. It replays the hands in 3D, with the classifier's features plotted over time. Gaps in the traces mean a hand wasn't fully tracked.

To watch one with the game's own code, open the Hand Lab (section 5), press **Replay…** and pick the file, or drag it onto the page. It loops, and the cards show the features frame by frame.

Keep recordings in `recordings/`. That folder is gitignored, so recordings don't bloat the repo.

## 8. Scripted emulator tests

With `npm run dev` running, you can drive the emulator from a second terminal:

```sh
npx iwsdk xr enter
npx iwsdk xr set-input-mode --input-json '{"mode":"hand"}'
npx iwsdk xr animate-to --input-json '{"device":"hand-right","position":{"x":0.1,"y":1.35,"z":-0.35},"duration":1.5}'
npx iwsdk xr animate-to --input-json '{"device":"hand-right","orientation":{"roll":-170},"duration":1}'
npx iwsdk xr set-select-value --input-json '{"device":"hand-right","value":1}'   # pinch
npx iwsdk xr set-connected --input-json '{"device":"hand-left","connected":false}' # lose a hand
npx iwsdk browser run scripts/read-report.mjs    # what the app measured
npx iwsdk browser run scripts/census.mjs         # what is drawn
npx iwsdk browser screenshot
```

`npx iwsdk xr --help` lists every command.

The report's `capabilities` section says what the session provides: hand tracking (and each hand's `tracked` and `lostCount`), passthrough, plane and mesh detection (`unsupported`, `none-yet` or `found`, with a count), anchors, and the persistent-anchor API, plus `planeList` with each detected plane's label, centre and normal. In the emulator expect everything available, 17 planes and 9 meshes, and persistent anchors `no` (the emulator's anchors can't request a persistent handle). After `set-connected ... false`, that hand shows `tracked: false` and its `lostCount` goes up. `basis` says how support was decided: `enabledFeatures` when the browser reports the granted features, `api` when only the API's presence was checked.

## 9. Score the classifier on recordings

Labelled recordings (section 5's **Guided recording**, or `?record&script=shapes` on a headset) can be scored against the shape classifier:

1. Put the `.handrec.json` files in `recordings/` (any subfolder). They stay on your machine; the folder is gitignored.
2. Run `npm run eval`. It prints, per source (webcam, Pico, Quest, emulator, synthetic): frame accuracy, hits (prompted shapes that committed), false triggers per minute, flicker and time to commit, then a table per shape, a confusion matrix and the worst labels. A JSON report goes to `eval-reports/`.
3. To compare with an earlier run: `EVAL_BASELINE=eval-reports/<file>.json npm run eval`. Add `EVAL_CALIBRATE=1` to calibrate each hand from its first flat prompt, as a player would before playing.
4. When a recording shows a bug, cut the bad moment into a regression fixture: `EVAL_EXTRACT=recordings/<file>:<hand>:<start>-<end>:<name> npm run eval` writes `src/engine/hands/fixtures/<name>.handrec.json`; add it to `src/engine/hands/fixtures/manifest.ts` with the result it should give once fixed. `npm test` then replays it.

Only time inside a label is scored; a label is what the person was asked to do, so replay low-scoring recordings in the Hand Lab to see whether the person or the classifier was wrong.

## 10. Before you commit

```sh
npm run format  # format code with Prettier (run this first)
npm run check   # typecheck, lint, format check, single three.js, unit tests
npm run build   # production build into dist/
```

`npm run check` fails if:
- ESLint finds a problem, including code in `src/engine/hands`, `src/engine/sim`, `src/engine/stage` or `src/game` importing IWSDK, three.js or an engine-facing folder, or using browser globals (pure code stays engine-free, see [ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md));
- a file isn't formatted with Prettier (`npm run format` fixes it);
- a second copy of three.js gets installed;
- a test fails.

Commit messages use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).

To check a production build the way GitHub Pages serves it: `node scripts/serve-pages.mjs dist 4173`, then open http://localhost:4173/where-shadows-wander/.

## 11. Deploying

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`), after `npm run check` passes. One-time setup by the repo owner: **Settings → Pages → Source: GitHub Actions**. The site is at https://actuallyanson.github.io/where-shadows-wander/ (and the webcam bench at `.../webcam.html`). The published site is public even though the repo is private.

## 12. Edit the room and puzzle layouts

The room (`public/scenes/main.iwsdk.scene.json`) and the puzzle layouts (`public/scenes/chapter-1.iwsdk.scene.json`) are IWSDK scene files, edited in IWSDK's scene editor ([ADR 0006](adr/0006-editor-authored-layouts.md)). With `npm run dev` running, the editor is in the browser window IWSDK manages (it opens the scene from the editor's own file list). From a terminal: `npx iwsdk scene open --input-json '{"path":"public/scenes/chapter-1.iwsdk.scene.json"}'`, and `npx iwsdk scene state` shows the open file and any problems.

Everything the game needs is set with the inspector's own fields, so you never edit the file by hand:

| In the editor | What it means to the game |
|---|---|
| **Asset** `piece-rock`, `piece-crow`, `piece-fox`, `piece-traveller`, `piece-rabbit`, `piece-raindrop`, `piece-firefly` | An entity of that kind. Change the kind by choosing another asset |
| **Asset** `marker-gap`, `marker-goal`, `marker-plate` | A named spot for the puzzle code |
| **Position** x, y (metres) | Where it is on the stage; z is ignored (the stage is the x and y plane, like a wall, so dragging on the floor of the 3D view moves z, which does nothing) |
| **Scale** | A piece's radius (scale 0.08 is a radius of 0.08 m; the ball you see is the size the game uses). A marker's width and height are its scale x and y |
| **Add Component, `Piece`** (optional) | Starting speed `vx`, `vy` and the flags `isStatic`, `isSensor`, `hidden` |
| **Visible** off | The node, and everything under it, is left out |

Put each puzzle in its own group (`puzzle-1`) so the puzzle code can load one with `parseLayout(doc, 'puzzle-1')` and `spawnLayout` (nothing calls them yet; Teammate A's puzzle code will). The editor's scene-graph hide is preview-only and is not saved; use the inspector's **Visible** toggle to leave a node out. Groups can nest and their positions add up; rotation and scale on a parent are ignored and reported. `npm test` checks every scene file against IWSDK's validator and our loader.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Your connection is not private" | Expected with the dev server. Click **Advanced → Proceed**. |
| Port 8081 already in use | `npm run dev:down`, then `npm run dev` again. |
| No **Enter XR** button in desktop Chrome | Use the dev server (`npm run dev`), which adds the emulator. The hosted build only offers XR on a headset. |
| No hand dots in the emulator | Switch the emulator's input to **Hands**. |
| No hand dots on a headset | Turn on hand tracking in the headset settings, and put the controllers down. |
| Headset can't open the Network address | Same Wi-Fi? Some networks block devices from reaching each other. Use the hosted build instead. |
| Webcam (Hand Lab or bench) says "Couldn't start" | Allow camera access for localhost in Chrome, and close other apps that use the camera. |
| No way into VR on the Pico (a blank page, no Enter button) | The Pico browser (Chrome 105) can't show the browser's own enter prompt, which is all IWSDK relies on. The page always adds its own **Enter VR** buttons (and **Enter AR** when the browser supports it) at the bottom centre, so use those. If you don't see them, update to the latest `main`. |
| On the Pico, hands show as a pointer and a click but no joint dots ("hands as controllers"), or **Enter** does nothing | The Pico's own browser and the Pico Store's Wolvic do not give a page the 25 hand joints. What works (ADR 0003, update 2): the sideloaded **Wolvic Chromium 1.4** build (`Wolvic-picoxr-arm64-chromium-generic-release.apk`), a **VR** session (the launcher's **Enter VR** button), controllers off. Wolvic Chromium shows a blank page for a self-signed `https://192.168...` address (no certificate warning screen), so open the game through a trusted address: the GitHub Pages link, or a tunnel to the dev server (a public address: do not leave it running). The launcher's log box and buttons show what the browser said. |
| Webcam stuck on "Loading hand model" or "Starting the camera" | The model downloads from Google on first start. Check your internet connection. |
| Page stays white; the console says "WebGL context could not be created" | Chrome has turned WebGL off, usually after its graphics process crashed. Quit Chrome fully (Cmd+Q) and reopen it. If that doesn't help, turn on **Use graphics acceleration when available** in `chrome://settings/system`; `chrome://gpu` should show WebGL as hardware accelerated. |
| Hand Lab opens as the plain game | The address lost `?mock=1` (the window `npm run dev` opens drops it on reload). Use a normal Chrome tab. |
| Hand Lab recording isn't in `recordings/` | The dev server must be running (`npm run dev`) with the new vite.config.ts: restart it once after pulling. Without it the page falls back to a browser download. |
| `npm run check` fails on "single three" | Something added another three.js. Run `npm ls three` to find it; never install a second copy. |
| Copy report doesn't copy | Press **Show**, then select all the text and copy it by hand. |

## 15. Saves

Progress, the creature gallery and the solutions found per puzzle are saved in the browser ([ADR 0010](adr/0010-saves.md), `src/engine/services/saves`). The save is read once at start and written only on events: the headset coming off or the system menu opening, the VR session ending, the page being hidden or closed, and a puzzle ending. Nothing runs per frame.

- **Use it:** `saves.puzzleEnded('c1-p2', { solved: true, solutionId: 'cup', next: { chapter: 1, puzzle: 3 } })` when a puzzle ends, `saves.discoverCreature('rabbit')` for the gallery, `saves.data.progress` to resume. Read `saves.data` each time rather than keeping a piece of it. `saves.touchDay()` ran at start; `saves.previousDay` is the last night played (compare with today for a new night). In the dev console it is `__wsw.saves`.
- **Look at it:** `localStorage` keys `wsw.save.a` and `wsw.save.b` (the higher `seq` is the newest), `wsw.save.corrupt.<a|b>.<0-2>` if a slot was damaged, `wsw.save.newer.<a|b>` if a save from a newer version was moved aside. The Hand Lab (`?mock=1`) uses `wsw.save.mock.*` instead. `__wsw.saves.status` says whether it is being stored, whether it recovered from damage, and the last problem; the diagnostics report has the same under `saves`.
- **Change the format:** raise `CURRENT_VERSION` in `schema.ts`, add the step to `migrations.ts` (it must never throw), a reader in `SANITIZERS`, a frozen `fixtures/save-v<new>.json`, and update the `save-v<N>.expected.json` files. A test fails if you forget any of them.
- **Start over** in the browser: `__wsw.saves.reset()` (it overwrites both slots; a save from a newer version is moved aside first), or delete the `wsw.save.*` keys.
- **Check it in a browser:** `npx vite --port 8097 --strictPort`, then `node scripts/saves-probe.mjs https://localhost:8097`.
