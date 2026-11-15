# Where Shadows Wander — Game Design Document

## Overview

Where Shadows Wander is a seated, hands-only virtual reality story about grief and comfort. A boy who has recently lost his best friend, a girl, wakes in the middle of the night and can't get back to sleep. He lights a candle, and in shadow play on the bedroom wall he goes back through the memories he shared with his friend. The player moves each memory along by making a hand shape, and when the memories are done, the boy can sleep again.

| Item | Detail |
|----|----|
| Competition | Meta VR Start Developer Competition 2026 |
| Track | Gaming |
| Division | New Experience (built from 24 Sep 2026) |
| Submission deadline | 19 Nov 2026, 4:00am SGT |
| Platform | Meta Quest 3 / 3S, Quest Browser (WebXR, immersive VR) |
| Engine | IWSDK (three.js) for the XR session and emulator; the game in our own TypeScript code |
| Input | Hand tracking only; no controller needed. The player's hands are drawn as hand models in the room |
| Session length | To be decided with the story (to measure in playtests) |
| Audience | Players of short narrative and cozy games; people who play seated, on a couch, desk or plane |

### Direction (5 Oct 2026): a virtual room

The game is set in a **virtual room**, not the player's real one. A candle lights a wall and the player's hands cast shadows on it. We chose this because the art and lighting are then the same for every player, nothing depends on finding a table or wall in the real room, and testing is predictable. The costs are that passthrough is not used (the judging criteria reward passthrough that is purposeful, and scene understanding and anchoring, for entries that use them) and that the player's hands, which they can no longer see, must be drawn. The earlier real-room plan (a tabletop theatre or a real wall, in passthrough) is out of v1 and could return as a second mode: the stage code takes any surface. The passthrough compositing, hand occluder and plane detection already written stay in the repository, switched off for v1.

### Direction (17 Oct 2026): a bedroom at night

The virtual room is a **kid's bedroom at night**. The kid is a little restless and can't fall asleep, so he sits up in bed and plays with shadows on the wall until he drifts off. The tone is cozy and calm, never scary. The light is a candle on the bed tray, lit with a small flame carried in the right hand.

*The bedroom, the night and the candle stay. The reason he is awake, and the tone, changed on 12 Nov 2026 (below).*

### Direction (11 Nov 2026): a story in shadow puppets

The game was a physics puzzle: a little traveller walked across the wall and the player's hand shadows became bridges and walls for it. In the headset it felt bland, so the puzzles are gone ([ADR 0016](adr/0016-story-shadow-theatre.md)). What worked was the candle, the room and seeing your own hands' shadows on the wall, and the new direction builds on that.

- **The wall shows a story,** played as a shadow-puppet theatre in detail.
- **The puppets are 2D cut-outs** (silhouette art in parts, with pivots) placed between the candle and the wall and cast from the flame, so their shadows grow, blur and flicker like real ones.
- **The player moves the story on** by making a named shape with their hands when the story asks for one.
- **The room, the candle, the hand shadows and the cover-flame pause stay** as they are.

### Direction (12 Nov 2026): a night of remembering

The story now has a premise. The boy has recently lost his best friend. He wakes suddenly in the middle of the night and can't get back to sleep. He lights the candle and, through the shadow play, goes back through the memories they shared. By the end the shadow play lets him rest, and he falls asleep.

- **The theme is grief and comfort.** The game does not try to fix the loss. It is about the night when remembering stops hurting and starts to help.
- **The tone is tender and bittersweet, never bleak or frightening.** It stays as warm as the cozy bedroom it replaces, but now there is something underneath.
- **The shadow play is how he remembers.** Each memory is a scene on the wall, and the hand shapes the player makes are what bring the memories back.
- **The ending is sleep.** The session ends when the boy can rest, and that is what the game is building towards from its first moment.

The shadow play itself (the scenes, the shapes they ask for, and the puppets) is not final. The sections below say which parts are settled and which are proposals.

### Design pillars

1.  **Your hands are the toolkit.** Every action is a hand shape. Nothing on screen needs to be pointed at or pressed.

2.  **One room, one light, one wall.** A small bedroom built so nothing competes with the shadows: a candle in front of the kid lights the wall, and the wall is the stage.

3.  **Readable at a glance.** Silhouettes, one light source, one surface.

4.  **Short and complete.** Every session ends on a finished moment: the boy falls asleep.

5.  **Gentle with grief.** The loss is felt through absence and memory, never shown. Nothing on the wall should shock or upset the player, and no one is ever made to fail.

## Core experience and setup

The player is the boy, sitting up in bed with a bed tray across their lap after waking in the night. A candle stands on the tray; they light it, reach into its light, and their hand shadows land on the bedroom wall in front of them. The VR title is the moment of waking: the title fades to black, and the room fades in, dark and cold, before the candle is lit.

### The candle

The candle is the game's only light and its pause button. It stands on the bed tray close to the player, so the hands are always between the light and the stage, which is how real shadow puppetry works. Lighting it is the first action of every session; covering the flame pauses the session.

The current behaviour (`src/engine/render/candle-view.ts`, `title-lighter-view.ts`, starting values to tune in the headset):

- **The lighting ritual:** the room starts cold and dark with the title on the wall. The player's right hand carries a small flame. Holding it, or a fingertip, within about 15 cm of the wick for 3 s grows the flame from a spark to full light, warms the room and dissolves the title.
- **Covering the flame** pauses: one palm hovering just over the flame, or both hands cupped around it, for 3 s. A ring around the flame fills while the hands are there and drains when they leave.
- **The pause menu** appears on the wall itself (Resume, Settings). A button is chosen by holding a hand's shadow over it for 3 s, or with a pinch.

The session has three states: the VR title, playing (the candle lit, the shadows on), and paused.

### The stage

The stage is a plain, pale patch of the bedroom wall at the foot of the bed, about 2 m in front of the player and about 1.6 m wide (sizes to tune in the headset). It is fixed and known, so there is no surface detection and no fallback: the player gets the same wall every session. The candle stands on the bed tray close to the player, the hands are between the candle and the wall, and the shadows land on the wall.

### The room and the hands

- **The room:** a kid's bedroom, small, warm and mostly dark, lit only by the candle. The bed with its tray and the candle, the bare wall ahead, a few quiet objects (a window with the night outside, a shelf, a rug, a few toys). Anything near the shadow area stays light and low-contrast so the black shadows stay readable. Its layout is edited in the room editor ([ADR 0015](adr/0015-room-layout-file-and-editor.md)). The bed stands against the back wall (`ROOM_BACK_WALL_Z`, 15 Nov 2026); the room stays its current size, about 4 by 2.9 m.

- **Props to pick up and throw (planned, 15 Nov 2026):** small things the player can grab and toss, just for the feel of being there (a pillow, a plush toy, a ball). The room is not made bigger for them: a seated player reaches only about 60 to 70 cm, so they sit within reach, on the tray, the quilt, the bed's edges or a nightstand beside the bed. A prop may cast a shadow on the stage while it is held or in the air, but only for a moment: once thrown it falls to the floor and comes to rest out of the light's path, so nothing stays in front of the story. Never part of a scene's progress, so ignoring them costs nothing.

- **The hands:** in VR the player cannot see their real hands, so the game draws a hand for each tracked hand, following the 25 joints. Rules: always visible while tracked, simple and low-detail rather than realistic, never covering the shadow area, fading out when tracking is lost with a gentle "show me your hands" cue. The shadow is cast from the tracked joints, not from the hand model, so the model can look any way without changing the game.

- **Comfort:** seated, a fixed viewpoint, no locomotion, a steady floor and horizon.

### Light geometry

A physically accurate point light makes shadow size swing wildly with wall distance. Where Shadows Wander fakes it: the projection is blended toward orthographic so a hand always casts a shadow of a fixed, readable size on the stage. The candle flame still flickers and the shadow edges still soften with hand distance, so it feels real without behaving unpredictably.

What the candle's place does decide is where the hands start to cast: only a hand in front of the flame casts, fading in over its first 8 cm. So the candle stands near and low (15 Nov 2026): the tray 0.38 m ahead of the eyes and 0.55 m below them, the candle on its near half, the flame about 0.33 m ahead. A hand casts from about 0.33 m ahead and fully from about 0.41 m, so hands held relaxed in front of the body, forearms forward, already cast without reaching (before, they had to pass 0.45 m and were full only past 0.53 m). Tune it with `TRAY_AHEAD_M` and `TRAY_BELOW_EYES_M` in `main.ts` and the candle's spot on the tray (`CANDLE_DEFAULT` in `bed-tray-view.ts`, or the room editor).

## The story

The story is told on the wall in shadow puppets. A boy has recently lost his best friend. He wakes in the night, lights the candle, remembers their time together through the shadow play, and at the end he can sleep again.

### Premise (settled 12 Nov 2026)

- **Who:** the boy (the player) and his best friend, a girl, who has recently died. The friend appears only in the memories, as a shadow puppet beside the boy's own puppet. Making her a girl lets the player tell the two kids apart at a glance (her bow, ponytail and dress against his tuft of hair, jumper and shorts). The story calls them best friends and says no more; whether it was anything else is left to the player.
- **When:** one night, soon after the loss. He wakes suddenly in the dark and can't get back to sleep.
- **What happens:** through the shadow play he goes back through the memories they shared, one scene at a time, moving each on with his hands.
- **How it ends:** the shadow play lets him rest. The candle burns low, the room settles and he goes back to sleep. Sleep is the only ending, and every session reaches it.

### Tone

- **Bittersweet, not tragic.** Most memories are happy and ordinary: playing, laughing, getting into small trouble. The sadness is in the fact that they are memories.
- **The loss is never shown.** No illness, accident, funeral or hospital on the wall. It is felt through absence: a space beside the boy's puppet, a game set up for two, a shape that needs a second hand.
- **Not frightening.** He wakes suddenly, but the waking is lonely, not scary: no monsters, no nightmare imagery, no jump scares.
- **Show, don't tell.** The shadow play carries the story on its own, with no dialogue or narration. At most a word or two may be written on the wall where a picture cannot do the job (for example a name). Meaning comes from the puppets, the light, the music and the sound, so every scene must make sense to a player who reads nothing. Test this by playing it to someone who doesn't know the premise.

### The scenes

The night is told as one continuous puppet show in seven scenes: waking, four memories, a goodbye and sleep. The memories follow the friendship through one year, in order, and each ends on the picture that leads into the next. There the friend's puppet raises her hand and the friend's hand shadow shows the next shape; when the player copies it, their shadow joins the story and carries it on. Scenes change like a shadow theatre: one place slides off the wall as the next slides in, and the wall never goes black between memories. The scene-by-scene design is in [STORY.md](STORY.md). Each scene is a first draft, built and rewritten one at a time.

### What else is settled

- **Scenes are played, not simulated.** A scene is a short piece of puppet theatre: cut-out puppets move by keyframes, with captions and sounds at marked moments.
- **The player moves it on with a shape.** Between scenes the story waits for a named hand shape (for example a rabbit, or a flat hand), and the next scene plays when that shape commits.
- **No failure.** The story waits for as long as it takes; how it helps a player who is stuck is to be designed. A grieving boy cannot get remembering wrong.
- **The prologue comes back** as the waking scene at the start.
- **Ready for it:** the fade to black (now used when the title is left), poke to skip, and the sound palette (chime, notes, music, ambience).

Planned, not built, each with its own ADR when it is: a cut-out puppet format (parts, pivots, keyframes), a caster that renders the puppets from the flame onto the wall, a scene player with markers for captions and sounds, and a story graph (play a scene, wait for a shape, play the next).

### Shape vocabulary (v1)

Only a fixed set of one-handed shapes is recognised (`src/engine/hands/shapes.ts`). Two-handed shapes are left out because overlapping hands are where hand tracking is least reliable.

| Shape | How to make it |
|----|----|
| Flat | Palm toward the wall, fingers together |
| Fist | Closed hand |
| Cup | Palm up, fingers curled |
| Spread | Fingers spread wide |
| Rabbit | Index and middle up, others pinched to thumb |
| Fox | Fingers together, thumb up as an ear (the thumb out to the side like an L, with the hand turned so it points up) |

Which shapes the story asks for, and where, is part of writing it. The rabbit and fox take longer to hold and the classifier is weakest on them, so a story beat that asks for one should accept it generously.

### How a shape is used

1.  The shadow always mirrors the live hand, so the player sees their real silhouette.

2.  When a shape is recognised, its shadow sharpens and a soft paper rustle plays.

3.  Holding the shape for about 0.4 seconds (1 s for the rabbit and fox) commits it, with a soft thump. A commit is what moves the story on.

4.  Releasing the shape returns the shadow to a plain hand.

## Art and audio direction

The whole game is black silhouettes on a warm, candle-lit wall, a style that looks finished with a small team and few assets.

### Visual style

- **Palette:** Deep black shadows, warm amber light (around 2200 K feel), cream paper. The room starts cold and blue when the boy wakes and warms as the candle is lit; at the end it dims towards sleep.

- **Puppets:** Detailed cut-out silhouettes in parts, moving like rod puppets, with a little stiffness and bounce rather than smooth realism. The team does not use Blender, so the art is 2D (generated silhouette art, cut into parts).

- **Lighting:** The only bright object in the scene is the candle. Its gentle flicker drives a subtle shimmer across the wall and the room.

  The flicker (`src/engine/shadow/pure/lantern-flicker.ts`, `lantern-light.ts`) is slow and calm: two sine waves and a little noise, all under 4 Hz, with at most a 0.11 change from one frame to the next at 72 Hz, so it never strobes. At full strength it swings the flame's brightness by plus or minus 8 % and reddens it slightly when it dips; the paper brightens and dims with it and warms toward the flame's colour. Shadows stay pure black, and the point the shadows are cast from stays still, so shadows never shimmer. The flicker amount is a setting (0 to 1, `?flicker=` in the address, 0 is a steady light); it starts at 0.3 when the device asks for reduced motion.

- **Room:** Dark and warm towards the edges so the lit wall and the shadows dominate; scenery near the shadow area stays light and low-contrast so the shadows stay readable.

### Audio

- **Built:** a paper rustle when a shape is recognised and a soft thump when it commits, from where that hand's shadow is; the candle's whoosh when lit, its crackle, and a sound when it is lifted and set down.

- **For the story:** the sound definitions for a chime, notes, music and ambience are kept as a palette for the scenes. What each scene needs is to be written with it. The music should be quiet and bittersweet: the music-box notes suit memories from childhood, and the night ends in near silence as he falls asleep.

## Technical design

Where Shadows Wander draws its shadows on a single plane in 3D space, which keeps rendering cheap and lets any surface (the virtual wall now, a real table or wall in a possible later mode) share the same code.

### Architecture

The decisions are recorded in the [ADRs](adr/), and the layers and frame in [ARCHITECTURE.md](ARCHITECTURE.md).

- **IWSDK** provides the XR session and the emulator. Nothing else. (Scene understanding, planes and anchors are not used in the virtual room.)
- **Hand maths, the classifier and the shadow projection never import IWSDK or three.js.** They are plain TypeScript, and a lint check enforces this.
- **View layer:** plain three.js objects (`InstancedMesh`, custom shaders). IWSDK's ECS is used only where it clearly saves work.
- **Versions:** IWSDK is pinned to exactly 1.0.0, and three.js is IWSDK's `super-three@0.181.0` fork. There is never a second copy of three.
- **Fallback:** plain three.js + `@iwsdk/xr-input`; see [ADR 0002](adr/0002-plain-threejs-fallback.md).

### Test devices

We don't have a Quest yet; we have a Pico. Details are in [ADR 0003](adr/0003-pico-as-stand-in-test-device.md).

- **Develop on the Pico, confirm on a Quest.** Working on Pico means it will probably work on Quest, but only a Quest run proves it. A Quest check (remote tester or a borrowed headset) always comes before submission.
- **Build to the WebXR standard, not to one headset.** Every XR feature is optional and feature-detected.
- **Testing order:** IWER emulator for logic, the webcam hand bench for hand shapes, Pico for real-device behaviour, Quest for final confirmation.
- **Hand data on the Pico:** works in Wolvic Chromium 1.4 (a sideloaded build, not the Pico Store's Wolvic), in a VR session that asks only for `local-floor`, `bounded-floor` and `hand-tracking`. PicoBrowser 3.3 (Chrome 105) and the Pico Store's Wolvic (Gecko) give no joints. Meta documents WebXR hand input as supported in Quest Browser; still to confirm on a Quest.
- **Hand data without a headset:** the Hand Lab (mock hands for the game's own session, in development builds) and the webcam hand bench (`webcam.html`) track hands from a laptop camera and convert them to the same 25-joint data the game reads. Headset sessions and the bench can both save hand recordings for replay in tests. See [ADR 0004](adr/0004-webcam-bench-and-hand-recordings.md).

### Stack

| Area | Choice |
|----|----|
| Engine | IWSDK (three.js) for the XR session and emulator; the game in our own TypeScript code |
| Session | immersive-vr, seated (local-floor reference space) |
| XR features | Hand tracking; nothing else is needed in the virtual room |
| Hosting | Static HTTPS site on GitHub Pages, deployed by the Actions workflow (classic Jekyll Pages drops IWSDK's `_virtual_*` chunk), opened in Quest Browser |
| Performance | Minimum 60 fps (judging requirement), target 72 fps |

### Shadow rendering

- Each hand is projected from the candle flame onto the stage plane as capsules and drawn solid black in one draw call.

- The projection blends between perspective (from the candle flame) and orthographic to keep shadow size stable.

- A small blur on the shadow edge, scaled by the hand's distance from the plane, gives a soft, natural edge.

- Recognition sharpens the shadow (`src/engine/shadow/pure/shadow-sharpen.ts`): per hand, the edge blur shrinks and the shadow darkens a little as the hold fills (up to 70 % of the effect at the end of the hold), snaps to its crispest on commit with a brief extra pulse, and relaxes within about three quarters of a second on cancel or release. Only how the edge is drawn changes; the edge never gets narrower than a pixel. `strength` (0 to 1, default 1) is the setting for accessibility (0 turns it off) and the other values are in `DEFAULT_SHARPEN_SETTINGS`.

- This avoids real-time shadow maps entirely. The puppets' shadows are planned to be cast the same way, from the same flame, so they match the hands'.

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

- Hysteresis: once committed, a shape stays active until features move clearly outside its range, preventing flicker. If the hand drifts out of the committed shape's normal range into another shape, the new shape replaces it only when it commits.

- Low tracking confidence pauses recognition rather than guessing: with any joint missing the hold freezes; after 0.2 s a held shape is cancelled, after 0.5 s a committed one is released.

### Saves

- The settings and the day last played are saved in browser storage (save version 3, [ADR 0010](adr/0010-saves.md)). Where the player is in the story is to be added with the story.

- The room needs no spatial anchors: it is the same every session.

### Open questions

- [x] Which Pico do we have? A Pico 4 (OS 5.13.8, PicoBrowser 3.3.54); see ADR 0003.

- [ ] Confirm on the Meta Developer Forum that an IWSDK WebXR link with the game in our own code is an acceptable submission. Also ask about the plain three.js + `@iwsdk/xr-input` fallback.

- [ ] Confirm hand tracking in an immersive-vr session on the Quest Browser.

- [ ] Build and play-test each scene in [STORY.md](STORY.md), one at a time (first drafts written 12 Nov).

- [ ] The friend: name and age. (Decided 13 Nov: a girl, the boy's best friend, so the two read apart on the wall.)

- [ ] What wakes the boy: a dream, a sound, or nothing at all.

- [ ] The ending: STORY.md proposes palm to palm with the friend's hand, then covering the flame to put the candle out; confirm it in the headset.

- [ ] Whether to put a short content note at the start (the game is about the death of a friend) and on the store page.

- [ ] How the story helps a player who doesn't make the shape it waits for.

- [ ] Ask the organisers how a VR-only entry (no passthrough, no scene understanding) is scored under Technical implementation, since that criterion names them for entries that use them.

- [ ] Measure cold-start load time on Quest Browser; target under 5 seconds to the candle.

## Accessibility and comfort

The whole game can be played seated, with one hand, within a two-foot radius.

- **One-handed play:** All v1 shapes are one-handed; the player can switch which hand they use at any time.

- **Settings screen:** One panel in the room, pressed with a fingertip (poke), no controller path, two pages, every setting explained in one line, changes apply live and are saved ([ADR 0011](adr/0011-accessibility-settings.md)).

- **Shape tolerance slider:** Widens recognition ranges for players with limited finger mobility.

- **Hand calibration:** The player holds each hand flat for 2 seconds and finger curl is measured from their own straight, for fingers that don't fully straighten (`src/engine/hands/hand-calibration.ts`).

- **Hold time setting:** Commit time adjustable from 0.2 s to 1.0 s (default 0.4 s; the animal shapes take 2.5 times as long, so 1 s by default).

- **Shadow size slider:** Makes shadows larger for low-vision players.

- **High-contrast mode:** Pure black on bright white stage, no paper texture. The wall is pure white, fully lit and opaque, the shadows fully solid, and the settings panel itself is black on white.

- **Captions:** The story has no dialogue, so captions would describe the sounds that carry meaning (laughter, a school bell, the music changing) for players who can't hear them. The setting exists and is saved; nothing shows captions until the story does.

- **Main hand:** The panel opens beside the chosen hand. Both hands always work, so a one-handed player is never locked out by the choice.

- **Comfort:** No artificial locomotion, no camera movement, nothing that requires standing or turning around.

- **Arm fatigue:** Hands rest on or near the bed tray while a scene plays; the story asks for a shape only between scenes.

## Competition fit

Where Shadows Wander targets Best New Gaming Experience (\$100,000). The organisers' rules, judging criteria, dates and links are summarised in [COMPETITION.md](COMPETITION.md).

### Requirements and guidelines

| Rule | How Where Shadows Wander meets it |
|----|----|
| Hands-first, completable without a controller | Hands are the only input; no controller code path is needed |
| Seated-optimised (airplane seat test) | All play happens seated (the kid sitting up in bed in a virtual bedroom), with the wall in view and the hands within reach |
| Passthrough (judged for purpose if used) | Not used. The entry leans on hands-first design, the first five minutes, accessibility and polish instead |
| Easy in and out (one bus stop test) | Light the candle to start, cover the flame to pause |
| Original, not a wrapper (take it away test) | All of the game is built in-house; no third-party service |
| New Experience division | Codebase started on or after 24 Sep 2026 |

### Special awards

| Award | Why Where Shadows Wander fits |
|----|----|
| Boldest Original Concept | Your own hands' shadows bring back a boy's memories of a lost friend, as a candle-lit shadow-puppet story. (This award favours ideas that depend on real-world presence, so a virtual room is a weaker fit than the original real-room plan.) |
| Best First Five Minutes | No instructions; waking in the dark sets the mood, lighting the candle is a ritual, and the first shape is made by instinct |
| Best Accessibility Forward Experience | One-handed play, tolerance and hold-time settings, high-contrast mode |

### Submission checklist

- [ ] Playable WebXR link hosted and tested on a fresh Quest 3S

- [ ] The person submitting has joined the Meta VR Start Program, and everyone on the team is 18 or older

- [ ] Devpost: track Gaming and division New Experience selected; video is public on YouTube or Vimeo

- [ ] The deployed page stays up until the winners are announced (about 11 Dec) and is not changed after 18 Nov 12:00 PM Pacific (19 Nov 4:00 AM Singapore)

- [ ] Demo video under 3 minutes, best shot (the shadow story on the lit wall) in the first 10 seconds

- [ ] Tagline under 140 characters

- [ ] Description under 500 words: inspiration, how it was built, future plans

- [ ] Hand interactions write-up

- [ ] Target launch date

## Scope, milestones and risks

### In scope / out of scope

| In v1 | Later |
|----|----|
| The bedroom, the candle and the hand shadows (built) | Real-room mode (table or wall in passthrough) |
| A shadow-puppet story moved on by hand shapes (to be built) | Two-handed shapes (bird, butterfly) |
| Accessibility settings (built) | Localisation |

### Milestones (to 19 Nov)

1.  **Weeks 1–3 (to 22 Oct):** done. The WebXR shell on the Pico, hand shadows on the wall, the shape classifier.
2.  **Weeks 4–6 (to 11 Nov):** the room, the candle, sound, saves, settings and debug tools. The puzzle game was built and then removed ([ADR 0016](adr/0016-story-shadow-theatre.md)).
3.  **Now to 19 Nov:** the story system (puppet format, caster, scene player, story graph), the story itself, testing on the Pico and a Quest, the demo video and the submission form.

### Risks

| Risk | Impact | Mitigation |
|----|----|----|
| The story system and its art are not ready by the deadline | High | Build the smallest path first: one scene, one shape, the next scene; keep the room and shadows shippable on their own |
| Shape recognition feels unreliable to new players | High | Replay saved hand recordings as regression tests; tolerance slider; ask for the most reliable shapes at key moments |
| Judging favours passthrough, scene understanding and anchors, which a VR-only entry does not use | High | Lead with hands-first design, accessibility, polish and the first five minutes; ask the organisers |
| Fallback (plain three.js + `@iwsdk/xr-input`) not accepted for submission | Medium | Ask on the forum before relying on it; stay on `@iwsdk/core` by default |
| Slow cold start in Quest Browser | Medium | Small initial bundle; stream the rest of the assets after the candle appears |
| *Device:* hand joint jitter, occlusion and tracking dropouts | High | Report counts partial frames and tracking losses per hand; tune classifier hysteresis from real data |
| *Device:* hand joints depend on the browser: on the Pico only Wolvic Chromium (sideloaded) delivers them | Medium | The session asks for just the three features (in the launcher); Quest Browser is documented to support hand input; confirm on a Quest |
| Works on Pico but not on Quest (different browser, tracker and chip) | High | Standard WebXR only, everything feature-detected; compare Pico and Quest reports |
| No Quest available before submission | High | A remote Quest tester or a borrowed headset; the submission checklist requires a fresh Quest 3S test |
