import { createComponent, defineComponents, Types } from '@iwsdk/core';

// IWSDK component manifest (required by iwsdk.config.json). Game state lives outside the ECS
// (docs/adr/0001-iwsdk-as-xr-and-view-layer.md); this one component exists only so the scene editor
// shows a game piece's extra settings in its inspector. Nothing in the game reads it from the ECS: the
// layout loader (src/engine/sim/scene-layout.ts) reads it from the scene file.
export const Piece = createComponent(
  'Piece',
  {
    vx: { type: Types.Float32, default: 0 },
    vy: { type: Types.Float32, default: 0 },
    isStatic: { type: Types.Boolean, default: false },
    isSensor: { type: Types.Boolean, default: false },
    hidden: { type: Types.Boolean, default: false },
  },
  'Extra settings for a game piece: starting speed (m/s) and behaviour flags',
);

export default defineComponents([Piece]);
