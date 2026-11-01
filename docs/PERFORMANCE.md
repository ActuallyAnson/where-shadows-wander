# Performance

How the game is measured, what the numbers were, and what guards them. Everything here was measured on a laptop
with a software renderer (no GPU), so the **render milliseconds are for comparing two builds, not for predicting
a headset**. Nothing has been measured on a Pico or a Quest yet.

## Measuring

| Tool | What it does |
| --- | --- |
| `node scripts/perf-bench.mjs "https://localhost:PORT/?mock=1" --label NAME --out FILE --runs 2` | Opens the game in a browser, steps through the room, the spark and reward, the opening reel and the finale hall, and records render time, draw calls, textures, texture memory, our own allocation per frame and long main-thread stalls. A calibration loop scales the time to this machine's speed so two runs on different days can be compared. |
| `npm run perf` | Micro-benchmarks: the solver, a whole game frame in the busiest scenes, prop shadows, the Verlet rope and the quality governor. |
| Debug bar (`FrameInspector`) | Live frame time, draw calls and the governor's level in the headset. |

`docs/perf/2026-11-01-baseline.json` is the benchmark before the engine-systems work.

## Guards in `npm run check`

- Whole game frame stays under 0.5 ms in the three busiest scenes (`game.budget.test.ts`).
- Per-frame allocation stays under 64 B for the solver, entity store, fixed step, prop shadows, hand visuals, and the
  spark, hand trail, reward and bunting views (`*.alloc.test.ts`).
- Download size budgets per file and for the first-load JavaScript (`check:budgets`).
- Replay determinism, so the rewind and bug-report recordings stay exact (`determinism.test.ts`).

## What the engine-systems work added

| Change | Why | Measured |
| --- | --- | --- |
| Quality governor | Drops the extras (prop sketches, rings, ambient, trail, rewards, backdrop) in steps when the frame runs over budget, and brings them back after a calm stretch. Only active in a real headset session. | Top level cut one render from 34 to 24.9 ms (-27%) on the laptop, in one noisy run. |
| Sound rendering on a worker | All 26 sounds are made off the main thread, room loops first. | About 290 ms of work for all sounds (music about 130 ms), now off the main thread. Not measured on a headset. |
| Cinematic scenes built on entry | The dusk and hall scenes no longer keep about 35 textures on the GPU while idle. | Expected about 10 MB less texture memory in the room; not yet re-measured. |
| Texture size cuts | Paper scenery layers 640x360, side walls 800x400. | Texture memory 66.5 to 56.7 MB. |
| Verlet bunting | Live flags that flutter in the fan's wind and ripple when a spark lands. | 3.3 microseconds per frame for a rope; about 0 bytes allocated. |
| Rewind by replay | Turns the night back 3 s by replaying recorded input into a fresh game. | Exact against the original run in tests. |

## Numbers so far (software renderer, 1000x700)

| State | Render ms | Draw calls |
| --- | --- | --- |
| Room | 25.0 | 52 |
| Room with spark and reward | 24.8 | 54 |
| Opening reel | 20.9 | 47 |
| Finale hall | 19.1 | 37 |

Our own JavaScript allocates about 20 B a frame; the roughly 1 KB a frame in a full page is the desktop hand emulator.
No single new element measured above about 1 ms.

## Not yet known

- Frame time, thermal behaviour and the governor's thresholds on a Pico and a Quest.
- The final paired before/after run (baseline commit `da2a6a9` against the current branch). It is heavy and heats the
  laptop, so it is run once, at the end.
