# Asset tracker

Every sound, piece of music, model and font the game has, uses as a stand-in, or still needs. Update a row when its status changes.

- [`CREDITS.md`](../CREDITS.md) records who made each shipped file and its licence. Add a row there whenever a file goes in.
- [`ASSET-SOURCES.md`](ASSET-SOURCES.md) covers where to download, the size budgets and how a file gets into the game.

**Status:** **Final** = a real file that is in the game. **Placeholder** = in the game, but made in code; replace it. **Needed** = the story or the room asks for it and nothing exists yet. **Unused** = in the repo but nothing plays or shows it. **Drop** = left over from the puzzle game (deleted 11 Nov); remove it.

Last checked: 15 Nov 2026.

## Sound effects

All 29 sounds are made in code by `src/engine/services/audio/placeholder-sounds.ts`; there are no audio files yet. Each is defined in `src/engine/services/audio/sounds.ts`, and its name is the file name a real one will have (`src/assets/audio/sfx/<name>.ogg`).

> **Not wired yet:** nothing loads files from `src/assets/audio/` into the engine (`WebAudioEngine.setBuffer` is never called), so a file dropped in there is ignored until that is built.

### In the game now (replace these first)

| Name | What it should sound like | When it plays | Status |
|---|---|---|---|
| `thunder` | Far-off thunder, low and muffled by distance and walls, about 6 s | Wakes him in scene 1; after the window flashes; the prologue's storm | Placeholder |
| `rain` | Steady rain on the window and roof, seamless loop | All night, from the window's side | Placeholder |
| `covers` | A soft slide of heavy bedclothes | He sits up in bed (scene 1) | Placeholder |
| `ignite` | A match struck, then a flame catching | Lighting the candle; BEGIN on the title screen | Placeholder |
| `crackle` | A quiet candle flame, seamless loop | While the candle is lit | Placeholder |
| `lift` | The candle picked up off the tray | Moving the candle | Placeholder |
| `set` | The candle set down on the tray | Moving the candle | Placeholder |
| `rustle` | A light, dry paper crinkle | A hand shape is recognised | Placeholder |
| `thump` | A soft, low thump | A hand shape is accepted | Placeholder |
| `release` | A soft letting-go | A shape is let go | Placeholder |
| `lost` | A low falling pair of tones | Hand tracking lost for too long | Placeholder |
| `note0` to `note4` | Five music-box notes: C5, D5, E5, G5, A5 | The lullaby notes in the prologue | Placeholder |
| `tick` | A tiny tick | A fingertip reaches a menu item | Placeholder |
| `press` | A soft click | A menu item is pressed | Placeholder |

### Made but not played

| Name | What it is | Status |
|---|---|---|
| `hum` | The room tone, a low loop. Scene 1 asks for "a short silence, then the room tone". | Unused (needs wiring) |
| `clock` | A slow wooden clock, loop | Unused. Keep only if a clock goes in the room. |
| `wind` | Wind outside, loop | Unused. Rain is the night's sound now. |
| `chime` | A small bell | Unused |

### Left over from the puzzle game

`twinkle` (spirit fox), `hop` (rabbit landing), `step0` and `step1` (the traveller's footsteps), `snowtick` (snow on the glass), `creak` (a beam). Status: **Drop**.

### Sounds the story needs that don't exist

| Sound | Where (see `STORY.md`) | Status |
|---|---|---|
| Children's laughter | Scene 3 (they lie in the grass laughing); its absence in scene 5 is part of the loss | Needed |
| Torch clicking on | The prologue, when she sets the torch down. A lullaby note plays there now. | Needed |
| Far thunder inside the memory | Scene 3, listed as "still to do" | Needed (could reuse `thunder`) |
| Breathing slowing, or a small yawn | Scene 7, as he falls asleep | Needed |
| Rain easing off | Scene 7 | Needed (could be `rain` faded, or a lighter take) |

## Music

| Name | What it is | Status |
|---|---|---|
| `music` | A 24 s loop of sine pads and music-box notes over A minor, F, C, G (in code) | Placeholder, and **never started**: no music plays in the game now |
| The lullaby | One music-box melody through the whole story: fuller in scenes 2 to 4, thinning in 5, a single note in 6, silent in 7 (`STORY.md`, "The music"). Best delivered as layers or stems so it can thin out. Keep it in a key the five notes fit, or replace the notes to match. | Needed |

## 3D models

Files live in `src/assets/models/`; the pieces are placed by `src/engine/shadow/room-models.ts` and the layout file `content/rooms/bedroom.json` (moved with the room editor).

### In the game

| File | What | Status |
|---|---|---|
| `bedSingle.glb` | The bed he sits up in | Final |
| `bookcaseOpen.glb` | Bookcase on the right wall | Final |
| `rugRound.glb` | Round rug | Final |
| `chair.glb` | Chair by the window | Final |
| `pottedPlant.glb` | Potted plant | Final |
| `hands/glove-left.glb`, `hands/glove-right.glb` | Glove hands (setting) | Final |
| `hands/cartoon-glove-left.glb`, `hands/cartoon-glove-right.glb` | Cartoon glove hands (setting) | Final |

### In the repo but not placed

| File | What | Status |
|---|---|---|
| `bear.glb` | Teddy bear | Unused |
| `books.glb` | Loose books | Unused |
| `sideTable.glb` | Bedside table | Unused |
| `lampRoundTable.glb` | Small table lamp | Unused |
| `candleStick.glb` | Candlestick | Unused (the candle on the tray is drawn in code) |
| `candles.glb` | Candles | Unused |

### Drawn in code (no file)

The bed tray, the quilt on his lap, the candle and its flame, the walls, the window with the rain, the shelf, the windowsill, the two pictures (`picture-hill`, `picture-moon`), the moonlight patch on the floor, the tin can, and all of the puppets and scenery on the wall (`src/engine/shadow`, `src/engine/render`, `src/engine/stage/puppet`). The shelf's "wonders" glows are left over from the puzzle game.

### Needed: tied to the story

| Model | Why | Status |
|---|---|---|
| Glass jar (lid, maybe a string handle) | "The jar the friend gave him" on the shelf, seen in scene 1 and lit by the last of the candle in scene 7 | Needed |
| Moving boxes, 2 or 3, one open and half unpacked | The prologue shows he has just moved in; the real room can echo it | Needed |
| Torch / flashlight | Hers, from the night they met, kept on the shelf or nightstand | Needed |
| Stuffed rabbit (or fox) | The first shapes are the rabbit and the fox | Needed |
| A blanket over a chair | Echoes the blanket fort in scene 2 | Needed |

### Needed: a lived-in kid's bedroom

Keep everything off the wall ahead and out of the space between the candle and that wall: it is the stage. Put things on the side walls, by the bed and behind the player. Keep to the low-poly Kenney / Quaternius look.

| Model | Status |
|---|---|
| Nightstand (or place `sideTable.glb`) with an alarm clock | Needed |
| Wardrobe | Needed |
| Desk and desk chair, with a pencil jar or a globe | Needed |
| Toy chest, and a few loose toys (blocks, a toy car, a ball) | Needed |
| Curtains for the window, partly open | Needed |
| The room's door, with coat hooks and a school bag | Needed |
| Slippers by the bed | Needed |
| Crayon drawings on a side wall | Needed (could be drawn in code) |
| String lights (unlit) | Needed |
| Ceiling lamp (off) | Needed |

## Fonts

| File | What | Status |
|---|---|---|
| `src/ui/title-screen/fonts/cinzel-decorative-*` | Title lettering (Cinzel Decorative, SIL OFL 1.1) | Final |
| `src/ui/menu-panel/fonts/cinzel-latin-400-normal.woff2` | Pause and end screens (Cinzel, SIL OFL 1.1) | Final |
