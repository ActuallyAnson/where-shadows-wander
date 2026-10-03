// Checks what the scene would hand to a passthrough compositor, without a headset.
// Usage: start a dev server (npx vite --port 8091 --strictPort) then
//   node scripts/composite-probe.mjs https://localhost:8091
// Opens ?mock=1&occlude=1 (and ?occlude=0 for contrast) in headless Chromium and
// reads the rendered pixels at four stage points through __wsw.probe (dev builds only):
//   off the stage          alpha 0 (the room shows through)
//   bare paper             premultiplied paper: alpha 0.85, rgb = paper colour x 0.85
//   inside a hand's shadow nearly black, nearly opaque
//   paper behind a hand    alpha 0 with the occluder on (the real hand stays visible), 0.85 with it off
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:8081';
const browser = await chromium.launch();
let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

for (const occlude of ['1', '0']) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?mock=1&occlude=${occlude}`);
  await page.waitForFunction(() => window.__wsw?.projector?.shadows.right.active, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = window.__wsw;
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
    const points = [at(s.width / 2 + 0.12, 0), at(-s.width / 2 + 0.04, -s.height / 2 + 0.04), core, behind];
    return { pixels: w.probe(points), t, hand: w.hands.hands.right.tracked };
  });
  console.log(`--- occlude=${occlude}  (hand tracked: ${r.hand}, eye-to-stage ratio past the palm: ${r.t.toFixed(2)})`);
  const [off, paper, shadow, behind] = r.pixels;
  check('off the stage is transparent', off === null || off[3] === 0, JSON.stringify(off));
  check('bare paper is premultiplied at alpha 0.85', paper && near(paper[3], 217, 3) && paper[0] <= paper[3], JSON.stringify(paper));
  check('shadow core is near black and near opaque', shadow && shadow[0] <= 8 && shadow[3] >= 245, JSON.stringify(shadow));
  if (occlude === '1') check('paper behind a hand is transparent (hand stays visible)', behind && behind[3] === 0, JSON.stringify(behind));
  else check('without the occluder the paper covers the hand', behind && behind[3] >= 200, JSON.stringify(behind));
  check('no page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
