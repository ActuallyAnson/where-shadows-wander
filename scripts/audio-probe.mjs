/* global window */
// Checks the sound in a real browser, with no headset.
// Usage: start a dev server (npx vite --port 8095 --strictPort) then
//   node scripts/audio-probe.mjs https://localhost:8095
// In headless Chromium it checks that:
//   audio stays locked until a gesture, then runs;
//   the flame crackles from the moment audio unlocks (it was lit while locked);
//   a sound placed left of the listener is louder in the left ear (and the same on the right);
//   muting the effects bus silences effects, and the ambience bus still plays the flame's crackle;
//   a shape event (candidate, commit) makes a sound, and lighting the candle a whoosh;
//   pausing suspends the context and resuming runs it again;
//   the per-frame update costs well under 0.5 ms.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'https://localhost:8081';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
};

const page = await (
  await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 700 } })
).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?mock=1&flicker=0`);
await page.waitForFunction(() => window.__wsw?.audio, null, { timeout: 90000 });

const before = await page.evaluate(() => ({
  context: window.__wsw.audio.context === null,
  state: window.__wsw.audio.state,
}));
check('locked before any gesture', before.context && before.state === 'locked', JSON.stringify(before));

await page.mouse.click(300, 300);
await page.waitForFunction(() => window.__wsw.audio.state === 'running', null, { timeout: 10000 }).catch(() => {});
const after = await page.evaluate(() => window.__wsw.audio.state);
check('running after a click', after === 'running', after);

// Taps the master output into a left and a right meter. Returns helpers kept on window.
await page.evaluate(() => {
  const a = window.__wsw.audio;
  const ctx = a.context;
  const split = ctx.createChannelSplitter(2);
  a.master.connect(split);
  const meters = [0, 1].map((ch) => {
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    split.connect(an, ch);
    return { an, buf: new Float32Array(2048) };
  });
  const rms = (m) => {
    m.an.getFloatTimeDomainData(m.buf);
    let s = 0;
    for (const v of m.buf) s += v * v;
    return Math.sqrt(s / m.buf.length);
  };
  // Highest left and right level seen over `ms`.
  window.__peak = (ms) =>
    new Promise((res) => {
      const out = [0, 0];
      const t0 = performance.now();
      const tick = () => {
        out[0] = Math.max(out[0], rms(meters[0]));
        out[1] = Math.max(out[1], rms(meters[1]));
        if (performance.now() - t0 < ms) setTimeout(tick, 10);
        else res(out);
      };
      tick();
    });
  // The listener sits at head height looking down -Z (the frame loop also updates it each frame).
  window.__wsw.world.camera.position.set(0, 1.2, 0);
});

const peak = (ms = 500) => page.evaluate((m) => window.__peak(m), ms);
const sleep = (ms) => page.waitForTimeout(ms);
// Plays `id` `side` metres to the listener's right (negative: left) and 1 m in front, whichever way the camera faces.
const play = (id, side) =>
  page.evaluate(
    ([i, d]) => {
      const e = window.__wsw.world.camera.matrixWorld.elements;
      const [px, py, pz] = [e[12], e[13], e[14]];
      return window.__wsw.audio.playAt(
        i,
        px + e[0] * d - e[8] * 2,
        py + e[1] * d - e[9] * 2,
        pz + e[2] * d - e[10] * 2,
      );
    },
    [id, side],
  );
const CHIME = 2;
const RUSTLE = 0;

// The flame crackles from the start (it is lit), so mute that bus while the other sounds are measured.
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(2, true));
await sleep(1500); // the page draws slowly in software, and the mute is applied on a frame
const quiet = await peak(200);
check('silent when nothing plays', quiet[0] < 0.002 && quiet[1] < 0.002, quiet.map((v) => v.toFixed(4)).join(' '));

let ok = await play(RUSTLE, -3);
let [l, r] = await peak(500);
check(
  'rustle at the left is louder in the left ear',
  ok && l > 0.003 && l > r * 1.5,
  `left ${l.toFixed(3)} right ${r.toFixed(3)}`,
);
await sleep(700);
ok = await play(RUSTLE, 3);
[l, r] = await peak(500);
check(
  'rustle at the right is louder in the right ear',
  ok && r > 0.003 && r > l * 1.5,
  `left ${l.toFixed(3)} right ${r.toFixed(3)}`,
);
await sleep(600);

// Mixer: mute effects.
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(1, true));
await sleep(300);
await play(CHIME, 0);
[l, r] = await peak(500);
check(
  'muting the effects bus silences the chime',
  l < 0.002 && r < 0.002,
  `left ${l.toFixed(4)} right ${r.toFixed(4)}`,
);
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(1, false));
await sleep(900);

// Flame crackle on the ambience bus, from the candle (already lit by the frame loop).
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(2, false));
await sleep(500);
[l, r] = await peak(600);
check('the lit flame crackles (ambience bus)', Math.max(l, r) > 0.003, `left ${l.toFixed(4)} right ${r.toFixed(4)}`);
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(2, true));
await sleep(400);
[l, r] = await peak(400);
check(
  'muting the ambience bus silences the crackle',
  Math.max(l, r) < 0.002,
  `left ${l.toFixed(4)} right ${r.toFixed(4)}`,
);
await page.evaluate(() => window.__wsw.audio.mixer.setMuted(2, false));
await sleep(900);

// Events.
const played = await page.evaluate(() => {
  const w = window.__wsw;
  const a = w.audio;
  const n = a.stats.played;
  w.shapes.events.clear();
  w.shapes.events.push('candidate', 'right', 'flat', 0, 0, 0);
  w.gameAudio.onShapeEvents(w.shapes.events, w.projector.shadows, w.stage);
  const afterCandidate = a.stats.played - n;
  w.shapes.events.clear();
  w.shapes.events.push('commit', 'right', 'flat', 1, 0, 0.4);
  w.gameAudio.onShapeEvents(w.shapes.events, w.projector.shadows, w.stage);
  const afterCommit = a.stats.played - n;
  w.gameAudio.candleIgnited(w.candleView.flamePosition);
  return [afterCandidate, afterCommit, a.stats.played - n];
});
check(
  'candidate makes a rustle, commit a thump, lighting the candle a whoosh',
  played.join() === '1,2,3',
  played.join(),
);

// Pause: setPaused suspends the context, and clearing it resumes it. (The game calls it from the session's
// visibility and the page's, not from the frame loop.)
const paused = await page.evaluate(async () => {
  const a = window.__wsw.audio;
  a.setPaused(true);
  await new Promise((r) => setTimeout(r, 200));
  const s1 = a.context.state;
  a.setPaused(false);
  await new Promise((r) => setTimeout(r, 300));
  return [s1, a.context.state];
});
check('pausing suspends the context and resuming runs it', paused.join() === 'suspended,running', paused.join());

// CPU.
const cost = await page.evaluate(() => {
  const w = window.__wsw;
  const a = w.audio;
  const flame = w.candleView.flamePosition;
  w.gameAudio.setFlame(true, flame);
  const pose = new Float64Array([0, 1.2, 0, 0, 0, -1, 0, 1, 0]);
  for (let i = 0; i < 500; i++) a.update(pose);
  const n = 5000;
  const t = performance.now();
  for (let i = 0; i < n; i++) {
    const s = Math.sin(i * 0.01);
    pose[0] = s * 0.05;
    pose[3] = s * 0.3;
    w.gameAudio.setFlame(true, flame);
    a.update(pose);
  }
  return (performance.now() - t) / n;
});
check('the per-frame cost is under 0.05 ms (budget 0.5 ms on a headset)', cost < 0.05, `${cost.toFixed(4)} ms`);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);
