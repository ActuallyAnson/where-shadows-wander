# Assets

Every sound, piece of music, model and font the game has, uses as a stand-in, or still needs, and how to get new ones in. Update a row when its status changes.

- [`CREDITS.md`](../CREDITS.md) records who made each shipped file and its licence. Add a row there whenever a file goes in.
- [Getting new assets](#getting-new-assets) covers where to download, the size budgets and how a file gets into the game. Check the competition's rule on third-party assets in [`COMPETITION.md`](COMPETITION.md) before relying on anything that is not CC0.

**Status:** **Final** = a real file that is in the game. **Placeholder** = in the game, but made in code; replace it. **Needed** = the story or the room asks for it and nothing exists yet. **Unused** = in the repo but nothing plays or shows it. **Drop** = left over from the deleted puzzle game; remove it.

## Sound effects

Each sound is defined in `src/engine/services/audio/sounds.ts`, and its name is its file name (`src/assets/audio/sfx/<name>.ogg`). A file there replaces the sound made in code by `src/engine/services/audio/placeholder-sounds.ts` once it has loaded (`src/engine/services/audio/sound-files.ts`, a second or so after the page opens); a sound with no file, or whose file fails to load, keeps its placeholder. Files so far: `thunder`, `rain`, `covers`, `ignite`, `crackle`, `rustle`, `thump`, `release`, `tick`, `press`, `lost`, `step0`, `step1`, `dooropen`, `doorclose`, `laugh`, `click`, `rumble`, `yawn`, `giggle`, `hop`, `blanket`, `run`, `jar`, `bell`, `gate`, `creak`, `gust`, `crickets`, `wind`, `birds`, `firefly`, `palms`, `slide`, `snuff`, `breath`; every sound effect has a recording. `laugh`, `yawn`, `dooropen`, `doorclose` and the story and night sounds from `giggle` on have no placeholder (a voice made in code sounds like a machine, and the rest are real recordings with nothing worth imitating): like the music they are `fileOnly`, silent until their file loads. A memory can also lay a loop under itself with a `bed` cue (`crickets` or `wind`, until the next `bed` cue); the bed is worked out from the story's time every frame (`bedAt`, `StoryDirector.bed`), so skipping a memory never leaves one running, and it fades in and out over a couple of seconds (`SoundDef.fadeS`). `creak` and `gust` also play between memories, now and then, from the house (`src/engine/stage/night-sounds.ts`). A memory plays a sound with a `sound` cue (`puppet-scene.ts`; the names a cue may use are `StorySound`), from its place on the wall. A sound with a file has its placeholder rendered only if the file fails (`sound-prerender.ts` skips it). Credit each new one in `CREDITS.md` and in the end credits (`src/ui/credits/credits.ts`).

### In the game now (replace these first)

| Name | What it should sound like | When it plays | Status |
|---|---|---|---|
| `thunder` | Far-off thunder, low and muffled by distance and walls, about 6 s | Wakes him in scene 1; after the window flashes; the prologue's storm | Final: "Huge Thunder Crack [XY]" by -CASK- (CC BY 4.0), cut to 7 s and low-passed |
| `rain` | Steady rain on the window and roof, seamless loop | All night, from the window's side | Final: "rain wind city 40m 002" by klankbeeld (CC BY 4.0; credit freesound.org too, never share the raw file), a 24 s loop. It is faded out as he falls asleep (`ending-timeline.ts`); a lighter take for the easing would still help. |
| `covers` | A soft slide of heavy bedclothes | He sits up in bed (scene 1) | Final: "Bed sheets (SoundAction 104)" by alexarje (CC BY 4.0), cut to 3.5 s |
| `ignite` | A match struck, then a flame catching | Lighting the candle; BEGIN on the title screen | Final: "match strike 05" by tim.kahn (CC BY 4.0), cut to 1.9 s |
| `crackle` | A quiet candle flame, seamless loop | While the candle is lit | Final: "fire crackling, fireplace, BBQ" by AlexanderChe (CC0), a 14 s loop |
| `rustle` | A light, dry paper crinkle | Not played: a recognised shape is silent (the sound only distracted); the file is kept | Final: "Crinkle; Paper" by Crovic (CC0), cut to 0.45 s |
| `thump` | A soft, low thump | Not played: a committed shape is silent (the sound only distracted); the file is kept | Final: "Deck of Cards, Thump on Table" by designerschoice (CC BY 4.0), one thump, 0.32 s |
| `release` | A soft letting-go | A shape is let go | Final: "Slide release (PSX Horror SFX Free)" by heyheytheree (CC BY 4.0), cut to 0.3 s and softened |
| `lost` | A soft sigh, a breath going out; gentle, not an alarm | Hand tracking lost for too long | Final: "ManSighMovement" by bennychico11 (CC BY 4.0), cut to 1.4 s |
| `tick` | A tiny tick | A fingertip reaches a menu item | Final: "Button hover" by Fachii (CC0) |
| `press` | A soft click | A menu item is pressed | Final: "UI Button Press" by el_boss (CC0), cut to 0.18 s |
| `laugh` | Two young kids laughing together, warm and unforced | Scene 2: after his rabbit comes right, and the giggles after the hush; scene 3: lying in the grass. Never after scene 3: its absence is part of the loss. Captioned "[children laughing]" | Final: "Children's Toys Laughing" by f-r-a-g-i-l-e (CC0), a 3.3 s stretch. No placeholder (`fileOnly`). The giggles reuse the same take: a shorter, softer giggle would fit them better |
| `click` | A small torch's switch clicking on | Scene 2's prologue, as she sets her torch down between them. Captioned "[a torch clicks on]" | Final: "Torch Click 2" by BenjaminNelan (CC0), 0.34 s |
| `rumble` | Far thunder inside a memory: softer than the room's own | Scene 2's fort, while she shows him the rabbit (3.2 s in), from the memory's window. Captioned "[distant thunder]" | Final: a thunder clip from csengeri's "30th May 2016 thunderstorm in Pecel, Hungary" (CC0), 6.7 s. Placeholder: the room thunder's |
| `yawn` | A small, sleepy child's yawn | The end, 10.2 s after covering the flame, as his eyes come back open after the first heavy blink (`ENDING_SCRIPT.yawnAt`), from his lap. Captioned "[a sleepy yawn]" | Final: "Yawn 2" by OwlStorm (CC0), cut to 2.9 s. No placeholder (`fileOnly`) |
| `giggle` | A short, stifled giggle: two kids trying to be quiet | Scene 2, after the hush (in place of the full laugh). Captioned "[stifled giggles]" | Final: "Child Giggle" by wolfdoctor (CC BY 4.0), 3.1 s. No placeholder |
| `hop` | A tiny soft pat | Scene 2: each landing of the rabbit's three hops to her hand and its two hops down onto the blanket | Final: "Jump (Footsteps SFX Free)" by heyheytheree (CC BY 4.0), low-passed, 0.55 s. One take for every hop: a second, alternated, would help. No placeholder |
| `blanket` | A soft cloth whoosh | Scene 2's prologue, when the boy pulls the blanket over himself and when she throws it up into the fort | Final: "Fluffing Blanket" by mlestn1 (CC0), 1.2 s. No placeholder |
| `run` | Light feet running on grass | Scene 3, twice while the kids run, before she catches him | Final: "Grass_Footsteps" by D001447733 (CC BY 3.0), 1.3 s, hiss gated down. A quiet, hissy take: replace if a cleaner one turns up. No placeholder |
| `jar` | A small clink of glass | Scene 4, as the firefly settles into her jar | Final: one clank of "Wine Glass clank 2" by wasserbjorn (CC0), 1.3 s. A glass clink; no tin lid. No placeholder |
| `bell` | A school bell far off | End of scene 4, as the school gate slides in with the morning. Captioned "[a school bell, far off]" | Final: "morning bell" by barkenov (CC0), four strokes, band-passed to sound far off, 9 s. No placeholder |
| `gate` | A gate's creak and clank | Scene 5, as the boy goes through the gate they part at. Captioned "[a gate creaks]" | Final: "GATE:" by German1990 (CC BY 3.0), 2.25 s. No placeholder |
| `creak` | The house settling: a creak of the floor | Between memories (scene 1 and the friend's waits), now and then (`night-sounds.ts`), from behind him by the door. Captioned "[the house creaks]" | Final: one creak of "floor_creak_3" by tipitapipuddin (CC0), 1.4 s. No placeholder |
| `gust` | A gust of wind | Between memories, now and then, on the room's window (`night-sounds.ts`); scene 6, as she fades. Captioned "[a gust of wind]" | Final: "Gust (Weather & Nature SFX Free)" by heyheytheree (CC BY 4.0), 3.8 s. No placeholder |
| `crickets` | Crickets at dusk, seamless loop (a story bed) | From dusk in the park (scene 3) through the fireflies until the park slides off into morning (scene 4), from the wall | Final: "crickets night urban park..." by kyles (CC0), a 20 s loop. No placeholder |
| `wind` | A thin, gentle wind, seamless loop (a story bed) | From the park sliding away at the end of scene 5, through the friend's lone hand and the goodbye, until he fades (scene 6), from the wall | Final: "Wind strong gusts in small hangar" by Angel_Perez_Grandi (CC BY 4.0), a 20 s loop, band-passed, very quiet. No placeholder |
| `birds` | Birdsong, seamless loop (a story bed) | Scene 3's spring park from when it slides in until dusk (the crickets take over), and the morning at the school gate from the end of scene 4 until the gate slides off in scene 5, from the wall | Final: "Birdsong in Tuscany" by evernaut (CC BY 4.0), a 20 s loop. Birdsong only, no leaves in the breeze. No placeholder |
| `firefly` | A tiny soft shimmer | Scene 4: as the firefly settles in the player's cup, and as each firefly comes down to the kids' hands | Final: "Magic Fireflies" by IENBA (CC0), 1.6 s. No placeholder |
| `palms` | Emotional piano phrase emphasizing the goodbye | Scene 6, from palm meeting palm through parting and the start of her fade (`0.05..12.05 s`). Captioned "[a gentle piano plays]" | Final: "Emotional Piano 005 (Am-80)" by Xinematix (CC0), 12.0 s mono, faded in and out. No placeholder |
| `slide` | A soft, dry slide of card | Every time places slide on or off the wall (scenes 2 to 5), very quiet | Final: one slide of "sliding paper on table" by 123jorre456 (CC0), 0.85 s. No placeholder |
| `snuff` | A small hiss as a flame gutters out | The end, just after his hand covers the flame (`ending-timeline.ts`), from the flame. Captioned "[the candle hisses out]" | Final: "Match Sizzle 02" by squareal (CC0), 1.75 s. A hiss as it is covered; nothing when the light finally goes. No placeholder |
| `breath` | One slow breath in and out | The end, from the second heavy blink into the black before the credits (`ending-timeline.ts`), from his lap. Captioned "[a slow breath]" | Final: "Deep Breath 1_1" by Joao_Janz (CC0), 7.4 s. One breath: a second, slower one would say "slowing" better. No placeholder |
| `step0`, `step1` | A grown-up's soft footsteps on a wooden floor beyond a door, two takes to alternate; unhurried, not threatening | Scene 2's hush: footsteps coming and going outside the fort while she covers the torch (seven steps from the wall's right edge, captioned "[footsteps outside]") | Final: "Walk Footstep with Clothing Foley 6 (Hard Floor/Wooden)" by EvanBoyerman (CC BY 4.0), two soft low-passed variants to sound beyond a door, 0.58 s each |
| `dooropen` | A door opening slowly outside the room | Scene 2's hush, as the door's line of light opens (`H_DOOR`, from the door's side). Captioned "[a door opens]" | Final: opening half of "Door opening and closing 7" by JakLocke (CC BY 4.0), cut to 2.1 s, band-limited. No placeholder |
| `doorclose` | That door easing and clicking shut | Scene 2's hush, as the door's line of light closes (`H_DOOR_SHUT`, from the door's side). Captioned "[a door closes]" | Final: closing half of "Door opening and closing 7" by JakLocke (CC BY 4.0), cut to 1.4 s, band-limited. No placeholder |

### Sounds still needed

Each would be one more `Sound` in `sounds.ts`; a memory's would be one more name in `StorySound` and a `sound` cue in its chapter. Keep every one quiet and soft: the rain, the candle and the music are the bed, and these sit on top of it.

| Sound | Where (see `STORY.md`) | Why it helps | Status |
|---|---|---|---|
| Quilt pulled up, a head on the pillow | Scene 7, between the candle going out and the blinks | He lies back down: the mirror of `covers` in scene 1, so the night closes as it opened | Needed (`covers` played softer could stand in) |
| Match-near-wick proximity sizzle / warmth hum | Scene 1, while the match approaches and heats the wick (`ignition.ts`) | Gives tactile and low-vision audio feedback during the 3 s ignition hold before `ignite` fires | Needed (improves onboarding and accessibility) |
| Soft torch-cover pat / muffled cloth thump | Scene 2's hush, when the friend claps her hand over the torch (`H_CLAP`) | Grounds her sudden lunge and deepens the tactile link to covering the candle at the end | Needed |
| Soft pause hush and relight breath | When the pause menu opens (the headset's system menu, or the headset taken off) and when Resume relights the candle | Confirms the pause and the return in audio without breaking the quiet mood | Needed |
| Subtle shape-hold parchment breath / swell | Scenes 2–6, while a recognised shape hold fills before the commit `thump` | Lets players hear the hold progressing toward commit without looking away from their shadow | Needed (accessibility and responsiveness) |
| Lighter rain loop for sleep easing | Scene 7, cross-faded with `rain` as he falls asleep (`ending-timeline.ts`) | Softens the patter naturally alongside the dimmer room instead of relying on volume dip alone | Needed |

## Music

The music files live under `src/assets/audio/music/` (`music.ogg` is `Sound.Music` and `credits.ogg` is `Sound.Credits` in `sounds.ts`). Both play flat (not placed in the room, so the same in both ears) on the music bus, and only from their files: until a file has loaded it is silent, and neither has a placeholder. Everything under `audio/music/` is kept out of IWSDK's asset manifest (`src/app/assets.ts`) so it is decoded once, not twice.

| Name | What it is | When it plays | Status |
|---|---|---|---|
| `music` | One quiet, bittersweet orchestral track (guitar, pads), looped | From the candle's lighting until the candle goes out in scene 7: turned down under the pause menu, out with the candle as he falls asleep (`ending-timeline.ts`) | Final: "Emotional Mysterious Music" ("I Got Lost") by Migfus20 (CC BY 4.0), the whole 4:41 track, mono, 1.4 MB. Tune its level (`gain` in `sounds.ts`) by ear on a headset |
| `credits` | Quiet melodic synth pluck, pad and bass | Over the end credits and thank-you card (`ending-timeline.ts`, from `creditsAt` to `endAt`) | Final: "Atmospheric Melodic Synth - Pluck, Pad & Bass" by Jadis0x (CC0), 39.5 s excerpt trimmed from 16.0 s and faded, mono, 260 KB |

## 3D models

Files live in `src/assets/models/`; the pieces are placed by `src/engine/shadow/room-models.ts` (`ROOM_PIECES`, each fitted to a footprint, so a model's own units do not matter) and the layout file `content/rooms/bedroom.json` (moved with the room editor).

### In the game

| File | What | Status |
|---|---|---|
| `bedSingle.glb` | The bed he sits up in, its own cover over his legs | Final |
| `bookcaseOpen.glb` | Bookcase on the right wall | Final |
| `rugRound.glb` | Round rug | Final |
| `pottedPlant.glb` | A small potted plant on the nightstand | Final |
| `glassJar.glb` | The jar she gave him, lid on, on his desk under the window (piece `jar`): her firefly glows in it from scene 1 until it leaves in scene 5; the last of the candle finds it empty in scene 7 | Final: "Glass Jar" by Jarlan Perez (CC BY 3.0) |
| `flashlight.glb` | Her torch from the night they met, lying beside the jar (piece `torch`) | Final: "Time Hotel 7.07" by S. Paul Michael (CC BY 3.0), body recoloured from black to faded red so it shows in the dark |
| `cardboardBoxStack.glb` | A stack of taped moving boxes in the front right corner (piece `boxes`): he has just moved in | Final: Quaternius (CC0) |
| `cardboardBoxOpen.glb` | An open box, half unpacked, just inside the door, left of the bed's head (piece `box-open`) | Final: Kenney (CC0) |
| `cardboardBoxFlat.glb` | A flat box beside it, under the folded blankets (piece `box-flat`) | Final: Quaternius (CC0) |
| `blanketsFolded.glb` | Folded blankets on the flat box (piece `blankets`), a nod to the blanket fort | Final: "Blankets" by Poly by Google (CC BY 3.0). 19k triangles, the heaviest model; simplify if the frame budget needs it |
| `toyFox.glb` | A toy fox on the boxes, looking at the bed (piece `fox`); her shape | Final: "Fox" by Poly by Google (CC BY 3.0). Texture cut from 2048 px PNG to 512 px JPEG (1 MB to 100 KB) |
| `toyRabbit.glb` | A toy rabbit on the rug, looking at the bed (piece `rabbit`); his shape | Final: "Rabbit" by Poly by Google (CC BY 3.0), rotated to Y-up/+Z-forward and scaled to metres |
| `wallPainting.glb` | A framed landscape painting on the right wall above the moving boxes (piece `wall-painting`) | Final: "Wall painting" by jeremy (CC BY 3.0), rotated to +Z-forward and scaled to metres |
| `desk.glb` | His desk under the window, against the left wall (piece `desk`) | Final: "Desk" by Quaternius (CC0) |
| `deskChair.glb` | The desk's chair, pulled up to it, its back to the bed (piece `chair`); it replaced Kenney's `chair.glb` | Final: "Chair" by Quaternius (CC0) |
| `pencilJar.glb` | A mug of pencils, scissors and a ruler on the desk (piece `pencils`) | Final: "Mug With Office Tool" by CreativeTrio (CC0) |
| `globe.glb` | A globe on the desk (piece `globe`) | Final: "Globe" by CreativeTrio (CC0) |
| `curtains.glb` | Curtains either side of the window, down to just over the desk, drawn back in code so the moon shines in (piece `curtains`, `part` in `room-models.ts`) | Final: "Curtains Double" by Quaternius (CC0) |
| `closet.glb` | A small wardrobe in the back left corner (piece `closet`) | Final: "Closet" by Quaternius (CC0) |
| `door.glb` | The room's door, on the back wall left of the bed's head (piece `door`); the moving boxes stand just inside it | Final: "Door" by Quaternius (CC0) |
| `nightstand.glb` | The nightstand right of the bed's head, the plant on it (piece `nightstand`) | Final: "Night Stand" by Quaternius (CC0) |
| `slippers.glb` | His slippers on the rug beside the bed (piece `slippers`) | Final: "Slippers" by J-Toastie (CC BY 3.0) |
| `backpack.glb` | His schoolbag, dropped between the nightstand and the bookcase (piece `bag`) | Final: "Backpack" by Quaternius (CC0) |
| `coatRack.glb` | A coat stand against the right wall (piece `coat-stand`) | Final: "Coat Rack Standing" by Kenney (CC0) |
| `ceilingLight.glb` | The ceiling light, unlit, over the middle of the room (piece `ceiling-light`) | Final: "Light Ceiling" by Quaternius (CC0) |
| `hands/glove-left.glb`, `hands/glove-right.glb` | Glove hands (setting) | Final |
| `hands/cartoon-glove-left.glb`, `hands/cartoon-glove-right.glb` | Cartoon glove hands (setting) | Final |

### In the repo but not placed

Kept to dress the room with the room editor: the bear can stand in for a stuffed toy, the side table for the nightstand. There is no candle model: the candle on the tray is drawn in code and never moves.

| File | What | Status |
|---|---|---|
| `bear.glb` | Teddy bear | Unused |
| `books.glb` | Loose books | Unused |
| `sideTable.glb` | Bedside table | Unused |
| `lampRoundTable.glb` | Small table lamp | Unused |

### Removed from the room: replace with models

The room's props that were drawn in code were taken out, because the room looked cluttered and they did not match the low-poly models around them. Git history has them (`room-art.ts`, `room-dressing-view.ts`, `bedroom-view.ts`). Bring back only the ones the room needs, as `.glb` files, one at a time, and look at the room in the headset after each. A model goes in as a `RoomPiece` in `room-models.ts` or is placed with the room editor.

| What was there | Where it was | Replace with | Status |
|---|---|---|---|
| Two framed pictures: a bird and the moon, and a hill under stars (pieces `picture-moon`, `picture-hill`) | Right wall, over the bed and the bed's foot | One or two picture-frame models, or a frame with a small image texture. A hill of stars echoes scene 6 | Partly done: `wallPainting.glb` hangs on the right wall above the moving boxes; a second framed picture or crayon drawing remains optional |
| A wall shelf of books, a toy boat and a small lamp (piece `shelf`) | Back wall, above the nightstand, right of the bed's head | A wall-shelf model; `books.glb` and `lampRoundTable.glb` (in the repo, unused) could stand on it | Needed (optional) |
| Things on the windowsill: a potted fern, a paper bird on two books, an unlit candle stub (piece `sill`) | The window's sill, left wall | Probably not needed: the desk with its pencils and globe is under the window now | Needed (optional) |
| A tin can with a wooden spoon in it (piece `tin-can`) | On the floor by the bed | Nothing: a leftover from the old winter-cottage room | Not needed |
| A painted bed, bookcase and rug, shown only until their models loaded | Where `bedSingle.glb`, `bookcaseOpen.glb` and `rugRound.glb` stand | Nothing: the models are the bed, bookcase and rug | Not needed |
| Five "wonder" glows (the shelf's lamp, the pictures, the bookcase, the window) | Over those props | Nothing: left over from the puzzle game, never lit | Not needed |

### Still drawn in code

These stay because the room or the story stops working without them. Each could be swapped for a model or texture later, but none has to be.

| What | Code | Why it stays | Status |
|---|---|---|---|
| The candle, its flame, and the tray it stands on | `src/engine/render/candle-view.ts`, `src/engine/render/room/bed-tray-view.ts` | The candle is the game's one light: it is lit, covered and smothered by the hands, so it is drawn and animated in code | Placeholder: a candle-and-tray model would need to keep the flame in code |
| The walls (plaster and panelling), floor, ceiling and rafters | `room-art.ts` (`paintWall`), `bedroom-view.ts` | The room's shell; the wall ahead is the stage | Placeholder: ambientCG or Poly Haven textures (plaster, wood planks) would replace the painted ones |
| The window: frame, the night outside in four sliding layers, the curtains inside it, two layers of rain, and the lightning flashes | `room-dressing-view.ts`, `room-art.ts` (`paintNight`, `paintRain`), `bedroom-view.ts` | The storm wakes him in scene 1; the rain and flashes play all night | Placeholder: a window-frame model; keep the outside and the rain in code |
| The moonlight through the window | `candle-light.ts` (`setMoonWindow`, `MOON_BEAM`), the opening from `room-dressing-view.ts` | A beam of cool light through the window's opening, cut by its cross bars and shadowed by the curtains and furniture, onto the desk, the chair and the side of the bed; it brightens with each flash and in scene 6 (`goodbye-moon.ts`) | Final (it is light, made in code, not an asset) |
| The puppets and scenery on the wall | `src/engine/shadow/puppet-art.ts` | See below | Final (they are the game's art) |

The puppets' cut-outs are painted by `src/engine/shadow/puppet-art.ts` (`PUPPET_ART`): the kids (`kid`, `kid-head`, `kid-torso`, `girl-head`, `girl-torso`, `ponytail`, `arm`, `leg`), the friend's hands (`friend-rabbit`, `friend-ear`, `friend-fox`, `friend-cup`, `friend-palm`, `friend-arm`, `side-hand`), the shape guide's outlines (`outline-rabbit`, a V; `outline-fox`, a flat hand side on with the thumb up; `outline-cup`; `outline-flat`, its thumb drawn on the right so the mirrored outline matches a right hand), the animals (`rabbit`, `fox`, `lump`), the places (`fort`, `blanket`, `window`, `pane`, `box`, `leafy-tree`, `autumn-tree`, `leaf`, `grass`, `hill`, `school-gate`), the lights (`torch`, `beam`, `orb`, `jar`, and `door-light`, the line of light from a door ajar in scene 2's hush), and the old prologue's `castle`, `hills`, `tree`, `cloak`, `hood`, `staff` and `lantern` (used only by the old `src/engine/stage/puppet/prologue-scene.ts`, which nothing plays; drop with it). All are made in code and owe nothing to anyone. The shape guide's outline (`src/engine/shadow/ghost-outline.ts`) is made from these too: the `outline-*` hand for the shape she waits for (`OUTLINE_SHAPES` in `friend-puppet.ts`), the plainest hand that makes it as it is recognised, not her painted hand, drawn as a thin line just outside its edge and mirrored to face her hand; baked once per shape, in use in every wait for her shape.

### Needed: tied to the story

| Model | Why | Status |
|---|---|---|
| Glass jar (lid, maybe a string handle) | "The jar the friend gave him" on the desk, her firefly in it until scene 5, found empty by the last of the candle in scene 7 | Done: `glassJar.glb`, on the desk; the firefly is made in code (`jar-firefly-view.ts`) |
| Moving boxes, 2 or 3, one open and half unpacked | The prologue shows he has just moved in; the real room can echo it | Done: `cardboardBoxStack.glb`, `cardboardBoxOpen.glb`, `cardboardBoxFlat.glb` |
| Torch / flashlight | Hers, from the night they met, kept on the shelf or nightstand | Done: `flashlight.glb`, on the bookcase |
| Stuffed rabbit (or fox) | The first shapes are the rabbit and the fox | Done: `toyFox.glb` on the boxes and `toyRabbit.glb` on the rug |
| A blanket over a chair | Echoes the blanket fort in scene 2 | Partly: `blanketsFolded.glb`, folded on a box, not draped over the chair |

### Needed: a lived-in kid's bedroom

Keep everything off the wall ahead and out of the space between the candle and that wall: it is the stage. Put things on the side walls, by the bed and behind the player. Keep to the low-poly Kenney / Quaternius look.

| Model | Status |
|---|---|
| Nightstand (or place `sideTable.glb`) with an alarm clock | Partly: `nightstand.glb`; a quiet, dim bedside alarm clock would reinforce waking in the middle of the night |
| Wardrobe | Done: `closet.glb` |
| Desk and desk chair, with a pencil jar or a globe | Done: `desk.glb`, `deskChair.glb`, `pencilJar.glb`, `globe.glb` |
| Toy chest, and a few loose toys (blocks, a toy car, a ball) | Needed |
| Half-unpacked keepsakes for the open box and bookcase (folded paper animal, picture books) | Partly: `books.glb` is in the repo (unused); a small origami/paper-craft prop would tie into the paper-shadow theatre |
| Curtains for the window, partly open | Done: `curtains.glb` |
| The room's door, with coat hooks and a school bag | Done: `door.glb`, `coatRack.glb`, `backpack.glb` |
| Slippers by the bed | Done: `slippers.glb` |
| Crayon drawings on a side wall | Needed (a framed drawing of two kids or shadow shapes, e.g. beside `wallPainting.glb` or on the nightstand) |
| Low-poly ceramic candle saucer and rumpled lap tray details | Needed (upgrades the procedural candle saucer right beneath the player's hands where gaze stays longest) |
| Subtle 1K CC0 timber floorboard and matte plaster wall textures | Needed (replaces small procedural canvases to reduce dark-scene banding in VR and add warmth around the bed) |
| String lights (unlit) | Needed |
| Ceiling lamp (off) | Done: `ceilingLight.glb` |

### Needed: props to pick up and throw (planned)

Small and light-looking, placed within a seated reach (the tray, the bed's edges, a nightstand). See the GDD, "The room and the hands".

| Model | Status |
|---|---|
| A spare pillow | Needed |
| A small plush toy | Needed (could be the stuffed rabbit above) |
| A soft ball | Needed |
| Sounds for a prop landing (soft thud on the floor, on the bed) | Needed |

## Fonts

| File | What | Status |
|---|---|---|
| `src/ui/title-screen/fonts/cinzel-decorative-*` | Title lettering (Cinzel Decorative, SIL OFL 1.1) | Final |
| `src/ui/menu-panel/fonts/cinzel-latin-400-normal.woff2` | Pause and end screens (Cinzel, SIL OFL 1.1) | Final |

## Icons

| File | What | Status |
|---|---|---|
| `public/favicon.ico` | Browser tab icon for `index.html` and `webcam.html`: a lit candle on the night background (`#14161c`), 16 to 256 px. Our own, drawn in code with Pillow | Final |

## Getting new assets

### Workflow

1. Download into `asset-inbox/` at the top of the repo, one folder per download, with whatever came with it. `asset-inbox/` is git-ignored, so raw files are never committed and do not count against the asset budgets.
2. For anything not from Kenney, Quaternius or Poly Haven, add a `source.txt` to its folder with the page URL, the author, and the licence (for example `CC-BY 4.0, by <author>`).
3. Pick what is used and shrink it to fit the budget. A model becomes a single `.glb` in `src/assets/models/` (the file name sets its asset id: `bedSingle.glb` is `bedsingle`). A sound becomes `src/assets/audio/sfx/<name>.ogg` and music goes in `src/assets/audio/music/`, named as in the tables above.
4. Add a row for it to `CREDITS.md`, and update its status here.

### Where to download

#### Models

| Source | Licence | Look | Notes |
|---|---|---|---|
| [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) | CC0 | Low-poly, flat colours | **Start here.** About 140 pieces: beds, bookcases, tables, lamps, rugs, plants, toys. One zip with `.glb` files. Unzip to `asset-inbox/kenney-furniture/`. The room uses several of them. |
| [Kenney 3D kits](https://kenney.nl/assets?category=3D) | CC0 | Low-poly | The rest of Kenney's 3D packs. |
| [Quaternius](https://quaternius.com) | CC0 | Low-poly, softer | Furniture, house interior and medieval or village packs. Take the glTF/GLB version where offered. |
| [Poly Haven models](https://polyhaven.com/models) | CC0 | Realistic scans | Furniture, candles, books, wooden props. Download **1k** textures in **glTF** format, or the files are far too big. |
| [Poly Pizza](https://poly.pizza) | Mixed CC0 and CC-BY | Low-poly | Note the licence and page link for each CC-BY model so it can be credited. |
| [Sketchfab, downloadable](https://sketchfab.com/search?features=downloadable&type=models) | Varies per model | Anything | Needs a login. Note each model's licence. Download "glTF" or "GLB". |

#### Textures

| Source | Licence | Notes |
|---|---|---|
| [ambientCG](https://ambientcg.com) | CC0 | Wood planks, wallpaper, fabric, plaster. **1K-JPG** is enough. |
| [Poly Haven textures](https://polyhaven.com/textures) | CC0 | The same kind of thing, at 1k. |

#### Sounds and music

| Source | Licence | Notes |
|---|---|---|
| [Kenney audio](https://kenney.nl/assets?category=Audio) | CC0 | UI clicks and small effects. |
| [Freesound](https://freesound.org) | Mixed CC0, CC BY, CC BY-NC | Rain, thunder, cloth, matches, laughter. Filter the search to CC0 or CC BY; never take an NC sound. Needs a login. |
| [OpenGameArt](https://opengameart.org) | Mixed | Music and effects. Check each file's licence. |
| [Pixabay sounds and music](https://pixabay.com/sound-effects/) | Pixabay licence (free, no attribution) | Not CC; read its terms against `COMPETITION.md` before using. |

### What a file needs

- **Format (models).** `.glb` is best. `.gltf` with its textures is fine (it is converted to `.glb` before it ships, since loose `.gltf` files are not loaded). `.fbx` or `.obj` will do if that is all there is.
- **Size.** Each shipped model must be at most 500 KB, each texture 512 KB, each sound effect 300 KB and each music file 1.5 MB (`src/engine/services/assets/budgets.mjs`). Prefer low-poly models with small or no textures.
- **Format (audio).** `.ogg` (Vorbis), mono for effects, about 96 to 128 kbps. Loops must join their own start without a click.
- **Licence.** In order of preference:

  | Licence | Use it? |
  |---|---|
  | CC0 | Yes, the safest choice |
  | CC BY | Very likely fine. Credit the author in `CREDITS.md` |
  | CC BY-SA | Allowed, but "share alike" can extend to our changes. Best avoided |
  | Any NC (non-commercial) | Avoid: a competition with cash prizes could count as commercial use |
  | Any ND (no derivatives) | Avoid: rescaling or recolouring a model would break it |

- **Style.** Keep to one look so the room hangs together: low-poly (Kenney, Quaternius) or realistic (Poly Haven), not a mix. Low-poly is lighter on Quest and suits the storybook mood.
