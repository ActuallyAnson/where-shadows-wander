// On a browser that can't start the session the game asks for (a laptop, a phone), the game
// page is otherwise blank and IWSDK shows no Enter XR button. This explains what the page is
// and where to go. It checks the session the page will really request: VR by default, AR for
// ?xr=ar (ADR 0005). The emulator in `npm run dev` supports both, so it never shows there.

import { sessionModeOf, xrModeFromUrl } from '../engine/xr/session-mode';

/** The part of `navigator.xr` this reads. */
export interface XrSupport {
  isSessionSupported(mode: 'immersive-vr' | 'immersive-ar'): Promise<boolean>;
}

/** Whether the browser can start the session `search` asks for. False when WebXR is missing or the check throws. */
export async function xrSessionSupported(xr: XrSupport | undefined, search: string): Promise<boolean> {
  try {
    return (await xr?.isSessionSupported(sessionModeOf(xrModeFromUrl(search)))) ?? false;
  } catch {
    return false;
  }
}

export async function showNoXrNoticeIfNeeded(search: string = location.search): Promise<void> {
  if (await xrSessionSupported(navigator.xr, search)) return;

  const box = document.createElement('section');
  box.setAttribute('role', 'status');
  box.style.cssText =
    'position:fixed;inset:0;display:grid;place-items:center;padding:24px;z-index:5;' +
    'background:#14161c;color:#ece6d8;font:16px/1.55 system-ui,-apple-system,sans-serif;text-align:center';
  box.innerHTML = `
    <div style="max-width:30rem;display:grid;gap:14px">
      <h1 style="margin:0;font-size:28px;font-weight:650;letter-spacing:-0.01em">Where Shadows Wander</h1>
      <p style="margin:0">A seated, hands-only VR game about shadows made with your hands. This browser can't
      start a VR session, so open this page in the browser on a <b>Meta Quest</b> or <b>Pico</b> headset.</p>
      <p style="margin:0;font-size:14px">No headset? Open the
      <a href="./?mock=1" style="color:#f0a24a">Hand Lab</a> to try the hand shapes with mock or webcam hands.</p>
    </div>`;
  document.body.append(box);
}
