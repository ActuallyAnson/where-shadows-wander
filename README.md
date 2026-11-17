# Where Shadows Wander

A seated, hands-only virtual reality story about grief and comfort. A boy who has recently lost his best friend, a girl, wakes in the night, lights a candle, and goes back through their memories in shadow puppets on his bedroom wall, moving each one on with the shapes of his hands, until he can sleep again.

**Status:** the bedroom, lighting the candle, your hands' shadows on the wall, the shape recogniser, pausing from the headset's system menu, sound, saves and settings are built. The puzzle game was removed ([ADR 0016](docs/adr/0016-story-shadow-theatre.md)); the shadow-puppet story system is next. Built for the Meta VR Start Developer Competition 2026.

- **New here? Start with [Getting started](docs/getting-started.md)**: setup, running, the emulator and Hand Lab, headset testing, recordings, troubleshooting.
- [Game design document](docs/GDD.md): the premise, the candle and the stage, shapes, art, accessibility, competition fit
- [The story](docs/STORY.md): the seven scenes of the night, one at a time
- [Architecture](docs/ARCHITECTURE.md): layers, one frame, modules, frame budget
- [Performance](docs/PERFORMANCE.md): how it is measured and the numbers so far
- [UI style](docs/UI-STYLE.md) and [assets](docs/ASSETS.md) (shipped assets are credited in [CREDITS.md](CREDITS.md))
- [Competition reference](docs/COMPETITION.md): rules, dates, judging criteria and useful links
- [Architecture decisions](docs/adr/): ADR 0016 is the current direction; 0006, 0007, 0013 and 0014 are superseded. The [IWSDK spike](docs/spikes/iwsdk-spike.md) is the evidence for ADRs 0001 and 0002.

## Quick start

Node `>=20.19 <21`, `>=22.12 <23` or `>=24` (see `.nvmrc`).

```sh
npm install
npm run dev          # IWSDK dev server (HTTPS, port 8081) with the IWER Quest 3 emulator
npm run check        # typecheck, lint, formatting, single three.js, asset budgets, unit tests
npm run build        # production build in dist/
```

Then open https://localhost:8081/ and press **BEGIN**. To test without a headset, press **🛠 Dev**, then **Hand Lab panel**. On a headset, we develop on a Pico and confirm on a Quest ([ADR 0003](docs/adr/0003-pico-as-stand-in-test-device.md)). The details of each are in [Getting started](docs/getting-started.md).

## Credits

Made by:

- Anson Teng ([@ActuallyAnson](https://github.com/ActuallyAnson))
- Lim Zhen Eu Damon ([@Requlish](https://github.com/Requlish))
- Nyove ([@Nyoveee](https://github.com/Nyoveee))

Third-party models and fonts, with their authors and licences, are listed in [CREDITS.md](CREDITS.md). Built with Meta's [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk).
