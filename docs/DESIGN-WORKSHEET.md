# Design worksheet (draft)

A place to decide the game's shape in writing. Everything below is a proposal to edit, not a decision. Companion
gameplay (rabbit, fox) is out of scope; the kindred (the spirit fox) is a visual spirit only.

## 1. The puzzle curve

One new idea per puzzle, never two at once. Every puzzle has one intended shape and one alternative, a kind hint, and a
reward the player can see. Times are for a first-time player.

| # | Obstacle | New idea | Shape | Alternative | Hint ladder | Target time |
|---|----------|----------|-------|-------------|-------------|-------------|
| 1 | A gap | Your shadow is a bridge | flat | none (tutorial) | ghost outline from the start | 45 s |
| 2 | A tall ledge | Shapes can be a step | fist (a rock to stand on) | stack two flat hands | outline after 20 s | 60 s |
| 3 | Rain on the traveller's lantern | Shapes can shelter | cup (catch it) | flat as a roof | outline after 20 s, then the kindred perches on the spot | 60 s |
| 4 | Wind pushes the traveller back | Shapes can block | spread (a wall) | fist as an anchor | outline after 20 s, wind eases after 45 s | 60 s |
| 5 | A gap and a gate together | Combine what you learned | flat then fist | any order | outline after 30 s | 90 s |

Questions to settle:
- Is the traveller's lantern the story's second light? (It would tie the rain puzzle to the candle.)
- What is the last scene's "lit window", and does the kindred take the traveller there?
- Does the player ever fail? Proposal: never. A fall puts the traveller back at the last ledge, with no counter.

## 2. Kind failure (the hint ladder)

1. 0–20 s: nothing; let them try.
2. 20 s: a faint outline of the wanted shape where it goes (the ghost target).
3. 40 s: the kindred flies to the spot and perches on it.
4. 70 s: the traveller waits and looks back at the player.
5. 100 s: the outline pulses and the obstacle eases (the wind drops, the gap narrows).

Never a failure screen, never a message in words.

## 3. Story beats (wordless, each under 15 s, skippable)

| Beat | When | What happens |
|------|------|--------------|
| Opening | the candle is lit | The title, the kindred drifts in out of the dark, "Hold your hands to the light". Built; text is a placeholder. |
| The dimming | between puzzles 3 and 4 | The light gutters, the kindred hides, the room goes cold. |
| The return | puzzle 5 solved | The kindred returns, the room fills with light, the traveller reaches the lit window. |
| The end | after the window | The candle burns low, the kid falls asleep, "The End" screen. |

## 4. The colour script

The room is cold and blue-grey when the candle is first lit and warms with each solved puzzle, to full amber at the
end. The paper wall has a mood value (0 cold, 1 warm) that the game sets; today it starts at 0.4 and goes to 1 on the
first solve. With five puzzles: 0.4, 0.55, 0.7 (dimming: back to 0.45), 0.85, 1.0.

## 5. Playtest script (stranger tests)

Three to five people who have not seen the game, on the headset, seated. Say only: "Put this on and tell me what you
are thinking out loud." Do not help for 60 s.

Watch for, and write down with the time:
- Do they find their hands' shadows within 10 s?
- Do they match the first outline without being told?
- Where do they stop, laugh, look away or take the headset off?
- Which puzzle takes longest, and what do they try?
- Anything they say about the light, the fox, the sounds.

Afterwards ask: what was the best moment? What was confusing? Would you play the next one?

## 6. Demo video storyboard (60–90 s)

1. Black, the candle is lit, the title appears (5 s).
2. The kindred flies in, hands appear as shadows on the wall (10 s).
3. Puzzle 1: the hand bridge, the traveller crosses (15 s).
4. A montage of puzzles 2–4: the cup, the wall, the fist (25 s).
5. The solve moment: the wall blooms, the kindred bursts into light (10 s).
6. The window, the end screen, the title again (10 s).

Record with capture mode (five taps on the title's emblem, then BEGIN).
