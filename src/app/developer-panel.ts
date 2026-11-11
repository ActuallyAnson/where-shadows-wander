// The launcher's Developer panel (dev and tester builds only): everything that used to be typed into the address, as big
// buttons, for testing on a headset where typing an address is a chore (and nobody should have to).
//
// - Hands and modes: whose hands play the game (the device's, or the Hand Lab's mock ones, in the same session: ADR 0018),
//   and the room editor. A press saves the choice for this tab and reloads the page with it (launch-mode.ts); the address
//   stays the plain page.
// - Switches: a press takes effect at once (the page is told with a `wsw-testing` event), is remembered in the browser for
//   next time (testing-options.ts), and nothing reloads. The overlays change live; the settings panel and the recording
//   start when VR starts, so they are armed here and begin when you press BEGIN. Capture mode and the lantern's flicker
//   are read when the page starts, so those two reload it.
// - Logs: the launch log, and a button that copies it to the clipboard.
import { loadCaptureChoice, nextCapture, saveCaptureChoice } from './capture-mode';
import { HANDS_CHOICES, loadLaunch, switchHands, switchLaunch, type HandsChoice } from './launch-mode';
import {
  DEFAULT_TESTING,
  describeTesting,
  FLICKER_CHOICES,
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

const HANDS_TEXT: Record<HandsChoice, string> = {
  device: "the device's (headset or emulator)",
  synthetic: 'Hand Lab: synthetic (pose with keys)',
  script: 'Hand Lab: every shape, in a loop',
  replay: 'Hand Lab: a replayed recording',
  webcam: 'Hand Lab: the webcam',
};

export interface DeveloperPanelHooks {
  /** The launcher's live log, shown in the panel. */
  log: HTMLElement;
  /** Copies the launch log to the clipboard. */
  copyLogs(): void;
}

/** Builds the panel (hidden until `toggle`). `target` is where the switches' change event goes (the window). */
export function createDeveloperPanel(
  hooks: DeveloperPanelHooks,
  target: EventTarget = window,
): { element: HTMLElement; toggle: () => void } {
  let options = loadTesting();
  let shown = false;

  const element = document.createElement('div');
  element.id = 'xr-developer-panel';
  element.style.cssText =
    'width:100%;box-sizing:border-box;display:none;flex-direction:column;gap:8px;padding:12px;' +
    // The buttons are taller than a headset browser's window: the panel scrolls rather than running off the top.
    'max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;' +
    'background:rgba(15,18,24,0.97);border:1px solid #3a4459;border-radius:10px;pointer-events:auto;' +
    'font:14px system-ui,sans-serif;color:#c9d1d9;box-shadow:0 8px 24px rgba(0,0,0,0.5);';

  const heading = (text: string) => {
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;font-size:15px;color:#f0f6fc;margin-top:4px;';
    h.textContent = text;
    return h;
  };
  const small = (text = '') => {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:12px;color:#8b949e;';
    d.textContent = text;
    return d;
  };
  const active = small();
  const hint = small(
    'Each press applies at once and is remembered. The settings panel and the recording begin when you press BEGIN.',
  );

  const button = (onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText =
      'padding:14px 16px;border-radius:10px;border:1.5px solid;font:700 15px system-ui,sans-serif;cursor:pointer;' +
      'text-align:left;min-height:48px;background:#21262d;border-color:#30363d;color:#c9d1d9;';
    b.onclick = onClick;
    return b;
  };

  const modeButton = (label: string, onClick: () => void) => {
    const b = button(onClick);
    b.textContent = label;
    b.style.background = '#1c2d42';
    b.style.borderColor = '#388bfd';
    b.style.color = '#58a6ff';
    return b;
  };
  const hands = loadLaunch(true).hands;
  const handsButton = modeButton(`Hands (press reloads): ${HANDS_TEXT[hands]}`, () =>
    switchHands(HANDS_CHOICES[(HANDS_CHOICES.indexOf(hands) + 1) % HANDS_CHOICES.length], true),
  );
  const editorButton = modeButton('Room editor: arrange the bedroom and save it (at the desk, no VR)', () =>
    switchLaunch('room-editor', true),
  );

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
    capture.textContent = `Capture mode (demo video; press reloads): ${loadCaptureChoice()}`;
    flicker.textContent = `Lantern flicker (press reloads): ${options.flicker === null ? 'the setting' : options.flicker === 0 ? 'steady' : options.flicker}`;
    record.textContent = `Recording hands when VR starts: ${RECORD_TEXT[options.record]}`;
    menu.textContent = `Menu screen showing: ${options.menu}`;
    for (const [b, isOn] of [
      [joints, options.joints],
      [shadow, options.shadow],
      [settings, options.settings],
      [flicker, options.flicker !== null],
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
  const record = button(() => set({ ...options, record: nextChoice(RECORD_CHOICES, options.record) }));
  const menu = button(() => set({ ...options, menu: nextChoice(MENU_CHOICES, options.menu) }));
  const flicker = button(() => {
    set({ ...options, flicker: nextChoice(FLICKER_CHOICES, options.flicker) });
    location.reload(); // the lantern's settings are made when the page starts
  });
  const capture = button(() => {
    saveCaptureChoice(nextCapture(loadCaptureChoice()));
    location.reload(); // the eye buffers' size is set when the page starts
  });
  const clear = button(() => set({ ...DEFAULT_TESTING }));
  clear.textContent = 'Clear all switches';
  clear.style.cssText += 'background:#2d1b1b;color:#ff7b72;border-color:#6e2f2f;';
  const copy = button(() => hooks.copyLogs());
  copy.textContent = '📋 Copy logs';

  element.append(
    heading('Hands and modes'),
    small(
      "Kept in this tab across reloads. Mock hands play the game in its own session: press BEGIN (the emulator at a desk). The room editor's Close returns to the game.",
    ),
    handsButton,
    editorButton,
    heading('Testing switches'),
    active,
    joints,
    shadow,
    settings,
    record,
    menu,
    flicker,
    capture,
    hint,
    clear,
    heading('Logs'),
    hooks.log,
    copy,
  );
  refresh();
  return {
    element,
    toggle: () => {
      shown = !shown;
      element.style.display = shown ? 'flex' : 'none';
    },
  };
}
