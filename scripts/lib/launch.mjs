/* global window */
// Opens the game page with a launch choice and no address: the page reads its mode and whose hands play from the tab's
// sessionStorage (src/app/launch-mode.ts) and its testing switches from localStorage (src/app/testing-options.ts), so a probe
// writes them before every load of the page. The address stays the plain page. The game always runs in a session (ADR 0018):
// on the dev server that is the emulator's, which `enterVr` starts by pressing BEGIN, as a player would.
//   await launchIn(page, { hands: 'synthetic', flicker: 0 });
//   await page.goto(`${base}/`);
//   await enterVr(page);
// mode: 'game' | 'room-editor'; hands: 'device' or a Hand Lab source ('synthetic', 'script', 'replay', 'webcam'); lab: whether
// the Hand Lab panel shows (by default, whenever the hands are mock); flicker: 0..1, the lantern's flicker (0 is steady). The
// other switches are left off.

/** Makes every later load of `page` (or of every page in a browser context) start with this choice. */
export async function launchIn(
  target,
  { mode = 'game', hands = 'synthetic', lab = hands !== 'device', flicker = null } = {},
) {
  await target.addInitScript(
    ({ mode, hands, lab, flicker }) => {
      try {
        sessionStorage.setItem('wsw.launch', JSON.stringify({ mode, hands, lab }));
      } catch {
        // a probe that blocks the storage gets the plain game
      }
      if (flicker === null) return;
      try {
        const testing = JSON.parse(localStorage.getItem('wsw.testing') ?? '{}') ?? {};
        localStorage.setItem('wsw.testing', JSON.stringify({ ...testing, flicker }));
      } catch {
        // blocked localStorage: the lantern keeps its setting
      }
    },
    { mode, hands, lab, flicker },
  );
}

/**
 * Presses BEGIN and waits for the session (the dev server's emulator). The press is a real click, so it also unlocks the
 * page's audio. Throws if no session starts.
 */
export async function enterVr(page, { timeout = 90000 } = {}) {
  await page.waitForFunction(() => window.__wsw?.world, null, { timeout });
  const begin = page.getByRole('button', { name: 'BEGIN' });
  await begin.waitFor({ timeout });
  await begin.click();
  await page.waitForFunction(() => window.__wsw.world.renderer.xr.isPresenting, null, { timeout: 30000 });
}

/** Lights the candle at once (a player holds a finger to the wick for 3 s; mock hands at rest do not reach it). */
export async function lightCandle(page) {
  await page.evaluate(() => window.__wsw.igniteCandle());
  await page.waitForFunction(() => window.__wsw.sessionState() === 'playing', null, { timeout: 10000 });
}
