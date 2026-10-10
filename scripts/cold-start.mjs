// Measures a cold start on desktop with the CPU and network slowed down, from a production build.
//   npm run build
//   node scripts/cold-start.mjs [--cpu 4] [--runs 3] [--budget 5000] [--no-network]
// Serves dist/ like GitHub Pages (scripts/serve-pages.mjs, gzip on), loads the page with an empty cache and
// reports when the world was created and when the first frame's update began (the lantern is already in the
// scene; the draw follows within tens of milliseconds), in ms from navigation start. It loads the 2D page: on
// a headset the lantern is seen after Enter VR, which this does not include. Needs Playwright's Chromium (npx playwright install chromium). Network is "fast 4G" (9 Mbit/s down, 165 ms round trip) unless --no-network. Headless
// Chromium draws with software GL, so treat the numbers as a guide and compare runs with each other, not with
// a headset. With --budget, exits 1 if the median first frame is later than that many ms.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = Number(process.argv[i + 1]);
  if (!Number.isFinite(value)) throw new Error(`--${name} needs a number`);
  return value;
};
const cpu = arg('cpu', 4);
const runs = arg('runs', 3);
const budget = arg('budget', 0);
const network = !process.argv.includes('--no-network');
const port = 8094;
const base = '/where-shadows-wander/';

const server = spawn('node', ['scripts/serve-pages.mjs', 'dist', String(port), base], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let waited = 0; ; waited += 100) {
  const up = await fetch(`http://localhost:${port}${base}`).then(
    (r) => r.ok,
    () => false,
  );
  if (up) break;
  if (waited > 5000) {
    console.error(`nothing is serving dist/ on port ${port} (is it busy, or is dist/ missing? run npm run build)`);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (network)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 165,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}${base}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => performance.getEntriesByName('wsw-firstFrame').length > 0, null, {
    timeout: 120000,
    polling: 50,
  });
  const t = await page.evaluate(() => {
    const at = (n) => Math.round(performance.getEntriesByName(n)[0]?.startTime ?? -1);
    return { worldCreated: at('wsw-worldCreated'), firstFrame: at('wsw-firstFrame') };
  });
  results.push({ ...t, kb: Math.round(bytes / 1024), errors: errors.length });
  for (const e of errors) console.error(`  page error: ${e}`);
  console.log(
    `run ${i + 1}: world created ${t.worldCreated} ms, first frame ${t.firstFrame} ms, ${Math.round(bytes / 1024)} KB transferred`,
  );
  await ctx.close();
}
await browser.close();
stop();
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const m = median(results.map((r) => r.firstFrame));
console.log(`median first frame ${m} ms (CPU ${cpu}x slower${network ? ', fast 4G' : ', no network limit'})`);
if (budget && m > budget) {
  console.error(`over the ${budget} ms budget`);
  process.exit(1);
}
