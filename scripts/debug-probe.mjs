/* global window, document */
// Checks the debug tools in a real browser, with no headset.
// Usage: start a dev server (npx vite --port 8097 --strictPort), with recordings/emulator-demo.handrec.json present, then
//   node scripts/debug-probe.mjs https://localhost:8097 [screenshot-prefix]
// It presses the keys (Alt+P, Alt+., Alt+[ ...), switches each system off and on, shows the overlays (with a stand-in
// entity store), replays the demo recording, and drives the hands-only menu's buttons.
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
const steps = () => w(() => window.__wsw.sim.steps);
const wait = (ms) => page.waitForTimeout(ms);

check('the HUD is on the page', (await w(() => document.body.innerText)).includes('DEBUG'));

// --- time ---
await wait(500);
const a = await steps();
await wait(1000);
const running = (await steps()) - a;
check('the simulation runs at about its rate', running > 20, `${running} steps in 1 s`);

await key('P');
check('Alt+P pauses', await w(() => window.__wsw.debug.time.paused));
const p0 = await steps();
await wait(600);
check('no steps while paused', (await steps()) === p0);
await key('Period');
await wait(200);
check('Alt+. runs exactly one step', (await steps()) === p0 + 1, String((await steps()) - p0));
await key('Period');
await key('Period');
await wait(200);
check('and two presses run two', (await steps()) === p0 + 3);
check('the HUD says PAUSED', (await w(() => document.body.innerText)).includes('PAUSED'));

await key('P');
await key('BracketLeft'); // 1/2x
await key('BracketLeft'); // 1/4x
check('Alt+[ twice gives 1/4x', (await w(() => window.__wsw.debug.time.speedLabel)) === '1/4x');
const s0 = await steps();
await wait(2000);
const slow = (await steps()) - s0;
check(
  '1/4x runs a quarter of the steps',
  slow > running * 0.1 && slow < running * 0.45 * 2,
  `${slow} in 2 s vs ${running} in 1 s`,
);
await key('Digit0');
check(
  'Alt+0 is normal speed again',
  (await w(() => window.__wsw.debug.time.speed)) === 1 && !(await w(() => window.__wsw.debug.time.paused)),
);

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
await w(async () => {
  const { EntityStore } = await import('/src/engine/sim/entity-store.ts');
  const { DEFAULT_CAPACITIES, Kind } = await import('/src/engine/sim/entity-kinds.ts');
  const store = new EntityStore(DEFAULT_CAPACITIES);
  store.create(Kind.Traveller, 0, 0.1, 0.05);
  store.create(Kind.Rock, 0.2, -0.1, 0.08);
  window.__wsw.debug.setEntityStore(store);
});
await key('KeyC');
await wait(300);
const drawn = await w(() => {
  const d = window.__wsw.debug.shadowDebug;
  return { visible: d.collidersVisible, range: d.colliders.geometry.drawRange.count };
});
check(
  'Alt+C draws a circle for each entity (2 entities x 20 segments x 2 points)',
  drawn.visible && drawn.range === 80,
  JSON.stringify(drawn),
);
if (shot) await page.screenshot({ path: `${shot}-overlays.png` });
for (const k of ['KeyK', 'KeyJ', 'KeyC']) await key(k);
check(
  'they switch off again',
  !(await w(() => window.__wsw.debug.controller.overlays.capsules || window.__wsw.debug.controller.overlays.colliders)),
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

// --- the hands-only menu ---
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForFunction(() => window.__wsw.settingsPanel.isOpen, null, { timeout: 20000 });
const press = (id) => w((id) => window.__wsw.settingsPanel.doc.getElementById(id).dispatchEvent({ type: 'click' }), id);
const text = (id) => w((id) => window.__wsw.settingsPanel.doc.getElementById(id).properties?.value?.text, id);
await press('settings-page-button');
await press('settings-page-button');
check(
  'the page button reaches the Debug page',
  (await text('settings-title')) === 'Debug: time and views',
  await text('settings-title'),
);
await press('extra-pause');
check('the Pause button pauses the simulation', await w(() => window.__wsw.debug.time.paused));
check('and its text follows', (await text('extra-pause')) === 'Paused: resume', await text('extra-pause'));
await press('extra-speed');
check('the Speed button cycles to 1/2x', (await text('extra-speed')) === '1/2x');
await press('extra-pause');
await press('extra-speed');
await press('extra-speed');
await press('extra-speed');
await press('extra-colliders');
check('an overlay button works', await w(() => window.__wsw.debug.controller.overlays.colliders));
await key('KeyC'); // a key press changes the menu text too
await wait(200);
check(
  'and a key press updates the menu text',
  (await text('extra-colliders')) === 'off',
  await text('extra-colliders'),
);
if (shot) await page.screenshot({ path: `${shot}-menu.png` });
await press('settings-page-button');
check('the next page is systems and replay', (await text('settings-title')) === 'Debug: systems and replay');
await press('extra-system-shadow');
check('a system button switches it off', !(await state()).shadow);
await press('extra-system-shadow');
check('and on', (await state()).shadow);
// Where skip-to-a-puzzle plugs in: a registered action gets its own page and button.
await w(() => {
  window.__wsw.debug.controller.actions.register({
    id: 'demo-jump',
    group: 'Puzzles',
    label: 'Demo jump',
    run: () => (window.__demoJump = true),
  });
});
check(
  'registered actions are listed under their group',
  await w(() => window.__wsw.debug.controller.pages().some((p) => p.title === 'Debug: Puzzles')),
);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
