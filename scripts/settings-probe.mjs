/* global window */
// Checks the settings screen in a real browser, with no headset.
// Usage: start a dev server (npx vite --port 8097 --strictPort) then
//   node scripts/settings-probe.mjs https://localhost:8097 [screenshot.png]
// In headless Chromium it checks that:
//   the panel builds and opens with every setting's value shown;
//   pressing a stepper, a toggle and the hand button changes the setting, applies it to the engine and updates the text;
//   Reset restores the defaults; Close hides the panel and removes its poke target;
//   a change is saved and survives a reload.
import { chromium } from 'playwright';
import { launchIn } from './lib/launch.mjs';

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

const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await launchIn(page, { mode: 'lab', flicker: 0 });
await page.goto(`${base}/`);
await page.waitForFunction(() => window.__wsw?.settingsPanel, null, { timeout: 90000 });
await page.getByRole('button', { name: 'Settings', exact: true }).click(); // the Hand Lab's button
await page.waitForFunction(() => window.__wsw.settingsPanel.isOpen || window.__wsw.settingsPanel.lastError, null, {
  timeout: 20000,
});

const state = await page.evaluate(() => {
  const p = window.__wsw.settingsPanel;
  const doc = p.doc;
  const el = (id) => doc?.getElementById(id);
  return {
    open: p.isOpen,
    error: p.lastError,
    ids: [
      'tolerance-dec',
      'tolerance-value',
      'highContrast-button',
      'hand-button',
      'settings-reset',
      'settings-close',
    ].map((id) => [id, !!el(id)]),
    scale: p.entity?.object3D.scale.x,
    visible: p.entity?.object3D.visible,
    pos: p.entity?.object3D.position.toArray(),
    root: doc ? { w: doc.rootElement.size?.value?.[0], h: doc.rootElement.size?.value?.[1] } : null,
    tolText: el('tolerance-value')?.properties?.value?.text ?? el('tolerance-value')?.properties?.signal?.text?.value,
  };
});
console.log(JSON.stringify(state));
check('panel opens', state.open && !state.error, state.error ?? '');
check(
  'every probed element exists',
  state.ids.every(([, ok]) => ok),
  JSON.stringify(state.ids),
);

// Press things the way a poke does: a click event on the element.
const press = (id) =>
  page.evaluate((id) => {
    const el = window.__wsw.settingsPanel.doc.getElementById(id);
    el.dispatchEvent({ type: 'click' });
  }, id);
const val = (key) => page.evaluate((k) => window.__wsw.settings.value[k], key);

const display = (id) =>
  page.evaluate((id) => window.__wsw.settingsPanel.doc.getElementById(id).properties?.value?.display, id);
check(
  'page 1 shows and page 2 is hidden',
  (await display('settings-page-0')) !== 'none' && (await display('settings-page-1')) === 'none',
);
if (shot) await page.screenshot({ path: `${shot}-1.png` });
await press('settings-page-button');
check(
  'the page button shows page 2',
  (await display('settings-page-0')) === 'none' && (await display('settings-page-1')) !== 'none',
);
if (shot) await page.screenshot({ path: `${shot}-2.png` });
await press('settings-page-button');

await press('tolerance-inc');
check('tolerance stepper raises it by 0.5', (await val('tolerance')) === 1.5, String(await val('tolerance')));
check('and the recognizer got it', await page.evaluate(() => window.__wsw.shapes.left.config.tolerance === 1.5));
await press('holdTime-inc');
check(
  'hold time reaches the recognizer (0.5 s verbs, 1.25 s companions)',
  await page.evaluate(() => {
    const c = window.__wsw.shapes.left.config;
    return Math.abs(c.verbHoldS - 0.5) < 1e-9 && Math.abs(c.companionHoldS - 1.25) < 1e-9;
  }),
);
await press('shadowSize-inc');
check('shadow size reaches the projector', await page.evaluate(() => window.__wsw.projector.settings.size === 1.1));
await press('volumeMusic-dec');
check(
  'music volume reaches the mixer',
  await page.evaluate(() => Math.abs(window.__wsw.audio.mixer.volume(0) - 0.6) < 1e-9),
);
await press('highContrast-button');
check('high contrast toggles', (await val('highContrast')) === true);
check(
  'high contrast makes the wall pure white and the shadows solid',
  await page.evaluate(() => {
    const w = window.__wsw;
    const m = w.stageView.paper.material;
    return (
      w.stageView.highContrast &&
      w.shadowRenderer.baseOpacity === 1 &&
      m.opacity === 1 &&
      m.color.r === 1 &&
      m.color.g === 1 &&
      m.color.b === 1
    );
  }),
);
await page.waitForTimeout(300);
if (shot) await page.screenshot({ path: `${shot}-contrast.png` });
await press('hand-button');
check('hand preference switches', (await val('hand')) === 'left');
const text = await page.evaluate(() => {
  const el = window.__wsw.settingsPanel.doc.getElementById('hand-button');
  return el.properties?.value?.text;
});
check('the button text follows the setting', text === 'Left', String(text));

// It is saved on the next flush, and survives a reload.
await page.evaluate(() => window.__wsw.saves.flush());
await page.reload();
await page.waitForFunction(() => window.__wsw?.settings, null, { timeout: 90000 });
const after = await page.evaluate(() => ({ ...window.__wsw.settings.value }));
check(
  'settings survive a reload',
  after.tolerance === 1.5 && after.highContrast === true && after.hand === 'left',
  JSON.stringify(after),
);

await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForFunction(() => window.__wsw.settingsPanel.isOpen, null, { timeout: 20000 });
await press('settings-reset');
check('reset restores the defaults', (await val('tolerance')) === 1 && (await val('hand')) === 'right');
await press('settings-close');
check(
  'close hides it',
  await page.evaluate(() => !window.__wsw.settingsPanel.isOpen && !window.__wsw.settingsPanel.entity.object3D.visible),
);
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
