# Credits

## Sounds

The game's twenty-six sounds (the effects, the room tone, the clock, the wind, the creak, the snow, the footsteps, the lullaby's five music-box notes and the music) are made in code by `src/engine/services/audio/placeholder-sounds.ts` (a noise burst for the paper rustle, a falling low sine for the thump, a small bell for the chime, a loop of random pops for the flame, then a tick, a press, a match and flame, a low room tone, a soft letting-go, a falling pair for lost tracking, the candle lifted and set down, and a 24-second loop of sine pads and music-box notes). They contain no recordings and no third-party material, so nothing is owed to anyone. The team intends them to be CC0 1.0; the repository has no licence file yet, so confirm that choice (and the project's own licence) before submission. They exist so the audio works before the team's sounds arrive.

| Sound | Made by | Licence |
|---|---|---|
| All twenty-six sounds and the music | `placeholder-sounds.ts` (this project) | Made by the project; intended CC0 1.0 (to confirm) |

When real sounds replace them, add a row for each file here: what it is, who made it, where it came from (a link), and its licence (CC0 or another that allows use in a game). Do not add a file whose licence is not recorded here.

## Other assets

None. All pictures (the room, the paper scenery, the cinematic scenes, the effects) are painted in code at start-up from `src/engine/shadow`, `src/engine/render` and `src/ui`; no image files are imported.

## Fonts

The title screen's lettering is Cinzel Decorative (regular and bold, Latin subset), by Natanael Gama, under the SIL Open Font License 1.1. The files and the licence text are in `src/ui/title-screen/fonts/`. It is a third-party font: replace it if the competition's "original work" rule turns out to exclude free fonts. The pause, solved and end screens use plain Cinzel (regular, Latin subset, same author and licence); the file and licence text are in `src/ui/menu-panel/fonts/`.
