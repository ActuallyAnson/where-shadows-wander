// IWSDK draws no Enter AR button of its own: it asks the browser to offer one
// (navigator.xr.offerSession, a recent Chrome feature). Quest Browser has it.
// Browsers without it, such as Pico Browser 3.3 (Chrome 105), show nothing at
// all, so there is no way into the headset. On those we add a plain button that
// starts the session through IWSDK's explicit launch. Every requested feature is
// optional (iwsdk.config.json), so a headset without one of them still starts.
//
// Headset debugging switches (in the address):
//   ?xrmode=vr            start an immersive-vr session instead of immersive-ar
//   ?xrfeatures=sample    ask for exactly what the official WebXR hands sample asks for
//                         (local-floor, bounded-floor, hand-tracking), nothing else
//   ?xrfeatures=a,b,c     ask for exactly these optional features
// They exist to find out which request a headset gives hands for.
import { SessionMode } from '@iwsdk/core';
import type { World } from '@iwsdk/core';

const SAMPLE_FEATURES = ['local-floor', 'bounded-floor', 'hand-tracking'];

/** Rewrites every session request this page makes to ask for exactly `features`, all optional. */
function forceFeatures(xr: XRSystem, features: string[]): void {
  const request = xr.requestSession.bind(xr);
  xr.requestSession = (mode: XRSessionMode, init?: XRSessionInit) =>
    request(mode, { ...init, requiredFeatures: [], optionalFeatures: features });
}

export async function mountEnterArButtonIfNeeded(world: World): Promise<void> {
  const xr = navigator.xr as (XRSystem & { offerSession?: unknown }) | undefined;
  if (!xr) return;
  const params = new URLSearchParams(location.search);
  const forced = params.get('xrfeatures');
  if (forced) forceFeatures(xr, forced === 'sample' ? SAMPLE_FEATURES : forced.split(',').filter(Boolean));
  if (typeof xr.offerSession === 'function') return;
  const vr = params.get('xrmode') === 'vr';
  const supported = await xr.isSessionSupported(vr ? 'immersive-vr' : 'immersive-ar').catch(() => false);
  if (!supported) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = vr ? 'Enter VR' : 'Enter AR';
  button.style.cssText =
    'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:6;padding:14px 28px;border-radius:12px;' +
    'background:#14161c;color:#f0a24a;border:1px solid #f0a24a;font:600 18px system-ui,-apple-system,sans-serif;cursor:pointer';
  button.onclick = () => world.launchXR(vr ? { sessionMode: SessionMode.ImmersiveVR } : undefined);
  document.body.append(button);
  // The page is hidden while a session runs; bring the button back when it ends.
  world.renderer.xr.addEventListener('sessionstart', () => (button.hidden = true));
  world.renderer.xr.addEventListener('sessionend', () => (button.hidden = false));
}
