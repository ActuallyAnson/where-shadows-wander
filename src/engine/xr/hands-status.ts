// Whether hand data is arriving from the XR session, as one of three states, and when the
// in-scene "Show me your hands" message should be up. The game has no controllers and the
// player cannot see their real hands in the virtual room, so a missing hand has to be said
// in the scene itself. Plain TypeScript with no engine imports; nothing is allocated per frame
// (the messages are constants and the state is a few numbers).

export const HandsState = {
  /** At least one hand is tracked this frame. */
  Tracking: 0,
  /** No hand tracked, but hand input sources exist (or did a moment ago): the hands left the camera view. */
  Lost: 1,
  /**
   * The session has had no hand input source for a while (hand tracking off, controllers held, or a browser that
   * gives no joints). This assumes a runtime keeps a hand's input source while the hand is out of view; if one
   * drops it, a player resting their hands would land here after `UNAVAILABLE_AFTER_S`. Not yet checked on a Pico.
   */
  Unavailable: 2,
} as const;
export type HandsStateId = (typeof HandsState)[keyof typeof HandsState];

/** Seconds with no tracked hand before the message appears. Shorter dropouts are ignored. */
export const MESSAGE_AFTER_LOST_S = 3;
/** Seconds with no hand input source at all before the state becomes `Unavailable`. */
export const UNAVAILABLE_AFTER_S = 5;

/** Longest frame step counted. The first frame after the headset was off or the page hidden carries the whole gap. */
export const MAX_STEP_S = 0.1;

/**
 * First line large, second line small (the PromptPanel splits on the newline and squeezes a line that is too
 * long, so the second lines are short). Teammate B polishes the wording.
 */
export const LOST_MESSAGE = 'Show me your hands\nHold them up in front of you';
export const UNAVAILABLE_MESSAGE = 'Show me your hands\nControllers down, hands up';

export class HandsStatus {
  state: HandsStateId = HandsState.Tracking;
  /** True while the message should be on screen: unavailable, or lost for at least `MESSAGE_AFTER_LOST_S`. */
  showMessage = false;
  /** Seconds since a hand was last tracked (or since the session started). */
  lostFor = 0;
  /** Seconds the session has had no hand input source. */
  noSourceFor = 0;
  /** Bumps when `state` or `showMessage` changes, so the view redraws only then. */
  version = 0;
  private active = false;

  /** A session started: begin counting from now, with the message hidden. */
  start(): void {
    this.active = true;
    this.lostFor = 0;
    this.noSourceFor = 0;
    this.set(HandsState.Tracking, false);
  }

  /** The session ended: nothing to report. */
  stop(): void {
    this.active = false;
    this.lostFor = 0;
    this.noSourceFor = 0;
    this.set(HandsState.Tracking, false);
  }

  /** The text for the current state, or '' when no message is showing. */
  get message(): string {
    if (!this.showMessage) return '';
    return this.state === HandsState.Unavailable ? UNAVAILABLE_MESSAGE : LOST_MESSAGE;
  }

  /**
   * Call once per XR frame.
   * @param dt seconds since the last call (counted up to `MAX_STEP_S`)
   * @param anyTracked a hand has all its joints this frame
   * @param handSources how many of the session's input sources are hands (not controllers)
   */
  update(dt: number, anyTracked: boolean, handSources: number): void {
    if (!this.active) return;
    if (dt > MAX_STEP_S) dt = MAX_STEP_S;
    if (anyTracked) {
      this.lostFor = 0;
      this.noSourceFor = 0;
      this.set(HandsState.Tracking, false);
      return;
    }
    this.lostFor += dt;
    this.noSourceFor = handSources > 0 ? 0 : this.noSourceFor + dt;
    if (this.noSourceFor >= UNAVAILABLE_AFTER_S) this.set(HandsState.Unavailable, true);
    else this.set(HandsState.Lost, this.lostFor >= MESSAGE_AFTER_LOST_S);
  }

  private set(state: HandsStateId, show: boolean): void {
    if (state === this.state && show === this.showMessage) return;
    this.state = state;
    this.showMessage = show;
    this.version++;
  }
}
