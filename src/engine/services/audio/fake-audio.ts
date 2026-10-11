// A just-enough AudioContext for the engine's unit tests: it records what was set and lets a test end a sound.
export class FakeParam {
  // In a typed array, so setting a number does not allocate (a plain field would box each double on the heap,
  // which the real, native AudioParam never does).
  private readonly cell = new Float64Array(1);
  targets: number[] = [];
  get value(): number {
    return this.cell[0];
  }
  set value(v: number) {
    this.cell[0] = v;
  }
  setTargetAtTime(v: number): void {
    this.targets.push(v);
    this.cell[0] = v;
  }
  cancelScheduledValues(): void {}
}

export class FakeNode {
  connected: FakeNode | null = null;
  connect(n: FakeNode): void {
    this.connected = n;
  }
  disconnect(): void {
    this.connected = null;
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam();
}

export class FakePanner extends FakeNode {
  panningModel = '';
  distanceModel = '';
  rolloffFactor = 0;
  refDistance = 0;
  maxDistance = 0;
  positionX = new FakeParam();
  positionY = new FakeParam();
  positionZ = new FakeParam();
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
  /** Plays to its end. */
  end(): void {
    this.onended?.();
  }
}

export class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  listener = {
    positionX: new FakeParam(),
    positionY: new FakeParam(),
    positionZ: new FakeParam(),
    forwardX: new FakeParam(),
    forwardY: new FakeParam(),
    forwardZ: new FakeParam(),
    upX: new FakeParam(),
    upY: new FakeParam(),
    upZ: new FakeParam(),
  };
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  panners: FakePanner[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  /** Set false to leave the context locked, as before a user gesture. */
  allowResume = true;
  /** Set true to start only when the resume promise settles, as browsers do. */
  asyncResume = false;
  createGain = () => {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  };
  createPanner = () => {
    const p = new FakePanner();
    this.panners.push(p);
    return p;
  };
  createBufferSource = () => {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  };
  createBuffer = (_channels: number, length: number) => ({ length, copyToChannel() {} });
  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.allowResume) return Promise.resolve();
    if (!this.asyncResume) {
      this.state = 'running';
      return Promise.resolve();
    }
    return Promise.resolve().then(() => {
      this.state = 'running';
    });
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** A context whose listener has no position parameters, as in older Gecko browsers: it has setPosition and setOrientation instead. */
export class FakeLegacyContext extends FakeContext {
  calls: string[] = [];
  constructor() {
    super();
    (this as unknown as { listener: unknown }).listener = {
      setPosition: (x: number, y: number, z: number) => this.calls.push(`position ${x} ${y} ${z}`),
      setOrientation: (...v: number[]) => this.calls.push(`orientation ${v.join(' ')}`),
    };
  }
}
