// Standalone Playwright check of IWER desktop emulation (outside the IWSDK managed
// browser, so the DevUI toolbar and keyboard bindings are live).
// Usage: node scripts/desktop-emulation.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'https://localhost:8081/';
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--use-angle=metal'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const viewer = () => page.evaluate(() => window.__spike.game.viewer.toArray().map((v) => +v.toFixed(3)));
await page.goto(url);
await page.waitForFunction(() => window.__spike?.report.firstFrameMs != null, null, { timeout: 30000 });
const buttons = await page.evaluate(() => [...document.querySelectorAll('button, [role=button]')].map((b) => b.textContent?.trim() || b.getAttribute('aria-label') || b.title).filter(Boolean));
console.log('buttons:', JSON.stringify(buttons));
const enter = page.getByRole('button', { name: /enter (xr|ar)/i }).first();
if (await enter.count()) await enter.click();
else await page.evaluate(() => window.__spike.world.launchXR());
await page.waitForFunction(() => !!window.__spike.world.session, null, { timeout: 15000 });
await page.waitForTimeout(1000);
console.log('session:', JSON.stringify(await page.evaluate(() => ({ blend: window.__spike.world.session.environmentBlendMode, sources: [...window.__spike.world.session.inputSources].map((s) => `${s.handedness}:${s.hand ? 'hand' : 'controller'}`) }))));
console.log('viewer before keys:', await viewer());
// DevUI toolbar: second icon is "play mode" (pointer-lock look + WASD).
await page.mouse.click(455, 27);
await page.waitForTimeout(300);
console.log('pointerLock:', await page.evaluate(() => !!document.pointerLockElement));
await page.keyboard.down('Shift');
await page.keyboard.down('w');
await page.waitForTimeout(1200);
await page.keyboard.up('w');
await page.keyboard.up('Shift');
await page.waitForTimeout(300);
console.log('viewer after Shift+W 1.2s:', await viewer());
await page.mouse.move(640, 400);
await page.mouse.move(840, 400, { steps: 10 });
await page.waitForTimeout(300);
console.log('viewer forward after mouse move:', await page.evaluate(() => {
  const { world } = window.__spike; const e = world.camera.matrixWorld.elements; return [-e[8], -e[9], -e[10]].map((v) => +v.toFixed(3));
}));
// Toolbar third icon: input mode (controllers <-> hands).
await page.keyboard.press('Escape');
await page.mouse.click(484, 27);
await page.waitForTimeout(800);
await page.mouse.click(437, 163); // "Hands" in the Input setup menu
await page.waitForTimeout(1500);
console.log('sources after choosing Hands:', JSON.stringify(await page.evaluate(() => [...window.__spike.world.session.inputSources].map((s) => `${s.handedness}:${s.hand ? 'hand' : 'controller'}`))));
await page.waitForTimeout(500);
console.log('hands:', JSON.stringify(await page.evaluate(() => { const h = window.__spike.game.hands.hands; return [h.left.validJoints, h.right.validJoints]; })));
await page.screenshot({ path: process.env.SHOT ?? 'desktop-emulation.png' });
await browser.close();
