// Cold-load timing of a production build: bytes transferred and time to first rendered frame.
// Usage: node scripts/load-timing.mjs <url> [cpuSlowdown] [downMbps] [latencyMs]
import { chromium } from 'playwright';

const [url, cpu = '1', mbps = '0', latency = '0'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (+mbps > 0) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: +latency, downloadThroughput: (+mbps * 1e6) / 8, uploadThroughput: (+mbps * 1e6) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +cpu });
let bytes = 0; const failed = []; const errors = [];
cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => performance.getEntriesByName('spike-first-frame').length > 0, null, { timeout: 120000 });
await page.waitForTimeout(500);
const t = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const m = (n) => Math.round(performance.getEntriesByName(n)[0]?.startTime ?? -1);
  return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), scriptStart: m('spike-script-start'), worldCreated: m('spike-world-created'), firstFrame: m('spike-first-frame'), drawCalls: window.__spike.world.renderer.info.render.calls };
});
console.log(JSON.stringify({ url, cpu: +cpu, mbps: +mbps, latency: +latency, transferKB: Math.round(bytes / 1024), ...t, failed, errors }));
await browser.close();
