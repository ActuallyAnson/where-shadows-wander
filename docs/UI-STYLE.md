# UI and presentation style

One look for every screen and prompt: title, pause, end, settings, in-world hints. The reference is
the Hollow Knight menu: near-black, pale spaced capitals, thin ornate dividers, fog and dust. Our
twist is light. The player's fingertip is a candle, and the UI is lit only where it reaches.

The mock-up is the source of truth for the feel; this page is the rules behind it.

## Palette

Night, pale and one candle colour. Nothing else on UI.

| Role | Hex | Used for |
| --- | --- | --- |
| Night | `#05070d` | panel background |
| Fog | `#788caa` at 12–20% | drifting haze |
| Dim | `#7f8898` | menu items at rest |
| Pale | `#9aa5b8` | emblem, dividers, small caps |
| Bright | `#f2f5f9` | titles, the hovered item |
| Candle | `#ffd89a` | markers, flame, press colour |
| Glow | `#ffc46e` at 30% | the light that follows the fingertip |

The settings panel (`src/ui/settings-panel/markup.ts`) and the pause, solved and end screens
(`src/ui/menu-panel`) use this palette. The menu screens are not UIKit panels: no box, only small serif text on drawn mist, shafts of light and dust, lit by position under a fingertip. To look at them: the Hand Lab's **Menu** button steps through pause, solved and end, and the launcher's Developer panel has the same switch (no address to type). The game flow shows a screen with `__wsw.showMenu('pause' | 'solved' | 'end')`
and reads presses from `menu.onPress`. High contrast stays pure black on pure white
with black outlines (`PALETTE.high`), and every new screen needs a high-contrast version.

## Light and shadow

- Everything starts dark. Light comes from one candle-coloured glow that follows the fingertip,
  and it flickers slowly (opacity 0.8–1, about 4 s).
- A cool shaft from above, drifting fog and a few rising dust motes give the panel depth. They are
  cheap, slow and low contrast. Keep them under 10 elements per panel.
- A dark vignette closes in the edges so the eye stays on the middle.
- The solved screen blooms warm light behind the title, the one place the glow is bigger.

## Type and shape

- One serif in spaced capitals (Cinzel in the mock; the file has to be loadable and its size
  checked against the bundle budget before we commit to it).
- Titles are large and bright; menu items are medium and dim until reached.
- Thin 1 px dividers with a small diamond in the middle. Round emblem with a flame at the top of
  the title screen.
- One highlighted thing per screen.
- Items are at least `BUTTON_PX` high and are pressed by fingertip poke (ADR 0011), not pinch.

## Motion

- Reaching an item: it brightens to bright, its letters spread (0.30em to 0.38em) over about
  0.45 s, and two small candle-coloured diamonds slide in from the sides with a soft overshoot.
- Pressing: the item shrinks to 97% and turns candle-coloured.
- Screens fade and bloom; they do not slide or flash. Nothing flashes more than 3 times a second.
- Panels sit within arm's reach to poke (about 0.5 m; unverified in a headset) and move slowly if
  at all. Never lock UI to the head.
- Motion can be cut down to a short fade if we add a reduced-motion setting (not in the settings
  table yet).

## Sound

- Every action has a sound: reach an item (tick), press (a warm knock), BEGIN (a match and the flame
  catching), recognise (rustle), commit (thump), let go (a soft breath), solve (chime), candle lifted
  and set down, tracking lost (two low falling notes).
- Under it all: a low room tone and slow, sparse music (sine pads and music-box notes). Both are made
  in code (`placeholder-sounds.ts`), so no files and nothing to license.
- Short, dry, paper or candle themed. Browsers keep audio locked until the first tap, so the very
  first hover is silent.

## Comfort rules

- Text at least 44 px on a poked panel. To be checked on the Pico.
- No camera moves, no scaling of the whole world, no fast parallax.
- Cutscenes are in-engine shadow-puppet sequences: they can be skipped with a poke on a Skip
  button and last under 20 s.

## Debug tools

- Debug is a separate small panel, never part of a title or pause screen, and exists only when
  `DEBUG_TOOLS` is true (dev and `--mode tester` builds). The release build has none of it
  (`check:debug-free`).
- In a dev or tester build one **Developer** button (modes, testing switches, the launch log) sits at
  the bottom on top of the title screen, so a tester build is never mistaken for the release.
- Every build shows BEGIN and SETTINGS under the title, nothing else.

## Not doing

- Pre-rendered video (bundle size, untested on Pico and Quest browsers).
- Screen-filling busy UI, head-locked text, gaze input.
- Bright, saturated or cartoon-bright colour. If it is not dark first, it is not this style.
