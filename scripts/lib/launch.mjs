// Opens the game page in a mode without an address: the page reads its mode from the tab's sessionStorage
// (src/app/launch-mode.ts) and its testing switches from localStorage (src/app/testing-options.ts), so a probe writes them
// before every load of the page. The address stays the plain page.
//   await launchIn(page, { mode: 'lab', flicker: 0 });
//   await page.goto(`${base}/`);
// mode: 'game' | 'lab' | 'room-editor'; source: the Hand Lab's hand source; flicker: 0..1, the lantern's flicker
// (0 is steady). The other switches are left off.

/** Makes every later load of `page` (or of every page in a browser context) start in `mode`. */
export async function launchIn(target, { mode = 'lab', source = 'synthetic', flicker = null } = {}) {
  await target.addInitScript(
    ({ mode, source, flicker }) => {
      try {
        sessionStorage.setItem('wsw.launch', JSON.stringify({ mode, source }));
      } catch {
        // a probe that blocks the storage gets the game
      }
      if (flicker === null) return;
      try {
        const testing = JSON.parse(localStorage.getItem('wsw.testing') ?? '{}') ?? {};
        localStorage.setItem('wsw.testing', JSON.stringify({ ...testing, flicker }));
      } catch {
        // blocked localStorage: the lantern keeps its setting
      }
    },
    { mode, source, flicker },
  );
}
