// Dev only. The IWER emulator (injected by IWSDK's dev plugin) starts with controllers; this game is hands-only, so it is
// switched to hands. Its control panel keeps its own copy of the input mode, read when it is made and again only when the
// emulator's control mode turns programmatic, so setting the device's mode alone leaves the panel showing controllers, and
// its gizmos moving controllers the session ignores (the hands, and the flame on the right one, stay still). Turning the
// control mode programmatic and back makes the panel read the hands' mode, then gives the mouse back.

/** The parts of IWER's XRDevice this uses, so it can be tested without the emulator. */
export interface EmulatedDeviceLike {
  primaryInputMode: string;
  controlMode?: string;
}

/** Hides the panel's "Select input mode" button: its menu's only other choice is controllers (or gaze, which needs them). */
export const HANDS_ONLY_CSS = 'button[title="Select input mode"]{display:none !important}';

/**
 * Hides the emulator panel's input mode switch, now and in any panel added later. The panel is a div with an open shadow
 * root; a style in each such root hides the button however often React draws it again.
 */
export function hideEmulatorInputSwitch(doc: Document): void {
  const style = (el: Element): void => {
    const root = el.shadowRoot;
    if (!root || root.querySelector('style[data-wsw-hands-only]')) return;
    const s = doc.createElement('style');
    s.setAttribute('data-wsw-hands-only', '');
    s.textContent = HANDS_ONLY_CSS;
    root.appendChild(s);
  };
  // The panel's host sits in a wrapper div on the body, so each new element is searched, not only itself.
  const search = (el: Element): void => {
    style(el);
    for (const d of Array.from(el.querySelectorAll('div'))) style(d);
  };
  search(doc.body);
  new MutationObserver((records) => {
    for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof Element) search(n);
  }).observe(doc.body, { childList: true });
}

/** Puts the emulator, and its control panel, in hand mode. */
export function useEmulatorHands(device: EmulatedDeviceLike): void {
  device.primaryInputMode = 'hand';
  if (device.controlMode !== 'manual') return; // a script is driving it (programmatic): the panel follows the device already
  device.controlMode = 'programmatic';
  device.controlMode = 'manual';
}
