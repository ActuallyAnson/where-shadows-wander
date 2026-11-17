# ADR 0020: The system menu pauses the game; covering the flame does not

Status: accepted 17 Nov 2026. Changes the pause in [ADR 0016](0016-story-shadow-theatre.md).

## Context

ADR 0016 kept covering the flame as the pause: a palm (or two cupped hands) over the candle for 3 s filled a ring round the wick, put the candle out and opened the wall's pause menu (Resume, Settings). Scene 7 reuses the gesture: there, covering the flame puts the candle out and he sleeps.

The headset's system menu, or taking the headset off, now opens the same pause menu while the story plays (`SessionVisibility` in `main.ts`), so the player comes back to Resume and not to a story that ran on without them. With that, covering the flame was a second way to pause, and one a player could trigger by accident: hands near the flame are common in a game played with hand shadows, and three seconds there paused the story mid-memory. It also gave the cover two meanings, pause in scenes 1 to 6 and sleep in scene 7.

## Decision

- **The system menu, or taking the headset off, is the only pause.** It opens the wall's pause menu as before (`enterPause` in `main.ts`).
- **Covering the flame counts only in scene 7's wait,** where it puts the candle out and ends the story (`CandleView.sleepMode`). Before that, a hand over the flame only dims its light; nothing is timed and no ring shows. The developer switch "Covering ends the story (test)" turns sleep mode on wherever the story is.
- The ring round the wick now shows only while the matchstick lights the candle.

## Consequences

- Scene 2's hush, the girl's hand over the torch, no longer teaches a pause. It shows the gesture once, inside a memory, so that the ghost hand in scene 7 is recognised: a hand over the light makes everything hold still, and at the end it lets him rest.
- In a headset, Settings is reached from the pause menu after the system menu, or from the title page before the session.
- The "Soft pause hush and relight breath" sound in ASSETS.md is now for the pause menu opening and Resume, not for a cover.
