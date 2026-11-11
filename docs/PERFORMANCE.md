# Performance

How the game is measured, what the numbers were, and what guards them. Everything here was measured on a laptop
with a software renderer (no GPU), so the **render milliseconds are for comparing two builds, not for predicting
a headset**. Nothing has been measured on a Pico or a Quest yet.

## Measuring

| Tool | What it does |
| --- | --- |
| `node scripts/perf-bench.mjs "https://localhost:PORT/" --label NAME --out FILE --runs 2` | Opens the game in a browser, measures the lit room with and without the decoration the quality governor sheds, and records render time, draw calls, textures, texture memory, our own allocation per frame and long main-thread stalls. A calibration loop scales the time to this machine's speed so two runs on different days can be compared. |
| `npm run perf` | Micro-benchmarks: the per-frame hand pipeline (shape recognizer, gesture detector, shadow projector), the Verlet rope and the quality governor. |
| Debug bar (`FrameInspector`) | Live frame time, draw calls and the governor's level in the headset. |

`docs/perf/2026-11-01-baseline.json` is the benchmark before the engine-systems work.

## Guards in `npm run check`

- Per-frame allocation stays under 64 B for the hand reader, the hands status, the hand visual, the audio engine, and
  the hand trail and bunting views (`*.alloc.test.ts`; the last two are in `room-views.alloc.test.ts`, which was
  `story-views.alloc.test.ts`), and under 700 B for the whole hand pipeline (`frame-pipeline.alloc.test.ts`).
- Download size budgets per file and for the first-load JavaScript (`check:budgets`).

## What the engine-systems work added

The tables below were measured on 1 Nov 2026, with the puzzle game that has since been removed
([ADR 0016](adr/0016-story-shadow-theatre.md)). Several of the scenes and features in them (the spark and reward,
the opening reel, the finale hall, the cinematic scenes, rewind) no longer exist. They are kept as a record.

| Change | Why | Measured |
| --- | --- | --- |
| Quality governor | Drops the extras (prop sketches, rings, ambient, trail, rewards, backdrop) in steps when the frame runs over budget, and brings them back after a calm stretch. Only active in a real headset session. | Top level cut one render from 34 to 24.9 ms (-27%) on the laptop, in one noisy run. |
| Sound rendering on a worker | All 26 sounds are made off the main thread, room loops first. | About 290 ms of work for all sounds (music about 130 ms), now off the main thread. Not measured on a headset. |
| Cinematic scenes built on entry | The dusk and hall scenes no longer keep about 35 textures on the GPU while idle. | Expected about 10 MB less texture memory in the room; not yet re-measured. |
| Texture size cuts | Paper scenery layers 640x360, side walls 800x400. | Texture memory 66.5 to 56.7 MB. |
| Verlet bunting | Live flags that flutter in the fan's wind and ripple when a spark lands. | 3.3 microseconds per frame for a rope; about 0 bytes allocated. |
| Rewind by replay | Turns the night back 3 s by replaying recorded input into a fresh game. | Exact against the original run in tests. |

## Before and after (same laptop, one browser at a time, median of 2 runs, software renderer 1000x700)

Before is commit `da2a6a9` (`docs/perf/2026-11-01-before-da2a6a9.json`); after is `feat/engine-systems` (`docs/perf/2026-11-01-engine-systems.json`).

| State | Render ms before / after | Draw calls | Textures | Texture MB |
| --- | --- | --- | --- | --- |
| Room | 15.8 / 17.7 | 52 / 53 | 44 / 44 | 56.7 / 47.0 |
| Room, quality level 3 (new) | n/a / 17.8 | n/a / 49 | n/a / 45 | n/a / 47.0 |
| Room + spark + reward | 17.9 / 20.3 | 54 / 55 | 45 / 45 | 56.7 / 47.0 |
| Opening reel | 13.6 / 15.4 | 47 / 45 | 64 / 64 | 56.7 / 52.4 |
| Finale hall | 14.0 / 15.8 | 37 / 35 | 79 / 60 | 56.7 / 51.3 |

What this says, plainly:

- **Texture memory is down** 7 to 17 percent (room 56.7 to 47.0 MB), and the finale hall holds 19 fewer textures. This is the lazy cinematic scenes and the smaller scenery.
- **Render time is up about 10 percent** (about 2 ms in this software renderer). The new bunting adds a draw call and some triangles, and the machine was still busy with other work (load average 7 to 10), so some of that is noise. It is a cost we chose, not a saving.
- **The quality governor did not show a saving in this run.** Level 3 cost the same as the room (17.8 ms). An earlier noisy run showed 34 to 24.9 ms; this paired run does not confirm it. The governor is untested on a real headset.
- **Start-up** is the same (3.5 s before, 3.4 s after), and the long main-thread stalls in the first 26 s are the same count (17 each): they come from start-up work that is not yet moved off the main thread.
- Our own JavaScript allocation per frame is small in both (9 to 34 B); the larger totals are the desktop hand emulator.

## Not yet known

- Frame time, thermal behaviour and the governor's thresholds on a Pico and a Quest.
- Whether the sound worker removes the start-up stalls on a headset (the stalls above are unchanged on the laptop).
