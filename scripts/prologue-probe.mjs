/* global window */
// Watches the puppet prologue play on the wall, with no headset (the emulator's session, seen from the player's eyes), and
// saves a screenshot at chosen moments.
// Usage: start a dev server (npx vite --port 8097 --strictPort), then
//   node scripts/prologue-probe.mjs https://localhost:8097 shots/prologue [4,9,13,15,17]
// The software renderer is slow, so the scene is held still between shots (posed by seek) rather than timed by the clock.
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';

const base = process.argv[2] ?? 'https://localhost:8097';
const prefix = process.argv[3] ?? 'prologue';
const moments = JSON.parse(process.argv[4] ?? '[4, 9, 13, 15, 17]');
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'warning' && /puppet/.test(m.text()) && errors.push(m.text()));
await launchIn(page, { flicker: 0 });
await page.goto(`${base}/`);
await page.waitForFunction(() => window.__wsw?.prologue, null, { timeout: 90000 });
// Lighting the candle starts the prologue a moment later.
await enterVr(page);
await lightCandle(page);
await page.waitForFunction(() => window.__wsw.prologue.playing, null, { timeout: 60000 });
console.log('the prologue started');
for (const t of moments) {
  // Play up to the moment from a little before it, so the cues near it (the notes, the ink lines) have fired.
  await page.evaluate((t) => {
    const p = window.__wsw.prologue;
    if (!p.playing) window.__wsw.playPrologue();
    let guard = 0;
    while (p.time < t && guard++ < 10000) p.update(1 / 72);
  }, t);
  await page.waitForTimeout(400);
  const at = await page.evaluate(() => window.__wsw.prologue.time);
  const file = `${prefix}-${String(t).padStart(2, '0')}s.png`;
  await page.screenshot({ path: file });
  console.log(`${file}  (scene at ${at.toFixed(2)} s)`);
}
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
