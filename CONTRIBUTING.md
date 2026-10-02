# Contributing

How the three of us work on Where Shadows Wander. Setup and running are in [docs/getting-started.md](docs/getting-started.md). How the code fits together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Who does what each week is in [docs/WORKPLAN.md](docs/WORKPLAN.md).

## Who owns what

Each person owns some folders. Only edit your own folders. If you need a change in someone else's, open an issue or message them with what you need and why.

| Owner | Folders |
|---|---|
| Anson (Input & Hands) | `src/app`, `src/engine/xr`, `src/engine/hands`, `src/engine/shadow`, `src/input-mock`, `tools/hand-recorder` |
| Teammate A (Simulation & Gameplay) | `src/engine/sim`, `src/engine/stage`, `src/game`, `content/levels` |
| Teammate B (Presentation & Services) | `src/engine/render`, `src/engine/anim`, `src/engine/services`, `src/ui`, `src/debug`, `.github/workflows` |

Shared files (`package.json`, `vite.config.ts`, `eslint.config.js`, `docs/`) can be changed by anyone, in a PR the others can see. If you change something another owner's code reads, such as the hand data in `src/engine/hands/hand.ts`, tell them before merging.

## Issues

Every task is a GitHub issue, assigned to its owner and placed in a weekly milestone (Week 1 to Week 7). Issues follow Google's style:

- **Title:** `component: Imperative summary`, e.g. `hands: Build the pose classifier for the v1 shapes`.
- **Labels:**
  - `priority: p0`: blocking; drop other work until it's done.
  - `priority: p1`: needed for this milestone.
  - `priority: p2`: should be done on a reasonable timescale.
  - `priority: p3`: when there's time.
  - `type: feature request`, `type: process` or `type: cleanup`, plus `bug` for defects.
  - One `component:` label.
- **Body:** Summary, Background, Requirements, Acceptance criteria (as a checklist), Out of scope, Dependencies, References, How to verify.

When time runs short, protect P1 work.

## Branches, commits and pull requests

- **One branch per task**, named after the work: `feat/hands-classifier`, `fix/anchor-probe`, `docs/team-docs`.
- **Commits** use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `style:`. The first line says what changed; the body says why.
- **Before every commit:** `npm run format`, then `npm run check` (typecheck, lint, format check, single three.js, tests).
- **One pull request per task.** Fill in the template, and put `Closes #<issue>` in the description.
- **`main` is protected.** Changes go in through a PR, and the `check` CI job must pass with the branch up to date. Merge with a merge commit so individual commits are kept.
- Every merge to `main` deploys to GitHub Pages: https://actuallyanson.github.io/where-shadows-wander/

## Code rules

These come from the architecture and the frame budget. The reasons are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the [ADRs](docs/adr/).

1. **Pure code stays pure.** `src/engine/hands`, `src/engine/sim`, `src/engine/stage` and `src/game` never import IWSDK, three.js, the emulator or MediaPipe, never import engine-facing folders, and never use browser globals. ESLint enforces this.
2. **No allocations every frame.** Code that runs per frame reuses vectors, matrices and arrays. Allocate in constructors or when something changes, not inside the frame loop.
3. **Stay within your frame budget** (see ARCHITECTURE.md). Measure on the Pico when you add something expensive.
4. **Wrap IWSDK, don't rebuild it.** Plane and mesh detection, anchors, hand input and the session come from IWSDK or raw WebXR.
5. **Feature-detect, never check the device.** Every XR feature is optional. Check for the API, and have a fallback. Code must not work on one headset and break on another.
6. **One three.js.** Import three.js through `@iwsdk/core`. Never add a second copy (`npm run check` fails if one appears).
7. **Exact versions.** Dependencies are pinned without `^` or `~`. Upgrade on purpose, in its own PR.
8. **No top-level `await`** in entry files. It deadlocks IWSDK's lazy-loaded chunk in production builds (ADR 0001).
9. **Tests sit next to the code** (`thing.ts` and `thing.test.ts`). Pure logic is unit-tested with Vitest, using synthetic or recorded hand data.

## Testing a change

Say in the PR which of these you checked:

- **Unit tests:** `npm test`.
- **Emulator:** `npm run dev`, then Enter XR with hands. The scripted commands are in getting-started, section 8.
- **Webcam bench:** for anything about hand shapes.
- **Pico:** for anything about real tracking, rooms, performance or feel.
- **Quest:** remote tester rounds at the end of weeks 3, 5 and 7.

## Decisions

When we make a decision that's hard to reverse or that someone will later ask "why?" about, write an ADR in `docs/adr/` using the existing ones as a template: context, decision, consequences. Number them in order.
