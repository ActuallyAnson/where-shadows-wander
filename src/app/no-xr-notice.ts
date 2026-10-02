// On a browser that can't start an AR session (a laptop, a phone), the game
// page is otherwise blank: the canvas is transparent for passthrough and IWSDK
// shows no Enter XR button. This explains what the page is and where to go.
// The emulator in `npm run dev` reports AR support, so it never shows there.

export async function showNoXrNoticeIfNeeded(): Promise<void> {
  let supported: boolean;
  try {
    supported = (await navigator.xr?.isSessionSupported('immersive-ar')) ?? false;
  } catch {
    supported = false;
  }
  if (supported) return;

  const box = document.createElement('section');
  box.setAttribute('role', 'status');
  box.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;padding:24px;z-index:5;' +
    'background:#14161c;color:#ece6d8;font:16px/1.55 system-ui,-apple-system,sans-serif;text-align:center';
  box.innerHTML = `
    <div style="max-width:30rem;display:grid;gap:14px">
      <h1 style="margin:0;font-size:28px;font-weight:650;letter-spacing:-0.01em">Where Shadows Wander</h1>
      <p style="margin:0">A seated, hands-only mixed reality game. This browser can't start an AR session,
      so open this page in the browser on a <b>Meta Quest</b> or <b>Pico</b> headset.</p>
      <p style="margin:0;color:#a8a294;font-size:14px">In development: the headset build has hand tracking and room
      detection, but no gameplay yet.</p>
      <p style="margin:0;font-size:14px">No headset? Try your hands on the
      <a href="./webcam.html" style="color:#f0a24a">webcam hand bench</a>.</p>
    </div>`;
  document.body.append(box);
}
