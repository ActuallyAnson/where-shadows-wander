// Runs the plain-three.js fallback build with IWER (?emulate), enters AR, reports hands/loop.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4175/WhereShadowsWander/?emulate';
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const page = await browser.newPage();
const errors = []; const failed = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
await page.goto(url);
await page.waitForFunction(() => window.__spike?.report.firstFrameMs != null, null, { timeout: 30000 });
await page.evaluate(() => window.__enterXR());
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const { report, game } = window.__spike;
  game['summarise']();
  return { session: report.session, hands: report.hands, loop: report.loop, perf: report.perf, shadow: { instances: report.shadow.instances, k1: report.shadow.handShadowWidthM } };
});
console.log(JSON.stringify({ ...r, errors, failed }, null, 1));
await browser.close();
