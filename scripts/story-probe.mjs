/* global window */
// Watches the story play on the wall, with no headset (the emulator's session, seen from the player's eyes): the friend's hand
// showing its shape, then, after a pretend commit of that shape, the memory, saving a screenshot at chosen moments.
// Usage: start a dev server (npx vite --port 8097 --strictPort), then
//   node scripts/story-probe.mjs https://localhost:8097 shots/story [1,4] [0.3,3,6,9.5,13,16]
// (the friend's hand's moments, then the memory's, in seconds). The software renderer is slow, so the story is held still for
// each shot: it is stepped to the moment by hand and the frame loop's own steps are switched off.
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';

const base = process.argv[2] ?? 'https://localhost:8097';
const prefix = process.argv[3] ?? 'story';
const handMoments = JSON.parse(process.argv[4] ?? '[1, 4]');
const memoryMoments = JSON.parse(process.argv[5] ?? '[0.3, 3, 6, 9.5, 13, 16]');
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'warning' && /puppet|story/.test(m.text()) && errors.push(m.text()));
await launchIn(page, { flicker: 0 });
await page.goto(`${base}/`);
await page.waitForFunction(() => window.__wsw?.story, null, { timeout: 90000 });
await enterVr(page);
await lightCandle(page);
await page.waitForFunction(() => window.__wsw.story.waitingForShape, null, { timeout: 60000 });
await page.waitForFunction(() => !window.__wsw.wake.playing, null, { timeout: 120000 }); // the eyes open
await page.waitForTimeout(1500);
console.log('the friend’s hand is waiting');
// From here the probe steps the story itself.
await page.evaluate(() => {
  const s = window.__wsw.story;
  s.__step = s.update.bind(s);
  s.update = () => {};
});
const shot = async (name, at) => {
  await page.waitForTimeout(500);
  const file = `${prefix}-${name}.png`;
  // The middle of the wall, where the story plays.
  await page.screenshot({ path: file, clip: { x: 400, y: 260, width: 520, height: 320 } });
  console.log(`${file}  (${at})`);
};
for (const t of handMoments) {
  const handT = await page.evaluate((t) => {
    const s = window.__wsw.story;
    let guard = 0;
    while (s.friendT < t && guard++ < 10000) s.__step(1 / 72);
    return s.friendT;
  }, t);
  await shot(
    `hand-${t}s`,
    `hand shown ${handT.toFixed(2)} s, opacity ${await page.evaluate(() => window.__wsw.story.friendOpacity.toFixed(2))}`,
  );
}
const took = await page.evaluate(() => window.__wsw.commitShape('rabbit', 0.15, 0.02));
console.log(`commit rabbit: ${took}`);
for (const t of memoryMoments) {
  const at = await page.evaluate((t) => {
    const s = window.__wsw.story;
    let guard = 0;
    while (s.memory && s.memory.time < t && guard++ < 100000) s.__step(1 / 72);
    return s.memory ? s.memory.time : -1;
  }, t);
  await shot(`memory-${String(t).padStart(4, '0')}s`, `memory at ${at.toFixed(2)} s`);
}
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
