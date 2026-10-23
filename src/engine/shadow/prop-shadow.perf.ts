// Times the prop shadows (`npm run perf`): projecting 16 props, turning them into ground, rebuilding the drawn
// geometry, and the per-frame update. Props are static, so projecting and ground happen at puzzle load; the
// numbers show what it would cost if a prop moved every frame (a moving light re-projects them all). Desktop numbers
// are only a guide: a headset CPU is several times slower (docs/ARCHITECTURE.md divides the headset budget by 4).
import { bench, describe } from 'vitest';
import { Terrain } from '../sim/solver';
import { createSilhouette, projectProp, type Prop } from './pure/prop-shadow';
import { addPropTerrain, type PropDef } from './pure/prop-terrain';
import { createStagePlane } from './pure/stage-plane';
import { PropShadowView } from './prop-shadow-view';

const COUNT = 16;
const stage = createStagePlane();
stage.origin.set([0, 0.75, -0.75]);
const light = [0, 0.65, -0.2];
const BLEND = 0.9;
const SHAPES: Prop['shape'][] = ['box', 'sphere', 'cylinder'];
const props: PropDef[] = Array.from({ length: COUNT }, (_, i) => ({
  shape: SHAPES[i % 3],
  position: [-0.6 + (i % 8) * 0.17, 0.55 + Math.floor(i / 8) * 0.2, -0.45],
  size: i % 3 === 0 ? [0.12, 0.08, 0.08] : i % 3 === 1 ? [0.05] : [0.04, 0.12],
  rotation: [0, 0.2, 0, Math.sqrt(1 - 0.04)],
  solid: true,
  tag: 1,
}));
const out = createSilhouette();
const view = new PropShadowView();
view.setProps(props, light, stage, BLEND);
const terrain = new Terrain(64);

describe(`${COUNT} props`, () => {
  bench('project all (projectProp)', () => {
    for (let i = 0; i < COUNT; i++) projectProp(props[i], light, stage, BLEND, out);
  });
  bench('project all and make ground (addPropTerrain, pool of 64)', () => {
    terrain.clear();
    for (let i = 0; i < COUNT; i++) addPropTerrain(props[i], light, stage, BLEND, terrain, out);
  });
  bench('rebuild the drawn geometry (PropShadowView.setProps)', () => {
    view.setProps(props, light, stage, BLEND);
  });
  bench('per-frame update (PropShadowView.update)', () => {
    view.update(stage, 0.88);
  });
});
