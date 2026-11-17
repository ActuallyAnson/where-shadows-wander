# ADR 0019: The hands' shadows are cast by a light, from behind the candle

Status: accepted 17 Nov 2026.

## Context

The player's shadow was drawn, not cast. The projector projected the 25 joints onto the wall, 28 capsules per hand, and a quad over the wall drew them as a 2D distance field, darker where a capsule was. The projection was bent to keep the shadows on the wall: blended 0.65 toward orthographic, scaled by a second "light" 0.75 m behind the flame, and kept as a dim, blurred shadow when the hand was behind the candle. It read as a projection: tube fingers, no palm edge, a black overlay laid on the lit wallpaper rather than light taken away from it.

A shadow cast from the flame itself does not work in this room. The candle stands on the lap tray, 0.45 m below the eyes and only a few centimetres behind where hands rest, so a resting hand's shadow would land 5 to 30 m above the stage, on the ceiling (`stage-frame-geometry.test.ts`). The candle is fixed there by the story (it is lit, covered to pause, and covered to sleep).

## Decision

- **The shadow is a shadow map.** `HandShadowMap` (`engine/shadow/hand-shadow-map.ts`) draws the hand visual's meshes (the glove the player sees: skinned, or the instanced capsule gloves) from a light into a cube distance map (512² a face) each frame, all round the light, so a shadow falls on whichever wall the light throws it at, not only the front one. Every surface the candle lights (`CandleLight.light`: the walls, floor, ceiling, bed and tray) and the stage's paper look it up: where a hand is nearer the light, the candle's light is taken away (the moon's stays). So a shadow is as strong as the candle's light where it falls: full on the front wall the candle's beam is aimed at, fainter on the side walls, and next to nothing on the back wall. The edge is soft as a sized light makes it: a blocker search, then a filter as wide as the distance behind the hand allows, sharp near the hand.
- **It is cast from behind the flame, not from it.** The light is `castPoint` (`engine/shadow/pure/real-wall.ts`): 1.2 m behind the flame and 0.3 m above it, about level with resting hands, as a lamp behind a shadow puppeteer would be. A resting hand casts a shadow about 20 × 47 cm on the middle of the stage, bigger as it nears the light.
- **The game sets how dark it is.** `strength` (0 to 1, the share of the candle's light the shadow takes) is `baseOpacity` (0.88, high contrast 1) times `HandPresence`'s level, so the player's shadow still goes faint while a memory plays. The sharpen effect shrinks the light's size. The candle's own dimming is the light's, not the shadow's.
- **The projector follows the drawn shadow.** It projects the joints from the same point in plain perspective (no blend, no size scaling, no shadow behind the light), so where the story places her hand and the memories, the shapes' rings and the sounds match the shadow on the wall. Its capsules are no longer drawn.
- `ShadowRenderer`, its shader and `packShadowUniforms` are removed.

## Consequences

- The shadow has the glove's own outline and moves with every finger the glove shows; another glove casts another shadow.
- A hand hidden from the player (passthrough, faded near the eyes) still casts. A hand fading out does not fade its shadow: the shadow goes when the glove's mesh does, not over the old 0.35 s.
- The gloves do not take the hands' shadows (the light is not where the flame is, so self-shadowing would not match the candle's light on them).
- The "shadow size" setting still scales the projector's capsules but not the drawn shadow. It needs a decision: drop it, or scale the casters.
- Six more render passes a frame (two gloves into each cube face), and up to 25 map reads for each candle-lit pixel near a shadow (9 everywhere else the candle lights). To measure on the headset; drawing only the faces the hands are in would save most of the passes.
- The light is behind the player's head, so a hand casts on the back wall only when it is behind that point. The player's head and body cast nothing.
- `CAST_BACK_M`, `CAST_UP_M` and `LIGHT_SIZE_M` are starting values, to tune in the headset.
