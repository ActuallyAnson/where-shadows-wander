# Credits

## Sounds

The game's twenty-six sounds (the effects, the room tone, the clock, the wind, the creak, the snow, the footsteps, the lullaby's five music-box notes and the music) are made in code by `src/engine/services/audio/placeholder-sounds.ts` (a noise burst for the paper rustle, a falling low sine for the thump, a small bell for the chime, a loop of random pops for the flame, then a tick, a press, a match and flame, a low room tone, a soft letting-go, a falling pair for lost tracking, the candle lifted and set down, and a 24-second loop of sine pads and music-box notes). They contain no recordings and no third-party material, so nothing is owed to anyone. The team intends them to be CC0 1.0; the repository has no licence file yet, so confirm that choice (and the project's own licence) before submission. They exist so the audio works before the team's sounds arrive.

| Sound | Made by | Licence |
|---|---|---|
| All twenty-six sounds and the music | `placeholder-sounds.ts` (this project) | Made by the project; intended CC0 1.0 (to confirm) |

When real sounds replace them, add a row for each file here: what it is, who made it, where it came from (a link), and its licence (CC0 or another that allows use in a game). Do not add a file whose licence is not recorded here.

## 3D models

The bedroom's models are in `src/assets/models/` and are loaded by `src/engine/shadow/room-models.ts`. All of them are [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) except the gloves, which are [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and must keep their credit. The CC0 ones need no attribution, but it is given here anyway. The raw downloads they were picked from are kept out of the repository (see `docs/ASSET-SOURCES.md`).

| Model | Made by | Source | Licence |
|---|---|---|---|
| `bedSingle.glb`, `bookcaseOpen.glb`, `books.glb`, `sideTable.glb`, `lampRoundTable.glb`, `rugRound.glb`, `bear.glb`, `chair.glb`, `pottedPlant.glb` (Furniture Kit 2.0) | Kenney | https://kenney.nl/assets/furniture-kit | CC0 1.0 |
| `candleStick.glb` ("Candlestick") | CreativeTrio | https://poly.pizza/m/tknOVwxT8B | CC0 1.0 |
| `candles.glb` ("Candles") | Quaternius | https://poly.pizza/m/AnzHB44wlW | CC0 1.0 |
| `hands/glove-right.glb`, `hands/glove-left.glb` ("Welding Glove"; changes: rigged to the WebXR hand joints by `scripts/blender/rig-glove.py`, the left hand mirrored from the right, textures resized to 512 px WebP) | vr.district.0 | https://skfb.ly/oQvDI | CC BY 4.0 |

## Other assets

None besides the models above. All pictures (the room, the paper scenery, the cinematic scenes, the effects) are painted in code at start-up from `src/engine/shadow`, `src/engine/render` and `src/ui`; no image files are imported.

## Fonts

The title screen's lettering is Cinzel Decorative (regular and bold, Latin subset), by Natanael Gama, under the SIL Open Font License 1.1. The files and the licence text are in `src/ui/title-screen/fonts/`. It is a third-party font: replace it if the competition's "original work" rule turns out to exclude free fonts. The pause, solved and end screens use plain Cinzel (regular, Latin subset, same author and licence); the file and licence text are in `src/ui/menu-panel/fonts/`.
