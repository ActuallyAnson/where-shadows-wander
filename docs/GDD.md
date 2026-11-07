# Where Shadows Wander — Game Design Document

## Overview

Where Shadows Wander is a seated, hands-only virtual reality puzzle game: a kid who can't sleep sits up in bed, lights a candle, and plays with the shadows on the bedroom wall, where their hands' shadows help a little traveller wander across a landscape of shadows, until the kid drifts off to sleep.

| Item | Detail |
|----|----|
| Competition | Meta VR Start Developer Competition 2026 |
| Track | Gaming |
| Division | New Experience (built from 24 Sep 2026) |
| Submission deadline | 19 Nov 2026, 4:00am SGT |
| Platform | Meta Quest 3 / 3S, Quest Browser (WebXR, immersive VR) |
| Engine | IWSDK (three.js) for the XR session and emulator; gameplay in our own TypeScript code |
| Input | Hand tracking only; no controller needed. The player's hands are drawn as hand models in the room |
| Session length | 10–14 minutes: one night of five levels (to measure in playtests) |
| Audience | Casual and cozy-game players; people who play seated, on a couch, desk or plane |

### Direction (5 Oct 2026)

The game is set in a **virtual room**, not the player's real one. A lantern on a table lights a wall, the player's hands cast shadows on it, and a traveller walks across it. We chose this because the art and lighting are then the same for every player, nothing depends on finding a table or wall in the real room, and testing is predictable. The costs are that passthrough is not used (the judging criteria reward passthrough that is purposeful, and scene understanding and anchoring, for entries that use them) and that the player's hands, which they can no longer see, must be drawn. The earlier real-room plan (a tabletop theatre or a real wall, in passthrough) is out of v1 and could return as a second mode: the stage code takes any surface, so it would only swap the surface. The passthrough compositing, hand occluder and plane detection already written stay in the repository, switched off for v1.

### Direction (17 Oct 2026): a bedroom at night, and shadows of things that aren't there

The virtual room is a **kid's bedroom at night**. The kid is a little restless and can't fall asleep, so he sits up in bed and plays with shadows on the wall until he drifts off. The tone is cozy and calm, never scary. The game is **one small level, one night**: there are no further nights or chapters to come back for.

The landscape the traveller walks on (hills, ledges, gaps) is made of **shadows cast by invisible props**. Each prop is a simple 3D shape placed in the scene editor (a stack of books, a toy block, a castle) that is never drawn: only its shadow appears on the wall, as if the lantern were lighting things that aren't in the room. Nothing visible stands between the player and the wall, so the shadows are never blocked, and since nobody sees the props, they can change between scenes without anything in the room visibly moving. The hands still cast their shadows from the same lantern, so props and hands share one light and one look.

We chose invisible props over visible ones (proposal in PR #47) because visible props would have to be rearranged between scenes, which breaks the room's realism, and would sit in the way of the wall. We chose them over shapes drawn straight onto the wall because a prop's shadow comes from the same light as the hands, so it has the same perspective, softness and flicker.

### Direction (28 Oct 2026): a candle, the kindred, and no companions

This section brings the GDD in line with the [design worksheet](DESIGN-WORKSHEET.md), which holds the working draft of the night (puzzle curve, hint ladder, story beats, colour script, playtest script, demo storyboard). The GDD records what is settled; the worksheet is where the night's details are proposed and edited first.

- **The light is a candle,** not a lantern. It stands on the bed tray and the player lights it with a small flame carried in the right hand (the lighting ritual).
- **Companions are cut from gameplay.** The rabbit and fox no longer break free as helpers with abilities, and no puzzle needs them: their shapes are the most complicated in the set and the classifier is weakest on them, so a puzzle that needed one would fail players for reasons they can't see. Gameplay uses the four verb shapes only: flat, fist, cup and spread.
- **The kindred** is a small spirit fox made of shadow that lives on the wall. It is a picture only: it flies about, perches, and carries the story beats and hints, but it never touches the puzzle. The rabbit and fox hand shapes are still recognised for a visual flourish (a shadow rabbit hops out of a rabbit hand, a fox hand calls the kindred), with no gameplay role.
- **The night is five levels,** one new idea each, and each level is three puzzles (stages) on its idea, each harder than the last, with a kind hint ladder and no failure (see Puzzles). Each level has a document in [`docs/levels/`](levels/night.md).
- **Wordless story beats and a colour script** frame the night: the room starts cold and warms with each solve, dims once in the middle, and ends warm as the kid falls asleep.

### Design pillars

1.  **Your hands are the toolkit.** Every action is a hand shape. Nothing on screen needs to be pointed at or pressed.

2.  **One room, one light, one wall.** A small bedroom built so nothing competes with the shadows: a candle in front of the kid lights the wall, and the wall is the stage.

3.  **Readable at a glance.** Silhouettes, one light source, one surface. A first-time player understands the scene within seconds.

4.  **Short and complete.** Every session ends on a finished moment, never mid-puzzle.

## Core experience and setup

The player is the kid, sitting up in bed with a bed tray across their lap. A candle stands on the tray; they light it, reach into its light, and their hand shadows land on the bedroom wall in front of them.

### The candle

The candle is the game's only light and its pause button. It stands on the bed tray close to the player, so the hands are always between the light and the stage, which is how real shadow puppetry works. Lighting it is the first action of every session; covering the flame pauses the session.

The current behaviour (`src/engine/render/candle-view.ts`, `title-lighter-view.ts`, starting values to tune in the headset):

- **The lighting ritual:** the room starts cold and dark with the title on the wall. The player's right hand carries a small flame. Holding it, or a fingertip, within about 15 cm of the wick for 3 s grows the flame from a spark to full light, warms the room, dissolves the title and starts the opening.
- **Covering the flame** pauses: one palm hovering just over the flame, or both hands cupped around it, for 3 s. A ring around the flame fills while the hands are there and drains when they leave.
- **The pause menu** appears on the wall itself (Resume, Begin this puzzle again, Settings). A button is chosen by holding a hand's shadow over it for 3 s, or with a pinch.

The pinch-to-place and quick cover gestures (`src/engine/hands/gesture-detector.ts`) are still in the code but no longer drive the session.

### The stage

The stage is a plain, pale patch of the bedroom wall at the foot of the bed, about 2 m in front of the player and about 1.6 m wide (sizes to tune in the headset). It is fixed and known, so there is no surface detection and no fallback: the player gets the same wall every session. The candle stands on the bed tray close to the player, the hands are between the candle and the wall, and the shadows land on the wall. The invisible props that cast the level stand between the candle and the wall too, but are never drawn.

### The room and the hands

- **The room:** a kid's bedroom, small, warm and mostly dark, lit only by the candle. The bed with its tray and the candle, the bare wall ahead, a few quiet objects (a window with the night outside, a shelf where the creature gallery sits, a rug, a few toys). Nothing moves except the flame, a few dust motes and the story. Anything near the shadow area stays light and low-contrast so the black shadows stay readable. The art style is open: flat paper-cut layers, or a richer lit diorama in the manner of Octopath Traveler (without real-time bloom or depth-of-field, which are too costly on a headset).

- **The hands:** in VR the player cannot see their real hands, so the game draws a hand for each tracked hand, following the 25 joints. The look is open (a dark paper-cut glove or a simple stylised hand). Rules: always visible while tracked, simple and low-detail rather than realistic, never covering the shadow area, fading out when tracking is lost with a gentle "show me your hands" cue. While no hand is tracked the world holds still, so nothing falls apart while the player's hands are out of view; a dropout shorter than half a second changes nothing. The shadow is cast from the tracked joints, not from the hand model, so the model can look any way without changing the game.

- **Comfort:** seated, a fixed viewpoint, no locomotion, a steady floor and horizon.

### Light geometry

A physically accurate point light makes shadow size swing wildly with wall distance. Where Shadows Wander fakes it: the projection is blended toward orthographic so a hand always casts a shadow of a fixed, readable size on the stage. The candle flame still flickers and the shadow edges still soften with hand distance, so it feels real without behaving unpredictably. The invisible props are projected the same way, so their shadows match the hands'.

## Gameplay

The player helps a shadow traveller walk from one side of the stage to the other by making a small set of recognised hand shapes, each of which does one thing in the world.

### The traveller

A small silhouette figure with a lantern-lit cloak. It walks on its own and stops at obstacles, then waits and looks back at the player. The player never controls it directly; they change the world around it. (Who the traveller is in the story is still open: one of the kid's toys, his dream self, or a little creature that lives in the wall's shadows. So is whether its little lantern is the story's second light, which would tie the rain puzzle to the candle.)

The traveller never dies and the player never fails. If it falls, it is put back on the last ledge, with no counter and no message (a proposal in the worksheet).

### The kindred

A small spirit fox made of shadow that lives on the wall (`src/engine/shadow/pure/kindred.ts`). It drifts in slow loops, circles the light, perches on a spot and shies away when startled. It is a picture only and never touches the puzzle or the collision solver. It carries the wordless story (it drifts in at the opening, hides during the dimming, returns at the end) and is one rung of the hint ladder (it perches where the wanted shape goes).

### The landscape: shadows of invisible props

The ground the traveller walks on is the shadow of props that are never drawn.

- **Props are simple 3D shapes** placed in the scene editor between the candle and the wall, in the shapes of bedroom things: books, toy blocks, a toy castle, a teacup. Their shadows read as a landscape: a stack of books becomes a ledge, two blocks with space between them a gap.
- **Only the shadow is shown.** A prop's shadow is projected from the candle onto the wall like a hand's, drawn black, and turned into collision terrain for the traveller when a scene starts. A prop that doesn't move costs nothing per frame.
- **Props can change without breaking the room.** Between scenes the set of props changes, and the wall shows the next part of the landscape. Because the props are invisible, nothing in the room is seen moving. A prop may also move during a scene (a shadow that sways or slides) when a puzzle needs it.
- **The hands stay the only thing the player changes.** The player never moves a prop.
- **Level design works backwards:** sketch the shadow landscape the puzzle needs, then place props whose shadows make it. Block-like props (books, blocks, boxes) make most of it; odd shapes are landmarks. Where a shadow is almost right, a scene may add a little invisible terrain.

### Shape vocabulary (v1)

Only a fixed set of one-handed shapes is recognised. Two-handed shapes are left out because overlapping hands are where hand tracking is least reliable.

| Shape | How to make it | What it does |
|----|----|----|
| Flat hand | Palm down, fingers together | Becomes a bridge or platform the traveller walks on |
| Fist | Closed hand | Becomes a rock that pushes, weighs down, or breaks things |
| Cup | Palm up, fingers curled | Catches rain, embers, or fireflies and carries them |
| Spread | Fingers spread wide | Blocks wind, holds back vines, forms a cage |
| Rabbit | Index and middle up, others pinched to thumb | No gameplay role: a shadow rabbit hops out of the hand |
| Fox | Fingers together, thumb up as an ear (the thumb out to the side like an L, with the hand turned so it points up) | No gameplay role: calls the kindred |

The four verb shapes are the whole gameplay vocabulary: simple and bold, so no puzzle needs a fine finger gap or a thin shape. The two animal shapes are a visual flourish to discover; whether they stay is the visual side's call (Anson).

### How a shape is used

1.  The shadow always mirrors the live hand, so the player sees their real silhouette.

2.  When a shape is recognised, its shadow sharpens and a soft paper rustle plays.

3.  Holding the shape for about 0.4 seconds commits it, and the shadow takes on its role (a rock gains weight, a bridge gains a plank texture).

4.  Releasing the shape returns the shadow to a plain hand.

Simple physical roles (bridge, rock) use the shadow's actual outline for collision, so slight variations still work. Special actions (catching, the windbreak) require the exact recognised shape.

### Puzzles

The night is five levels in the kid's bedroom, each standing on the shadows of a few invisible props. Each level brings **one new idea, never two at once**; the last combines them. A level's first stage teaches its idea exactly as the table below describes. The level then has two more stages (see "Levels and stages" below). Every puzzle has one intended solution and one alternative (except the tutorial), a kind hint, and a reward the player can see. Every puzzle can be finished with one hand. Times are targets for a first-time player.

| \# | Puzzle | Obstacle | New idea | Intended solution | Alternative | Target time |
|----|----|----|----|----|----|----|
| 1 | **The books** (tutorial) | A gap between two stacks of books | Your shadow is a bridge | Flat-hand bridge | — (ghost outline from the start) | 45 s |
| 2 | **The ledge** | The books stop short of the bedside table, which is too tall to step up | Shapes can be a step | A fist in the gap, lifted with the traveller standing on it | A flat hand lifted the same way | 60 s |
| 3 | **The dripping plant** | A freshly watered plant drips on the traveller's lantern | Shapes can shelter | Cup to catch the drips | Flat hand as a roof | 60 s |
| 4 | **The fan** | A desk fan blows the traveller back | Shapes can block | Spread hand as a windbreak | Fist as an anchor | 60 s |
| 5 | **The castle** (last) | A moat, and a shut castle gate with a counterweight | Combine what you learned | Flat bridge over the moat and a fist on the counterweight, in either order | (the other order) | 90 s |

#### Levels and stages

The first stages alone were too simple, so each level has three stages on its idea, each harder than the last. The second stage asks more of the idea; the third combines it with an idea from an earlier level, one obstacle after the other, so one hand is still enough.

| Level | Stage 1 (teaches) | Stage 2 (asks more) | Stage 3 (combines) |
|----|----|----|----|
| 1 The books | The books: one gap | Stepping stones: two gaps, one hand moved from the first to the second | The wide gap: wider than a hand, so the traveller is carried across (a fist carries too) |
| 2 The ledge | The ledge: one lift | The stair: two lifts, the table then the dresser | The bridge and the step: a gap to bridge, then a step to lift |
| 3 The dripping plant | One plant, a cover held still is enough | The hanging plant: a long, swaying strip of drips; the cover must go along with the traveller | Drips and a gap: shelter, then a bridge |
| 4 The fan | One fan | Two fans: a small one, a calm, then a big one that blows harder | The fan and the step: through the wind, then a lift onto the table |
| 5 The castle | Moat and gate, either order | The wide moat: carried over, and the counterweight | The keep: moat, gate, then a step up to the keep's door |

The room's story beats belong to levels, not stages: the travel scene, the scenery, the line on the wall, the sleeper waking and the wall warming all happen once per level. A stage solved inside a level gets the chime and the reward, and the next stage's props swap in after the outro.

The layouts (props, positions, triggers, hints and cutscenes) are in the level documents: [the night](levels/night.md) and one per puzzle. The worksheet keeps the reasoning and the questions still open.

Hands rest on the tray between puzzles; no puzzle needs a hand held up for long except the drips and the wind, which take about 10 to 15 seconds each.

What happened to the earlier ideas:

| Earlier idea | Verdict | Why |
|----|----|----|
| Gap | The books | The tutorial, unchanged in play |
| Rain | The dripping plant | Rain in a bedroom reads oddly; a watered plant dripping off the shelf is the same puzzle |
| Wind | The fan | A desk fan is the bedroom's wind |
| Wide chasm (rabbit), later bed to toy box | Cut | Without the rabbit it needed two hands (two bridges end to end), against the one-handed rule |
| Crows (fox) | Cut | Crows don't belong indoors, and the cup is already used for the drips |
| Gate with a weight plate | The castle | Becomes the finale, combined with a moat |
| — | The ledge (new) | Teaches the fist before the finale needs it |

### Kind failure: the hint ladder

The player is never told they failed, and nothing is ever said in words. If a puzzle stays unsolved, help arrives in steps:

1.  **0–20 s:** nothing; let them try.
2.  **20 s:** a faint outline of the wanted shape where it goes (the ghost target).
3.  **40 s:** the kindred flies to the spot and perches on it.
4.  **70 s:** the traveller waits and looks back at the player.
5.  **100 s:** the outline pulses and the obstacle eases (the wind drops, the gap narrows).

The tutorial shows the outline from the start, and a puzzle may start a rung later (puzzle 5's outline waits 30 s).

### The night

The whole game is one night of five levels, three stages each, about 10–14 minutes. Each stage is a scene; the traveller walks from one level's land into the next. It ends with the kid falling asleep: the traveller reaches a lit window, the candle burns low, and the room settles into sleep. There are no further nights or chapters.

### Story beats

The story is told without words (only a title and a few short captions), each beat under 15 seconds and skippable.

| Beat | When | What happens |
|----|----|----|
| Opening | the candle is lit | The title appears on the wall, the kindred drifts in out of the dark, "Hold your hands to the light". Built (`src/app/opening.ts`); the text is a placeholder. |
| The dimming | between puzzles 3 and 4 | The light gutters, the kindred hides, the room goes cold. |
| The return | puzzle 5 solved | The kindred returns, the room fills with light, the traveller reaches the lit window. |
| The end | after the window | The candle burns low, the kindred flies to the traveller, the kid falls asleep, "The End". Built (`src/app/ending.ts`). |
| Chapter card | as each level after the first begins | The level's number and sleeper ("II · The bunting") on the wall, the kindred leading the way in (not while it is away). About 4.5 s. Built (`src/game/story.ts`). |
| The sleeper stirs | between two stages of a level | The level's sleeper stirs (stage 1 solved) and half wakes (stage 2) in a caption, while the kindred sweeps across the new land, or once it has fled a paper bird. About 6.5 s. Built (`src/game/story.ts`). |

**The story (6 Nov 2026).** The room dreams every night, but tonight its dreams have sunk too deep to wake, and the traveller carries the one spark left to wake the five sleepers: the lamp, the bunting, the pictures, the globe and the window. Each level is one sleeper, and it takes all three of its stages to wake it: it stirs, it half wakes, it wakes. Every stage has a line of its own, said a moment after it appears (what lies in the way, told as story, never as an instruction). Between scenes there is always something: the stir interlude between stages, the travel scene and the chapter card between levels. The game holds still while one plays, and each can be skipped.

Still open: what the last scene's lit window is, and whether the kindred leads the traveller there.

### Colour script

The paper wall has a mood value from 0 (cold, blue-grey) to 1 (warm amber) that the game sets. The room is cold when the candle is first lit and warms with each solved puzzle: 0.4 at the start, then 0.55, 0.7 (the dimming takes it back to 0.45), 0.85 and 1.0. During the ending it settles to a dim, quiet 0.3.

## Player journey

A first-time player should be solving their first puzzle within 60 seconds of launching, without reading a word of instruction.

### First five minutes

1.  **0–10 s:** The headset fades in on the kid's bedroom at night, cold and dark, with the title on the wall. The player sits up in bed; an unlit candle stands on the bed tray in front of them, and a small flame glows in their right hand.

2.  **10–25 s:** The player brings the flame to the wick and holds it there; over 3 s the candle catches, the room warms and the title dissolves. The opening plays: the kindred drifts in, "Hold your hands to the light", and the first shadow landscape appears.

3.  **25–40 s:** The player's hand shadows appear on the wall. They wave and see their shadow move. No prompt is needed.

4.  **40–90 s:** The traveller walks in and stops at a gap. A faint ghost outline of a flat hand appears over the gap. The player matches it, and the traveller crosses.

5.  **90 s–5 min:** Puzzles 2–4, with the dimming between 3 and 4. Help follows the hint ladder: the outline only appears after 20 seconds.

### Session flow

- **Start:** Light the candle. Returning players resume where they left off.

- **Play:** Puzzles in sequence; each is a single screen.

- **Pause:** Cover the flame with one or both hands for 3 s (or remove the headset). Progress saves immediately. The pause menu appears on the wall.

- **Resume:** Choose Resume on the wall menu. The scene fades back in at the same puzzle; "Begin this puzzle again" restarts it.

- **End:** The kid falls asleep: the ending plays and "The End" appears, with "Begin again" to start a new night.

### Reason to come back

The game is one short night, so coming back is about doing it differently, not about new content:

- The room keeps a gallery of the creatures the player has discovered, shown as paper figures on a shelf and saved in the browser. (With companions cut, what fills the gallery is open: the shadow animals and the kindred are the candidates.)

- Each puzzle tracks which solutions the player has found, encouraging replays to find the alternative.

## Art and audio direction

The whole game is black silhouettes on a warm, candle-lit wall, a style that looks finished with a small team and few assets.

### Visual style

- **Palette:** Deep black shadows, warm amber light (around 2200 K feel), cream paper. Accent colour only for magical moments (firefly green, ember orange).

- **Shapes:** Hand-cut paper look: slightly irregular edges, visible fibres in the paper texture.

- **Motion:** Characters animate like rod puppets, with a little stiffness and bounce rather than smooth realism.

- **Lighting:** The only bright object in the scene is the candle. Its gentle flicker drives a subtle shimmer across the wall and the room.

  The flicker (`src/engine/shadow/pure/lantern-flicker.ts`, `lantern-light.ts`) is slow and calm: two sine waves and a little noise, all under 4 Hz, with at most a 0.11 change from one frame to the next at 72 Hz, so it never strobes. At full strength it swings the flame's brightness by plus or minus 8 % and reddens it slightly when it dips; the paper brightens and dims with it and warms toward the flame's colour. Shadows stay pure black, and the point the shadows are cast from stays still, so shadows and collision never shimmer. The flicker amount is a setting (0 to 1, `?flicker=` in the address, 0 is a steady light); it starts at 0.3 when the device asks for reduced motion.

- **Room:** Dark and warm towards the edges so the lit wall and the shadows dominate; scenery near the shadow area stays light and low-contrast so the shadows stay readable. Its warmth follows the colour script.

### Audio

- **Ambience:** Crackling flame close to the player, quiet night sounds (crickets, distant wind) from the stage.

- **Feedback:** A paper rustle when a shape is recognised; a soft thump when it commits; a chime when a puzzle is solved.

- **Music:** Sparse plucked strings or music box, a short lullaby-like motif that resolves as the kid falls asleep.

- **Spatial:** Sounds originate from where they happen on the stage, so the player can hear the traveller arrive before seeing it.

## Technical design

Where Shadows Wander is a 2D game running on a single plane in 3D space, which keeps rendering cheap and lets any surface (the virtual wall now, a real table or wall in a possible later mode) share all game code.

### Architecture

The decisions are recorded in [ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md) and [ADR 0002](adr/0002-plain-threejs-fallback.md).

- **IWSDK** provides the XR session, the emulator and possibly spatial audio. Nothing else. (Scene understanding, planes and anchors are not used in the virtual room.)
- **Gameplay and simulation never import IWSDK or three.js.** They are plain TypeScript, and a build check enforces this.
- **View layer:** plain three.js objects (`InstancedMesh`, custom shaders). IWSDK's ECS is used only where it clearly saves work.
- **Loop:** the simulation runs on our own fixed-timestep loop, driven by a single IWSDK system once per display frame.
- **Versions:** IWSDK is pinned to exactly 1.0.0, and three.js is IWSDK's `super-three@0.181.0` fork. There is never a second copy of three.
- **Fallback:** plain three.js + `@iwsdk/xr-input`. The entry file is about 54 lines and was tested in the emulator; see ADR 0002.

### Test devices

We don't have a Quest yet; we have a Pico. Details are in [ADR 0003](adr/0003-pico-as-stand-in-test-device.md).

- **Develop on the Pico, confirm on a Quest.** Working on Pico means it will probably work on Quest, but only a Quest run proves it. A Quest check (remote tester or a borrowed headset) closes each milestone that matters, and always comes before submission.
- **Build to the WebXR standard, not to one headset.** Every XR feature is optional and feature-detected. Nothing may work on one headset and break on the other.
- **Testing order:** IWER emulator for logic, the webcam hand bench for hand shapes, Pico for real-device behaviour, Quest for final confirmation.
- **Hand data on the Pico:** works in Wolvic Chromium 1.4 (a sideloaded build, not the Pico Store's Wolvic), in a VR session that asks only for `local-floor`, `bounded-floor` and `hand-tracking`; the headset rejects anchors, plane and mesh detection and projection layers. PicoBrowser 3.3 (Chrome 105) and the Pico Store's Wolvic (Gecko) give no joints. See [ADR 0003](adr/0003-pico-as-stand-in-test-device.md). Meta documents WebXR hand input as supported in Quest Browser; still to confirm on a Quest.
- **Hand data without a headset:** the webcam hand bench (`webcam.html`) tracks hands from a laptop camera and converts them to the same 25-joint data the game reads. Headset sessions and the bench can both save hand recordings for replay in tests and in the Hand Recording Player. See [ADR 0004](adr/0004-webcam-bench-and-hand-recordings.md).

### Stack

| Area | Choice |
|----|----|
| Engine | IWSDK (three.js) for the XR session and emulator; gameplay in our own TypeScript code |
| Session | immersive-vr, seated (local-floor reference space) |
| XR features | Hand tracking; nothing else is needed in the virtual room |
| 2D physics | Lightweight 2D library or a small custom solver in plane space |
| Hosting | Static HTTPS site on GitHub Pages, deployed by the Actions workflow (classic Jekyll Pages drops IWSDK's `_virtual_*` chunk), opened in Quest Browser |
| Performance | Minimum 60 fps (judging requirement), target 72 fps |

### Plane-space game

1.  The stage plane is the fixed virtual wall: its position, size and orientation are known when the room is built.

2.  Build a 2D coordinate frame on that plane (origin, right axis, up axis, scale).

3.  Each frame, project every hand joint from the candle flame onto the plane, giving 2D points.

4.  When a scene starts, project each invisible prop from the candle flame onto the plane the same way, and turn its shadow outline into terrain (re-projected only for a prop that moves).

5.  Run all gameplay (traveller, obstacles, the kindred, collisions) in this 2D space.

6.  Render 2D game objects as flat quads placed on the plane.

Because the wall is fixed there is no detection step and no fallback. A real table or wall (a possible later mode) would only supply a different plane frame; all gameplay code is identical.

### Shadow rendering

- A copy of each hand mesh is flattened onto the stage plane with a planar projection matrix and drawn solid black.

- The invisible props are flattened the same way, with the same projection, and drawn solid black; the props themselves are never drawn. A prop that doesn't move can be flattened once when its scene starts.

- The projection blends between perspective (from the candle flame) and orthographic to keep shadow size stable.

- A small blur on the shadow edge, scaled by the hand's distance from the plane, gives a soft, natural edge.

- Recognition sharpens the shadow (`src/engine/shadow/pure/shadow-sharpen.ts`): per hand, the edge blur shrinks and the shadow darkens a little as the hold fills (up to 70 % of the effect at the end of the hold), snaps to its crispest on commit with a brief extra pulse, and relaxes within about three quarters of a second on cancel or release. The shadow's shape and collision capsules never change, only how its edge is drawn; the edge never gets narrower than a pixel. `strength` (0 to 1, default 1) is the setting for accessibility (0 turns it off) and the other values are in `DEFAULT_SHARPEN_SETTINGS`. The paper rustle and the thump belong to audio: play the rustle on a ShapeEvent `candidate` and the thump on `commit`.

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
| Flat | mean curl ≤ 0.19 and no finger above 0.35, spread ≤ 18°, palm facing the stage (palm · stage normal ≤ −0.5), thumb within 50° of the fingers |
| Fist | every finger curl ≥ 0.65 |
| Cup | every finger curl 0.15–0.6, palm facing away from the stage (≥ 0.5) |
| Spread | mean curl ≤ 0.19 and no finger above 0.35, index–pinky spread ≥ 25° |
| Rabbit | index and middle curl ≤ 0.25, ring and pinky ≥ 0.4, thumb tip within 0.35 hand lengths of the ring or pinky tip and at least 0.4 from the index tip |
| Fox | mean curl ≤ 0.19 and no finger above 0.35, spread ≤ 18°, thumb ≥ 38° from the fingers, palm facing sideways (palm · stage normal −0.7 to 0.7) |

Each feature has a tolerance unit (0.1 curl, 5° spread, 0.15 palm dot, 8° thumb angle, 0.08 hand lengths). The tolerance slider (1 to 3) widens every range by whole units; hysteresis keeps a committed shape for one more unit. A shape is only picked if it leads any other matching shape by a quarter of a unit.

- Each shape is a set of ranges on these features, hand-tuned and tested on several people. Shapes are worked out on the webcam hand bench, then thresholds are checked against headset recordings, because webcam depth and noise differ from a headset's.

- A shape must match continuously for about 0.4 s to commit (1 s for the animal shapes). Each shape emits `candidate` (recognised: the shadow starts sharpening), then `commit` or `cancel`, and later `release`.

- Hysteresis: once committed, a shape stays active until features move clearly outside its range, preventing flicker. If the hand drifts out of the committed shape's normal range into another shape, the new shape replaces it only when it commits, so there's no gap between roles.

- Low tracking confidence pauses recognition rather than guessing: with any joint missing the hold freezes; after 0.2 s a held shape is cancelled, after 0.5 s a committed one is released.

### Persistence

- Progress through the night, discovered creatures and solutions found are saved in browser storage.

- The room needs no spatial anchors: it is the same every session.

### Open questions

- [x] Which Pico do we have? A Pico 4 (OS 5.13.8, PicoBrowser 3.3.54); see ADR 0003.

- [ ] Confirm on the Meta Developer Forum that an IWSDK WebXR link with gameplay in our own code is an acceptable submission. Also ask about the plain three.js + `@iwsdk/xr-input` fallback, which may raise the same question Babylon.js did.

- [ ] Confirm hand tracking in an immersive-vr session on the Quest Browser, and why the Pico delivers hands to the WebXR sample but not to our page.

- [ ] Decide the hand look (paper glove or a simple stylised hand) and the room art style.

- [ ] Decide who the traveller is in the bedroom story (one of the kid's toys, his dream self, or a creature of the wall's shadows).

- [x] How many puzzles the night has: five, one new idea each (see Puzzles and the design worksheet).

- [x] Write a level document per puzzle and the cutscenes between them: [`docs/levels/`](levels/night.md).

- [ ] Is the traveller's lantern the story's second light? What is the last scene's lit window, and does the kindred lead the traveller there?

- [ ] What fills the creature gallery now that companions are cut (the shadow animals, the kindred, or nothing)?

- [ ] Decide how the editor shows a prop's shadow while it is placed, so levels can be designed by eye.

- [ ] Ask the organisers how a VR-only entry (no passthrough, no scene understanding) is scored under Technical implementation, since that criterion names them for entries that use them.

- [ ] Measure cold-start load time on Quest Browser; target under 5 seconds to the candle.

## Accessibility and comfort

Every puzzle can be finished seated, with one hand, within a two-foot radius.

- **One-handed play:** All v1 shapes are one-handed; the player can switch which hand they use at any time.

- **Settings screen:** One panel in the room, pressed with a fingertip (poke), no controller path, two pages, every setting explained in one line, changes apply live and are saved ([ADR 0011](adr/0011-accessibility-settings.md)).

- **Shape tolerance slider:** Widens recognition ranges for players with limited finger mobility.

- **Hand calibration:** The player holds each hand flat for 2 seconds and finger curl is measured from their own straight, for fingers that don't fully straighten (`src/engine/hands/hand-calibration.ts`; onboarding can run it).

- **Hold time setting:** Commit time adjustable from 0.2 s to 1.0 s (default 0.4 s; the animal shapes take 2.5 times as long, so 1 s by default).

- **Shadow size slider:** Makes shadows larger for low-vision players.

- **High-contrast mode:** Pure black on bright white stage, no paper texture. Built: the wall is pure white, fully lit and opaque, the shadows fully solid, and the settings panel itself is black on white; the room art must read `settings.value.highContrast` and drop its paper texture.

- **Captions:** The traveller's sounds and story beats have optional text captions. The setting exists and is saved; nothing shows captions until story beats exist.

- **Main hand:** The panel opens beside the chosen hand. Both hands always work, so a one-handed player is never locked out by the choice.

- **Comfort:** No artificial locomotion, no camera movement, nothing that requires standing or turning around.

- **Arm fatigue:** Puzzles are designed so hands rest on or near the bed tray between actions.

## Competition fit

Where Shadows Wander targets Best New Gaming Experience (\$100,000), with Boldest Original Concept and Best First Five Minutes as the strongest special-award chances. The organisers' rules, judging criteria, dates and links are summarised in [COMPETITION.md](COMPETITION.md).

### Requirements and guidelines

| Rule | How Where Shadows Wander meets it |
|----|----|
| Hands-first, completable without a controller | Hands are the only input; no controller code path is needed |
| Seated-optimised (airplane seat test) | All play happens seated (the kid sitting up in bed in a virtual bedroom), with the wall in view and the hands within reach |
| Passthrough (judged for purpose if used) | Not used. The entry leans on hands-first design, the first five minutes, accessibility and polish instead |
| Easy in and out (one bus stop test) | Light the candle to start, cover the flame to pause, a 5–8 minute night |
| Original, not a wrapper (take it away test) | All gameplay is built in-house; no third-party service |
| New Experience division | Codebase started on or after 24 Sep 2026 |

### Special awards

| Award | Why Where Shadows Wander fits |
|----|----|
| Boldest Original Concept | Your own hands' shadows as the only controls, in a candle-lit shadow theatre. (This award favours ideas that depend on real-world presence, so a virtual room is a weaker fit than the original real-room plan.) |
| Best First Five Minutes | No instructions; lighting the candle is a ritual, and the first puzzle is solved by instinct |
| Best Accessibility Forward Experience | One-handed play, tolerance and hold-time settings, high-contrast mode |
| Best Reason to Come Back | A persistent creature gallery and alternative solutions to find. (A weaker fit now that the game is one night with no further chapters and no companions.) |

### Submission checklist

- [ ] Playable WebXR link hosted and tested on a fresh Quest 3S

- [ ] The person submitting has joined the Meta VR Start Program, and everyone on the team is 18 or older

- [ ] Devpost: track Gaming and division New Experience selected; video is public on YouTube or Vimeo

- [ ] The deployed page stays up until the winners are announced (about 11 Dec) and is not changed after 18 Nov 12:00 PM Pacific (19 Nov 4:00 AM Singapore)

- [ ] Demo video under 3 minutes, best shot (the shadow story on the lit wall) in the first 10 seconds (storyboard in the design worksheet)

- [ ] Tagline under 140 characters

- [ ] Description under 500 words: inspiration, how it was built, future plans

- [ ] Hand interactions write-up

- [ ] Target launch date

## Scope, milestones and risks

v1 is one polished night: five puzzles, 4 verb shapes, the kindred as a visual guide, with features frozen at the start of week 7.

### In scope / out of scope

| In v1                           | Later                               |
|---------------------------------|-------------------------------------|
| One night of five puzzles       | More levels                         |
| 4 verb shapes, the kindred (visual only) | Two-handed shapes (bird, butterfly); companions with gameplay abilities |
| Bedroom with a wall stage and invisible-prop landscape | Multiplayer shadow duets |
| —                               | Real-room mode (table or wall in passthrough) |
| Creature gallery                | Player-made shadow stories          |
| Accessibility settings          | Localisation                        |

### Milestones (7 weeks to 19 Nov)

1.  **Week 1 (to 8 Oct):** IWSDK WebXR shell: hand tracking in a VR session, a placeholder room, lantern placement. Run it on the Pico (through Wolvic if PicoBrowser gives no hands) and collect its diagnostics report and a hand recording. Host the build on GitHub Pages (HTTPS) and, if a remote Quest tester is available, have them send a report too. Confirm submission rules.

2.  **Week 2 (to 15 Oct):** Planar shadow rendering on the wall and the 2D plane-space game layer.

3.  **Week 3 (to 22 Oct):** Pose classifier for the 4 verb shapes with hold-to-commit and hysteresis. Develop on the webcam hand bench, check against Pico recordings, and test with at least 3 other people (the bench works on any laptop).

4.  **Week 4 (to 29 Oct):** Traveller, invisible-prop shadows as terrain, and the first puzzles of the night, including the wordless tutorial.

5.  **Week 5 (to 5 Nov):** The remaining puzzles, the hint ladder, the story beats (the dimming, the return) and the ending (the kid falls asleep), saved gallery.

6.  **Week 6 (to 12 Nov):** The bedroom and hand models, art, audio, onboarding polish, accessibility settings. Feature freeze at end of week.

7.  **Week 7 (to 19 Nov):** Testing on the Pico and Quest in different lighting (hand tracking depends on it), performance, demo video, submission form.

### Risks

Everything in the IWSDK spike ran in the emulator only. The rows marked *Device* need a real headset. The Pico answers them first, but only a Quest run confirms them for the judges' device (see Test devices).

| Risk | Impact | Mitigation |
|----|----|----|
| Shape recognition feels unreliable to new players | High | Week 3 stranger tests on the webcam bench and the Pico; replay saved hand recordings as regression tests; tolerance slider; physical-outline collision for simple roles |
| Judging favours passthrough, scene understanding and anchors, which a VR-only entry does not use | High | Lead with hands-first design, accessibility, polish and the first five minutes; ask the organisers; keep the real-room mode as a possible later addition |
| IWSDK changes during development (1.0.0 released 24 Sep 2026) | Medium | Pin exact versions; keep gameplay in our own TypeScript so plain three.js with IWSDK's xr-input stays a cheap fallback |
| Fallback (plain three.js + `@iwsdk/xr-input`) not accepted for submission | Medium | Ask on the forum before relying on it; stay on `@iwsdk/core` by default |
| Slow cold start in Quest Browser | Medium | Small initial bundle; stream the rest of the assets after the candle appears |
| Hand models look wrong or hide the shadows | Medium | Keep them simple, dark and low-detail; the shadow comes from the joints, not the model; check on the headset |
| Scope creep | Medium | One night only; feature freeze end of week 6 |
| Designing levels from prop shadows is slow | Medium | Design backwards from the shadow landscape; mostly block-like props; see each prop's shadow while placing it; allow a little invisible terrain where a shadow is almost right; prototype one puzzle first |
| *Device:* cold start in the headset browser over Wi-Fi | Medium | Report records time to first XR frame; 717 KB first load (0.5 s at 4× CPU throttle on desktop) |
| *Device:* frame time with shadow and 500 quads at 72/90 Hz | Medium | Report logs frame intervals, frame rate and whether multiview is active (IWSDK requests it; the emulator lacks the extension); re-measure with OVR Metrics once the shadow lands |
| *Device:* hand joint jitter, occlusion and tracking dropouts | High | Report counts partial frames and tracking losses per hand; tune classifier hysteresis from real data |
| *Device:* hand joints depend on the browser: on the Pico only Wolvic Chromium (sideloaded) delivers them, and only when the session asks for little | Medium | The session asks for just the three features (in the launcher); Quest Browser is documented to support hand input; confirm on a Quest |
| The bedroom and hand models are more art work than flat paper | Medium | A small room, few assets, free CC0 assets where licensing allows, flat silhouettes for everything near the shadows |
| *Device:* self-signed LAN dev cert click-through | Low | Test builds go through GitHub Pages (real HTTPS); ADB port-forward to `localhost` as backup |
| Works on Pico but not on Quest (different browser, tracker and chip) | High | Standard WebXR only, everything feature-detected; Quest check at each milestone and before submission; compare Pico and Quest reports |
| No Quest available before submission | High | Line up a remote Quest tester (or borrow a headset) by week 4 at the latest; the submission checklist requires a fresh Quest 3S test |
