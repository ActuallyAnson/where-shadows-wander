// The launcher's Testing panel: the test switches as big buttons, for testing on a headset where typing an address is
// a chore (and nobody should have to). A press takes effect at once (the page is told with a `wsw-testing` event), is
// remembered in the browser for next time (testing-options.ts), and nothing reloads. The overlays change live; the
// settings panel and the recording start when VR starts, so they are armed here and begin when you press Enter VR.
import { loadCaptureChoice, nextCapture, saveCaptureChoice } from './capture-mode';
import {
  DEFAULT_TESTING,
  describeTesting,
  FREE_RECORD_SECONDS,
  loadTesting,
  MENU_CHOICES,
  nextChoice,
  RECORD_CHOICES,
  saveTesting,
  TESTING_EVENT,
  type RecordChoice,
  type TestingOptions,
} from './testing-options';

const RECORD_TEXT: Record<RecordChoice, string> = {
  off: 'off',
  free: `${FREE_RECORD_SECONDS} s of free hands`,
  shapes: 'guided shapes (84 s)',
};

/** Builds the panel (hidden until `toggle`). `target` is where the change event goes (the window). */
export function createTestingPanel(target: EventTarget = window): { element: HTMLElement; toggle: () => void } {
  let options = loadTesting();
  let shown = false;

  const element = document.createElement('div');
  element.id = 'xr-testing-panel';
  element.style.cssText =
    'width:100%;box-sizing:border-box;display:none;flex-direction:column;gap:8px;padding:12px;' +
    'background:rgba(15,18,24,0.97);border:1px solid #3a4459;border-radius:10px;pointer-events:auto;' +
    'font:14px system-ui,sans-serif;color:#c9d1d9;box-shadow:0 8px 24px rgba(0,0,0,0.5);';

  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;font-size:15px;color:#f0f6fc;';
  title.textContent = 'Testing: switches';
  const active = document.createElement('div');
  active.style.cssText = 'font-size:12px;color:#8b949e;';
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#8b949e;';
  hint.textContent =
    'Each press applies at once and is remembered. The settings panel and the recording begin when you press Enter VR.';

  const button = (onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText =
      'padding:14px 16px;border-radius:10px;border:1.5px solid;font:700 15px system-ui,sans-serif;cursor:pointer;' +
      'text-align:left;min-height:48px;';
    b.onclick = onClick;
    return b;
  };

  const set = (next: TestingOptions) => {
    options = next;
    saveTesting(options);
    target.dispatchEvent(new CustomEvent<TestingOptions>(TESTING_EVENT, { detail: options }));
    refresh();
  };

  const refresh = () => {
    const on = describeTesting(options);
    active.textContent = `On now: ${on.length ? on.join(', ') : 'nothing (the plain game)'}`;
    joints.textContent = `Joint dots: ${options.joints ? 'ON' : 'off'}`;
    shadow.textContent = `Shadow capsules: ${options.shadow ? 'ON' : 'off'}`;
    settings.textContent = `Settings panel opens when VR starts: ${options.settings ? 'ON' : 'off'}`;
    kindred.textContent = `Kindred (the shadow bird): ${options.kindred ? 'ON' : 'off'}`;
    cutscene.textContent = `Test cutscene plays when VR starts: ${options.cutscene ? 'ON' : 'off'}`;
    capture.textContent = `Capture mode (demo video; press reloads): ${loadCaptureChoice()}`;
    record.textContent = `Recording hands when VR starts: ${RECORD_TEXT[options.record]}`;
    menu.textContent = `Menu screen showing: ${options.menu}`;
    for (const [b, isOn] of [
      [joints, options.joints],
      [shadow, options.shadow],
      [settings, options.settings],
      [cutscene, options.cutscene],
      [kindred, options.kindred],
      [record, options.record !== 'off'],
      [menu, options.menu !== 'off'],
    ] as const) {
      b.style.background = isOn ? '#163824' : '#21262d';
      b.style.borderColor = isOn ? '#2ea043' : '#30363d';
      b.style.color = isOn ? '#7ee787' : '#c9d1d9';
    }
  };

  const joints = button(() => set({ ...options, joints: !options.joints }));
  const shadow = button(() => set({ ...options, shadow: !options.shadow }));
  const settings = button(() => set({ ...options, settings: !options.settings }));
  const kindred = button(() => set({ ...options, kindred: !options.kindred }));
  const cutscene = button(() => set({ ...options, cutscene: !options.cutscene }));
  const record = button(() => set({ ...options, record: nextChoice(RECORD_CHOICES, options.record) }));
  const menu = button(() => set({ ...options, menu: nextChoice(MENU_CHOICES, options.menu) }));
  const capture = button(() => {
    saveCaptureChoice(nextCapture(loadCaptureChoice()));
    location.reload(); // the eye buffers' size is set when the page starts
  });
  const clear = button(() => set({ ...DEFAULT_TESTING }));
  clear.textContent = 'Clear all switches';
  clear.style.cssText += 'background:#2d1b1b;color:#ff7b72;border-color:#6e2f2f;';

  element.append(title, active, joints, shadow, settings, cutscene, kindred, record, menu, capture, hint, clear);
  refresh();
  return {
    element,
    toggle: () => {
      shown = !shown;
      element.style.display = shown ? 'flex' : 'none';
    },
  };
}
