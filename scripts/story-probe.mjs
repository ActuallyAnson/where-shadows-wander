/* global window */
// Watches the story play on the wall, with no headset (the emulator's session, seen from the player's eyes): the friend's hand
// showing its shape, then, after a pretend commit of that shape, the memory, saving a screenshot at chosen moments.
// Usage: start a dev server (npx vite --port 8097 --strictPort), then
//   node scripts/story-probe.mjs https://localhost:8097 shots/story [1,4] [0.3,3,6,9.5,13,16] '[["fox",[0.5,3,6]]]'
// (the friend's hand's moments, then the memory's, in seconds from its chapter's start; then, optionally, the scenes after it:
// each the shape the friend's hand shows next, copied, and its memory's moments, the hand shot at the same moments as the first). The software renderer is slow, so the story is held still for
// each shot: it is stepped to the moment by hand and the frame loop's own steps are switched off.
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';

const base = process.argv[2] ?? 'https://localhost:8097';
const prefix = process.argv[3] ?? 'story';
const handMoments = JSON.parse(process.argv[4] ?? '[1, 4]');
const memoryMoments = JSON.parse(process.argv[5] ?? '[0.3, 3, 6, 9.5, 13, 16]');
const laterScenes = JSON.parse(process.argv[6] ?? '[]');
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
  // (PROBE_WIDE=1: the whole view, to see the edges of the wall.)
  const clip = process.env.PROBE_WIDE ? undefined : { x: 400, y: 260, width: 520, height: 320 };
  await page.screenshot({ path: file, clip });
  console.log(`${file}  (${at})`);
};
const shootHand = async (label) => {
  for (const t of handMoments) {
    const handT = await page.evaluate((t) => {
      const s = window.__wsw.story;
      let guard = 0;
      while (s.friendT < t && guard++ < 10000) s.__step(1 / 72);
      return s.friendT;
    }, t);
    await shot(
      `${label}hand-${t}s`,
      `hand shown ${handT.toFixed(2)} s, opacity ${await page.evaluate(() => window.__wsw.story.friendOpacity.toFixed(2))}`,
    );
  }
};
// Copies `shape`, shoots its memory at `moments` (seconds from where its chapter starts), and plays it to its end.
const playMemory = async (shape, moments, label) => {
  const took = await page.evaluate((shape) => window.__wsw.commitShape(shape, 0.15, 0.02), shape);
  console.log(`commit ${shape}: ${took}`);
  const from = await page.evaluate(() => window.__wsw.story.memory?.time ?? 0);
  for (const t of moments) {
    const at = await page.evaluate(
      ([t, from]) => {
        const s = window.__wsw.story;
        let guard = 0;
        while (s.memory?.playing && s.memory.time - from < t && guard++ < 100000) s.__step(1 / 72);
        return s.memory ? s.memory.time - from : -1;
      },
      [t, from],
    );
    await shot(`${label}memory-${String(t).padStart(4, '0')}s`, `memory at ${at.toFixed(2)} s`);
  }
  await page.evaluate(() => {
    const s = window.__wsw.story;
    let guard = 0;
    while (s.memory?.playing && guard++ < 100000) s.__step(1 / 72);
  });
};
await shootHand('');
await playMemory('rabbit', memoryMoments, '');
for (const [i, [shape, moments]] of laterScenes.entries()) {
  const label = `${i + 3}-`;
  await shootHand(label);
  await playMemory(shape, moments, label);
}
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
