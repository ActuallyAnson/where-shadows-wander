# Work plan

Seven weeks to submission (19 Nov 2026, 04:00 SGT). Each week matches a GitHub milestone, and each task is an issue in that milestone. The weekly goals come from the [GDD milestones](GDD.md#milestones-7-weeks-to-19-nov). Ownership is in [CONTRIBUTING.md](../CONTRIBUTING.md#who-owns-what).

When time runs short, protect P1. Features freeze at the end of week 6.

**Status:** ✅ done · ⏳ in progress · blank = not started. Owners update their own rows.

## Week 1 (to 8 Oct): XR shell on a headset

Goal: the shell runs on the Pico with hands, passthrough and plane detection, and we have its report.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Reorganise source into the planned folders | #1 | ✅ |
| Anson | Team docs: CONTRIBUTING, ARCHITECTURE, WORKPLAN | #2 | ✅ |
| Anson | ESLint, Prettier, required CI | #4 | ✅ |
| Anson | XR capability layer | #5 | |
| Anson | Mock input mode (`?mock=1`) | #6 | ✅ |
| Anson | Shape labels in hand recordings | #7 | ✅ |
| B | First Pico session and its report | #8 | |
| B | Take over CI and the Pages deploy | | |
| A | Loop scheduler (from `src/engine/sim/fixed-step.ts`): interpolation, pause/resume, determinism | | |
| A | StageFrame maths: first version on a fixed test plane | | |
| All | Confirm submission rules on the Meta Developer Forum | | |

## Week 2 (to 15 Oct): shadows and the 2D stage

Goal: hand shadows on the stage, and a 2D world in stage space, in both stage modes.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Projected-shadow renderer and collision capsules | #9 | |
| Anson | Lantern gestures (pinch to place, hand over the flame to pause) | #10 | |
| A | StageFrame: choosing a table or wall, snapping, placement fallback | | |
| A | Entity system and object pools | | |
| A | 2D collision solver: first version against the shadow capsules | | |
| B | Stage renderer: instanced sprites from entity state | | |
| B | Lantern flow: place and light, pause, relight | | |
| B | Asset pipeline: lantern visible in under 5 s | | |

## Week 3 (to 22 Oct): recognising shapes

Goal: the classifier recognises the verb shapes reliably with hold-to-commit and hysteresis, tested with at least 3 other people.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Pose classifier for the v1 shapes | #11 | |
| Anson | Classifier evaluation pipeline | #12 | |
| A | Traveller state machine | | |
| A | Shape abilities: bridge, rock, cup, spread | | |
| B | Procedural animation runtime | | |
| B | Persistence: versioned saves with migrations | | |
| B | Remote Quest tester round 1 | | |
| All | Stranger tests (3+ people) on the webcam bench and the Pico | | |

## Week 4 (to 29 Oct): first puzzles

Goal: the traveller, and puzzles 1–3 including the wordless tutorial.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Composite the stage and shadows over passthrough | #13 | |
| Anson | Classifier tuning from week-3 test recordings | #12 | |
| A | Puzzle framework: JSON levels, win conditions, solution tracking | | |
| A | Puzzles 1–3, including the tutorial gap | | |
| B | Onboarding and the first five minutes | | |
| B | Audio: spatial sounds, mixing | | |
| All | Line up a Quest for the rest of the project (GDD risk "No Quest available") | | |

## Week 5 (to 5 Nov): the full chapter

Goal: puzzles 4–6, the rabbit and fox, the chapter ending and the saved gallery.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Performance pass on hands and shadows (Pico) | | |
| A | Puzzles 4–6 | | |
| A | Companions: rabbit and fox | | |
| A | Creature discovery | | |
| B | Chapter flow and chapter end | | |
| B | Creature gallery | | |
| B | Diagnostics and profiler against the frame budget | | |
| B | Remote Quest tester round 2 | | |

## Week 6 (to 12 Nov): polish, then feature freeze

Goal: art, audio, onboarding polish and accessibility. No new features after this week.

| Owner | Task | Issue | Status |
|---|---|---|---|
| Anson | Lantern light and flicker shader | #14 | |
| Anson | Recognition sharpen effect | #15 | |
| A | Debug tools; bug fixing | | |
| B | Accessibility settings: tolerance, hold time, shadow size, high contrast, captions | | |
| B | Hint system | | |
| B | Art and audio in (CC0 or royalty-free, tracked in CREDITS.md) | | |

## Week 7 (to 19 Nov): ship

Goal: tested in different rooms, fast enough, submitted.

| Owner | Task | Issue | Status |
|---|---|---|---|
| All | Testing in different rooms, on the Pico and a Quest | | |
| All | Performance against the frame budget | | |
| B | Remote Quest tester round 3 on a fresh Quest 3S | | |
| B | Demo video (under 3 minutes, best shot in the first 10 s) | | |
| B | Devpost submission; tag `submission-v1`; turn off the deploy workflow | | |
