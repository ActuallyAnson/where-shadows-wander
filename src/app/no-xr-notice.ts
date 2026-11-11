// On a browser that can't start the session the game asks for (a laptop, a phone), the game
// page is otherwise blank and IWSDK shows no Enter XR button. This explains what the page is
// and where to go. It checks the session the page really requests, immersive-vr (ADR 0005). The emulator in
// `npm run dev` supports it, so it never shows there.

import { switchLaunch } from './launch-mode';

/** The part of `navigator.xr` this reads. */
export interface XrSupport {
  isSessionSupported(mode: 'immersive-vr' | 'immersive-ar'): Promise<boolean>;
}

/** Whether the browser can start a VR session. False when WebXR is missing or the check throws. */
export async function xrSessionSupported(xr: XrSupport | undefined): Promise<boolean> {
  try {
    return (await xr?.isSessionSupported('immersive-vr')) ?? false;
  } catch {
    return false;
  }
}

/** The page a visitor without a headset sees: what the game is, how to get in on a headset, and the Hand Lab to try without one. */
export function landingHtml(link: string): string {
  const safe = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `
    <style>
      #wsw-landing{--ink:#ece6d8;--gold:#f0a24a;position:fixed;inset:0;overflow:auto;z-index:5;color:var(--ink);
        background:radial-gradient(ellipse at 70% 12%,#2b3a78 0,#16215a 28%,#0a0e26 70%,#06081a 100%);
        font:16px/1.6 system-ui,-apple-system,sans-serif}
      #wsw-landing .moon{position:absolute;right:11%;top:9%;width:84px;height:84px;border-radius:50%;
        background:radial-gradient(circle at 38% 36%,#fffff0,#e6e4c6 70%);box-shadow:0 0 70px 24px rgba(200,215,255,.28)}
      #wsw-landing .snow{position:absolute;inset:0;pointer-events:none;opacity:.5;
        background-image:radial-gradient(2px 2px at 20px 30px,#fff,transparent),radial-gradient(1.5px 1.5px at 90px 80px,#fff,transparent),
        radial-gradient(2px 2px at 150px 20px,#fff,transparent),radial-gradient(1.5px 1.5px at 60px 140px,#fff,transparent);
        background-size:180px 180px;animation:wsw-fall 14s linear infinite}
      @keyframes wsw-fall{to{background-position:30px 180px}}
      @media (prefers-reduced-motion:reduce){#wsw-landing .snow{animation:none}}
      #wsw-landing main{position:relative;max-width:34rem;margin:0 auto;padding:12vh 24px 48px;display:grid;gap:22px}
      #wsw-landing h1{margin:0;font-size:clamp(30px,7vw,46px);font-weight:650;letter-spacing:-.01em;line-height:1.1}
      #wsw-landing .tag{margin:0;font-size:19px;color:#d8d2c2}
      #wsw-landing ol{margin:0;padding:0;list-style:none;display:grid;gap:12px;counter-reset:s}
      #wsw-landing li{counter-increment:s;position:relative;padding:12px 14px 12px 52px;border-radius:12px;
        background:rgba(10,14,36,.62);border:1px solid rgba(240,162,74,.22)}
      #wsw-landing li::before{content:counter(s);position:absolute;left:14px;top:11px;width:26px;height:26px;border-radius:50%;
        background:var(--gold);color:#1a1008;font-weight:700;text-align:center;line-height:26px}
      #wsw-landing code{display:block;margin-top:6px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.4);
        font:13px ui-monospace,monospace;word-break:break-all}
      #wsw-landing button{font:inherit;cursor:pointer;border-radius:10px;padding:8px 14px;text-decoration:none;
        border:1px solid var(--gold);background:transparent;color:var(--gold)}
      #wsw-landing button:hover{background:var(--gold);color:#1a1008}
      #wsw-landing .small{font-size:14px;color:#b9b3a4;margin:0}
    </style>
    <div class="moon"></div><div class="snow"></div>
    <main>
      <h1>Where Shadows Wander</h1>
      <p class="tag">A tiny traveller is lost on the wall. Make shadows with your hands to light the way home.</p>
      <p style="margin:0">A seated, <b>hands-only</b> VR game: no controllers, just your own hands, a candle and a paper theatre.
      This browser can't start a VR session, so it needs a <b>Meta Quest</b> or <b>Pico</b> headset.</p>
      <ol>
        <li>Open this page in your headset's browser.<code>${safe}</code>
          <p style="margin:8px 0 0"><button type="button" data-copy>Copy the link</button></p></li>
        <li>Press <b>BEGIN</b> and sit down with your hands in front of you.</li>
        <li>Light the candle with your hand, then shape rabbits, birds and foxes in its light.</li>
      </ol>
      <p style="margin:0">No headset? <button type="button" data-lab>Try the Hand Lab</button></p>
      <p class="small">The Hand Lab shows the hand shapes the game reads, with mock or webcam hands. It is a test bench, not the game.</p>
    </main>`;
}

/** `debugTools`: whether the build has the debug tools (the launch choice is read with it). */
export async function showNoXrNoticeIfNeeded(debugTools: boolean): Promise<void> {
  if (await xrSessionSupported(navigator.xr)) return;

  const box = document.createElement('section');
  box.id = 'wsw-landing';
  box.setAttribute('role', 'status');
  box.innerHTML = landingHtml(location.origin + location.pathname);
  box.querySelector('[data-copy]')?.addEventListener('click', (e) => {
    const button = e.currentTarget as HTMLButtonElement;
    void navigator.clipboard
      ?.writeText(location.origin + location.pathname)
      .then(() => (button.textContent = 'Copied'))
      .catch(() => (button.textContent = 'Select the link above and copy it'));
  });
  box.querySelector('[data-lab]')?.addEventListener('click', () => switchLaunch('lab', debugTools));
  document.body.append(box);
}
