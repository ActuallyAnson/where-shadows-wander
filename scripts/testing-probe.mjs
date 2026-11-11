/* global window */
// Checks the launcher's Developer panel in a real browser, with no headset and with no address typed.
// Usage: start a dev server (npx vite --port 8097 --strictPort) then
//   node scripts/testing-probe.mjs https://localhost:8097 [screenshot.png]
// It opens the plain game (the dev server's emulator gives the page navigator.xr, so the launcher shows), presses the
// testing switches and checks that each takes effect at once (nothing reloads, the address stays plain), is remembered
// across a reload, and that the settings panel and the recording begin when a VR session starts. Then it opens the Hand
// Lab and the room editor from the panel and comes back to the game, the address plain all the while.
import { chromium } from 'playwright';

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
await page.waitForSelector('#xr-launcher-ui', { timeout: 90000 });
await page.waitForFunction(() => window.__wsw?.debug, null, { timeout: 90000 });
let navigations = 0;
page.on('framenavigated', (f) => f === page.mainFrame() && navigations++);

const panel = page.locator('#xr-developer-panel');
check('the Developer panel starts hidden', await panel.isHidden());
check(
  'the launcher has no AR or duplicate Enter VR button',
  (await page.getByRole('button', { name: /Enter AR|Direct Hands/ }).count()) === 0,
);
await page.getByRole('button', { name: /Developer/ }).click();
check('the Developer button shows it', await panel.isVisible());

await page.getByRole('button', { name: /Joint dots/ }).click();
check('Joint dots take effect at once', await page.evaluate(() => window.__wsw.debug.dots.mesh.visible));
await page.getByRole('button', { name: /Shadow capsules/ }).click();
check('and so do the shadow capsules', await page.evaluate(() => window.__wsw.debug.shadowDebug.capsulesVisible));
await page.getByRole('button', { name: /Settings panel opens/ }).click();
await page.getByRole('button', { name: /Recording hands/ }).click(); // off -> 20 s
if (shot) await page.screenshot({ path: shot });
check('nothing reloaded and the address is still plain', navigations === 0 && new URL(page.url()).search === '');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wsw.testing')));
check(
  'the switches are remembered in the browser',
  stored.joints && stored.shadow && stored.settings && stored.record === 'free',
  JSON.stringify(stored),
);

// A reload keeps them, with still no address.
await page.reload();
await page.waitForSelector('#xr-launcher-ui', { timeout: 90000 });
await page.waitForFunction(() => window.__wsw?.debug, null, { timeout: 90000 });
check('after a reload the address is still plain', new URL(page.url()).search === '');
check(
  'and the overlays are on again',
  await page.evaluate(() => window.__wsw.debug.dots.mesh.visible && window.__wsw.debug.shadowDebug.capsulesVisible),
);
await page.getByRole('button', { name: /Developer/ }).click();
const text = await panel.innerText();
check(
  'the panel shows what is on',
  /On now: joint dots, shadow capsules, settings panel on entry, recording 20 s/.test(text),
  text.split('\n')[1],
);

// Starting VR: the settings panel opens and the recording is armed.
check('no recording before VR starts', (await page.evaluate(() => window.__wsw.getRecorder())) === null);
await page.evaluate(() => window.__wsw.world.renderer.xr.dispatchEvent({ type: 'sessionstart' }));
await page.waitForFunction(() => window.__wsw.settingsPanel.isOpen || window.__wsw.settingsPanel.lastError, null, {
  timeout: 20000,
});
check('the settings panel opens when VR starts', await page.evaluate(() => window.__wsw.settingsPanel.isOpen));
check(
  'and a 20 s recording is armed',
  await page.evaluate(() => {
    const r = window.__wsw.getRecorder();
    return r !== null && r.seconds === 20 && r.script === null;
  }),
);

// Guided shapes: the next press of the recording button.
await page.evaluate(() => window.__wsw.world.renderer.xr.dispatchEvent({ type: 'sessionend' }));
check(
  'the recording is dropped when the session ends',
  (await page.evaluate(() => window.__wsw.getRecorder())) === null,
);
await page.getByRole('button', { name: /Recording hands/ }).click(); // free -> guided shapes
await page.evaluate(() => window.__wsw.world.renderer.xr.dispatchEvent({ type: 'sessionstart' }));
check(
  'guided shapes arm the shape script and a prompt panel',
  await page.evaluate(() => {
    const r = window.__wsw.getRecorder();
    return r !== null && r.script !== null;
  }),
);

await page.evaluate(() => window.__wsw.world.renderer.xr.dispatchEvent({ type: 'sessionend' })); // the launcher comes back
await page.getByRole('button', { name: 'Clear all switches' }).click();
const cleared = await page.evaluate(() => ({
  dots: window.__wsw.debug.dots.mesh.visible,
  caps: window.__wsw.debug.shadowDebug.capsulesVisible,
  stored: JSON.parse(localStorage.getItem('wsw.testing')),
}));
check(
  'Clear all switches everything off',
  !cleared.dots && !cleared.caps && cleared.stored.record === 'off',
  JSON.stringify(cleared),
);

// The modes: the Hand Lab and the room editor open from the panel, and the lab leads back to the game; the address stays plain.
const plain = () => new URL(page.url()).search === '' && new URL(page.url()).hash === '';
if (await panel.isHidden()) await page.getByRole('button', { name: /Developer/ }).click();
await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /^Hand Lab/ }).click()]);
await page.waitForFunction(() => window.__wsw?.lab, null, { timeout: 90000 });
check('Hand Lab opens in the lab, with a plain address', plain(), page.url());
check('the lab has no launcher', (await page.locator('#xr-launcher-ui').count()) === 0);
await page.reload();
await page.waitForFunction(() => window.__wsw?.lab, null, { timeout: 90000 });
check('a reload stays in the lab', true);
await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Back to the game' }).click()]);
await page.waitForSelector('#xr-launcher-ui', { timeout: 90000 });
await page.waitForFunction(() => window.__wsw, null, { timeout: 90000 });
check('Back to the game opens the game', (await page.evaluate(() => window.__wsw.lab)) === null && plain());
await page.getByRole('button', { name: /Developer/ }).click();
await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /^Room editor/ }).click()]);
await page.waitForFunction(() => window.__wsw?.roomEditor, null, { timeout: 90000 });
check('Room editor opens the editor, with a plain address', plain(), page.url());
await page.evaluate(() => {
  sessionStorage.removeItem('wsw.launch');
});
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
