# The story: one night, one friendship

A boy has recently lost his best friend, a girl from down the street. He wakes in the night, lights a candle, and in shadow play on his bedroom wall he goes back through the friendship they shared, from the night they met to the last ordinary day. At the end he can sleep again. The premise and the tone rules are in the [GDD](GDD.md#the-story); this document is the scene-by-scene design.

**Status:** every scene is a first draft. We work on them one at a time: build a scene, play it in the headset, and rewrite its section here with what changed. The order, the shapes and the content of any scene can change.

## One story, not seven

The player should feel they are watching one puppet show that runs from the candle being lit to the candle going out, with seven things to do in it, not seven short films. Four things hold it together:

The friend is a girl, so the two kids read apart at a glance: her puppet has a bow and a ponytail, and a dress when she stands (`girl` in `story-kit.ts`); the boy has a tuft of hair and a jumper and shorts. They are children and best friends; nothing in the story is a romance.

1.  **One friendship, told in order.** The memories follow the friendship through a year: they meet on a stormy winter night, play in the park in spring, catch fireflies in summer, and walk to school in autumn. Each memory starts where the last one left off, often with the same two kids walking or running from one into the next.
2.  **The friend teaches every shape.** The friend taught the boy his first shadow rabbit, and every shape after it is the friend saying "now try this one". The friend's hand that shows each shape comes out of the memory itself: the friend's puppet raises her hand, and the big shadow of her hand rises at the edge of the wall. Making the shapes she taught is how the boy remembers her.
3.  **Threads that come back.** A few things recur so the ending pays off what came before:
    - **The wave.** The friend waves in the dream that wakes the boy (scene 1). At the school gate she turns back and waves once more, and the boy, already walking away, doesn't see it (scene 5). In scene 6 the same hand is raised alone on the wall, and this time the boy answers it, palm to palm. The night has been about returning that wave.
    - **The rabbit and the fox.** The rabbit is the boy's shape, the fox is the friend's. They meet in the fort, chase each other into the park, and sit together on the hill. In scene 5, the rabbit goes one way and the fox the other.
    - **The jar.** The jar from the firefly night was the friend's, and she gives it to the boy. It is on the boy's shelf in the room from the start, unlit, and the last of the candle finds it in scene 7.
    - **The storm.** They met on a stormy night, and the storm that wakes the boy is like that one. Thunder outside connects the room and the memory.
4.  **A puppet stage, not a slideshow.** After the candle is lit, the wall never goes black and the story never fades out and in again. Scenes change the way a shadow theatre changes them: the cut-outs of one place slide off one side of the wall while the next place slides in from the other, and the kids walk through the change from one into the next (see [Scene changes](#scene-changes)).

## Rules for every scene

- **Show, don't tell.** No dialogue and no narration. At most a word or two written on the wall where a picture cannot do the job. Each scene must make sense to a player who reads nothing.
- **The loss is never shown.** No illness, accident, funeral or hospital. It is felt through absence.
- **Bittersweet, not tragic.** The memories are happy and ordinary; the sadness is that they are memories.
- **No failure.** A scene waits as long as it takes. The friend's hand always shows the shape to make.
- **Arms rest while a scene plays.** The player only holds up a shape between memories, while the story waits.
- **A memory is short:** about 30 to 60 seconds of puppet theatre, plus a scene change of a few seconds into the next.

## How the story moves on: the friend's hand

Each memory (scenes 2 to 5) ends on a picture that leads into the next one, and the story waits there:

1.  **The friend asks.** Inside the memory, the friend's puppet lifts her hand, and the friend's hand shadow rises large at the edge of the wall and makes the next shape. It is softer and slightly lighter than the player's, so the two are never confused, and it holds the shape gently and repeats it, as if it were waiting. The memory's last picture stays alive behind it, breathing (a torch flickering, grass swaying), so the story is paused, not stopped.
2.  **The player copies it.** When the player's shape commits, the friend's hand lowers out of sight.
3.  **The shadow joins the story.** The player's shadow becomes a puppet in the picture that's already there (the fox pounces on the rabbit, the cup holds a firefly), and that puppet carries the story into the next place.

Scene 2 is the only memory that starts on an empty wall: the candle is the first light, and the friend's hand appears in it the way it first appeared by torchlight in the fort. Scene 6 is the friend's hand with nothing behind it, and that emptiness is the point.

This is the tutorial, the help for a stuck player, and the friend's presence in one.

## Scene changes

Like a shadow theatre with rod puppets on a track:

- **Places slide, they don't fade.** A place (the fort, the trees, the hill, the school gate) is a group of cut-outs. When the story moves on, the old place slides off one side of the wall, eased, as the new one slides in from the other, a little behind it, so the wall is never bare for long. Pieces at different depths slide at slightly different speeds (near ones faster), so it reads as the stage turning and not as a picture being swapped.
- **Time moves left to right.** Moving forward in the friendship, places leave to the left and arrive from the right, and the kids walk or run rightwards through the change. Once, in scene 5, the hill slides back in from the left, the wrong way, because the story has stopped going forward.
- **Characters carry over.** The two kids (and the rabbit and fox) stay on the wall through a change and walk into the next place, so the player follows them, not a cut.
- **The light changes with the place.** During a change the candle's mood eases to the next memory's (`StoryScene.candle`), and the candle burns a little lower.
- **The only fades** are the friend's hand appearing and lowering, the dream in scene 1, the friend's hand leaving in scene 6, and the final dark in scene 7.

**How it is built:** the story director (`src/engine/stage/story/story-director.ts`) plays each scene as a list of beats in `story-script.ts`: a `friend` beat shows the friend's hand and waits for the player's commit of its shape; a `memory` beat plays a puppet scene (keyframed tracks, `src/engine/stage/puppet/`) and can start one of its puppets where the player's shadow was. The friend's hand is a painted shadow of a hand making the shape, drawn the way the old shadow-puppet plates draw one (`friend-puppet.ts`, its art in `puppet-art.ts`), as a small puppet with the moving fingers (a rabbit's ears) as parts of their own; it forms the shape, holds it, and every few seconds eases half out of it and back. (A posed hand cast like the player's was tried first: a shadow made of a hand's bones reads as a hand, not as a rabbit.) Each shape needs its own painted hand; a shape without one shows nothing yet. The story is written for the 1.6 by 1 m stage and drawn `STORY_SCALE` (2.375) times bigger, centred on the wall's middle, so the memories, the friend's hand and the story's words fill 95% of the 4 by 2.5 m wall (`StageFrame.setStoryArea`); the player's own shadows keep their size. The candle's light has a mood (`candle-mood.ts`): the story opens `rainy`, its light thin and blue-grey, and a scene can name another (`StoryScene.candle`, e.g. `warm`) for the light to ease into over a few seconds, so the candle's colour can mark the story's moments; the flame itself stays a flame's colour. `__wsw.candleMood('warm')` tries one. In dev, `__wsw.playStory()` starts the story and `__wsw.commitShape('rabbit')` copies the shape without a hand; `node scripts/story-probe.mjs` takes screenshots.

**The continuous stage (built 13 Nov):** the memories are chapters of one puppet scene (`src/engine/stage/puppet/chapters.ts` joins them; `story-stage.ts` lists them), so a puppet in several memories is one part that carries over. A `memory` beat plays one chapter (`start`, `end`); when it ends, its last picture stays on the wall with its wobbles still moving (`ScenePlayer.idle`) through the next `friend` beat, and the next chapter goes on from there. `slideKeys` writes a place's slide on or off, slower the further back it stands, and the puppets are cut off at the room wall's edges (`PuppetView.clipToWall`). A `friend` beat's `rise` lifts the friend's hand into place as it appears. `node scripts/story-probe.mjs <url> <prefix> [1,4] [0.3,3] '[["fox",[0.6,3,7]]]'` follows the story into later scenes (`PROBE_WIDE=1` for the whole view).

**All the scenes (first pass, 13 Nov):** scenes 3 to 5 are chapters too (`the-park.ts`, `fireflies.ts`, `last-ordinary-day.ts`); the kids, sitting or standing, and their walk and run come from `story-kit.ts`. A beat can also be a `wait` (seconds of nothing new) or `sleep` (scene 7: covering the flame ends the game instead of pausing it; the candle goes out and the view fades to black). A friend beat can name which painted hand shows its shape (`puppet`, e.g. `wave`) and how slowly it fades (`out`). A memory can change the candle's mood on the way with a `mood` cue; each scene's `candle` is the mood its wait opens in. Starting the story at a later scene puts the picture the memory before it ended on on the wall, so any scene is a checkpoint: the Hand Lab's **Story** tab has one per scene (Wait shows the friend's hand, Play copies its shape at once), with Make shape (the Lab's synthetic hand forms the waiting shape, through the real recognition, even when the session started on the device's hands), Copy shape and Skip memory; pressed before BEGIN, a checkpoint starts the session itself; in dev, `__wsw.jumpTo(3, true)` does the same. `node scripts/scene-probe.mjs <url> <dir> '[[1,[2,8,14]]]'` jumps to scenes and takes screenshots.

## The scenes

| # | Scene | Season | Shape | Leads into the next with |
|----|----|----|----|----|
| 1 | Waking | the stormy night now | none (light the candle) | The candle's light on the wall, like the torch in the fort |
| 2 | How they met | winter, a stormy night | Rabbit | The friend makes a fox with the torch: "now this one" |
| 3 | The park | spring | Fox | Running into the evening; the first firefly |
| 4 | Fireflies | summer | Cup | The friend gives him the jar; they walk down the hill towards school |
| 5 | The last ordinary day | autumn | Flat (a wave) | The friend's wave the boy didn't see; the hill comes back with one boy on it |
| 6 | Goodbye | the night now | Flat, palm to palm | The friend's hand fades; the candle is low |
| 7 | Sleep | the night now | Cover the flame | — |

Fist and spread are not used: a fist reads as anger and is the easiest shape to make by accident, and spread has no memory that fits it yet.

### 1. Waking

- **Purpose:** set the mood without a word. He is awake, alone and it is late. Plant the wave the story will end on.
- **What happens:** BEGIN fades the title to black (built). The headset stays black. In it, his friend slowly gathers: a faint pale glow of a girl lifting a hand to wave, soft-edged and never quite clear, like a dream (built). Then far off thunder rolls, low and muffled, and the dream goes with it: it is what woke him (built). While it rumbles away his eyes open on the room: a slow, heavy blink, a quicker, wider one, and they stay open (built). The room is dark and cold blue. A short silence, then the room tone. On the shelf, half seen, is a glass jar. The player lights the candle (built), and the room warms a little.
- **The player:** lights the candle.
- **Leads into scene 2:** the candle throws its light on the wall, and the first thing in it is the friend's hand, as it first appeared to him by torchlight.
- **Must make the player feel:** lonely, then a little safer once the light is there.
- **Built already:** the fade to black, the blinks (`src/engine/stage/wake-timeline.ts` has the timing, `src/engine/shadow/wake-view.ts` draws it; `__wsw.playWake()` replays it), the cold room, lighting the candle.
- **To build:** the jar on the shelf, unlit (a placed model in the room).
- **To try:** whether the friend in the dream reads as a friend and never as a figure to fear (keep it small, soft and brief); `__wsw.playWake()` replays it. A whispered "noo…" was tried in the dark and dropped (it read wrong); the timeline still has a slot for a word. Whether the dream's wave should match the friend's flat hand in scene 6 closely enough to be recognised.

### 2. How they met

- **Purpose:** introduce the friend and the game's one mechanic, and start the friendship.
- **What happens:** the friend's hand appears in the candlelight and makes a rabbit. When the player copies it, the player's rabbit hops off their hand and becomes a puppet rabbit. Around it the fort slides in: two small kids under a blanket fort with a torch on a stormy night (a far thunder, the same as the room's), one showing the other how to make the rabbit. The new kid tries, gets it wrong (a lumpy shape), then gets it right. They both laugh. Then the friend, pleased with herself, turns her hand in the torchlight into something new.
- **The player:** Rabbit.
- **Ends on (the wait for scene 3):** the fort stays, the torch flickering and the boy's rabbit sitting on the blanket; the friend's puppet raises her hand, and the friend's hand shadow rises at the wall's edge making a fox.
- **Must make the player feel:** delight at the transformation; warmth towards the friend.
- **Puppets:** the boy, the friend, the blanket fort, the torch, a rabbit.
- **Note:** the rabbit is slow to commit and the classifier is weakest on it, so accept it generously here. It is the first shape, and it must not frustrate.
- **Built (first pass, 13 Nov):** the friend's rabbit on the left of the wall, waiting; the player's rabbit becoming a puppet rabbit that hops to the friend's raised hand; the fort, the torch and the two kids appearing around it; the boy's lumpy try, the friend leaning over to help, the boy's rabbit coming right, the rabbits nodding to each other, and both laughing; then it fades (about 23 s). Its timing and places are in `src/engine/stage/story/how-they-met.ts`, the cut-outs in `src/engine/shadow/puppet-art.ts`.
- **Reworked for the continuous stage (13 Nov):** the fort and the kids slide in from the right around the sitting rabbit (the fort a little behind), then the rabbit hops to the friend's hand; at the end the boy lowers his hand, the rabbit hops down onto the blanket between them, and the friend's arm goes down and up again; the story holds that picture while the friend's fox hand rises over it, between the kids (about 22.6 s). Still to do: a far thunder in the memory.
- **To try:** whether the friend's painted rabbit hand reads in a headset, and whether players copy it with one hand; the sizes on the wall in a headset; laughter in the sound, which the memory has only notes for so far.

### 3. The park

- **Purpose:** pure joy. The friendship at its most carefree.
- **What happens:** the player's fox pounces at the rabbit, and the rabbit bolts out of the fort. The fort slides off to the left as trees slide in from the right, and the chase runs on through the change: rabbit and fox across the wall, out of winter and into a spring park. Mid-run they become the two kids, the girl chasing the boy between the trees, until she catches him and they both fall over in the grass laughing. They lie there while the sky goes from day to dusk (the candle eases warmer and lower), and a single small light blinks above them.
- **The player:** Fox.
- **Ends on (the wait for scene 4):** the two kids lying in the grass, the firefly drifting over them; the friend's puppet reaches up, and her hand shadow rises cupped.
- **Must make the player feel:** play, speed, laughter.
- **Puppets:** the fox, trees, the kids running and lying down (reused from scene 2), one firefly.
- **Built (opening only, 13 Nov):** the friend's painted fox hand; the player's fox landing in the fort, crouching and pouncing; the rabbit bolting; the two running on the spot while the fort and the kids slide off to the left; then both running off the right edge, leaving the wall empty (about 10.7 s, `src/engine/stage/story/the-park.ts`). Next: the trees sliding in as the fort goes, the rabbit and fox becoming the kids, and the rest of the scene ending on the firefly.
- **Built (first pass, 13 Nov):** the fort slides off as the trees and grass slide in from the right (the candle warming); mid-run the rabbit and the fox fade into the two kids running, the friend chasing; she catches him and they tumble backwards into the grass, the friend rolling over, and lie on their backs laughing; the light goes to dusk and a firefly drifts in to hover between them; the friend reaches up, and her cup hand rises (about 23 s).
- **To try:** the rabbit and fox becoming the kids is a cross-fade; the two lie in a row, not head to head.
- **Sound:** laughter. Keep it in mind: it is missing from later scenes.

### 4. Fireflies

- **Purpose:** a quiet, close moment. The most tender memory.
- **What happens:** when the player copies the cup, the firefly settles into their cupped shadow and glows there. The trees slide away and the ground rises into a hill as more fireflies come up out of the grass. The two kids sit side by side on the hill with a jar between them, fill it, and then let the fireflies go, a few at a time, until the jar is empty. The friend puts the empty jar in the boy's hands to keep. They stand and walk down the far side of the hill together, to the right.
- **The player:** Cup.
- **Ends on (the wait for scene 5):** as they walk, the hill slides off to the left and a school gate slides in from the right; it is morning, and autumn leaves fall. At the gate the friend's puppet turns to go her own way, lifts her hand, and the friend's hand shadow rises flat, waving.
- **Must make the player feel:** stillness, closeness, a summer that seemed endless.
- **Puppets:** the kids sitting (one shot, to reuse in scene 5), a jar, fireflies (small lights on the wall), the school gate (arriving).
- **Built (first pass, 13 Nov):** the firefly comes off the player's cup glowing brighter and goes back over the kids; they get up and walk on the spot as the park slides off and the hill slides in, eight fireflies rising from its grass; they sit (standing kids cross-fade to sitting ones), the friend sets the jar down, they fill it one firefly at a time (the jar glows brighter with each), let them go in threes over the top of the wall, and the friend puts the empty jar in the boy's lap; they stand and walk on, the boy carrying it, as the hill slides off and the school gate and an autumn tree slide in (the light turning to a pale morning), five leaves falling; the friend turns to face the other way and raises her hand, and her waving hand rises beside her (about 40 s).
- **To try:** the firefly light comes from the wall, not the candle, so this is the only scene with a second light. Check that it reads as magic, not as a bug. Whether the jar being handed over reads at this size.

### 5. The last ordinary day

- **Purpose:** the turn. Without saying it, show that this was the last time.
- **What happens:** when the player waves, the boy waves back at the gate, as on any day, and they go opposite ways: the boy off the right edge of the wall, the friend off the left. Just before the edge, the friend turns back once and waves again, but the boy's puppet is already gone. The wave hangs there, unanswered, and then the friend walks off too. The gate slides away, and the hill slides back in, from the left, the wrong way: the hill and the jar from scene 4, with only the boy sitting there.
- **The player:** Flat (a wave).
- **Ends on (the wait for scene 6):** the hill slides away, slowly, until the wall is empty for the first time since the candle was lit.
- **Must make the player feel:** that something is ending, before they can say what.
- **Puppets:** the school gate, the kids walking and waving, the single boy on the hill (from scene 4).
- **Built (first pass, 13 Nov):** the boy waves back with his free hand and walks off the right edge with the jar; the friend walks left, turns back near the edge and waves at nobody, holds his hand up, lowers it, and walks off; the gate slides away to the right as the hill slides back in from the left, the light cooling to `low`, with only the boy on it and the jar on the grass where the friend sat; he bows his head, and the hill slides slowly off to the right, leaving the wall empty (about 37 s). The tune drops to single notes.
- **How it lands without words:** the wave that isn't seen, the hill coming back the wrong way with the girl missing, the laughter from scene 3 gone, the music-box tune dropping to a single note, and the candle dimming. This is the scene to test hardest with someone who doesn't know the premise.

### 6. Goodbye

- **Purpose:** let the boy, and the player, say goodbye: answer the wave.
- **What happens:** no memory this time, and no stage. The wall is empty except for the friend's hand, held up flat, alone: the wave from the gate, and from the dream. It waits. When the player raises their own flat hand to meet it, palm to palm, the two shadows touch, and the friend's hand slowly fades away.
- **The player:** Flat, held against the friend's hand.
- **Must make the player feel:** grief, and some peace.
- **Puppets:** none; the friend's hand only.
- **Built (first pass, 13 Nov):** the friend's painted flat hand (`flat`, its thumb easing out as it opens) alone in the middle of the empty wall; any flat commit answers it (not yet checked to be palm to palm), and it fades over 6 s; then 4 s of empty wall.
- **To try:** how long the friend's hand takes to fade, and whether it lingers if the player pulls away early; making the commit need the hands to meet.

### 7. Sleep

- **Purpose:** the ending: rest.
- **What happens:** the candle has burned low. The wall is dim and the room quiet; the rain is easing. The last of the candle's light finds the jar on the shelf, the one the friend gave him. The player covers the flame, and it goes out. Darkness, the boy's breathing slows, and the game fades to black.
- **The player:** covers the flame. In every other scene this pauses the game; here it puts the candle out. The player chooses when he sleeps.
- **Must make the player feel:** calm and finished.
- **Built (first pass, 13 Nov):** the light eases to `ember`, and after 3 s covering the flame ends the game (the `asleep` state): the candle goes out, the rain and music drop, and the view fades to black over 7 s and stays there. Not yet: the jar on the shelf, the breathing, the rain easing before the end, the candle burning visibly lower.
- **To try:** whether one firefly glows in the jar after the candle goes out (magic, and maybe too much); whether the jar is enough without it.

## Throughout the night

- **The candle burns lower** at each scene change, so the player can see the night moving towards sleep. Its mood follows the memories (winter blue in the fort, warm in the park, dusk gold on the hill, pale morning at the gate) and cools again towards the end.
- **The rain** falls all night outside the window, and its sound is a steady bed from the window's side. Now and then the window flickers pale and, a few seconds later, thunder rolls far off, low and muffled: safe inside on a wet night, never a threat (`src/engine/stage/storm.ts` times it; `__wsw.thunder()` brings a flash now). It is the same weather as the night they met, and it eases off in scene 7 as he nears sleep.
- **The music** is the music-box tune, one melody that runs on through the scene changes, fuller in scenes 2 to 4, thinning in 5, a single note in 6, silent in 7.
- **Puppets in total:** about eight (the boy and the girl, a rabbit, a fox, a blanket fort, trees, a hill, a school gate, a jar and fireflies), each with simple rod-puppet motion: slides, bobs and turns on one pivot; and one real jar in the room.

## Build order

So that every step leaves a game we could submit:

1.  The story graph, the friend's hand, and scene 2 from start to finish (first pass built 13 Nov).
2.  The continuous stage: the last picture staying through the wait, the slide changes, the friend's hand rising into place; scene 2 reworked to use them (built 13 Nov, with the opening of scene 3).
3.  Scenes 6 and 7. With scenes 1, 2, 6 and 7, the game is short but complete: scene 2 ends with the friend waving instead of making the fox, the fort slides away, and the wave becomes scene 6's hand.
4.  Scenes 3, 4 and 5, in that order. If time runs short, cut from the end; scene 5 can be merged into 6 by having the friend's hand wave before it waits. Each cut scene's lead-in moves to the scene before it.

## Change log

- 12 Nov 2026: first draft of all seven scenes.
- 12 Nov 2026: scene 1 opens on black with a word in the dark ("noo…"), then the eyes open in two blinks.
- 12 Nov 2026: the word in the dark is dropped; the black before the blinks is shorter, and the second blink quicker.
- 12 Nov 2026: it rains outside instead of snowing: a rainy night in the window, a constant rain sound, and now and then a far, muffled thunder after a faint flash.
- 12 Nov 2026: a far thunder roll in the black is what wakes him; the eyes open as it rumbles away.
- 13 Nov 2026: before the thunder, lightning flashes through the shut lids with the friend's silhouette in it, waving; the thunder follows the flash.
- 13 Nov 2026: the flash becomes a slow glow, and the friend fades in over it gradually and faintly (he appeared too quickly and too plainly); the thunder breaks the dream, and the blinks start 1.6 s later.
- 13 Nov 2026: the glow behind him is dropped (too bright); the friend is now himself a faint pale glow in the black, not a shadow on a light.
- 13 Nov 2026: the friend stays 2 s longer at his clearest before the thunder (held 2.3 s); the thunder and the blinks move 2 s later.
- 13 Nov 2026: the story graph, the friend's hand and scene 2 are built (first pass); the old prologue no longer plays after the candle is lit.
- 13 Nov 2026: the friend's rabbit hand is turned 45° side-on with its ears spread, and held nearer the candle (shadow about twice the hand, crisper); square to the wall it read as a peace sign.
- 13 Nov 2026: the friend's hand is now a painted hand-shadow puppet, drawn like the old shadow-puppet plates (a hand side on: forearm, the back of the hand as the head, the thumb meeting the curled fingers as the muzzle with the eye between, two fingers as ears that rise as it forms). The posed hand, even turned side on, cast a shadow of bones that read as a hand.
- 13 Nov 2026: the story (the memories, the friend's hand and its words) is drawn 2.1 times bigger, centred on the wall, to fill about 85% of it; the player's own shadows are unchanged.
- 13 Nov 2026: the story is drawn 2.375 times the stage, 95% of the wall each way.
- 13 Nov 2026: the candle's light opens blue-grey, rainy and gloomy (the `rainy` mood); scenes can ask for another mood and the light eases into it.
- 13 Nov 2026: one continuous story instead of seven separate ones. The memories follow one year in order (winter, spring, summer, autumn), each ending on the picture that leads into the next; the friend's hand comes out of the memory, not onto an empty wall. Scenes change like a puppet stage: places slide off one side as the next slides in from the other, the kids walking through, and the wall never goes black between memories. Threads that recur: the dream's wave, unseen at the gate and answered in scene 6; the rabbit and fox as the two kids; the jar, given to the boy in scene 4 and on his shelf in the room; the storm, the same as the night they met.
- 13 Nov 2026: the continuous stage is built. The memories are chapters of one puppet show; each chapter's last picture stays on the wall, still breathing, while the friend's hand waits; places slide on and off and are cut off at the wall's edges. Scene 2's fort slides in, and the scene ends with the rabbit on the blanket and the friend raising his hand; the friend's fox hand rises between the kids. The opening of scene 3 is built: the fox pounces, the rabbit bolts, and the fort slides away behind them as they run.
- 13 Nov 2026: a first pass of every scene (3 to 7) is built, so the whole story plays from the candle to sleep: the park, the fireflies and the jar, the walk to school, the unanswered wave and the hill with one boy, the friend's hand alone, and covering the flame to sleep. New candle moods mark the memories (dusk, morning, low, ember). The Hand Lab's Story tab jumps to any scene.
- 13 Nov 2026: the friend is a girl, so the player can tell the two kids apart: a bow and a ponytail that bounces as she walks and runs, and a dress when she stands; the dream in scene 1 is a girl with two bunches and a dress. They are still best friends, not a romance.
