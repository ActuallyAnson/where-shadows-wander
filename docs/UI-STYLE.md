# UI and presentation style

One look for every screen and prompt: title, pause, end, settings, in-world hints. The idea is
Persona-style boldness (hard colour blocks, big type, angled shapes, snappy motion) kept
comfortable in a headset.

## Palette

Ink, paper and one flame accent. Nothing else on UI.

| Role | Hex | Used for |
| --- | --- | --- |
| Ink | `#1c1a17` | panels, text on light blocks |
| Card | `#2a2622` | cards on a panel |
| Paper | `#f1e9d8` | titles, names |
| Muted paper | `#bdb4a2` | help text |
| Flame | `#ffb454` | values, the one highlighted thing on screen |
| Gold | `#e9c46a` | buttons |

High contrast is pure black on pure white with black outlines (`PALETTE.high` in
`src/ui/settings-panel/markup.ts`). Every new screen needs a high-contrast version.

## Shape and type

- Hard edges. Blocks are rectangles or parallelograms with an angled cut, not soft rounded cards.
  Corners may stay slightly rounded where `uikit` requires it.
- One bold sans for everything, two sizes of emphasis: a title and a body. No thin weights.
- One accent per screen. If everything is flame, nothing is.
- Button targets are at least `BUTTON_PX` high so a fingertip poke lands (panels are poked, not pinched: ADR 0011).

## Motion

- Slide-and-snap: 150–250 ms ease-out into place, no bounce past the final position.
- Nothing flashes more than 3 times a second. No full-screen flashes.
- Panels are anchored in the world within arm's reach to poke (about 0.5 m; the reading distance is not verified on a headset yet) and move slowly if at all. Never lock UI to the head.
- Motion can be cut down to a short fade if we add a reduced-motion setting (not in the settings table yet).

## Sound

- Every action has a sound: recognise (rustle), commit (thump), solve (chime), hover and press for
  buttons, tracking lost (low, short).
- Sounds are short, dry and paper or candle themed. Nothing above -12 dB relative to the music bus.

## Comfort rules

- Text at least 44 px on a poked panel (the settings title is 44 px). To be checked on the Pico.
- No camera moves, no scaling of the whole world, no fast parallax.
- Cutscenes are in-engine shadow-puppet sequences: they can be skipped with a poke on a Skip button and last under 20 s.

## Not doing

- Pre-rendered video (bundle size, untested on Pico and Quest browsers).
- Screen-filling busy UI, head-locked text, gaze input.
