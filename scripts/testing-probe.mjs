/* global window */
// Checks the developer tools in a real browser, with no headset and with no address typed.
// Usage: start a dev server (npx vite --port 8097 --strictPort) then
//   node scripts/testing-probe.mjs https://localhost:8097 [screenshot.png]
// The launcher page has no Developer button; its launch log is hidden until BEGIN fails. The testing switches preset in the
// browser's storage take effect when the page starts and when VR starts. In the session, the pause screen's Developer
// button opens the room's settings screen at the Developer page (developer-page.ts), whose buttons show the Hand Lab
// (which switches whose hands play, live), start a recording, set the test flicker live, and open the room editor.
import { chromium } from 'playwright';
import { enterVr } from './lib/launch.mjs';

const base = process.argv[2] ?? 'https://localhost:8097';
const shot = process.argv[3];
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};

const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 900 } })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/`);
await page.waitForSelector('#xr-launcher-ui', { state: 'attached', timeout: 90000 });
await page.waitForFunction(() => window.__wsw?.developer, null, { timeout: 90000 });
let navigations = 0;
page.on('framenavigated', (f) => f === page.mainFrame() && navigations++);
const plain = () => new URL(page.url()).search === '' && new URL(page.url()).hash === '';

check('the launcher has no Developer button', (await page.getByRole('button', { name: /Developer/ }).count()) === 0);
check('nor a Copy logs button until BEGIN fails', await page.getByRole('button', { name: /Copy logs/ }).isHidden());

// Switches preset in storage (as the probe scripts do) apply when the page starts.
await page.evaluate(() =>
  localStorage.setItem('wsw.testing', JSON.stringify({ joints: true, shadow: true, settings: true, record: 'free' })),
);
await page.reload();
await page.waitForFunction(() => window.__wsw?.developer, null, { timeout: 90000 });
check(
  'preset overlays are on when the page starts',
  await page.evaluate(() => window.__wsw.debug.dots.mesh.visible && window.__wsw.debug.shadowDebug.capsulesVisible),
);
check('no recording before VR starts', (await page.evaluate(() => window.__wsw.getRecorder())) === null);
await enterVr(page);
await page.waitForFunction(() => window.__wsw.settingsPanel.isOpen || window.__wsw.settingsPanel.lastError, null, {
  timeout: 20000,
});
check('the preset settings panel opens when VR starts', await page.evaluate(() => window.__wsw.settingsPanel.isOpen));
check(
  'and the preset 20 s recording is armed',
  await page.evaluate(() => {
    const r = window.__wsw.getRecorder();
    return r !== null && r.seconds === 20 && r.script === null;
  }),
);
await page.evaluate(() => {
  window.__wsw.settingsPanel.close();
  localStorage.removeItem('wsw.testing');
});

// The Developer page, opened the way the pause screen's Developer button opens it.
await page.evaluate(() => window.__wsw.openSettings(window.__wsw.developer.title));
check('the Developer page opens in the room', await page.evaluate(() => window.__wsw.settingsPanel.isOpen));
if (shot) await page.screenshot({ path: shot });
const press = (id) => page.evaluate((id) => window.__wsw.developer.items.find((i) => i.id === id).press(), id);
const text = (id) => page.evaluate((id) => window.__wsw.developer.items.find((i) => i.id === id).text(), id);

check('the free recording is already running', (await text('record-free')) !== 'Start', await text('record-free'));
await press('record-shapes'); // ignored while the free one runs
check('a second recording waits for the first', await page.evaluate(() => window.__wsw.getRecorder().script === null));

const navBefore = navigations;
await press('flicker'); // the setting -> steady
const steady = await page.evaluate(() => ({
  amp: window.__wsw.lanternLight.settings.amplitude,
  stored: JSON.parse(localStorage.getItem('wsw.testing')),
}));
check(
  'the test flicker applies live and is remembered',
  steady.amp === 0 && steady.stored.flicker === 0 && navigations === navBefore,
  JSON.stringify(steady),
);
for (let i = 0; i < 3; i++) await press('flicker'); // steady -> 0.5 -> 1 -> the setting
check('and hands the lantern back to the setting', (await text('flicker')) === 'the setting');

// Hands (ADR 0018): the Hand Lab shows at once, with no reload, and switches whose hands play live, in the session.
const labPanel = page.locator('aside.lab');
const labButton = (name) => labPanel.getByRole('button', { name, exact: true });
let before = navigations;
await press('hand-lab');
await labPanel.waitFor({ state: 'visible', timeout: 10000 });
check('the Hand Lab panel shows at once, with no reload', navigations === before && plain(), page.url());
check('and starts with the device hands', await page.evaluate(() => !window.__wsw.lab.mockActive));
check('the page says it is shown', (await text('hand-lab')) === 'SHOWN');
await labButton('Script').click();
await page.waitForFunction(() => window.__wsw.lab.mockActive && window.__wsw.hands.hands.right.tracked, null, {
  timeout: 30000,
});
check(
  'Script switches to mock hands live, in the session',
  await page.evaluate(() => window.__wsw.world.renderer.xr.isPresenting),
);
await labButton('Device').click();
const back = await page.evaluate(() => ({
  mock: window.__wsw.lab.mockActive,
  presenting: window.__wsw.world.renderer.xr.isPresenting,
  stored: JSON.parse(sessionStorage.getItem('wsw.launch')),
}));
check(
  'Device gives the hands back live, still in the session',
  !back.mock && back.presenting && back.stored.hands === 'device' && navigations === before,
  JSON.stringify(back),
);
await press('hand-lab');
check(
  'a second press hides it, remembered for the tab',
  (await labPanel.isHidden()) &&
    (await page.evaluate(() => JSON.parse(sessionStorage.getItem('wsw.launch')).lab)) === false,
);

// The room editor leaves VR and reloads into the desk.
await Promise.all([page.waitForEvent('load'), press('room-editor')]);
await page.waitForFunction(() => window.__wsw?.roomEditor, null, { timeout: 90000 });
check('Room editor opens the editor, with a plain address', plain(), page.url());
await page.evaluate(() => sessionStorage.removeItem('wsw.launch'));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
