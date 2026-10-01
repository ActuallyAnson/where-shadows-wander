// Reload the app frame with a query string, e.g. RELOAD_QS="?quads=5000" (default: keep).
// CLEAR_ANCHOR=1 also clears the spike's saved anchor uuid first.
export default async function run({ frame, page }) {
  const target = frame ?? page;
  const qs = process.env.RELOAD_QS ?? '';
  const clear = process.env.CLEAR_ANCHOR === '1';
  await target.evaluate(([qs, clear]) => {
    if (clear) localStorage.removeItem('wsw.spike.anchor-uuid');
    location.search = qs;
  }, [qs, clear]).catch(() => {});
  return { reloaded: qs, clearedAnchor: clear };
}
