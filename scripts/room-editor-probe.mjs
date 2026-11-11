/* global window, document, DataTransfer, DragEvent */
// Checks the room editor's asset browser end to end in a real browser, with no headset: the dev server's asset endpoints and
// their refusals, that changing model files never reloads the page, importing, placing (button and drop into the view),
// undo and redo, exporting built pieces, and that a placed model saved to the layout loads in the game after a reload.
// Usage: start a dev server (npx vite --port 8097 --strictPort), then
//   node scripts/room-editor-probe.mjs https://localhost:8097 [screenshot.png]
// It works in src/assets/models/probe-tmp/ and puts content/rooms/bedroom.json back as it was at the end.
import { readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:8097';
const shot = process.argv[3];
const LAYOUT = 'content/rooms/bedroom.json';
const layoutBefore = readFileSync(LAYOUT, 'utf8');
const chair = readFileSync('src/assets/models/chair.glb');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};
const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 850 } })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());
const w = (fn, arg) => page.evaluate(fn, arg);
const open = async () => {
  await page.goto(`${base}/?mock=1&edit=room`);
  await page.waitForFunction(
    () => window.__wsw?.roomEditor && document.querySelector('.room-assets .tree .item'),
    null,
    {
      timeout: 90000,
    },
  );
  await w(() => (window.__mark = 1));
};
/** POSTs to an asset endpoint from the page; the status and the text of the answer. */
const post = (query, bytes) =>
  w(
    async ([q, b]) => {
      const res = await fetch(`./__wsw/assets/${q}`, { method: 'POST', body: b ? new Uint8Array(b) : undefined });
      return { status: res.status, text: (await res.text()).slice(0, 120) };
    },
    [query, bytes ? [...bytes] : null],
  );
const alive = () => w(() => window.__mark === 1).catch(() => false);

try {
  await open();

  // --- the endpoints ---
  check('makes a folder', (await post('mkdir?path=probe-tmp')).status === 200);
  check('imports a model', (await post('file?path=probe-tmp/probe-chair.glb', chair)).status === 200);
  const bad = await post('file?path=../evil.glb', chair);
  check('refuses a path out of the folder', bad.status === 400, bad.text);
  const clash = await post('file?path=probe-tmp/Chair.glb', chair);
  check("refuses another asset's id, whatever its case", clash.status === 409, clash.text);
  const notGlb = await post('file?path=probe-tmp/text.glb', Buffer.from('{"asset":{}}'));
  check('refuses bytes that are not a .glb', notGlb.status === 422, notGlb.text);
  const big = await post('file?path=probe-tmp/big.glb', Buffer.alloc(600 * 1024));
  check('refuses a file over the model budget', big.status === 413, big.text);
  await page.waitForTimeout(1500);
  check('changing model files does not reload the page', await alive());

  // --- placing ---
  await page.click('.room-assets [data-act="refresh"]');
  await page.waitForSelector('.room-assets [data-path="probe-tmp"]');
  await page.click('.room-assets [data-path="probe-tmp"]');
  await page.click('.room-assets [data-path="probe-tmp/probe-chair.glb"]');
  await page.click('.room-assets [data-act="add"]');
  await page.waitForFunction(() => window.__wsw.placedModels.editables().some((p) => p.model === 'probe-chair'), null, {
    timeout: 20000,
  });
  check('Add to room places the model', true);
  check('the layout has unsaved changes', await w(() => window.__wsw.roomEditor.dirty));
  const dropped = await w(async () => {
    const dt = new DataTransfer();
    dt.setData('application/x-wsw-asset', JSON.stringify({ path: 'probe-tmp/probe-chair.glb', folder: false }));
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const at = { clientX: r.left + r.width * 0.25, clientY: r.top + r.height * 0.6, dataTransfer: dt, bubbles: true };
    c.dispatchEvent(new DragEvent('dragover', { ...at, cancelable: true }));
    c.dispatchEvent(new DragEvent('drop', { ...at, cancelable: true }));
    await new Promise((done) => setTimeout(done, 2000));
    return window.__wsw.placedModels.editables().filter((p) => p.model === 'probe-chair').length;
  });
  check('dropping it into the view places another', dropped === 2, `${dropped} placed`);
  const undo = await w(() => {
    const ed = window.__wsw.roomEditor;
    const count = () => window.__wsw.placedModels.editables().filter((p) => p.model === 'probe-chair').length;
    ed.step(true);
    const afterUndo = count();
    ed.step(false);
    return [afterUndo, count()];
  });
  check('undo takes the drop back and redo brings it back', undo[0] === 1 && undo[1] === 2, undo.join(' → '));

  // --- moving and renaming files ---
  check('moves a placed model between folders', (await post('mkdir?path=probe-tmp/sub')).status === 200);
  check(
    '(the move)',
    (await post('move?from=probe-tmp/probe-chair.glb&to=probe-tmp/sub/probe-chair.glb')).status === 200,
  );

  // --- export ---
  const exported = await w(async () => {
    const ed = window.__wsw.roomEditor;
    ed.selectId('tin-can');
    return ed.exportSelected();
  });
  check('exports a built piece', /Exported exported\/tin-can\.glb/.test(exported), exported);

  // --- save and reload: the game loads the placed model through the asset manifest ---
  const saved = await w(() => window.__wsw.roomEditor.save());
  check('saves the layout', /^Saved/.test(saved), saved);
  const used = await post('move?from=probe-tmp/sub/probe-chair.glb&to=probe-tmp/sub/renamed.glb');
  check('refuses to rename a model the layout places', used.status === 409, used.text);
  if (shot) await page.screenshot({ path: shot });
  await page.reload();
  await page.waitForFunction(() => window.__wsw?.placedModels, null, { timeout: 90000 });
  await page
    .waitForFunction(() => window.__wsw.placedModels.editables().length >= 2, null, { timeout: 30000 })
    .catch(() => {});
  const afterReload = await w(() => window.__wsw.placedModels.editables().map((p) => `${p.id}:${p.model}`));
  check('after a reload the game stands the saved models', afterReload.length === 2, afterReload.join(', '));
} finally {
  writeFileSync(LAYOUT, layoutBefore);
  rmSync('src/assets/models/probe-tmp', { recursive: true, force: true });
  rmSync('src/assets/models/exported/tin-can.glb', { force: true });
  try {
    rmdirSync('src/assets/models/exported');
  } catch {
    // Not empty (other exports there): leave it.
  }
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
