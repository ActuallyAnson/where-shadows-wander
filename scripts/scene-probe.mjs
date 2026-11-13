/* global window */
// Jumps to scenes of the story (window.__wsw.jumpTo, the Hand Lab's Story tab) and shoots the friend's hand waiting, then
// moments of the memory after copying it. Start a dev server first (npx vite --port 8097 --strictPort). Usage:
//   node scripts/scene-probe.mjs https://localhost:8097 shots '[[1, [2, 8, 14]], [3, [1, 10], 4]]'
// (each: the scene's index in story-script.ts, 0 being scene 2; its memory's moments, seconds; and, optionally, how long the
// hand has been showing when it is shot). WIDE=1 shoots the whole view.
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';

const base = process.argv[2];
const out = process.argv[3];
const plan = JSON.parse(process.argv[4]);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && errors.push(m.text()));
await launchIn(page, { flicker: 0 });
await page.goto(`${base}/`);
await page.waitForFunction(() => window.__wsw?.story, null, { timeout: 90000 });
await enterVr(page);
await lightCandle(page);
await page.waitForFunction(() => window.__wsw.story.waitingForShape, null, { timeout: 60000 });
await page.waitForFunction(() => !window.__wsw.wake.playing, null, { timeout: 120000 });
await page.evaluate(() => {
  const s = window.__wsw.story;
  s.__step = s.update.bind(s);
  s.update = () => {};
});
const shot = async (name, note) => {
  await page.waitForTimeout(700);
  const file = `${out}/${name}.png`;
  await page.screenshot({
    path: file,
    clip: process.env.WIDE ? undefined : { x: 220, y: 150, width: 840, height: 480 },
  });
  console.log(`${file}  ${note}`);
};
for (const [index, moments, handAt] of plan) {
  // The friend's hand, waiting.
  const what = await page.evaluate((i) => window.__wsw.jumpTo(i, false), index);
  await page.evaluate((t) => {
    const s = window.__wsw.story;
    let g = 0;
    while (s.friendT < t && g++ < 10000) s.__step(1 / 30);
  }, handAt ?? 3);
  await shot(`s${index}-hand`, what);
  const b = await page.evaluate(() => window.__wsw.story.beat);
  if (b?.kind === 'friend') await page.evaluate((b) => window.__wsw.commitShape(b.shape, b.x + 0.1, b.y - 0.04), b);
  const from = await page.evaluate(() => window.__wsw.story.memory?.time ?? 0);
  for (const t of moments) {
    const at = await page.evaluate(
      ([t, from]) => {
        const s = window.__wsw.story;
        let g = 0;
        while (s.memory?.playing && s.memory.time - from < t && g++ < 100000) s.__step(1 / 30);
        // let the hand's fade and any wait run on too
        if (!s.memory?.playing) for (let k = 0; k < 30 * 2 && g++ < 100000; k++) s.__step(1 / 30);
        return s.memory ? s.memory.time - from : -1;
      },
      [t, from],
    );
    await shot(`s${index}-m${String(t).padStart(5, '0')}`, `memory ${at.toFixed(2)} s`);
  }
}
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
