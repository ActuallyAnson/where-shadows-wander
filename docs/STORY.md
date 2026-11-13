# The story: one night, seven scenes

A boy has recently lost his best friend. He wakes in the night, lights a candle, and in shadow play on his bedroom wall he goes back through the memories they shared. At the end he can sleep again. The premise and the tone rules are in the [GDD](GDD.md#the-story); this document is the scene-by-scene design.

**Status:** every scene is a first draft. We work on them one at a time: build a scene, play it in the headset, and rewrite its section here with what changed. The order, the shapes and the content of any scene can change.

## Rules for every scene

- **Show, don't tell.** No dialogue and no narration. At most a word or two written on the wall where a picture cannot do the job. Each scene must make sense to a player who reads nothing.
- **The loss is never shown.** No illness, accident, funeral or hospital. It is felt through absence.
- **Bittersweet, not tragic.** The memories are happy and ordinary; the sadness is that they are memories.
- **No failure.** A scene waits as long as it takes. The friend's hand always shows the shape to make.
- **Arms rest while a scene plays.** The player only holds up a shape between scenes.
- **A scene is short:** about 30 to 60 seconds of puppet theatre.

## How a memory starts: the friend's hand

Each memory (scenes 2 to 6) starts the same way:

1.  **The friend's hand appears.** A second hand shadow fades in on the wall beside the player's and makes a shape. It is softer and slightly lighter than the player's, so the two are never confused, and it holds the shape gently and repeats it, as if it were waiting.
2.  **The player copies it.** When the player's shape commits, the friend's hand fades.
3.  **The shadow becomes the memory.** The player's shadow turns into the scene's first puppet (the rabbit becomes a rabbit, the cup holds a firefly), and the memory plays.

This is the tutorial, the help for a stuck player, and the friend's presence in one. Making a shape the friend shows you is how the boy remembers.

**How it is built:** the story director (`src/engine/stage/story/story-director.ts`) plays each scene as a list of beats in `story-script.ts`: a `friend` beat shows the friend's hand and waits for the player's commit of its shape; a `memory` beat plays a puppet scene (keyframed tracks, `src/engine/stage/puppet/`) and can start one of its puppets where the player's shadow was. The friend's hand is a painted shadow of a hand making the shape, drawn the way the old shadow-puppet plates draw one (`friend-puppet.ts`, its art in `puppet-art.ts`), as a small puppet with the moving fingers (a rabbit's ears) as parts of their own; it forms the shape, holds it, and every few seconds eases half out of it and back. (A posed hand cast like the player's was tried first: a shadow made of a hand's bones reads as a hand, not as a rabbit.) Each shape needs its own painted hand; a shape without one shows nothing yet. The story is written for the 1.6 by 1 m stage and drawn `STORY_SCALE` (2.375) times bigger, centred on the wall's middle, so the memories, the friend's hand and the story's words fill 95% of the 4 by 2.5 m wall (`StageFrame.setStoryArea`); the player's own shadows keep their size. The candle's light has a mood (`candle-mood.ts`): the story opens `rainy`, its light thin and blue-grey, and a scene can name another (`StoryScene.candle`, e.g. `warm`) for the light to ease into over a few seconds, so the candle's colour can mark the story's moments; the flame itself stays a flame's colour. `__wsw.candleMood('warm')` tries one. In dev, `__wsw.playStory()` starts the story and `__wsw.commitShape('rabbit')` copies the shape without a hand; `node scripts/story-probe.mjs` takes screenshots.

## The scenes

| # | Scene | Shape | One line |
|----|----|----|----|
| 1 | Waking | none (light the candle) | Alone in the dark; the candle makes it bearable |
| 2 | How they met | Rabbit | The friend teaches him his first shadow rabbit |
| 3 | The park | Fox | Fox chases rabbit; two kids running and laughing |
| 4 | Fireflies | Cup | A summer night; a firefly held in a cupped hand |
| 5 | The last ordinary day | Flat (a wave) | "See you tomorrow" at the school gate |
| 6 | Goodbye | Flat, palm to palm | The friend's hand alone; the player meets it, and it fades |
| 7 | Sleep | Cover the flame | The player puts the candle out, and the boy sleeps |

Fist and spread are not used: a fist reads as anger and is the easiest shape to make by accident, and spread has no memory that fits it yet.

### 1. Waking

- **Purpose:** set the mood without a word. He is awake, alone and it is late.
- **What happens:** BEGIN fades the title to black (built). The headset stays black. In it, his friend slowly gathers: a faint pale glow of a boy lifting a hand to wave, soft-edged and never quite clear, like a dream (built). Then far off thunder rolls, low and muffled, and the dream goes with it: it is what woke him (built). While it rumbles away his eyes open on the room: a slow, heavy blink, a quicker, wider one, and they stay open (built). The room is dark and cold blue. A short silence, then the room tone. The player lights the candle (built), and the room warms.
- **The player:** lights the candle.
- **Must make the player feel:** lonely, then a little safer once the light is there.
- **Built already:** the fade to black, the blinks (`src/engine/stage/wake-timeline.ts` has the timing, `src/engine/shadow/wake-view.ts` draws it; `__wsw.playWake()` replays it), the cold room, lighting the candle.
- **To try:** whether the friend in the flash reads as a friend and never as a figure to fear (keep it small, soft and brief); `__wsw.playWake()` replays it. A whispered "noo…" was tried in the dark and dropped (it read wrong); the timeline still has a slot for a word. Whether something of the friend's is in the room from the start, unlit until the end.

### 2. How they met

- **Purpose:** introduce the friend and the game's one mechanic.
- **What happens:** the friend's hand appears and makes a rabbit. When the player copies it, the player's rabbit hops off their hand and becomes a puppet rabbit. The scene widens: two small kids under a blanket fort with a torch, one showing the other how to make the rabbit. The new kid tries, gets it wrong (a lumpy shape), then gets it right. They both laugh.
- **The player:** Rabbit.
- **Must make the player feel:** delight at the transformation; warmth towards the friend.
- **Puppets:** the boy, the friend, the blanket fort, a rabbit.
- **Note:** the rabbit is slow to commit and the classifier is weakest on it, so accept it generously here. It is the first shape, and it must not frustrate.
- **Built (first pass, 13 Nov):** the friend's rabbit on the left of the wall, waiting; the player's rabbit becoming a puppet rabbit that hops to the friend's raised hand; the fort, the torch and the two kids fading up around it; the boy's lumpy try, the friend leaning over to help, the boy's rabbit coming right, the rabbits nodding to each other, and both laughing; then it fades (about 23 s). Its timing and places are in `src/engine/stage/story/how-they-met.ts`, the cut-outs in `src/engine/shadow/puppet-art.ts`.
- **To try:** whether the friend's painted rabbit hand reads in a headset, and whether players copy it with one hand; the sizes on the wall in a headset; laughter in the sound, which the memory has only notes for so far.

### 3. The park

- **Purpose:** pure joy. The friendship at its most carefree.
- **What happens:** the friend's hand makes a fox. When the player copies it, the friend's rabbit (from scene 2) bolts across the wall and the player's fox gives chase. They turn into the two boys running between trees, one catching the other, both falling over laughing.
- **The player:** Fox.
- **Must make the player feel:** play, speed, laughter.
- **Puppets:** the fox, trees, the boys running (reused from scene 2).
- **Sound:** laughter. Keep it in mind: it is missing from later scenes.

### 4. Fireflies

- **Purpose:** a quiet, close moment. The most tender memory.
- **What happens:** the friend's hand makes a cup. When the player copies it, a small point of light appears in their cupped shadow: a firefly. More drift across the wall. The two boys sit side by side on a hill, a jar between them, and let the fireflies go.
- **The player:** Cup.
- **Must make the player feel:** stillness, closeness, a summer that seemed endless.
- **Puppets:** the boys sitting (one shot, to reuse in scene 5), a jar, fireflies (small lights on the wall).
- **To try:** the firefly light comes from the wall, not the candle, so this is the only scene with a second light. Check that it reads as magic, not as a bug.

### 5. The last ordinary day

- **Purpose:** the turn. Without saying it, show that this was the last time.
- **What happens:** the friend's hand makes a flat hand, a wave. When the player copies it, the scene is the school gate after school. The boys wave to each other and go opposite ways, as on any day. The friend turns back once and waves again, then walks off the edge of the wall. Then the shot from scene 4 returns, the hill and the jar, with only one boy sitting there.
- **The player:** Flat (a wave).
- **Must make the player feel:** that something is ending, before they can say what.
- **Puppets:** the school gate, the boys walking and waving, the single boy on the hill (from scene 4).
- **How it lands without words:** the repeated shot with one boy missing, the laughter from scene 3 gone, the music-box tune dropping to a single note, and the candle dimming. This is the scene to test hardest with someone who doesn't know the premise.

### 6. Goodbye

- **Purpose:** let the boy, and the player, say goodbye.
- **What happens:** no memory this time. The wall is empty except for the friend's hand, held up flat, alone. It waits. When the player raises their own flat hand to meet it, palm to palm, the two shadows touch, and the friend's hand slowly fades away.
- **The player:** Flat, held against the friend's hand.
- **Must make the player feel:** grief, and some peace.
- **Puppets:** none; the friend's hand only.
- **To try:** how long the friend's hand takes to fade, and whether it lingers if the player pulls away early.

### 7. Sleep

- **Purpose:** the ending: rest.
- **What happens:** the candle has burned low. The wall is dim and the room quiet. The player covers the flame, and it goes out. Darkness, the boy's breathing slows, and the game fades to black.
- **The player:** covers the flame. In every other scene this pauses the game; here it puts the candle out. The player chooses when he sleeps.
- **Must make the player feel:** calm and finished.
- **Change needed:** the session's states (title, playing, paused) need an ending that covering the flame leads to here instead of the pause menu.
- **To try:** something of the friend's in the room, lit by the last of the candle before it goes out.

## Throughout the night

- **The candle burns lower** after each memory, so the player can see the night moving towards sleep. The room warms when it is lit and cools again towards the end.
- **The rain** falls all night outside the window, and its sound is a steady bed from the window's side. Now and then the window flickers pale and, a few seconds later, thunder rolls far off, low and muffled: safe inside on a wet night, never a threat (`src/engine/stage/storm.ts` times it; `__wsw.thunder()` brings a flash now). Later it could ease off as he nears sleep.
- **The music** is the music-box tune, fuller in scenes 2 to 4, thinning in 5, a single note in 6, silent in 7.
- **Puppets in total:** about eight (the two boys, a rabbit, a fox, a blanket fort, trees, a school gate, a jar and fireflies), each with simple rod-puppet motion: slides, bobs and turns on one pivot.

## Build order

So that every step leaves a game we could submit:

1.  The story graph, the friend's hand, and scene 2 from start to finish (first pass built 13 Nov).
2.  Scenes 6 and 7. With scenes 1, 2, 6 and 7, the game is short but complete.
3.  Scenes 3, 4 and 5, in that order. If time runs short, cut from the end; scene 5 can be merged into 6 by having the friend's hand wave before it waits.

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
