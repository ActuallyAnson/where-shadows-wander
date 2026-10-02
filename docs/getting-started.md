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

1. With `npm run dev` running, open **https://localhost:8081/?mock=1** in a normal Chrome tab, or press **Open Hand Lab** (top left) on the game page. Don't use the window `npm run dev` opens by itself: it drops `?mock=1` when the page reloads, and it doesn't save downloads to your Downloads folder.
2. Pick a **Source** in the panel on the right:
   - **Synthetic:** choose **Left** or **Right**, then click a shape (or press 0–6). **Hide** takes a hand away (as if tracking were lost) and **Jitter** adds a few millimetres of tracking noise. Keys: R/L pick a hand, arrows move it (Shift for depth), Q/E roll, Z/X turn, Space pauses.
   - **Script:** every shape on the right hand, then the left, in a loop.
   - **Replay…:** pick a `.handrec.json`, or drag one onto the page.
   - **Webcam:** your own hands. Allow camera access; the first start downloads the hand model (about 8 MB). The status line shows the tracking rate and MediaPipe's time per frame, which runs in the background and doesn't slow the page.
3. Drag to look around the hands, scroll to zoom. The cards show each hand's palm direction, thumb–index gap, finger spread and finger curl. The big label is the shape the hand is posed as (Synthetic and Script); the rough guess under it only knows flat, fist and open until the classifier lands.
4. **● Record**, then **Stop and download**, saves a `.handrec.json` to your Downloads folder.
5. **Guided recording** prompts you through every shape, right hand then left (66 s: each shape held 3 s with 2 s rests), and saves a recording with **shape labels**: which shape each hand was asked to make, and when. Those are what the classifier is scored against (#12). Use it with the **Webcam** source. With **Script** it gives a labelled synthetic recording. Press **Stop guided** to end early; you keep the labels for the prompts you finished.

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

**From the hosted build:** once GitHub Pages is set up (section 10), use that HTTPS link instead. There's no certificate warning, and it works away from your Wi-Fi.

**To record hand data on a headset,** add `?record=20` to the address, for example `https://192.168.1.95:8081/?record=20&note=fist then flat hand`. Recording starts when a hand is first tracked and lasts 20 seconds. After you exit XR, press **Download recording**.

**To record labelled hand shapes on a headset,** use `?record&script=shapes`, for example `https://192.168.1.95:8081/?record&script=shapes`. A panel in front of you says "Raise your right hand to start", then prompts each shape with a countdown, right hand then left. It takes 66 seconds and the file carries shape labels. Follow the prompts as closely as you can: the labels say what you were asked to do, not what your hand did.

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

## 9. Before you commit

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

## 10. Deploying

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`), after `npm run check` passes. One-time setup by the repo owner: **Settings → Pages → Source: GitHub Actions**. The site is at https://actuallyanson.github.io/where-shadows-wander/ (and the webcam bench at `.../webcam.html`). The published site is public even though the repo is private.

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
| Webcam stuck on "Loading hand model" or "Starting the camera" | The model downloads from Google on first start. Check your internet connection. |
| Page stays white; the console says "WebGL context could not be created" | Chrome has turned WebGL off, usually after its graphics process crashed. Quit Chrome fully (Cmd+Q) and reopen it. If that doesn't help, turn on **Use graphics acceleration when available** in `chrome://settings/system`; `chrome://gpu` should show WebGL as hardware accelerated. |
| Hand Lab opens as the plain game | The address lost `?mock=1` (the window `npm run dev` opens drops it on reload). Use a normal Chrome tab. |
| Hand Lab recording didn't download | You're in the window `npm run dev` opens, which doesn't save downloads. Use a normal Chrome tab. |
| `npm run check` fails on "single three" | Something added another three.js. Run `npm ls three` to find it; never install a second copy. |
| Copy report doesn't copy | Press **Show**, then select all the text and copy it by hand. |
