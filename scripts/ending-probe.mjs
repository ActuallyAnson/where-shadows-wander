/* global window, document, getComputedStyle */
// Plays the end (window.__wsw.playEnding: the candle going out, the blinks, the credits, back to the title), fast-forwarding to
// moments of it, and prints what the candle, the lids, the credits and the sound are doing at each (and shoots each). Start a dev server first (npx vite --port 8097 --strictPort). Usage:
//   node scripts/ending-probe.mjs https://localhost:8097 shots
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';

const base = process.argv[2];
const out = process.argv[3];
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
await page.waitForFunction(() => !window.__wsw.wake.playing, null, { timeout: 120000 });
await page.waitForTimeout(6000); // the candle settled, as it is after a whole story
console.log(await page.evaluate(() => window.__wsw.playEnding()));
// Moments of the end, seconds: the light going, out, the blinks, shut, the credits rolling, the thanks.
const moments = [0.3, 1.5, 3, 4.5, 6, 7.5, 9.5, 11, 13.6, 15.5, 18.5, 24, 32, 40, 49];
for (const t of moments) {
  const at = await page.evaluate((t) => {
    const e = window.__wsw.ending;
    if (e.time < t) e.update(t - e.time);
    return e.time;
  }, t);
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => {
    const w = window.__wsw;
    const u = w.candleLight.uniforms;
    const m = w.audio.mixer;
    const f = (n) => n.toFixed(2);
    return [
      `lit ${w.candleView.lit ? 'y' : 'n'}`,
      `point ${f(w.candleView.lightIntensity)}`,
      `room ${f(u.uCandleIntensity.value)}`,
      `moon ${f(u.uMoonLight.value.b)}`,
      `lid ${f(w.ending.lid)}`,
      `credits ${w.credits.group.visible ? f(w.ending.credits) : '-'}`,
      `thanks ${f(w.ending.thanks)}`,
      `rain ${f(m.dip(2))} music ${f(m.dip(0))}`,
    ].join('  ');
  });
  const file = `${out}/end-${String(t).padStart(4, '0')}.png`;
  await page.screenshot({ path: file });
  console.log(`t=${at.toFixed(1).padStart(4)}  ${state}`);
}
// Let it finish on its own: the session should end and the title page come back.
await page.evaluate(() =>
  window.__wsw.ending.update(window.__wsw.ending.script.endAt - window.__wsw.ending.time - 0.2),
);
await page.waitForFunction(() => window.__wsw.sessionState() === 'title_vr', null, { timeout: 15000 });
const titleShown = await page.evaluate(() => {
  const t = document.getElementById('wsw-title');
  return !!t && getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility !== 'hidden';
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/end-title.png` });
const after = await page.evaluate(() => {
  const w = window.__wsw;
  return `going out ${w.candleView.isGoingOut}, credits shown ${w.credits.group.visible}, dips ${w.audio.mixer.dip(0)} ${w.audio.mixer.dip(2)}`;
});
console.log(`session ended; title page shown: ${titleShown}; ${after}`);
if (errors.length) console.log('errors:\n' + errors.join('\n'));
await browser.close();
