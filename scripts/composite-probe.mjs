/* global window */
// Checks what the scene would hand to a passthrough compositor, without a headset.
// Usage: start a dev server (npx vite --port 8091 --strictPort) then
//   node scripts/composite-probe.mjs https://localhost:8091
// Opens ?mock=1&occlude=1 (and ?occlude=0 for contrast) in headless Chromium and
// reads the rendered pixels at four stage points through __wsw.probe (dev builds only):
//   off the stage          alpha 0 (the room shows through)
//   bare paper             alpha 0.85, linear rgb = paper colour x 0.85 (premultiplied)
//   inside a hand's shadow alpha 0.88 + 0.85 x 0.12 = 0.98, linear rgb = paper x 0.85 x 0.12 (the shadow is 88 % black)
//   paper behind a hand    alpha 0 with the occluder on (the real hand stays visible), opaque with it off
// The target is sRGB like WebXR's: blending happens in linear light and the bytes are sRGB-encoded afterwards,
// so rgb is compared after decoding.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:8081';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const lin = (byte) => ((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))(byte / 255);
// TestStageView's paper colour, tinted 12 % toward the steady flame colour (flicker=0, intensity 1).
const AMBER = [1, 0.56, 0.24];
const PAPER_LINEAR = [0xf2, 0xe6, 0xc9].map(lin).map((c, i) => c * 0.88 + AMBER[i] * 0.12);
const PAPER_ALPHA = 0.85;
const SHADOW_ALPHA = 0.88;

for (const occlude of ['1', '0']) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?mock=1&flicker=0&occlude=${occlude}`);
  await page.waitForFunction(() => window.__wsw?.projector?.shadows.right.active, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = window.__wsw;
    w.dots.mesh.visible = false; // the debug joint dots draw over everything
    const s = w.stage;
    const at = (x, y) => [0, 1, 2].map((i) => s.origin[i] + s.right[i] * x + s.up[i] * y);
    const sh = w.projector.shadows.right;
    // A palm web capsule (the last four): its middle is solid shadow.
    const c = 24 * 5;
    const core = at((sh.capsules[c] + sh.capsules[c + 2]) / 2, (sh.capsules[c + 1] + sh.capsules[c + 3]) / 2);
    // The line from the eye through the palm, carried on to the stage plane.
    const cam = w.world.camera.getWorldPosition(new w.world.camera.position.constructor());
    const palm = [0, 1, 2].map((i) => w.hands.hands.right.positions[10 * 3 + i]);
    const d = [0, 1, 2].map((i) => palm[i] - cam[['x', 'y', 'z'][i]]);
    const n = s.normal;
    const t =
      ((s.origin[0] - cam.x) * n[0] + (s.origin[1] - cam.y) * n[1] + (s.origin[2] - cam.z) * n[2]) /
      (d[0] * n[0] + d[1] * n[1] + d[2] * n[2]);
    const behind = [0, 1, 2].map((i) => [cam.x, cam.y, cam.z][i] + d[i] * t);
    const points = [at(s.width / 2 + 0.03, 0), at(-s.width / 2 + 0.04, -s.height / 2 + 0.04), core, behind];
    return { pixels: w.probe(points), t, hand: w.hands.hands.right.tracked };
  });
  console.log(`--- occlude=${occlude}  (hand tracked: ${r.hand}, eye-to-stage ratio past the palm: ${r.t.toFixed(2)})`);
  const [off, paper, shadow, behind] = r.pixels;
  check(
    'off the stage is transparent (and on screen, so a pixel was read)',
    off !== null && off[3] === 0,
    JSON.stringify(off),
  );
  check(
    'bare paper is premultiplied at alpha 0.85',
    paper &&
      near(paper[3] / 255, PAPER_ALPHA, 0.01) &&
      [0, 1, 2].every((i) => near(lin(paper[i]), PAPER_LINEAR[i] * PAPER_ALPHA, 0.012)),
    JSON.stringify(paper),
  );
  const covered = PAPER_ALPHA * (1 - SHADOW_ALPHA);
  check(
    'inside a shadow: 88 % black over the paper, alpha 0.98',
    shadow &&
      near(shadow[3] / 255, SHADOW_ALPHA + covered, 0.012) &&
      [0, 1, 2].every((i) => near(lin(shadow[i]), PAPER_LINEAR[i] * covered, 0.012)),
    JSON.stringify(shadow),
  );
  if (occlude === '1')
    check('paper behind a hand is transparent (hand stays visible)', behind && behind[3] === 0, JSON.stringify(behind));
  else
    check('without the occluder something opaque covers the hand', behind && behind[3] >= 200, JSON.stringify(behind));
  check('no page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
