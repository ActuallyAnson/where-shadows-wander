# Credits

## Sounds

Ten sounds are recordings from freesound.org (below). The game's other sounds (the falling pair of tones for lost tracking, the footsteps and the lullaby's five music-box notes) are made in code by `src/engine/services/audio/placeholder-sounds.ts`, which also makes a stand-in for each recorded sound, played only if its file fails to load. Those contain no recordings and no third-party material, so nothing is owed for them. The team intends them to be CC0 1.0; the repository has no licence file yet, so confirm that choice (and the project's own licence) before submission.

| Sound | Made by | Source | Licence |
|---|---|---|---|
| The other sounds | `placeholder-sounds.ts` (this project) | This repository | Made by the project; intended CC0 1.0 (to confirm) |
| `src/assets/audio/sfx/thunder.ogg`, the far thunder ("Huge Thunder Crack [XY]"; changes: cut to 7 s, mixed to mono, low-passed to sound far off, faded, level adjusted) | -CASK- on freesound.org | https://freesound.org/s/732993/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/rain.ogg`, the rain ("rain wind city 40m 002 220519_0361.wav"; changes: a 24 s stretch made into a seamless loop, mixed to mono, low end cut, level adjusted). The author asks to be credited with freesound.org and a link to https://freesound.org/people/klankbeeld/ , not to be used in stock material, and for the raw file not to be shared: keep the download in `asset-inbox/` only | klankbeeld on freesound.org (https://freesound.org/people/klankbeeld/) | https://freesound.org/s/635443/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/covers.ogg`, the bedclothes as he sits up ("Bed sheets (SoundAction 104)"; changes: cut to 3.5 s, low end cut, faded, level adjusted) | alexarje on freesound.org | https://freesound.org/s/863082/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/ignite.ogg`, the match struck to light the candle, and BEGIN on the title screen ("match strike 05.wav"; changes: cut to 1.9 s, mixed to mono, low end cut, faded, level adjusted) | tim.kahn on freesound.org | https://freesound.org/s/193301/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/crackle.ogg`, the candle's flame ("fire crackling, fireplace, BBQ"; changes: a 16 s stretch made into a seamless 14 s loop, mixed to mono, low end cut, level adjusted) | AlexanderChe on freesound.org | https://freesound.org/s/410404/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/audio/sfx/rustle.ogg`, a hand shape recognised ("Crinkle; Paper.wav"; changes: cut to 0.45 s, mixed to mono, low end cut, faded, level adjusted) | Crovic on freesound.org | https://freesound.org/s/661722/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/audio/sfx/thump.ogg`, a hand shape accepted ("GAMEMisc-Blue Snowball Microphone_Deck of Cards, Thump on Table_Nicholas Judy_TDC"; changes: the first thump cut out, 0.32 s, mixed to mono, faded, level adjusted) | designerschoice on freesound.org | https://freesound.org/s/808154/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/release.ogg`, a shape let go ("Slide release (PSX Horror SFX Free)"; changes: cut to 0.3 s, mixed to mono, high end softened, faded, level adjusted) | heyheytheree on freesound.org | https://freesound.org/s/872586/ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `src/assets/audio/sfx/tick.ogg`, a fingertip reaching a menu item ("Button hover.wav"; changes: mixed to mono, faded, level adjusted) | Fachii on freesound.org | https://freesound.org/s/338229/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/audio/sfx/press.ogg`, a menu item pressed ("UI Button Press"; changes: cut to 0.18 s, mixed to mono, faded, level adjusted) | el_boss on freesound.org | https://freesound.org/s/788611/ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

When a recording replaces a sound made in code, add a row for each file here: what it is, who made it, where it came from (a link), and its licence (CC0 or another that allows use in a game). Do not add a file whose licence is not recorded here.

## 3D models

The bedroom's models are in `src/assets/models/` and are loaded by `src/engine/shadow/room-models.ts`. All of them are [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) except the gloves, which are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and must keep their credit. The CC0 ones need no attribution, but it is given here anyway. The raw downloads they were picked from are kept out of the repository (see `docs/ASSETS.md`).

| Model | Made by | Source | Licence |
|---|---|---|---|
| `bedSingle.glb`, `bookcaseOpen.glb`, `books.glb`, `sideTable.glb`, `lampRoundTable.glb`, `rugRound.glb`, `bear.glb`, `chair.glb`, `pottedPlant.glb` (Furniture Kit 2.0) | Kenney | https://kenney.nl/assets/furniture-kit | CC0 1.0 |
| `hands/glove-right.glb`, `hands/glove-left.glb` ("Welding Glove"; changes: rigged to the WebXR hand joints by `scripts/blender/rig-glove.py`, the left hand mirrored from the right, textures resized to 512 px WebP) | vr.district.0 | https://skfb.ly/oQvDI | CC BY 4.0 |
| `hands/cartoon-glove-right.glb`, `hands/cartoon-glove-left.glb` ("Slap Battles Glove Rig"; changes: its own rig replaced by one on the WebXR hand joints by `scripts/blender/rig-glove.py --profile cartoon`, turned and scaled to metres, the left hand mirrored from the right) | senseiwords203 | https://skfb.ly/oBPuD | CC BY 4.0 |

## Other assets

None besides the models above. All pictures (the room, the paper scenery, the cinematic scenes, the effects) are painted in code at start-up from `src/engine/shadow`, `src/engine/render` and `src/ui`; no image files are imported.

## Fonts

The title screen's lettering is Cinzel Decorative (regular and bold, Latin subset), by Natanael Gama, under the SIL Open Font License 1.1. The files and the licence text are in `src/ui/title-screen/fonts/`. It is a third-party font: replace it if the competition's "original work" rule turns out to exclude free fonts. The pause, solved and end screens use plain Cinzel (regular, Latin subset, same author and licence); the file and licence text are in `src/ui/menu-panel/fonts/`.
