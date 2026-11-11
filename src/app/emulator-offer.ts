// Dev only. The IWER emulator (injected by IWSDK's dev plugin) draws its own "Enter XR" bar at the top of the page
// whenever a session is offered (iwsdk.config.json offers one always, for the headset browser's enter prompt). The
// launcher's own Enter VR buttons already do that job, and the Hand Lab and the room editor never enter XR, so the bar
// is hidden. The emulator's in-session controls are a different element and are left alone.

/** The parts of a DOM element `isEmulatorOfferHost` looks at, so it can be tested without a DOM. */
export interface OfferHostLike {
  readonly tagName: string;
  readonly shadowRoot: { querySelectorAll(selector: string): ArrayLike<{ textContent: string | null }> } | null;
}

/** Whether `el` is the emulator's offer bar: a plain div whose open shadow root holds an "Enter XR" button. */
export function isEmulatorOfferHost(el: OfferHostLike): boolean {
  if (el.tagName !== 'DIV' || !el.shadowRoot) return false;
  const buttons = el.shadowRoot.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i]!.textContent?.trim() === 'Enter XR') return true;
  }
  return false;
}

/**
 * Hides the emulator's offer bar, now or once it appears. The emulator adds its div to the body and React fills the
 * shadow root a moment later, so this watches the body's children and each new shadow root until the bar is found.
 */
export function hideEmulatorOfferBar(doc: Document): void {
  const watchers: MutationObserver[] = [];
  let done = false;
  const tryHide = (el: Element): boolean => {
    if (done || !(el instanceof HTMLElement) || !isEmulatorOfferHost(el)) return done;
    el.style.display = 'none';
    done = true;
    for (const w of watchers) w.disconnect();
    watchers.length = 0;
    return true;
  };
  const consider = (el: Element): void => {
    if (tryHide(el) || !el.shadowRoot) return;
    // A shadow root that is still empty: look again when React renders into it.
    const w = new MutationObserver(() => void tryHide(el));
    w.observe(el.shadowRoot, { childList: true, subtree: true });
    watchers.push(w);
  };
  for (const el of Array.from(doc.body.children)) consider(el);
  if (done) return;
  const bodyWatch = new MutationObserver((records) => {
    for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof Element) consider(n);
  });
  bodyWatch.observe(doc.body, { childList: true });
  watchers.push(bodyWatch);
}
