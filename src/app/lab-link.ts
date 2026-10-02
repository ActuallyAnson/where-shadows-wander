// Dev-only button on the game page that opens the Hand Lab (?mock=1). The
// emulator in `npm run dev` reports AR support, so the no-XR notice (which also
// links to the lab) never shows there. Page buttons aren't visible inside XR.

export function mountLabLink(): void {
  const a = document.createElement('a');
  a.href = '?mock=1';
  a.textContent = 'Open Hand Lab';
  a.title = 'Mock hands, replays and the webcam, without a headset';
  a.style.cssText =
    'position:fixed;left:12px;top:12px;z-index:5;padding:8px 12px;border-radius:8px;text-decoration:none;' +
    'background:#14161c;color:#f0a24a;border:1px solid #2e333f;font:500 13px system-ui,-apple-system,sans-serif';
  document.body.append(a);
}
