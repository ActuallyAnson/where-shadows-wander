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

The Hand Lab is mock mode: the game runs in a normal browser with hands from a mock source instead of a headset. There is no address for it: the page is always `https://localhost:8081/`, and the mode is kept in the browser tab (`src/app/launch-mode.ts`), so a reload stays in the lab and a new tab opens the game.

1. With `npm run dev` running, open **https://localhost:8081/** in a normal Chrome tab, press **Developer** under the title screen, then **Hand Lab**. **Back to the game** at the top of the lab returns to the title screen. (Without a headset the plain build offers the lab too: **Try the Hand Lab** on the page it shows instead of the title.) Avoid the window `npm run dev` opens by itself: its downloads don't reach your Downloads folder (recordings don't need them: see below).
2. Pick a **Source** in the panel on the right:
   - **Synthetic:** choose **Left** or **Right**, then click a shape (or press 0–6). **Hide** takes a hand away (as if tracking were lost) and **Jitter** adds a few millimetres of tracking noise. Keys: R/L pick a hand, arrows move it (Shift for depth), Q/E roll, Z/X turn, T/Y tilt the fingers up or down, Space pauses. Lantern gestures: P pinches (press again to let go: the log shows a pinch-release where the fingertips met), G moves the hand over the stand-in lantern (then 2 for a fist covers the flame), B brings it back. The **Lantern gestures** box logs each gesture.
   - **Script:** every shape on the right hand, then the left, in a loop.
   - **Replay…:** pick a `.handrec.json`, or drag one onto the page.
   - **Webcam:** your own hands. Allow camera access; the first start downloads the hand model (about 8 MB). The status line shows the tracking rate and MediaPipe's time per frame, which runs in the background and doesn't slow the page.
3. Drag to look around the hands, scroll to zoom. The cards show each hand's palm direction, thumb–index gap, finger spread and finger curl. The big label is the shape the hand is posed as (Synthetic and Script); the rough guess under it only knows flat, fist and open until the classifier lands.
4. **● Record**, then **Stop and download**, saves a `.handrec.json` into the repo's `recordings/` folder through the dev server (the message under Source says where). On a built page without the dev server it downloads to your Downloads folder instead.
5. **Calibration:** with real hands, press **Calibrate right** (or left) and hold that hand flat, fingers straight and together, for 2 seconds. Curl is then measured from your own straight, which removes the webcam's offset (it reads straight fingers as somewhat bent). It's remembered in this browser; **Clear** removes it. The **Shape guide** shows a picture of each shape and how to make it.
6. **Guided recording** prompts you through every shape, right hand then left (84 s: each shape held 4.5 s with 2 s rests, with a picture of each), and saves a recording with **shape labels**: which shape each hand was asked to make, and when. Those are what the classifier is scored against (#12). Use it with the **Webcam** source. With **Script** it gives a labelled synthetic recording. Press **Stop guided** to end early; you keep the labels for the prompts you finished.

The Hand Lab is the same game as in a headset: the same room, the same paper wall (`StageFrame`: 2 m ahead, 1.6 × 1.0 m, 0.2 m below the eyes; a puppet hand's shadow is about 15 × 35 cm on it) and the same candle on the bed tray. Only the hands and the head differ: the head is the desktop camera at (0, 1, 0.5), and the mock hands rest 20 cm in front of the candle. Shadow puppets are made with the hand turned toward the wall: tilt a synthetic hand with T/Y. **G** puts the selected hand over the candle (for the cover-flame pause). Turn on **Shadow capsules** in the Developer panel (or Alt+K) to draw the shadow capsules (red), outline (green) and each joint projected separately (blue dots, which sit on the red lines' ends at the normal shadow size). In a headset the wall is placed in front of you when the session starts.

The lab remembers the source you picked for the next reload in the same tab (Replay comes back as the emulator demo; drop your file again).

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

**The Developer button (no address to type; dev server and tester builds only, section 17).** Under the title screen is a **Developer** button. It opens one panel with:

- **Modes:** **Hand Lab** and **Room editor** (section 13). A press reloads the page into that mode; the address stays plain.
- **Testing switches:** joint dots, shadow capsules, open the settings panel when VR starts, record your hands (20 s of free hands, or the guided shapes), a menu screen to look at (off or pause), the lantern's flicker (the setting, steady, 0.5 or 1; reloads) and capture mode (reloads). Each press applies at once and is remembered in the browser; the settings panel and the recording begin when you press BEGIN. **Clear all switches** turns everything off.
- **Logs:** the launch log, and **Copy logs**.

The game takes no address options at all: everything is in this panel. `node scripts/testing-probe.mjs <url>` checks it in a browser; the other probe scripts set the mode before the page loads with `scripts/lib/launch.mjs`.

**Capture mode, for recording the demo video (works in the judges' build too).** On the title screen, tap the emblem (the little flame above the title) five times quickly: the page steps capture mode through off, clean and sharp and reloads, and a note under the menu says which is on. In the tester build the Developer panel has the same switch. Capture mode keeps the "Show me your hands" panel out of the picture (it would appear whenever tracking drops mid-take) and turns the headset's foveated rendering off (a recording shows its blurry edges). Sharp also renders the eyes at 1.5 times the resolution; that costs frame time, so check it holds the headset's rate before a take. The settings are in the session report (`capture`). Record with the headset's own recorder; this has not been tried on a Pico or a Quest yet, so do a short test take and look at the file before the real one. It is for taking video, not for playing.

**From the hosted build:** once GitHub Pages is set up (section 11), use that HTTPS link instead. There's no certificate warning, and it works away from your Wi-Fi.

**To record hand data on a headset,** press **Developer**, set **Recording hands when VR starts** to 20 s of free hands, then press BEGIN. Recording starts when a hand is first tracked and lasts 20 seconds. After you exit XR the page sends the file to the dev server, which saves it into `recordings/` on the computer running `npm run dev` (the button at the bottom right says where). If the page was not served by a dev server (a built page), press **Download recording** instead.

**To record labelled hand shapes on a headset,** set **Recording hands when VR starts** to guided shapes, then press BEGIN. A panel in front of you says "Raise your hands to start", then prompts each shape with a countdown, right hand then left. It takes 84 seconds and the file carries shape labels. Follow the prompts as closely as you can: the labels say what you were asked to do, not what your hand did.

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

Labelled recordings (section 5's **Guided recording**, or the Developer panel's guided shapes recording on a headset) can be scored against the shape classifier:

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
- ESLint finds a problem, including code in `src/engine/hands`, `src/engine/stage` or `src/engine/shadow/pure` importing IWSDK, three.js or an engine-facing folder, or using browser globals (pure code stays engine-free, see [ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md));
- a file isn't formatted with Prettier (`npm run format` fixes it);
- a second copy of three.js gets installed;
- a test fails.

Commit messages use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).

To check a production build the way GitHub Pages serves it: `node scripts/serve-pages.mjs dist 4173`, then open http://localhost:4173/where-shadows-wander/.

## 11. Deploying

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`), after `npm run check` passes. One-time setup by the repo owner: **Settings → Pages → Source: GitHub Actions**. The site is at https://actuallyanson.github.io/where-shadows-wander/ (and the webcam bench at `.../webcam.html`). The published site is public even though the repo is private.

## 12. Edit the room layout

### The bedroom: the room editor

Where the bedroom's static pieces stand is in `content/rooms/bedroom.json` ([ADR 0015](adr/0015-room-layout-file-and-editor.md)). Arrange them in the running game:

1. `npm run dev`, open `https://localhost:8081/`, press **Developer**, then **Room editor**. Closing the editor leaves the Hand Lab.
2. Click a piece, or pick it in the right panel's **Scene** tab (Room and Lap, grouped by Furniture, Dressing, Room, Tray and Added). In the **Inspector** tab, drag the gizmo or type exact numbers into Position (metres), Rotation (degrees) and Scale. Drag the panel's left edge to widen it (double-click the edge for the default width; the width is remembered).
3. To add a model, use the **Assets** panel along the bottom (below).
4. **Save room layout** (or Ctrl+S) writes the file. Commit it like any other change, with any model files you imported or exported. Saving doesn't reload the page; the next reload reads the saved file.

| Key or button | Does |
|---|---|
| W / E / R | Move, rotate, scale |
| Q | The gizmo's axes: the piece's own (Local) or the room's (World) |
| Hold Shift while dragging | Snap: 1 cm, 5°, 0.05 of scale |
| Esc | Deselect |
| Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z) | Undo, redo |
| Revert / Reset | Back to where the file has it / to the code's default |
| Ctrl+D or Duplicate, Delete or Remove | Copy or take out an added model (built-in pieces can't be copied or removed). Undoable |
| Export .glb | Writes the selected built-in piece to `src/assets/models/exported/<id>.glb` |
| Eye, Overview, Left, Right | View presets (drag empty space to orbit, scroll to zoom). Eye is at the player's eyes |
| Hold the right mouse button | Fly: the mouse turns the view, W/A/S/D move, Q/E go down/up, Shift is 3 times faster |
| Arrow keys | Move the view level with the floor, any time (W/E/R/Q pick the gizmo's mode unless you are flying) |
| Ctrl or Shift + drag | Pan |
| Room only | Hides the stage and everything else that is not the room (on when the editor opens) |
| Close editor | Hands the view back to the Hand Lab |

- **Spaces.** Pieces in the room are in room space: x right, y up from the floor, -z toward the wall the shadows play on, with the player at the origin. Keep everything short of z -1.5, the nearest the wall ahead comes. The lap pieces (`tray`, `quilt`) are in the tray's own space.
- **Things that follow.** Moving the tray moves the candle, which is the light the hand shadows are cast from. A wonder's glow moves with the piece it is on. The candle's shadows are baked, and baked again as you drag (once a frame), so they follow the piece live.
- **The player.** A light-blue wireframe shows where the player sits: the headset at their eyes, a line down to a cross on the floor, and roughly what a Quest 3 sees (110° across, 96° up and down) out to z -1.5. It is hidden in the Eye view.
- **Not in the editor:** the window, the walls and the wall ahead (which follows the stage distance). To make another piece editable, give it an id in its view and list it in `BEDROOM_PIECE_IDS` (`src/engine/shadow/bedroom-layout.ts`).
- A file the game can't read is reported in the console (`room layout: ...`), and the affected pieces stand at their defaults. The dev server refuses to save one.

#### The asset browser

The **Assets** panel along the bottom shows `src/assets/models`: the folder tree on the left, and the folder picked in it as tiles with a thumbnail of each model on the right (double-click a folder tile to open it; the path above the tiles goes back up). Drag its top edge to resize it (double-click the edge for the default height; the height is remembered), and ▾ folds it down to its title bar. It is hidden in windows narrower than 700 px.

- **Import:** **Import…**, or drag `.glb` files from your computer onto a folder. A name with spaces or odd characters is tidied (`Chair (1).GLB` becomes `Chair-1.glb`). The dev server refuses a file over the 500 KB model budget, bytes that are not a self-contained `.glb`, and a name whose asset id another file under `src/assets` already has (the id is the file name in lower case with hyphens, in any folder: `Chair.glb` clashes with `chair.glb`).
- **Organise:** **New folder**, **Rename**, **Delete**, and drag a file or folder onto another folder to move it. Moving keeps a model's id, so the layout still finds it; a model placed in the room (marked ●) can't be renamed or deleted until it's removed there and saved. Git doesn't keep empty folders.
- **Place:** **Add to room** (or double-click) puts the model on the floor where the view is looking. Dragging it into the view stands it on the surface under the pointer (a table, the bed; on the tray it goes in the lap section), else on the floor. A placed model is saved in the layout file with a `"model"` field (its asset id), keeps its own size (times its scale), and turns about the middle of its base. In the game and the headset it loads like the other furniture.
- **Export:** select a built-in piece and press **Export .glb**. The file appears under `exported/` (`chair-2.glb` if its id is taken) and can be placed or edited in Blender; the piece in the room is not changed. glTF can't hold additive (glowing) blending, a depth offset or a drawing order, and the status line says when a piece uses them. An exported copy's origin is the middle of its base, not where the code's piece has it.
- Model files added, changed or deleted under `src/assets/models` don't reload the page (they would end the editor's session); the next reload reads them. Without a dev server (a tester build) the panel is read-only and export downloads the file.
- `node scripts/room-editor-probe.mjs https://localhost:8097` (with `npx vite --port 8097 --strictPort` running) checks all of this in a browser and puts the layout file back afterwards.

## 13. Add models, textures and sounds

Put the file in `src/assets` and it is in the game ([ADR 0009](adr/0009-asset-pipeline.md)); there is no list to edit. The first folder under `src/assets` sets how it loads:

| Folder | Loads | Use for |
|---|---|---|
| `src/assets/critical/` | Before the world starts (the page waits, and a missing file leaves a blank page) | Almost nothing. Keep it empty or tiny, all of it under 1 MB. Prefer loading the paper's texture later with the loader and drawing the procedural paper until then |
| `src/assets/audio/` (`sfx/`, `music/`) | In the background after the critical files | Sounds. Music goes in a folder named `music` |
| anywhere else, for example `src/assets/models/` | When first used | Models and textures |

The id is the file name in lower case with hyphens (`Paper Crow.glb` is `paper-crow`). Models must be single-file `.glb`; extensions must be lower case (`npm run check` says so if not). In code, `new AssetLoader({ load: iwsdkLoad, fallback })` (`src/engine/services/assets`) gets a lazy or background one by id: it times out after 8 s, tries twice, shares a load between callers, and gives a stand-in rather than failing (it tries again after 10 s, or call `retry(id)`). It is not for critical files, and a loaded model is one shared object, so take copies with `AssetManager.getGLTF(id)`.

**Size limits** (`src/engine/services/assets/budgets.mjs`): a texture 512 KB, a model 500 KB, a sound effect 300 KB, a music file 1.5 MB, the critical files together 1 MB, and the first-load JavaScript 800 KB gzipped. `npm run check` checks the files in the repository and `npm run build` checks the first-load bundle, so an over-budget file turns CI red (it blocks merging only if the repository requires the check), and on `main` it stops the Pages deploy. Use WebP or KTX2 for textures, Ogg or MP3 for sound, and keep textures to 2048 pixels or less: the limits are file sizes, not memory.

**Cold start.** `npm run build`, then `npm run cold-start` loads the build with an empty cache, the CPU four times slower (`-- --cpu 6` for six) and fast 4G, and prints when the first frame's update began (the lantern is already in the scene). It needs Playwright's Chromium (`npx playwright install chromium`) and does not include tapping Enter VR. `-- --budget 5000` makes it fail if the median is later than 5 s. Headless Chromium draws in software and runs vary by a few hundred milliseconds, so use the numbers to compare changes, and confirm the real figure on a headset.

## 14. Sound

Sound is plain Web Audio ([ADR 0008](adr/0008-audio.md)), in `src/engine/services/audio`. Browsers keep audio locked until the first click, key press or tap, so the first sound after loading waits for that. Starting a VR session and pinching inside one also try to unlock it, but **whether the Pico or Quest browser allows that is not confirmed**: after entering VR, check `__wsw.audio.state` is `running`. The sounds are placeholders made in code ([CREDITS.md](../CREDITS.md)).

- **Events.** A recognised shape rustles, a committed shape thumps, a let-go shape makes a soft breath (a low falling pair if tracking was lost), all from where that hand's shadow is on the wall; the candle whooshes when it is lit and then crackles from the flame, and makes a small sound when lifted and set down. The title screen ticks as a fingertip reaches an item and strikes a match for BEGIN (after the first tap: browsers keep audio locked until then). `gameAudio` is on `__wsw` in dev. The other sound definitions (chime, notes, music, ambience) are kept for the story but nothing plays them yet.
- **Volumes.** `audio.mixer.setMaster(0..1)`, `setVolume(Bus.Music | Bus.Effects | Bus.Ambience, 0..1)`, `setMuted(bus, true)` and `setAllMuted(true)`. In the dev console: `__wsw.audio.mixer.setVolume(1, 0.5)`.
- **A real sound.** Put the file in `src/assets/audio/sfx/` named after the sound (`rustle`, `thump`, `chime`, `crackle`): the asset pipeline (section 13) loads it in the background under that id. Handing it to the engine is not automatic yet: once it has loaded, call `audio.setBuffer(Sound.Rustle, AssetManager.getAudio('rustle'))`. Add its licence to `CREDITS.md`.
- **Check it in a browser.** `npx vite --port 8095 --strictPort`, then `node scripts/audio-probe.mjs https://localhost:8095` checks the unlock, the left and right panning, the buses, the events and the cost with no headset.

## 15. Saves

The settings and the day last played are saved in the browser ([ADR 0010](adr/0010-saves.md), `src/engine/services/saves`). The save is version 3 (`schema.ts`); an older save that held puzzle progress and creatures migrates to it, keeping its settings and day. The save is read once at start and written only on events: the headset coming off or the system menu opening, the VR session ending, and the page being hidden or closed. Nothing runs per frame.

- **Use it:** `saves.setSettings(next)` stores the settings (`main.ts` already calls it whenever a setting changes). Read `saves.data` each time rather than keeping a piece of it. `saves.touchDay()` ran at start; `saves.previousDay` is the last night played (compare with today for a new night). In the dev console it is `__wsw.saves`.
- **Look at it:** `localStorage` keys `wsw.save.a` and `wsw.save.b` (the higher `seq` is the newest), `wsw.save.corrupt.<a|b>.<0-2>` if a slot was damaged, `wsw.save.newer.<a|b>` if a save from a newer version was moved aside. The Hand Lab uses `wsw.save.mock.*` instead. `__wsw.saves.status` says whether it is being stored, whether it recovered from damage, and the last problem; the diagnostics report has the same under `saves`.
- **Change the format:** raise `CURRENT_VERSION` in `schema.ts`, add the step to `migrations.ts` (it must never throw), a reader in `SANITIZERS`, a frozen `fixtures/save-v<new>.json`, and update the `save-v<N>.expected.json` files. A test fails if you forget any of them.
- **Start over** in the browser: `__wsw.saves.reset()` (it overwrites both slots; a save from a newer version is moved aside first), or delete the `wsw.save.*` keys.
- **Check it in a browser:** `npx vite --port 8097 --strictPort`, then `node scripts/saves-probe.mjs https://localhost:8097`.

## 16. Settings

The accessibility settings ([ADR 0011](adr/0011-accessibility-settings.md)) are one table in `src/engine/services/settings/settings.ts`: tolerance, hold time, shadow size, recognition glow, lantern flicker, the four volumes, high contrast, captions (a stub until the story exists) and the main hand. Each has a range, a default and a one-line explanation, and the panel, the saves and the tests all read that table.

- **Open the panel:** on the desktop, press **Settings** in the Hand Lab (**Developer**, then **Hand Lab**). In a headset, press **Developer** under the title, turn on **Settings panel opens when VR starts**, then press BEGIN: it opens a second after the session starts, in front of you and a little toward your main hand. Nothing opens it in play yet: the lantern flow (Teammate B) should call `__wsw.openSettings()`.
- **Use it:** poke a button with a fingertip. There are two pages (**More settings >** and **< Back**), **Reset to defaults** and **Close**. A change applies at once and is saved with the next save event.
- **Use a setting in game code:** read `settings.value` (on `__wsw.settings` in dev) and `settings.subscribe(fn)` to hear changes. `highContrast`, `captions` and `hand` are only read by listeners; the other settings are already pushed to the recognizer, shadow projector, sharpen, lantern and mixer by the store.
- **Add a setting:** add its field to `Settings`, an entry to `SETTING_SPECS` (with the one-line help) and a page slot in `PAGES` (`src/ui/settings-panel/markup.ts`), and, if it steers an engine object, a case in `SettingsStore.apply`. A new field needs a save version bump (section 15).
- **Check it in a browser:** `npx vite --port 8097 --strictPort`, then `node scripts/settings-probe.mjs https://localhost:8097 [screenshot-prefix]` (presses the Hand Lab's Settings button, then presses things, checks the engine, the saves and high contrast, and saves screenshots). It presses with a click event on the element, not a real fingertip: **poke on a headset is not verified** (see the ADR).

## 17. Debug tools

Debug tools ([ADR 0012](adr/0012-debug-tools.md), `src/debug`) exist only in the dev server and in a **tester build**; the judges' build (`npm run build`) does not contain them. `npm run build -- --mode tester` makes a tester build (for the Pico over GitHub Pages or a tunnel). The launcher's **Developer** button (section 6), with the Hand Lab and room editor buttons in it, is part of the same gate. `node scripts/check-debug-free.mjs` builds both ways and fails if the normal build has any debug code in it; run it before a release.

**Keyboard** (Alt plus the key, so none of it clashes with the Hand Lab's keys; a small line at the bottom left of the page shows what is not normal):

| Keys | What it does |
|---|---|
| Alt+K | Show the shadow capsules, outline and projected joints |
| Alt+J | Show the joint dots |
| Alt+R | Start or stop replaying the demo recording into the game, in place of your hands |
| Alt+1 to Alt+5 | Switch off or on: shadow, sharpen, flicker, candle light, hand visual |

**Hands-only menu.** The settings panel (section 16) has more pages after the two settings pages when the debug tools are on: **Debug: views** (capsules, joint dots) and **Debug: systems and replay** (the five systems, replay), then one page per group of registered actions. Poke a button; its text shows the state, and a key press updates it too. In a headset: Developer (launcher) > Settings panel opens when VR starts, press BEGIN, then the **Next page >** button.

**Switching a system off** is an override that sits on top of the settings: changing a setting while a system is off does not turn it back on, and a page reload clears it. Sharpen restores to the setting's value; flicker to what the flame was doing before (the device's default or the player's choice).

**Replay.** Alt+R plays `recordings/emulator-demo.handrec.json` (served by the dev server; `recordings/` is not in the repository or in a build) in a loop, and the hands cue and everything downstream see tracked hands. To replay another file from the console: `__wsw.debug.replay.load(json, 'name')`, then it is active until stopped (`__wsw.debug.replay.stop()`). The Hand Lab's own **Replay...** button still works at a desk.

**Menu actions.** Code can add buttons to the menu with `debug.controller.actions.register({ id, group, label, run })` (`src/debug/debug-actions.ts`), for example one per story scene to skip to it. The menu lists each group on its own pages, six to a page. Register before the settings panel is first opened (it builds its pages once).

**Adding a debug tool:** put it under `src/debug`, reach it only with `if (DEBUG_TOOLS) { const { ... } = await import(...) }` (never a static import from code that ships), add a marker string to `scripts/check-debug-free.mjs`, an item to `DebugController.pages()` and a key to `debug-keys.ts`. **Check it in a browser:** `npx vite --port 8097 --strictPort`, then `node scripts/debug-probe.mjs https://localhost:8097`.

## 18. Troubleshooting

| Problem | Fix |
|---|---|
| "Your connection is not private" | Expected with the dev server. Click **Advanced → Proceed**. |
| Port 8081 already in use | `npm run dev:down`, then `npm run dev` again. |
| No **Enter XR** button in desktop Chrome | Use the dev server (`npm run dev`), which adds the emulator. The hosted build only offers XR on a headset. |
| No hands in the emulator | Switch the emulator's input to **Hands**. |
| No hands on a headset | Turn on hand tracking in the headset settings, and put the controllers down. Press **Developer** in the launcher and turn on **Joint dots** to see a dot on every tracked joint. |
| Headset can't open the Network address | Same Wi-Fi? Some networks block devices from reaching each other. Use the hosted build instead. |
| Webcam (Hand Lab or bench) says "Couldn't start" | Allow camera access for localhost in Chrome, and close other apps that use the camera. |
| No way into VR on the Pico (a blank page, no Enter button) | The Pico browser (Chrome 105) can't show the browser's own enter prompt, which is all IWSDK relies on. The page always shows its own title screen: **BEGIN** starts VR, and **Trouble starting?** has two other ways in. If you don't see them, update to the latest `main`. |
| On the Pico, hands show as a pointer and a click but no hands drawn ("hands as controllers"), or **Enter** does nothing | The Pico's own browser and the Pico Store's Wolvic do not give a page the 25 hand joints. What works (ADR 0003, update 2): the sideloaded **Wolvic Chromium 1.4** build (`Wolvic-picoxr-arm64-chromium-generic-release.apk`), a **VR** session (the launcher's **Enter VR** button), controllers off. Wolvic Chromium shows a blank page for a self-signed `https://192.168...` address (no certificate warning screen), so open the game through a trusted address: the GitHub Pages link, or a tunnel to the dev server (a public address: do not leave it running). The launcher's log box and buttons show what the browser said. |
| Webcam stuck on "Loading hand model" or "Starting the camera" | The model downloads from Google on first start. Check your internet connection. |
| Page stays white; the console says "WebGL context could not be created" | Chrome has turned WebGL off, usually after its graphics process crashed. Quit Chrome fully (Cmd+Q) and reopen it. If that doesn't help, turn on **Use graphics acceleration when available** in `chrome://settings/system`; `chrome://gpu` should show WebGL as hardware accelerated. |
| Hand Lab opens as the plain game | The mode is kept per tab: a new tab, or the link opened elsewhere, starts the game. Press **Developer**, then **Hand Lab**. |
| Hand Lab recording isn't in `recordings/` | The dev server must be running (`npm run dev`) with the new vite.config.ts: restart it once after pulling. Without it the page falls back to a browser download. |
| `npm run check` fails on "single three" | Something added another three.js. Run `npm ls three` to find it; never install a second copy. |
| Copy report doesn't copy | Press **Show**, then select all the text and copy it by hand. |
