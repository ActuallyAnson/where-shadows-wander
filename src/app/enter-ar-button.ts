// IWSDK draws no Enter AR button of its own: it asks the browser to offer one
// (navigator.xr.offerSession, a recent Chrome feature). Quest Browser has it.
// Browsers without it, such as Pico Browser 3.3 (Chrome 105), show nothing at
// all, so there is no way into the headset. On those we add a plain button that
// starts the session through IWSDK's explicit launch. Every requested feature is
// optional (iwsdk.config.json), so a headset without one of them still starts.
import type { World } from '@iwsdk/core';

export async function mountEnterArButtonIfNeeded(world: World): Promise<void> {
  const xr = navigator.xr as (XRSystem & { offerSession?: unknown }) | undefined;
  if (!xr || typeof xr.offerSession === 'function') return;
  const supported = await xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!supported) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Enter AR';
  button.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:6;padding:14px 28px;border-radius:12px;' +
    'background:#14161c;color:#f0a24a;border:1px solid #f0a24a;font:600 18px system-ui,-apple-system,sans-serif;cursor:pointer';
  button.onclick = () => world.launchXR();
  document.body.append(button);
  // The page is hidden while a session runs; bring the button back when it ends.
  world.renderer.xr.addEventListener('sessionstart', () => (button.hidden = true));
  world.renderer.xr.addEventListener('sessionend', () => (button.hidden = false));
}
