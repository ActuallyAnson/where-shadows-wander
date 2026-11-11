/* global window, document */
// Checks the debug tools in a real browser, with no headset.
// Usage: start a dev server (npx vite --port 8097 --strictPort), with recordings/emulator-demo.handrec.json present, then
//   node scripts/debug-probe.mjs https://localhost:8097 [screenshot-prefix]
// It presses the keys (Alt+1 to 5, Alt+K, Alt+J, Alt+R), switches each system off and on, shows the overlays, replays
// the demo recording, and drives the hands-only menu's buttons.
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
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1100, height: 800 } })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?mock=1&flicker=0.5`);
await page.waitForFunction(() => window.__wsw?.debug, null, { timeout: 90000 });
const w = (fn, arg) => page.evaluate(fn, arg);
const key = (code) => page.keyboard.press(`Alt+${code}`);
const wait = (ms) => page.waitForTimeout(ms);

check('the HUD is on the page', (await w(() => document.body.innerText)).includes('DEBUG'));
// The candle lights itself in mock mode after 3 s; the shadow only shows once it is lit.
await page.waitForFunction(() => window.__wsw.sessionState() === 'playing', null, { timeout: 20000 });
await wait(300);

// --- systems ---
const state = () =>
  w(() => {
    const d = window.__wsw;
    return {
      shadow: d.shadowRenderer.mesh.visible,
      sharpen: d.sharpen.settings.strength,
      flicker: d.lanternLight.settings.amplitude,
      candle: d.candleView.pointLight.visible,
    };
  });
await key('Digit1');
await key('Digit2');
await key('Digit3');
await key('Digit4');
await key('Digit5');
const off = await state();
check(
  'Alt+1 to 4 switch off the shadow, sharpen, flicker and candle light',
  !off.shadow && off.sharpen === 0 && off.flicker === 0 && !off.candle,
  JSON.stringify(off),
);
check(
  'Alt+5 switches off the hand visual',
  (await w(() => window.__wsw.debug.controller.systems.handVisual)) === false,
);
await wait(300);
check('and the glove really is hidden', await w(() => !window.__wsw.handVisual.object.visible));
if (shot) await page.screenshot({ path: `${shot}-systems-off.png` });
await w(() => window.__wsw.settings.set('sharpen', 0.5)); // the settings screen must not switch a system back on
check('a settings change does not undo a switched-off system', (await state()).sharpen === 0);
for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) await key(k);
const on = await state();
check(
  'pressing them again restores each (the flicker to what it was: 0.5)',
  on.shadow && on.sharpen === 0.5 && on.flicker === 0.5 && on.candle,
  JSON.stringify(on),
);

// --- overlays ---
await key('KeyK');
check('Alt+K shows the capsules', await w(() => window.__wsw.debug.shadowDebug.capsulesVisible));
await key('KeyJ');
check('Alt+J shows the joint dots', await w(() => window.__wsw.debug.dots.mesh.visible));
if (shot) await page.screenshot({ path: `${shot}-overlays.png` });
for (const k of ['KeyK', 'KeyJ']) await key(k);
check(
  'they switch off again',
  !(await w(() => window.__wsw.debug.controller.overlays.capsules || window.__wsw.debug.controller.overlays.joints)),
);

// --- replay ---
await key('KeyR');
await page.waitForFunction(() => window.__wsw.debug.replay.active || window.__wsw.debug.controller.replayError, null, {
  timeout: 15000,
});
check(
  'Alt+R starts the demo replay',
  await w(() => window.__wsw.debug.replay.active),
  (await w(() => window.__wsw.debug.controller.replayError)) ?? '',
);
await wait(800);
const replayed = await w(() => ({
  left: window.__wsw.hands.hands.left.tracked,
  right: window.__wsw.hands.hands.right.tracked,
  t: window.__wsw.debug.replay.time,
}));
check(
  'the recording drives the hands',
  (replayed.left || replayed.right) && replayed.t > 0.3,
  JSON.stringify(replayed),
);
check('the HUD says REPLAY', (await w(() => document.body.innerText)).includes('REPLAY'));
await key('KeyR');
check('Alt+R stops it', !(await w(() => window.__wsw.debug.replay.active)));

// --- the hands-only menu (its pages, as the settings panel shows them after the settings) ---
const item = (page, id) =>
  w(
    ([page, id]) => {
      const it = window.__wsw.debug.controller.pages()[page].items.find((i) => i.id === id);
      return it ? it.text() : null;
    },
    [page, id],
  );
const pressItem = (page, id) =>
  w(
    ([page, id]) =>
      window.__wsw.debug.controller
        .pages()
        [page].items.find((i) => i.id === id)
        .press(),
    [page, id],
  );
check(
  'the first debug page is the views',
  (await w(() => window.__wsw.debug.controller.pages()[0].title)) === 'Debug: views',
);
await pressItem(0, 'joints');
check('an overlay button works', await w(() => window.__wsw.debug.controller.overlays.joints));
check('and its text follows', (await item(0, 'joints')) === 'ON', await item(0, 'joints'));
await key('KeyJ'); // a key press changes the menu text too
await wait(200);
check('and a key press updates the menu text', (await item(0, 'joints')) === 'off', await item(0, 'joints'));
check(
  'the next page is systems and replay',
  (await w(() => window.__wsw.debug.controller.pages()[1].title)) === 'Debug: systems and replay',
);
await pressItem(1, 'system-shadow');
check('a system button switches it off', !(await state()).shadow);
await pressItem(1, 'system-shadow');
check('and on', (await state()).shadow);
// A registered action gets its own page and button.
await w(() => {
  window.__wsw.debug.controller.actions.register({
    id: 'demo-jump',
    group: 'Demo',
    label: 'Demo jump',
    run: () => (window.__demoJump = true),
  });
});
check(
  'registered actions are listed under their group',
  await w(() => window.__wsw.debug.controller.pages().some((p) => p.title === 'Debug: Demo')),
);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
