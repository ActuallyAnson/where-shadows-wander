# Where Shadows Wander

A seated, hands-only virtual reality puzzle game: light a lantern in a small cosy room, and your hands' shadows help a little traveller cross the wall.

**Status:** week 1, XR shell. Built for the Meta VR Start Developer Competition 2026.

- **New here? Start with [Getting started](docs/getting-started.md)**: setup, running, emulator, webcam, headset testing, troubleshooting.
- [Architecture](docs/ARCHITECTURE.md): layers, one frame, modules, frame budget
- [Competition reference](docs/COMPETITION.md): rules, dates, judging criteria and useful links
- [Game design document](docs/GDD.md) (original: [docs/gdd.docx](docs/gdd.docx))
- [IWSDK spike results](docs/spikes/iwsdk-spike.md)
- Architecture decisions: [ADR 0001: IWSDK as XR and view layer](docs/adr/0001-iwsdk-as-xr-and-view-layer.md), [ADR 0002: plain three.js fallback](docs/adr/0002-plain-threejs-fallback.md), [ADR 0003: Pico as stand-in test device](docs/adr/0003-pico-as-stand-in-test-device.md), [ADR 0004: webcam hand bench and hand recordings](docs/adr/0004-webcam-bench-and-hand-recordings.md), [ADR 0005: a virtual room instead of the real one](docs/adr/0005-virtual-room.md)

## Develop

Node `>=20.19 <21`, `>=22.12 <23` or `>=24` (see `.nvmrc`).

```sh
npm install
npm run dev          # IWSDK dev server (HTTPS, port 8081) with the IWER Quest 3 emulator
npm run check        # typecheck, import boundaries, single three.js, unit tests
npm run build        # production build in dist/
```

Drive the emulator from the CLI while `npm run dev` is up:

```sh
npx iwsdk xr enter
npx iwsdk xr set-input-mode --input-json '{"mode":"hand"}'
npx iwsdk browser run scripts/read-report.mjs   # diagnostics report
npx iwsdk browser run scripts/census.mjs        # what is drawn (IWSDK hand meshes and rays should be hidden)
```

**Test hands without a headset (Hand Lab):** with `npm run dev` running, open https://localhost:8081/?mock=1 in a normal browser tab, or press **Open Hand Lab** on the game page. Pick a source: **Synthetic** (click a shape or press 0–6), **Script** (every shape on each hand in turn), **Replay…** (a `.handrec.json`) or **Webcam** (your own hands, through MediaPipe). It shows the hands in 3D (drag to look around) and the game's hand features live; **Record** saves a `.handrec.json`. Webcam depth is approximate, so use it for shapes, not tracking quality. The older webcam bench (https://localhost:8081/webcam.html) shows the camera image with the tracked landmarks drawn on it.

To check a production build the way GitHub Pages serves it: `node scripts/serve-pages.mjs dist 4173`, then open `http://localhost:4173/where-shadows-wander/`.

### Code layout

Folders without code yet are created by their owner when needed.

ESLint (`npm run lint`, part of `npm run check`) enforces the "Pure" rows: no IWSDK, three.js, engine-facing folders or browser globals. The rules are in `eslint.config.js`.

## Testing on a headset

We have a Pico now and no Quest yet. Develop on the Pico; confirm on a Quest before milestones and submission. See [ADR 0003](docs/adr/0003-pico-as-stand-in-test-device.md).

**Pico on your own Wi-Fi (fastest):** run `npm run dev`, then in the Pico browser open `https://<your laptop's LAN IP>:8081` (it's printed when the server starts) and accept the certificate warning once.

**Any headset, from GitHub Pages:** every push to `main` deploys over HTTPS (`.github/workflows/pages.yml`). One-time setup: in the repo settings, under Pages, set Source to "GitHub Actions".

Steps on the headset (Pico or Quest):

1. Open the link in the headset browser. Make sure the headset's room or space setup is done.
2. Press **Enter XR** and allow hand tracking and spatial data. Put the controllers down.
3. Look around the room for about 30 seconds and move your hands in front of you. Dots should follow your finger joints (orange for the right hand, blue for the left).
4. Leave XR, then press **Copy report** at the bottom left of the page and paste the text to us. If copy doesn't work, press **Show**, then select and copy the text.
5. Close the browser completely, reopen the page, enter XR again for about 10 seconds, then send a second report. This tests anchor persistence.

To record hand data, add `?record=20` to the link (`?record=20&note=fist then flat hand` to label it). After leaving XR, press **Download recording**, then open the file in the Hand Recording Player.
