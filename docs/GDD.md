# Where Shadows Wander — Game Design Document

## Overview

Where Shadows Wander is a seated, hands-only mixed reality puzzle game: light a tiny lantern on your real table, and your hands' shadows help a little traveller cross your real wall, one short chapter a night.

| Item | Detail |
|----|----|
| Competition | Meta VR Start Developer Competition 2026 |
| Track | Gaming |
| Division | New Experience (built from 24 Sep 2026) |
| Submission deadline | 19 Nov 2026, 4:00am SGT |
| Platform | Meta Quest 3 / 3S, Quest Browser (WebXR) |
| Engine | IWSDK (three.js) for the XR session, emulator and scene understanding; gameplay in our own TypeScript code |
| Input | Hand tracking only; no controller needed |
| Session length | 5–8 minutes per chapter |
| Audience | Casual and cozy-game players; people who play seated, on a couch, desk or plane |

### Design pillars

1.  **Your hands are the toolkit.** Every action is a hand shape. Nothing on screen needs to be pointed at or pressed.

2.  **Your room is the stage.** The real wall or tabletop is where the story plays. Turn passthrough off and there is no game.

3.  **Readable at a glance.** Silhouettes, one light source, one surface. A first-time player understands the scene within seconds.

4.  **Short and complete.** Every session ends on a finished moment, never mid-puzzle.

## Core experience and setup

The player places a small lantern on the near edge of their table, reaches into its beam, and their hand shadows land on a stage in front of them.

### The lantern

The lantern is the game's only light and its pause button. It sits close to the player so the hands are always between the light and the stage, which is how real shadow puppetry works. Placing it is the first action of every session; blowing it out ends or pauses the session.

Gestures (`src/engine/hands/gesture-detector.ts`, starting values to tune with recordings):

- **Pinch and release** places or relights the lantern: the thumb and index tips within about 18 mm (0.2 hand lengths) for at least 150 ms, then opened past about 32 mm. The lantern goes where the fingertips last met. A fist doesn't count (its index finger is curled), and a pinch that closes into a fist is dropped.
- **Covering the flame** pauses: a closed hand with the palm within 12 cm of the flame for 0.5 s. It fires once, then waits for the hand to leave.
- Each gesture has a 1 s cooldown across both hands. A closed hand over the flame is also the fist shape; the game can tell the two apart with `nearLantern`.

### Two stage modes

| Mode | When it is used | What it looks like |
|----|----|----|
| Tabletop theatre | Default; always available | A small paper folding screen unfolds on the table, about 40 cm wide |
| Wall stage | A suitable wall is detected within about 1–3 m in front of the player | The story plays on the real wall at a larger scale |

The tabletop theatre is the primary mode. It needs only a table plane, works facing any direction, and passes the airplane-tray test. The wall stage is the upgrade that makes the trailer shot. Both modes run the same game; only the stage surface differs.

### Light geometry

A physically accurate point light makes shadow size swing wildly with wall distance. Where Shadows Wander fakes it: the projection is blended toward orthographic so a hand always casts a shadow of a fixed, readable size on the stage. The lantern flame still flickers and the shadow edges still soften with hand distance, so it feels real without behaving unpredictably.

## Gameplay

The player helps a shadow traveller walk from one side of the stage to the other by making a small set of recognised hand shapes, each of which does one thing in the world.

### The traveller

A small silhouette figure with a lantern-lit cloak. It walks on its own and stops at obstacles, then waits and looks back at the player. The player never controls it directly; they change the world around it.

### Shape vocabulary (v1)

Only a fixed set of one-handed shapes is recognised. Two-handed shapes are left out because overlapping hands are where hand tracking is least reliable.

| Shape | How to make it | What it does |
|----|----|----|
| Flat hand | Palm down, fingers together | Becomes a bridge or platform the traveller walks on |
| Fist | Closed hand | Becomes a rock that pushes, weighs down, or breaks things |
| Cup | Palm up, fingers curled | Catches rain, embers, or fireflies and carries them |
| Spread | Fingers spread wide | Blocks wind, holds back vines, forms a cage |
| Rabbit | Index and middle up, others pinched to thumb | Releases the rabbit companion |
| Fox | Fingers together, thumb up as an ear (the thumb out to the side like an L, with the hand turned so it points up) | Releases the fox companion |

### How a shape is used

1.  The shadow always mirrors the live hand, so the player sees their real silhouette.

2.  When a shape is recognised, its shadow sharpens and a soft paper rustle plays.

3.  Holding the shape for about 0.4 seconds commits it, and the shadow takes on its role (a rock gains weight, a bridge gains a plank texture).

4.  Releasing the shape returns the shadow to a plain hand.

Simple physical roles (bridge, rock) use the shadow's actual outline for collision, so slight variations still work. Companions and special actions require the exact recognised shape.

### Companions

Making an animal shape and holding it longer (about 1 second) lets the creature break free from the hand and become an independent helper.

| Companion | Ability                                        |
|-----------|------------------------------------------------|
| Rabbit    | Hops over gaps and triggers far switches       |
| Fox       | Digs through soft ground and scares away crows |

New creatures are discovered, not unlocked from a menu: a faint hint appears in the scenery, and the player finds the shape.

### Puzzles (NOT FIXED – JUST IDEAS)

Each puzzle is a single screen of the stage with one obstacle. Every puzzle accepts at least two solutions.

| \# | Obstacle | Intended solution | Alternative |
|----|----|----|----|
| 1 | Gap in the path | Flat-hand bridge | — (tutorial) |
| 2 | Rain puts out the traveller's lantern | Cup to catch the rain | Flat hand as a roof |
| 3 | Strong wind pushes the traveller back | Spread hand as a wall | Fist rock as an anchor |
| 4 | Wide chasm | Rabbit hops across and lowers a rope | Two bridges in sequence |
| 5 | Crows block the path | Fox scares them away | Cup fireflies to distract them |
| 6 | Locked gate with a weight plate | Fist rock on the plate | Fox digs under the gate |

### Chapter structure

One chapter is one night: 5–6 puzzles, about 5–8 minutes. It ends with the traveller reaching a lit window, the lantern dimming, and the chapter's final scene staying painted on the stage. v1 ships one fully polished chapter.

## Player journey

A first-time player should be solving their first puzzle within 60 seconds of launching, without reading a word of instruction.

### First five minutes

1.  **0–10 s:** Passthrough fades in. An unlit lantern floats near the player's hands with a soft glow on the table below.

2.  **10–20 s:** The player sets the lantern down with a pinch-and-release. It lights, and the tabletop theatre unfolds (or the wall stage is offered if a wall is found).

3.  **20–40 s:** The player's hand shadows appear on the stage. They wave and see their shadow move. No prompt is needed.

4.  **40–90 s:** The traveller walks in and stops at a gap. A faint ghost outline of a flat hand appears over the gap. The player matches it, and the traveller crosses.

5.  **90 s–5 min:** Puzzles 2–4. The ghost hint only appears if the player is stuck for more than 20 seconds.

### Session flow

- **Start:** Place and light the lantern. Returning players resume where they left off.

- **Play:** Puzzles in sequence; each is a single screen.

- **Pause:** Close the hand over the lantern flame (or remove the headset). Progress saves immediately.

- **Resume:** Relight with a pinch. The scene fades back in at the same puzzle.

- **End:** The chapter finishes on a painted final scene and a creature added to the gallery.

### Reason to come back

- A new chapter unlocks each real night (v1 can ship with a teaser for chapter 2).

- The stage keeps a gallery of creatures the player has discovered, anchored in place between sessions.

- Each puzzle tracks which solutions the player has found, encouraging replays to find the alternative.

## Art and audio direction

The whole game is black silhouettes on warm, lantern-lit paper, a style that looks finished with a small team and few assets.

### Visual style

- **Palette:** Deep black shadows, warm amber light (around 2200 K feel), cream paper. Accent colour only for magical moments (firefly green, ember orange).

- **Shapes:** Hand-cut paper look: slightly irregular edges, visible fibres in the paper texture.

- **Motion:** Characters animate like rod puppets, with a little stiffness and bounce rather than smooth realism.

- **Lighting:** The only bright object in the scene is the lantern. Its gentle flicker drives a subtle shimmer across the stage.

- **Passthrough:** Left untinted so the real room stays recognisable; the stage glows warmly within it.

### Audio

- **Ambience:** Crackling flame close to the player, quiet night sounds (crickets, distant wind) from the stage.

- **Feedback:** A paper rustle when a shape is recognised; a soft thump when it commits; a chime when a puzzle is solved.

- **Music:** Sparse plucked strings or music box, a short motif per chapter that resolves at the ending.

- **Spatial:** Sounds originate from where they happen on the stage, so the player can hear the traveller arrive before seeing it.

## Technical design

Where Shadows Wander is a 2D game running on a single plane in 3D space, which keeps rendering cheap and lets the tabletop and wall modes share all game code.

### Architecture

The decisions are recorded in [ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md) and [ADR 0002](adr/0002-plain-threejs-fallback.md).

- **IWSDK** provides the XR session, the emulator and scene understanding (planes, anchors), and possibly spatial audio. Nothing else.
- **Gameplay and simulation never import IWSDK or three.js.** They are plain TypeScript, and a build check enforces this.
- **View layer:** plain three.js objects (`InstancedMesh`, custom shaders). IWSDK's ECS is used only where it clearly saves work.
- **Loop:** the simulation runs on our own fixed-timestep loop, driven by a single IWSDK system once per display frame.
- **Versions:** IWSDK is pinned to exactly 1.0.0, and three.js is IWSDK's `super-three@0.181.0` fork. There is never a second copy of three.
- **Fallback:** plain three.js + `@iwsdk/xr-input`. The entry file is about 54 lines and was tested in the emulator; see ADR 0002.

### Test devices

We don't have a Quest yet; we have a Pico. Details are in [ADR 0003](adr/0003-pico-as-stand-in-test-device.md).

- **Develop on the Pico, confirm on a Quest.** Working on Pico means it will probably work on Quest, but only a Quest run proves it. A Quest check (remote tester or a borrowed headset) closes each milestone that matters, and always comes before submission.
- **Build to the WebXR standard, not to one headset.** Every XR feature is optional and feature-detected. Plane labels are only a hint. Nothing may work on one headset and break on the other.
- **Testing order:** IWER emulator for logic, the webcam hand bench for hand shapes, Pico for real-device behaviour, Quest for final confirmation.
- **Hand data without a headset:** the webcam hand bench (`webcam.html`) tracks hands from a laptop camera and converts them to the same 25-joint data the game reads. Headset sessions and the bench can both save hand recordings for replay in tests and in the Hand Recording Player. See [ADR 0004](adr/0004-webcam-bench-and-hand-recordings.md).

### Stack

| Area | Choice |
|----|----|
| Engine | IWSDK (three.js) for the XR session, emulator and scene understanding; gameplay in our own TypeScript code |
| Session | immersive-ar (passthrough) |
| XR features | Hand tracking, plane detection, mesh detection (optional), anchors |
| 2D physics | Lightweight 2D library or a small custom solver in plane space |
| Hosting | Static HTTPS site on GitHub Pages, deployed by the Actions workflow (classic Jekyll Pages drops IWSDK's `_virtual_*` chunk), opened in Quest Browser |
| Performance | Minimum 60 fps (judging requirement), target 72 fps |

### Plane-space game

1.  Detect the stage plane: a table plane for the tabletop theatre, or a vertical plane for the wall stage.

2.  Build a 2D coordinate frame on that plane (origin, right axis, up axis, scale).

3.  Each frame, project every hand joint from the lantern position onto the plane, giving 2D points.

4.  Run all gameplay (traveller, obstacles, companions, collisions) in this 2D space.

5.  Render 2D game objects as flat quads placed on the plane.

Switching between tabletop and wall only swaps the plane frame. All gameplay code is identical.

### Shadow rendering

- A copy of each hand mesh is flattened onto the stage plane with a planar projection matrix and drawn solid black.

- The projection blends between perspective (from the lantern) and orthographic to keep shadow size stable.

- A small blur on the shadow edge, scaled by the hand's distance from the plane, gives a soft, natural edge.

- This avoids real-time shadow maps entirely and costs only two extra draw calls.

### Pose classifier

Shapes are recognised from the hand skeleton, not the shadow image. WebXR provides 25 joints per hand (wrist, thumb and finger joints). There is no palm joint, so the palm position and normal are derived from the wrist and metacarpal joints.

| Feature | How it is measured |
|----|----|
| Finger curl (per finger) | Angle sum along each finger's joints, normalised 0–1 |
| Thumb pinch | Distance from thumb tip to each fingertip |
| Finger spread | Angle between adjacent finger directions |
| Palm orientation | Derived palm normal relative to the stage plane |

Implementation (`src/engine/hands`, plain TypeScript, no allocation per frame): `hand-features.ts` measures per-finger curl (and the mean, smallest and largest of the four fingers), the thumb tip's distance to every fingertip divided by the hand's length, spread between neighbouring fingers and between index and pinky in the palm plane, the palm normal against the stage normal, and the thumb's angle to the palm's forward direction. `shape-ranges.ts` holds each shape's ranges, `shape-classifier.ts` the hold-to-commit state machine, and `shape-recognizer.ts` runs both hands each frame. The Hand Lab and webcam bench cards show the classifier live.

| Shape | Ranges (starting values, tuned with recordings) |
|----|----|
| Flat | mean curl ≤ 0.19 and no finger above 0.35, spread ≤ 18°, palm facing the stage (palm · stage normal ≤ −0.5), thumb within 35° of the fingers |
| Fist | every finger curl ≥ 0.65 |
| Cup | every finger curl 0.2–0.6, palm facing away from the stage (≥ 0.5) |
| Spread | mean curl ≤ 0.19 and no finger above 0.35, index–pinky spread ≥ 25° |
| Rabbit | index and middle curl ≤ 0.25, ring and pinky ≥ 0.4, thumb tip within 0.35 hand lengths of the ring or pinky tip and at least 0.4 from the index tip |
| Fox | mean curl ≤ 0.19 and no finger above 0.35, spread ≤ 18°, thumb ≥ 50° from the fingers |

Each feature has a tolerance unit (0.1 curl, 5° spread, 0.15 palm dot, 8° thumb angle, 0.08 hand lengths). The tolerance slider (1 to 3) widens every range by whole units; hysteresis keeps a committed shape for one more unit. A shape is only picked if it leads any other matching shape by a quarter of a unit.

- Each shape is a set of ranges on these features, hand-tuned and tested on several people. Shapes are worked out on the webcam hand bench, then thresholds are checked against headset recordings, because webcam depth and noise differ from a headset's.

- A shape must match continuously for about 0.4 s to commit (1 s for companions). Each shape emits `candidate` (recognised: the shadow starts sharpening), then `commit` or `cancel`, and later `release`.

- Hysteresis: once committed, a shape stays active until features move clearly outside its range, preventing flicker. If the hand drifts out of the committed shape's normal range into another shape, the new shape replaces it only when it commits, so there's no gap between roles.

- Low tracking confidence pauses recognition rather than guessing: with any joint missing the hold freezes; after 0.2 s a held shape is cancelled, after 0.5 s a committed one is released.

### Persistence

- Spatial anchors store the lantern and stage positions between sessions.

- If anchor persistence is unreliable in Quest Browser, the gallery is stored relative to the detected table or wall instead.

- Chapter progress, discovered creatures and solutions found are saved in browser storage.

### Open questions

- [ ] Which Pico model do we have (Pico 4, 4 Ultra, Neo 3)? The first diagnostics report's user agent will tell us.

- [ ] Confirm on the Meta Developer Forum that an IWSDK WebXR link with gameplay in our own code is an acceptable submission. Also ask about the plain three.js + `@iwsdk/xr-input` fallback, which may raise the same question Babylon.js did.

- [ ] Verify persistent anchor support in the current Quest Browser on device.

- [ ] Measure cold-start load time on Quest Browser; target under 5 seconds to the lantern.

## Accessibility and comfort

Every puzzle can be finished seated, with one hand, within a two-foot radius.

- **One-handed play:** All v1 shapes are one-handed; the player can switch which hand they use at any time.

- **Shape tolerance slider:** Widens recognition ranges for players with limited finger mobility.

- **Hold time setting:** Commit time adjustable from 0.2 s to 1.0 s.

- **Shadow size slider:** Makes shadows larger for low-vision players.

- **High-contrast mode:** Pure black on bright white stage, no paper texture.

- **Captions:** The traveller's sounds and story beats have optional text captions.

- **Comfort:** No artificial locomotion, no camera movement, nothing that requires standing or turning around.

- **Arm fatigue:** Puzzles are designed so hands rest on or near the table between actions.

## Competition fit

Where Shadows Wander targets Best New Gaming Experience (\$100,000), with Boldest Original Concept and Best First Five Minutes as the strongest special-award chances.

### Requirements and guidelines

| Rule | How Where Shadows Wander meets it |
|----|----|
| Hands-first, completable without a controller | Hands are the only input; no controller code path is needed |
| Seated-optimised (airplane seat test) | All play happens on a table or a wall in front of the player, within reach |
| Easy in and out (one bus stop test) | Lantern pinch to start, cover flame to pause, 5–8 minute chapters |
| Original, not a wrapper (take it away test) | All gameplay is built in-house; no third-party service |
| New Experience division | Codebase started on or after 24 Sep 2026 |

### Special awards

| Award | Why Where Shadows Wander fits |
|----|----|
| Boldest Original Concept | Hand shadows as physical game objects on your real room |
| Best First Five Minutes | No instructions; the first puzzle is solved by instinct |
| Best Accessibility Forward Experience | One-handed play, tolerance and hold-time settings, high-contrast mode |
| Best Reason to Come Back | Nightly chapters and a persistent creature gallery |
| Best Narrative Game |  |

### Submission checklist

- [ ] Playable WebXR link hosted and tested on a fresh Quest 3S

- [ ] Demo video under 3 minutes, best shot (shadow story on a real wall) in the first 10 seconds

- [ ] Tagline under 140 characters

- [ ] Description under 500 words: inspiration, how it was built, future plans

- [ ] Hand interactions write-up

- [ ] Target launch date

## Scope, milestones and risks

v1 is one polished chapter: 6 puzzles, 4 verb shapes, 2 companions, both stage modes, with features frozen at the start of week 7.

### In scope / out of scope

| In v1                           | Later                               |
|---------------------------------|-------------------------------------|
| Chapter 1 (6 puzzles)           | Chapters 2+ and nightly unlocks     |
| 4 verb shapes, 2 companions     | Two-handed shapes (bird, butterfly) |
| Tabletop theatre and wall stage | Multiplayer shadow duets            |
| Creature gallery                | Player-made shadow stories          |
| Accessibility settings          | Localisation                        |

### Milestones (7 weeks to 19 Nov)

1.  **Week 1 (to 8 Oct):** IWSDK WebXR shell: hands, passthrough, table and wall detection, lantern placement. Run it on the Pico and collect its diagnostics report and a hand recording. Host the build on GitHub Pages (HTTPS) and, if a remote Quest tester is available, have them send a report too. Confirm submission rules.

2.  **Week 2 (to 15 Oct):** Planar shadow rendering and the 2D plane-space game layer, working in both stage modes.

3.  **Week 3 (to 22 Oct):** Pose classifier for the 4 verb shapes with hold-to-commit and hysteresis. Develop on the webcam hand bench, check against Pico recordings, and test with at least 3 other people (the bench works on any laptop).

4.  **Week 4 (to 29 Oct):** Traveller and puzzles 1–3, including the wordless tutorial.

5.  **Week 5 (to 5 Nov):** Puzzles 4–6, rabbit and fox companions, chapter ending, saved gallery.

6.  **Week 6 (to 12 Nov):** Art, audio, onboarding polish, accessibility settings. Feature freeze at end of week.

7.  **Week 7 (to 19 Nov):** Testing in different rooms, performance, demo video, submission form.

### Risks

Everything in the IWSDK spike ran in the emulator only. The rows marked *Device* need a real headset. The Pico answers them first, but only a Quest run confirms them for the judges' device (see Test devices).

| Risk | Impact | Mitigation |
|----|----|----|
| Shape recognition feels unreliable to new players | High | Week 3 stranger tests on the webcam bench and the Pico; replay saved hand recordings as regression tests; tolerance slider; physical-outline collision for simple roles |
| No usable wall in the judge's room | High | Tabletop theatre is the default mode |
| IWSDK changes during development (1.0.0 released 24 Sep 2026) | Medium | Pin exact versions; keep gameplay in our own TypeScript so plain three.js with IWSDK's xr-input stays a cheap fallback |
| Fallback (plain three.js + `@iwsdk/xr-input`) not accepted for submission | Medium | Ask on the forum before relying on it; stay on `@iwsdk/core` by default |
| Slow cold start in Quest Browser | Medium | Small initial bundle; stream chapter assets after the lantern appears |
| Anchor persistence unreliable | Medium | Store gallery relative to detected surfaces |
| Scope creep | Medium | One chapter only; feature freeze end of week 6 |
| *Device:* real passthrough and cold start in the headset browser over Wi-Fi | Medium | Report checks `alpha-blend` and time to first XR frame; 717 KB first load (0.5 s at 4× CPU throttle on desktop) |
| *Device:* frame time with shadow and 500 quads at 72/90 Hz | Medium | Report logs frame intervals, frame rate and whether multiview is active (IWSDK requests it; the emulator lacks the extension); re-measure with OVR Metrics once the shadow lands |
| *Device:* hand joint jitter, occlusion and tracking dropouts | High | Report counts partial frames and tracking losses per hand; tune classifier hysteresis from real data |
| *Device:* room-setup planes missing or noisy near the player; plane normal sign | High | Report lists planes with labels, size, distance and normal direction; tabletop default; normal is flipped toward the viewer in code |
| *Device:* persistent anchors across browser restarts | Medium | Report creates, persists and restores a probe anchor; gallery stored relative to detected surfaces if it fails |
| *Device:* self-signed LAN dev cert click-through | Low | Test builds go through GitHub Pages (real HTTPS); ADB port-forward to `localhost` as backup |
| Works on Pico but not on Quest (different browser, tracker and chip) | High | Standard WebXR only, everything feature-detected; Quest check at each milestone and before submission; compare Pico and Quest reports |
| No Quest available before submission | High | Line up a remote Quest tester (or borrow a headset) by week 4 at the latest; the submission checklist requires a fresh Quest 3S test |
