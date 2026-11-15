# Where Shadows Wander

A seated, hands-only WebXR story for the Meta VR Start Developer Competition 2026 (deadline 19 Nov 2026, 4:00am SGT). A boy who has recently lost his best friend, a girl, wakes in the night, lights a candle, and relives their memories in shadow puppets on his bedroom wall, moving each on with a hand shape, until he can sleep again.

## Where things are written down

- **The story:** [docs/STORY.md](docs/STORY.md) is the source of truth for the seven scenes. Scenes are built one at a time; when one changes, rewrite its section and add a dated line to the change log at the bottom.
- **The design:** [docs/GDD.md](docs/GDD.md) (premise, tone, shapes, accessibility). **How to run and test:** [docs/getting-started.md](docs/getting-started.md). **Structure and frame budget:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). **Decisions:** [docs/adr/](docs/adr/); ADR 0016 is the current direction. **Assets (sounds, music, models):** [docs/ASSETS.md](docs/ASSETS.md) tracks what is final, placeholder or still needed, and where to get new ones (see the asset rule under Workflow).
- The puzzle gameplay (`src/game`, `src/engine/sim`, the traveller, props and solver) was deleted on 11 Nov 2026. Ignore anything that still describes it; git history has it.

## Story rules

- Show, don't tell: no dialogue or narration. At most a word or two on the wall where a picture can't do the job.
- The loss is never shown (no illness, accident or funeral); it is felt through absence.
- Bittersweet, not tragic, and never frightening.
- No failure: a scene waits for as long as it takes, and the friend's hand always shows the shape to make.

## Code rules

- `src/engine/hands`, `src/engine/stage` and `src/engine/shadow/pure` are pure TypeScript: no IWSDK, three.js, engine-facing folders or browser globals. ESLint enforces this (`eslint.config.js`). Time comes in as a `dt` argument.
- No allocation per frame in anything that runs every frame: reuse vectors and arrays, allocate in constructors or on load. `*.alloc.test.ts` tests guard the hot paths.
- No `Math.random()` without a seeded generator where results must be repeatable.
- Tests sit next to the code (`thing.ts` + `thing.test.ts`) and run in Node with Vitest.
- There is only one three.js: IWSDK's `super-three` fork. Never add a second copy.

## Names and credits

- One team member takes part only under the alias **Nyove** (GitHub `Nyoveee`). Wherever the team is named (README credits, CREDITS.md, docs, commits, PR text, store or competition copy), write "Nyove". Never write, guess or look up their real name.
- The README's Credits section is the team list. Change how anyone is credited only with that person's say-so.

## Workflow

- Before every commit: `npm run format`, then `npm run check`.
- Update [docs/ASSETS.md](docs/ASSETS.md) in the same commit whenever an asset is added, changed, put back into use or dropped. This covers every kind of asset: a sound, music, model, texture, font or painted art, whether it is a real file, a placeholder or made in code (for example a sound in `placeholder-sounds.ts` or a cut-out in `puppet-art.ts`). Say what it is, where it is used and its status; a third-party file also needs its row in CREDITS.md.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), one branch per task.
- Don't commit `package-lock.json` churn (`"peer": true` lines) unless a dependency actually changed.
- Known failures from before 11 Nov, not caused by new work: `src/engine/xr/xr-hands.alloc.test.ts` (2 tests) and `scripts/settings-probe.mjs` (reads the old `settingsPanel.doc`).
