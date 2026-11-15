/* global window */
// Draws moments of the story's puppet stage flat, in 2D, and saves them (a quick look without a headset or WebGL; puppet
// parts only, no room or light). Usage:
//   node scripts/stage-preview.mjs <out-prefix> <chapter> <t1,t2,...> [friend-json]
// e.g. node scripts/stage-preview.mjs shots/gb goodbye 0,0.3,0.8,1.5,3,5 '{"puppet":"flat","x":0,"y":0.06,"t":8,"op":1}'
import { build } from 'esbuild';
import { chromium } from 'playwright';

const [prefix, chapter, times, friendJson] = process.argv.slice(2);
const out = await build({
  entryPoints: [new URL('./stage-preview-entry.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true,
  write: false,
  format: 'iife',
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1010, height: 631 } });
await page.setContent('<body style="margin:0;background:#000"><canvas id="c"></canvas></body>');
await page.addScriptTag({ content: out.outputFiles[0].text });
const friend = friendJson ? JSON.parse(friendJson) : undefined;
for (const t of times.split(',').map(Number)) {
  await page.evaluate(([c, t, f]) => window.render(c, t, f), [chapter, t, friend]);
  const file = `${prefix}-${String(t).padStart(5, '0')}.png`;
  await page.locator('#c').screenshot({ path: file });
  console.log(file);
}
await browser.close();
