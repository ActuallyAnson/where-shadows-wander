# Where Shadows Wander

A seated, hands-only mixed reality puzzle game: light a tiny lantern on your real table, and your hands' shadows help a little traveller cross your real wall.

**Status:** week 1, XR shell. Built for the Meta VR Start Developer Competition 2026.

- [Game design document](docs/GDD.md) (original: [docs/gdd.docx](docs/gdd.docx))
- [IWSDK spike results](docs/spikes/iwsdk-spike.md)
- Architecture decisions: [ADR 0001: IWSDK as XR and view layer](docs/adr/0001-iwsdk-as-xr-and-view-layer.md), [ADR 0002: plain three.js fallback](docs/adr/0002-plain-threejs-fallback.md), [ADR 0003: Pico as stand-in test device](docs/adr/0003-pico-as-stand-in-test-device.md)

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

**Test hand shapes with your webcam (no headset):** with `npm run dev` running, open https://localhost:8081/webcam.html, press **Start camera** and allow camera access. It shows the game's hand features (palm direction, pinch gap, finger spread and curl) live. **Record** saves a `.handrec.json` you can open in the Hand Recording Player. Depth from one camera is approximate, so use it for shapes, not tracking quality.

To check a production build the way GitHub Pages serves it: `node scripts/serve-pages.mjs dist 4173`, then open `http://localhost:4173/where-shadow-wander/`.

### Code layout

| Folder | What | May import IWSDK / three.js |
|---|---|---|
| `src/contracts` | Data shapes shared by platform and gameplay (hand: 25 joints + derived palm) | No |
| `src/sim` | Fixed-timestep loop and, later, the 2D simulation | No |
| `src/game` | Gameplay (from week 2) | No |
| `src/platform` | Raw WebXR reads, IWSDK workarounds, diagnostics | Yes |
| `src/view` | Plain three.js objects | Yes |
| `src/main.ts` | `World.create` and the single driver system | Yes |

`npm run check:boundaries` enforces the "No" rows.

## Testing on a headset

We have a Pico now and no Quest yet. Develop on the Pico; confirm on a Quest before milestones and submission. See [ADR 0003](docs/adr/0003-pico-as-stand-in-test-device.md).

**Pico on your own Wi-Fi (fastest):** run `npm run dev`, then in the Pico browser open `https://<your laptop's LAN IP>:8081` (it's printed when the server starts) and accept the certificate warning once.

**Any headset, from GitHub Pages:** every push to `main` deploys over HTTPS (`.github/workflows/pages.yml`). One-time setup: in the repo settings, under Pages, set Source to "GitHub Actions".

Steps on the headset (Pico or Quest):

1. Open the link in the headset browser. Make sure the headset's room or space setup is done.
2. Press **Enter XR** and allow hand tracking and spatial data. Put the controllers down.
3. Look around the room for about 30 seconds and move your hands in front of you. Orange dots should follow your finger joints.
4. Leave XR, then press **Copy report** at the bottom left of the page and paste the text to us. If copy doesn't work, press **Show**, then select and copy the text.
5. Close the browser completely, reopen the page, enter XR again for about 10 seconds, then send a second report. This tests anchor persistence.

To record hand data, add `?record=20` to the link (`?record=20&note=fist then flat hand` to label it). After leaving XR, press **Download recording**, then open the file in the Hand Recording Player.
