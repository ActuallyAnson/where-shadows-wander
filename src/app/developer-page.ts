// The Developer page in the room (dev and tester builds only): what the launcher's Developer panel used to hold, now
// inside the session, where a headset can show it. It is one more page of the room's settings screen, opened from the
// pause screen's Developer button (cover the candle, then point at Developer). The overlays and systems are on the debug
// pages that follow it. Plain data and callbacks: main.ts supplies what each button does.
import type { ExtraPageItems } from '../ui/settings-panel/screen-model';
import { FLICKER_CHOICES, FREE_RECORD_SECONDS, nextChoice, type FlickerChoice } from './testing-options';

export const DEVELOPER_PAGE_TITLE = 'Developer';

/** What a hand recording is doing, as far as the page needs to say. */
export interface RecorderState {
  /** The guided shapes script (true) or free hands (false). */
  readonly shapes: boolean;
  readonly started: boolean;
  readonly finished: boolean;
}

export interface DeveloperPageHooks {
  labShown(): boolean;
  /** Shows or hides the Hand Lab panel (it picks whose hands play). */
  showLab(on: boolean): void;
  /** The current recording, or null when none was started this session. */
  recorder(): RecorderState | null;
  /** Starts a hand recording now (it begins when a hand is first tracked). */
  record(shapes: boolean): void;
  /** The lantern's test flicker (null: the player's setting). */
  flicker(): FlickerChoice;
  setFlicker(choice: FlickerChoice): void;
  /** Errors caught on the page so far, and the newest one. */
  errorCount(): number;
  lastError(): string | null;
  /** Ends the session and reloads into the room editor (at the desk, no VR). */
  openRoomEditor(): void;
}

export function flickerText(choice: FlickerChoice): string {
  return choice === null ? 'the setting' : choice === 0 ? 'steady' : String(choice);
}

function recordText(rec: RecorderState | null, shapes: boolean): string {
  if (!rec || rec.shapes !== shapes) return 'Start';
  if (rec.finished) return 'Saved: again';
  return rec.started ? 'Recording' : 'Waiting for hands';
}

/** The page's buttons. The texts and the error help are read each time the page is drawn. */
export function developerPage(h: DeveloperPageHooks): ExtraPageItems {
  const recordButton = (shapes: boolean) => ({
    id: shapes ? 'record-shapes' : 'record-free',
    label: shapes ? 'Record guided shapes' : `Record ${FREE_RECORD_SECONDS} s of hands`,
    help: shapes
      ? 'Prompts each shape for 84 s and saves the labelled recording to the dev machine.'
      : `Records ${FREE_RECORD_SECONDS} s of your hands and saves it to the dev machine.`,
    text: () => recordText(h.recorder(), shapes),
    press: () => {
      const rec = h.recorder();
      if (!rec || rec.finished) h.record(shapes);
    },
  });
  return {
    title: DEVELOPER_PAGE_TITLE,
    items: [
      {
        id: 'hand-lab',
        label: 'Hand Lab panel',
        help: 'Picks whose hands play: the device, synthetic, scripted, a replay or the webcam.',
        text: () => (h.labShown() ? 'SHOWN' : 'hidden'),
        press: () => h.showLab(!h.labShown()),
      },
      recordButton(false),
      recordButton(true),
      {
        id: 'flicker',
        label: 'Lantern flicker (test)',
        help: 'Overrides the player setting: steady for screenshots, or a fixed amount.',
        text: () => flickerText(h.flicker()),
        press: () => h.setFlicker(nextChoice(FLICKER_CHOICES, h.flicker())),
      },
      {
        id: 'errors',
        label: 'Errors',
        get help() {
          return h.lastError() ?? 'No errors caught on this page.';
        },
        text: () => String(h.errorCount()),
        press: () => {},
      },
      {
        id: 'room-editor',
        label: 'Room editor',
        help: 'Leaves VR and opens the room editor at the desk. Its Close returns to the game.',
        text: () => 'Leave VR',
        press: () => h.openRoomEditor(),
      },
    ],
  };
}
