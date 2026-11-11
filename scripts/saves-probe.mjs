/* global window */
// Checks the save in a real browser, with no headset.
// Usage: start a dev server (npx vite --port 8097 --strictPort) then
//   node scripts/saves-probe.mjs https://localhost:8097
// In headless Chromium it checks that:
//   a save made in one page load is there in the next (a setting);
//   it is written when the page is hidden or flushed, but not while nothing changed;
//   a damaged slot is recovered from the other and kept under wsw.save.mock.corrupt.* (the Hand Lab keeps its own save under wsw.save.mock.*);
//   with localStorage blocked (as in some private modes) the game still starts and the save works in memory;
//   with writes failing (a full disk) the game carries on and saves again when they work.
import { chromium } from 'playwright';
import { launchIn } from './lib/launch.mjs';

const base = process.argv[2] ?? 'https://localhost:8097';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};

async function open(context, init) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await launchIn(page, { mode: 'lab', flicker: 0 });
  if (init) await page.addInitScript(init);
  await page.goto(`${base}/`);
  await page.waitForFunction(() => window.__wsw?.saves, null, { timeout: 90000 });
  return { page, errors };
}
const keys = (page) =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('wsw.save'))
      .sort(),
  );

// 1. Saved in one load, there in the next.
{
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const { page, errors } = await open(context);
  const before = await keys(page);
  check(
    'nothing is written just by starting',
    before.filter((k) => k !== 'wsw.save.probe').length === 0,
    before.join(),
  );
  await page.evaluate(() => {
    const s = window.__wsw.saves;
    s.setSettings({ ...s.data.settings, volumeMaster: 0.4, captions: true });
  });
  const none = await page.evaluate(() => Object.keys(localStorage).filter((k) => k === 'wsw.save.mock.b').length);
  check('changes alone do not write (no per-change writes)', none === 0, `slot b present: ${none}`);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const after = await keys(page);
  check('writes when the page is hidden', after.includes('wsw.save.mock.b'), after.join());
  const status = await page.evaluate(() => ({ ...window.__wsw.saves.status }));
  check('status says it is stored', status.persistent === true && status.writes === 1, JSON.stringify(status));
  await page.close();
  const second = await open(context);
  const loaded = await second.page.evaluate(() => {
    const s = window.__wsw.saves;
    return { volume: s.data.settings.volumeMaster, captions: s.data.settings.captions, day: s.data.lastPlayedDay };
  });
  check(
    'the next load has it all',
    loaded.volume === 0.4 && loaded.captions === true && /^\d{4}-\d\d-\d\d$/.test(loaded.day),
    JSON.stringify(loaded),
  );
  // 2. An idle flush writes nothing; a change then a flush writes once.
  const sets = await second.page.evaluate(() => {
    const s = window.__wsw.saves;
    const spy = { n: 0 };
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith('wsw.save.')) spy.n++;
      return real.call(this, k, v);
    };
    s.flush();
    const idle = spy.n;
    s.setSettings({ ...s.data.settings, volumeMaster: 0.5 });
    s.flush();
    const ended = spy.n;
    Storage.prototype.setItem = real;
    return { idle, ended };
  });
  check(
    'an idle flush writes nothing; a change writes once when flushed',
    sets.idle === 0 && sets.ended === 1,
    JSON.stringify(sets),
  );
  // 3. A damaged slot is recovered from the other one.
  await second.page.evaluate(() => {
    const newest = ['wsw.save.mock.a', 'wsw.save.mock.b'].sort(
      (x, y) => JSON.parse(localStorage[y]).seq - JSON.parse(localStorage[x]).seq,
    )[0];
    localStorage.setItem(newest, localStorage.getItem(newest).slice(0, 40));
  });
  await second.page.close();
  const third = await open(context);
  const rec = await third.page.evaluate(() => ({
    status: { ...window.__wsw.saves.status },
    volume: window.__wsw.saves.data.settings.volumeMaster,
    kept: Object.keys(localStorage).filter((k) => k.startsWith('wsw.save.mock.corrupt')),
  }));
  check(
    'a damaged newest slot loads from the other and is kept',
    rec.status.recovered === 'other-slot' && rec.volume === 0.4 && rec.kept.length === 1,
    JSON.stringify(rec),
  );
  check('no page errors', errors.length === 0 && third.errors.length === 0, [...errors, ...third.errors].join(' | '));
  await context.close();
}

// 4. localStorage blocked: the game starts, and the save works in memory.
{
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const { page, errors } = await open(context, () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  const r = await page.evaluate(() => {
    const s = window.__wsw.saves;
    s.setSettings({ ...s.data.settings, volumeMaster: 0.3 });
    const wrote = s.flush();
    return { wrote, status: { ...s.status }, kept: s.data.settings.volumeMaster === 0.3 };
  });
  check(
    'with storage blocked the game starts and the save works in memory',
    r.kept && r.wrote === true && r.status.persistent === false,
    JSON.stringify(r),
  );
  check('no page errors with storage blocked', errors.length === 0, errors.join(' | '));
  await context.close();
}

// 5. Writes failing (a full disk), then working again.
{
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const { page, errors } = await open(context);
  const r = await page.evaluate(() => {
    const s = window.__wsw.saves;
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) {
      if (String(k).startsWith('wsw.save.'))
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      return real.apply(this, arguments);
    };
    s.setSettings({ ...s.data.settings, volumeMaster: 0.3 });
    const failedWrite = s.flush();
    const whileFailing = { ...s.status };
    Storage.prototype.setItem = real;
    const recovered = s.flush();
    return { failedWrite, whileFailing, recovered, now: { ...s.status }, kept: s.data.settings.volumeMaster === 0.3 };
  });
  check(
    'a full disk does not stop the game, and the next flush saves',
    r.failedWrite === false &&
      r.whileFailing.persistent === false &&
      r.recovered === true &&
      r.now.persistent === true &&
      r.kept,
    JSON.stringify(r),
  );
  check('no page errors with a full disk', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
