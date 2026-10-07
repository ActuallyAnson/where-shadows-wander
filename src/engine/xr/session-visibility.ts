// The session's visibility as a state the simulation can pause on. `visible-blurred` means the
// headset's system menu (or another overlay) has focus: the page is still drawn but no longer gets
// input, so hand data stops. `hidden` means the page is not shown at all. Both pause the game
// (the official WebXR hands sample skips its updates when blurred), and saves can listen for the
// change. No engine imports: it talks to anything shaped like the part of XRSession it needs, so it is tested
// in Node and survives the plain three.js fallback (ADR 0002). IWSDK also keeps `world.visibilityState` up to date;
// this is the same signal in a form our pure code and tests can use. Ending the session reports ('visible', false)
// to subscribers, so a save listener should treat that as "session over", not "resumed".

export type SessionVisibilityState = 'visible' | 'visible-blurred' | 'hidden';

/** The part of an XRSession this reads. */
export interface VisibilitySession {
  readonly visibilityState?: SessionVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** True for every state but `visible`. */
export function pausesOn(state: SessionVisibilityState): boolean {
  return state !== 'visible';
}

export class SessionVisibility {
  /** Current state; 'visible' when there is no session or the browser does not report one. */
  state: SessionVisibilityState = 'visible';
  /** True while a session is attached and not fully visible. The simulation pauses on this. */
  paused = false;
  /** Bumps on every state change. */
  version = 0;
  private session: VisibilitySession | null = null;
  private readonly listeners: ((state: SessionVisibilityState, paused: boolean) => void)[] = [];
  private readonly onChange = (): void => this.read();

  /** Calls `fn` whenever the state changes (once registered, nothing else is allocated). Returns an unsubscribe function. */
  subscribe(fn: (state: SessionVisibilityState, paused: boolean) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  attach(session: VisibilitySession): void {
    this.detach();
    this.session = session;
    session.addEventListener('visibilitychange', this.onChange);
    this.read();
  }

  /** The session ended: unpause and forget it. */
  detach(): void {
    this.session?.removeEventListener('visibilitychange', this.onChange);
    this.session = null;
    this.apply('visible');
  }

  private read(): void {
    this.apply(this.session?.visibilityState ?? 'visible');
  }

  private apply(state: SessionVisibilityState): void {
    const paused = this.session !== null && pausesOn(state);
    if (state === this.state && paused === this.paused) return;
    this.state = state;
    this.paused = paused;
    this.version++;
    for (let i = 0; i < this.listeners.length; i++) this.listeners[i](state, paused);
  }
}
