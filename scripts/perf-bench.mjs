// A repeatable performance benchmark of the running game, for before-and-after numbers. It plays the game in the emulator's session in headless Chromium
// (a software renderer, so the milliseconds are a proxy that rises and falls with the real cost, not a headset's numbers), puts the
// game in its states (the lit room, then with the decoration shed) and records, for each: the cost of drawing one frame (the median of many manual renders), the draw calls,
// triangles and textures, the texture memory, and the JavaScript the frame allocates. It also records the start-up time and the heap.
//
//   npm run dev                                   (in another terminal, then:)
//   node scripts/perf-bench.mjs [url] [--label name] [--out file.json] [--runs 3]
//
// The default address is https://localhost:5173/ (the Vite dev server). Compare two runs with `--out`. Runs from before ADR 0018
// (11 Nov 2026) drew the desk view of the old Hand Lab, not a session's, so compare only runs made since.
import { chromium } from 'playwright';
import { enterVr, launchIn, lightCandle } from './lib/launch.mjs';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = args.find((a) => a.startsWith('http')) ?? 'https://localhost:5173/';
const label = flag('--label', 'run');
const out = flag('--out', null);
const runs = Number(flag('--runs', '3'));

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const least = (xs) => Math.min(...xs);

async function once() {
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'],
  });
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 700 } });
  // Count the stalls: tasks on the main thread that take 50 ms or more (the frame loop cannot run during one).
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push(e.duration);
    }).observe({ entryTypes: ['longtask'] });
  });
  await launchIn(page);
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__wsw);
  const startupMs = Date.now() - t0;
  // Into the session, the candle lit (as a player would after 3 s), then 26 s in all, so the stall counts compare between runs.
  await enterVr(page);
  await page.waitForTimeout(3000);
  await lightCandle(page);
  await page.waitForTimeout(23000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const heapMb = await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576);
  const stalls = await page.evaluate(() => ({
    count: window.__longTasks.length,
    totalMs: window.__longTasks.reduce((a, b) => a + b, 0),
    worstMs: Math.max(0, ...window.__longTasks),
  }));
  // How fast this machine is just now (a fixed loop), so a busy laptop shows up in the numbers instead of hiding in them.
  const calibMs = await page.evaluate(() => {
    const t = performance.now();
    let x = 0;
    for (let i = 0; i < 3e7; i++) x += Math.sqrt(i);
    return performance.now() - t + (x < 0 ? 1 : 0);
  });

  const measure = async (name) => {
    const render = await page.evaluate(() => {
      const w = window.__wsw.world;
      const gl = w.renderer.getContext();
      const px = new Uint8Array(4);
      const wait = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // reading a pixel back makes the browser wait for the drawing to finish
      for (let i = 0; i < 8; i++) w.renderer.render(w.scene, w.camera); // warm up (shaders, uploads)
      wait();
      const times = [];
      for (let i = 0; i < 40; i++) {
        const t = performance.now();
        w.renderer.render(w.scene, w.camera);
        wait(); // so the time includes drawing the pixels, not just recording the commands
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      const info = w.renderer.info;
      const seen = new Set();
      let mb = 0;
      const add = (t) => {
        if (!t || !t.image || seen.has(t) || !t.image.width) return;
        seen.add(t);
        mb += (t.image.width * t.image.height * 4 * (t.generateMipmaps ? 1.33 : 1)) / 1048576;
      };
      w.scene.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          add(m.map);
          if (m.uniforms) for (const k in m.uniforms) if (m.uniforms[k].value?.isTexture) add(m.uniforms[k].value);
        }
      });
      return {
        renderMs: times[20],
        calls: info.render.calls,
        triangles: info.render.triangles,
        textures: info.memory.textures,
        textureMb: mb,
      };
    });
    // The JavaScript a frame allocates: a sampling heap profile over 3 s of ordinary frames; "ours" leaves out the browser's emulator
    // and the Hand Lab panel, which exist only on a desktop.
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256 });
    const frames = await page.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          const f = () => {
            n++;
            if (performance.now() - t0 < 3000) requestAnimationFrame(f);
            else res(n);
          };
          requestAnimationFrame(f);
        }),
    );
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    let total = 0;
    let ours = 0;
    const walk = (node) => {
      const u = node.callFrame.url;
      if (node.selfSize > 0) {
        total += node.selfSize;
        if (!/iwer|hand-lab|chunk-|:-1$/.test(u + ':' + node.callFrame.lineNumber) && u !== '') ours += node.selfSize;
      }
      node.children.forEach(walk);
    };
    walk(profile.head);
    return { state: name, ...render, allocBytesPerFrame: total / frames, ourAllocBytesPerFrame: ours / frames };
  };

  const states = [];
  states.push(await measure('room'));
  // The same room with the quality governor at its top level (the decoration shed): what shedding saves (when this build has one).
  if (await page.evaluate(() => !!window.__wsw.governor)) {
    await page.evaluate(() => (window.__wsw.governor.level = 3));
    await page.waitForTimeout(500);
    states.push(await measure('room, quality 3'));
    await page.evaluate(() => (window.__wsw.governor.level = 0));
    await page.waitForTimeout(500);
  }
  await browser.close();
  return { startupMs, heapMb, calibMs, stalls, states };
}

const results = [];
for (let i = 0; i < runs; i++) results.push(await once());
const names = results[0].states.map((s) => s.state);
const summary = {
  label,
  url,
  runs,
  startupMs: median(results.map((r) => r.startupMs)),
  heapMb: median(results.map((r) => r.heapMb)),
  calibMs: +least(results.map((r) => r.calibMs)).toFixed(1),
  stalls: {
    count: median(results.map((r) => r.stalls.count)),
    totalMs: Math.round(median(results.map((r) => r.stalls.totalMs))),
    worstMs: Math.round(median(results.map((r) => r.stalls.worstMs))),
  },
  states: names.map((name, i) => {
    const rows = results.map((r) => r.states[i]);
    const m = (k) => median(rows.map((r) => r[k]));
    return {
      state: name,
      // The least of the runs: the one with the least interference from the rest of the machine.
      renderMs: +least(rows.map((r) => r.renderMs)).toFixed(2),
      calls: m('calls'),
      triangles: m('triangles'),
      textures: m('textures'),
      textureMb: +m('textureMb').toFixed(1),
      allocBytesPerFrame: Math.round(m('allocBytesPerFrame')),
      ourAllocBytesPerFrame: Math.round(m('ourAllocBytesPerFrame')),
    };
  }),
};
console.log(
  `\n${label}: start-up ${(summary.startupMs / 1000).toFixed(1)} s, heap ${summary.heapMb.toFixed(0)} MB (median of ${runs} runs)`,
);
console.log(
  `main-thread stalls of 50 ms or more in the first 26 s: ${summary.stalls.count} (${summary.stalls.totalMs} ms in all, worst ${summary.stalls.worstMs} ms)`,
);
console.log('state                       render ms  calls   tris  textures  tex MB  alloc B/frame (ours)');
for (const s of summary.states)
  console.log(
    `${s.state.padEnd(26)} ${String(s.renderMs).padStart(9)} ${String(s.calls).padStart(6)} ${String(s.triangles).padStart(6)} ${String(s.textures).padStart(9)} ${String(s.textureMb).padStart(7)} ${String(s.allocBytesPerFrame).padStart(9)} (${s.ourAllocBytesPerFrame})`,
  );
if (out) writeFileSync(out, JSON.stringify(summary, null, 2) + '\n');
