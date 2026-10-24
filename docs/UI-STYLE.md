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
- Button targets are at least `BUTTON_PX` high so a fingertip pinch lands.

## Motion

- Slide-and-snap: 150–250 ms ease-out into place, no bounce past the final position.
- Nothing flashes more than 3 times a second. No full-screen flashes.
- Panels are anchored in the world at about 1.2 m and move slowly if at all. Never lock UI to the head.
- Respect the reduced-motion setting: replace slides with a short fade.

## Sound

- Every action has a sound: recognise (rustle), commit (thump), solve (chime), hover and press for
  buttons, tracking lost (low, short).
- Sounds are short, dry and paper or candle themed. Nothing above -12 dB relative to the music bus.

## Comfort rules

- Text readable at 1.2 m with hands-tracked pointing, at least 40 px in a 1024 px panel.
- No camera moves, no scaling of the whole world, no fast parallax.
- Cutscenes are in-engine shadow-puppet sequences: they can be skipped with a pinch and last under 20 s.

## Not doing

- Pre-rendered video (bundle size, untested on Pico and Quest browsers).
- Screen-filling busy UI, head-locked text, gaze input.
