// The Hand Lab: the panel that picks whose hands play (ADR 0018, src/app/launch-mode.ts). The game runs in its normal session
// (the emulator at a desk) and the lab only changes where the hands come from, live, with no reload: the device's own, or a mock
// source (synthetic, scripted, replay, webcam). It also makes shapes, reads the classifier's features and records. Everything in
// the room is the game's own, as on a headset.
import type { HandFrame, Handedness } from '../engine/hands/hand';
import { GuidedRecording } from '../engine/hands/guided-recording';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import type { GestureDetector } from '../engine/hands/gesture-detector';
import { FINGER_NAMES } from '../engine/hands/hand-features';
import type { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { SHAPE_HOW, SHAPES_SCRIPT, ShapeScript } from '../engine/hands/shape-script';
import { sampleImage } from '../engine/xr/hand-sample-draw';
import { SHAPES } from '../engine/hands/shapes';
import type { PresetName } from '../engine/hands/synthetic-hand';
import type { DeskFrame } from './desk-frame';
import { downloadRecording, handCardHtml } from './hand-card';
import type { HandSource } from './hand-source';
import { createMockSource, mockOptionsFor, type MockMode, type MockSourceKind } from './mock-mode';
import { replayFromFile } from './replay-source';
import { ScriptedSource } from './scripted-source';
import { SyntheticSource } from './synthetic-source';
import type { WebcamSource } from './webcam-source';

const PANEL_W = 320;
const STEP_M = 0.01;
const TURN_DEG = 15;
const JITTER_M = 0.003;
const SHAPE_KEYS: PresetName[] = ['relaxed', ...SHAPES];

/** Where the hands come from: the device's own (headset or emulator), or a mock source. */
export type LabSource = 'device' | MockSourceKind;

export interface LabView {
  /** The accessibility settings panel, if the page has one: the Settings button opens and closes it. */
  settings?: { toggle(): void; isOpen(): boolean };
  /** The pause screen: the Menu button shows and hides it, and says whether it is showing. */
  menu?: { cycle(): void; label(): string };
  /** Told the source in use whenever it changes, so the page can start with it again after a reload. */
  onSourceKind?(kind: LabSource): void;
  /** Hides the panel (its Hide button). The hands stay with the source picked. */
  hide?(): void;
  /** The Steps tab's ready-made setups, which move the emulator's headset and hands (absent without the emulator). */
  steps?: LabSteps;
}

/** Ready-made setups for testing at a desk (the Steps tab). */
export interface LabSteps {
  /** Sits the player at the candle with the right hand's match over the wick (the device's hands play). */
  candle(): void;
  /** Puts the emulator's headset and hands back where they started. */
  reset(): void;
  /** What the last step did, for the panel. */
  status(): string;
}

type LabTab = 'lab' | 'steps';
const TAB_KEY = 'wsw.lab.tab';

export class HandLab {
  /** The latest gesture events, newest first (copied: the detector reuses its event objects). */
  private readonly gestureLog: string[] = [];
  private calibrationSaved = true;
  /** Where the candle is, as the desk rig sees it (the G key aims a hand at it). */
  private readonly deskLantern = [0, 0, 0];
  private readonly root = document.createElement('aside');
  private selected: Handedness = 'right';
  private recording: HandRecording | null = null;
  /** A guided recording in progress: prompts every shape and labels the file. */
  private guided: GuidedRecording | null = null;
  private guidedStart = 0;
  /** The webcam's lock row before a guided recording took it over. */
  private lockBeforeGuided: Handedness | null = null;
  private recordStart = 0;
  private busy = false;
  private message = '';
  /** The device's own hands play (the Device source): the mock source is kept but not used. */
  private device = true;
  private tab: LabTab = readTab();

  constructor(
    private readonly mode: MockMode,
    private readonly hands: Record<Handedness, HandFrame>,
    private readonly shapes: ShapeRecognizer,
    private readonly gestures: GestureDetector,
    /** The candle the game placed (read when used: it moves when the rig is placed again or the candle is carried). */
    private readonly lantern: Readonly<ArrayLike<number>>,
    /** The sources pose hands for the desk rig; this maps the room back to it. */
    private readonly desk: DeskFrame,
    private readonly view: LabView,
  ) {
    loadCalibration(shapes);
    this.mount();
    this.show(false);
    setInterval(() => this.renderLive(), 100);
  }

  /** Whether a mock source plays (false: the device's own hands, read by the game as usual). */
  get mockActive(): boolean {
    return !this.device;
  }

  get shown(): boolean {
    return this.root.style.display !== 'none';
  }

  show(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }

  /** Starts with `kind` (a reload's saved choice): a replay plays the emulator demo. */
  start(kind: LabSource): Promise<void> {
    return this.switchSource(kind);
  }

  /**
   * Call once per frame, right after the source has filled the hands and before they are moved into the room's rig, so a
   * recording keeps the desk rig's space (the one every mock source replays in).
   */
  frame(): void {
    const g = this.gestures;
    for (let i = 0; i < g.events.count; i++) {
      const e = g.events.at(i);
      const at = e.position.map((v) => v.toFixed(2)).join(', ');
      this.gestureLog.unshift(`${e.t.toFixed(1)} s · ${e.hand} · ${e.type} at (${at})`);
      this.gestureLog.length = Math.min(this.gestureLog.length, 8);
    }
    if (this.recording)
      recordFrame(this.recording, this.mode.time - this.recordStart, this.hands.left, this.hands.right, null);
    if (this.guided && !this.guided.frame(this.mode.time - this.guidedStart, this.hands.left, this.hands.right, null))
      this.finishGuided();
    else if (this.guided) this.lockToPrompt();
  }

  /** Changes the hand source; the classifier starts fresh, since mock time restarts at 0. */
  private setSource(source: HandSource): void {
    this.mode.setSource(source);
    this.shapes.reset();
    this.gestures.reset();
    this.gestureLog.length = 0;
  }

  private get synthetic(): SyntheticSource | null {
    return !this.device && this.mode.source instanceof SyntheticSource ? this.mode.source : null;
  }

  private get kind(): LabSource {
    return this.device ? 'device' : kindOf(this.mode.source.name);
  }

  private onSourceChanged(): void {
    // The guide matters most with real hands (webcam, replays, the device); synthetic hands show the shape anyway.
    const guide = this.root.querySelector<HTMLDetailsElement>('#lab-guide');
    if (guide) guide.open = this.synthetic === null;
    // Synthetic hands start one-handed, like a player gesturing.
    this.synthetic?.setShape('left', null);
    this.view.onSourceKind?.(this.kind);
  }

  /** `file`: a recording to replay. Without one, Replay plays the emulator demo. */
  private async switchSource(kind: LabSource, file?: File): Promise<void> {
    if (this.busy) return;
    if (kind === 'device') {
      // The game reads the device's hands again from the next frame; the classifier starts fresh on its clock.
      this.device = true;
      this.shapes.reset();
      this.gestures.reset();
      this.gestureLog.length = 0;
      this.message = '';
      this.onSourceChanged();
      return this.renderControls();
    }
    this.busy = true;
    this.message =
      kind === 'webcam' ? 'Starting the camera. The first start downloads the hand model (about 8 MB)…' : '';
    this.renderControls();
    try {
      const source = file ? await replayFromFile(file) : await createMockSource(mockOptionsFor(kind));
      this.setSource(source);
      this.device = false;
      this.onSourceChanged();
      this.message = '';
    } catch (e) {
      this.message = `Couldn't start ${kind}: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.busy = false;
    this.renderControls();
  }

  /**
   * Starts a guided recording with the current source. With the Script source
   * the script restarts from 0 so the poses line up with the prompts, which
   * gives a labelled synthetic recording.
   */
  private startGuided(): void {
    if (this.recording || this.guided) return;
    this.message = '';
    this.mode.paused = false;
    if (this.mode.source instanceof ScriptedSource) this.setSource(new ScriptedSource(SHAPES_SCRIPT, false));
    this.guidedStart = this.mode.time;
    this.lockBeforeGuided = this.webcam()?.lockSide ?? null;
    this.guided = new GuidedRecording(
      new ShapeScript(SHAPES_SCRIPT),
      `Hand Lab guided, ${this.mode.source.name}`,
      navigator.userAgent,
      new Date().toISOString(),
    );
    this.renderControls();
  }

  private webcam(): WebcamSource | null {
    return this.mode.source.name === 'webcam' ? (this.mode.source as WebcamSource) : null;
  }

  /** During a guided recording the webcam's lone hand is the one the prompt names, so MediaPipe's left/right guess can't mislabel it. */
  private lockToPrompt(): void {
    const src = this.webcam();
    const step = this.guided?.script.steps[this.guided.prompt.index];
    if (step && src) src.lockSide = step.hand;
  }

  /** Saves a recording and says where it went. */
  private save(rec: HandRecording, prefix: string): void {
    void downloadRecording(rec, prefix).then((where) => {
      this.message = where;
      this.renderControls();
    });
  }

  /** Ends a guided recording (finished or stopped early) and downloads it with its labels. */
  private finishGuided(): void {
    if (!this.guided) return;
    const rec = this.guided.finish();
    this.guided = null;
    const cam = this.webcam();
    if (cam) cam.lockSide = this.lockBeforeGuided;
    if (rec.frames.length) this.save(rec, 'wsw-lab-guided');
    else this.message = 'Guided recording stopped before it recorded anything, so nothing was saved.';
    // The run used a one-shot script; go back to the looping one the Script button promises.
    if (this.mode.source instanceof ScriptedSource) this.setSource(new ScriptedSource());
    this.renderControls();
    this.renderLive();
  }

  private toggleRecording(): void {
    if (!this.recording) {
      this.recording = createRecording(
        `Hand Lab, ${this.mode.source.name}`,
        navigator.userAgent,
        new Date().toISOString(),
      );
      this.recordStart = this.mode.time;
    } else {
      this.save(this.recording, 'wsw-lab');
      this.recording = null;
    }
    this.renderControls();
  }

  private mount(): void {
    document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
    this.root.className = 'lab';
    this.root.innerHTML = `
      <header><h1>Hand Lab</h1><p>Whose hands play the game, in its own session. Press BEGIN, and move the head with the
        emulator's controls.</p><button type="button" data-act="hide-panel" data-arg="">Hide panel</button></header>
      <nav class="tabs" role="tablist"><button type="button" role="tab" data-act="tab" data-arg="lab">Lab</button
      ><button type="button" role="tab" data-act="tab" data-arg="steps">Steps</button></nav>
      <section class="tab-steps" id="lab-steps"></section>
      <section class="tab-lab" id="lab-controls"></section>
      <details class="guide tab-lab" id="lab-guide"><summary>Shape guide</summary><div class="shapes">${SHAPES.map(
        (s) =>
          `<figure title="${SHAPE_HOW[s]}"><img src="${sampleImage(s, '#f0a24a', 'right', 168)}" alt=""><figcaption><b>${s}</b>${SHAPE_HOW[s]}</figcaption></figure>`,
      ).join('')}</div></details>
      <section class="hand tab-lab" id="lab-calibration">
        <h2>Calibration <span>your straight fingers</span></h2>
        <div class="row"><button type="button" data-act="calibrate" data-arg="left">Calibrate left</button
        ><button type="button" data-act="calibrate" data-arg="right">Calibrate right</button
        ><button type="button" data-act="uncalibrate" data-arg="">Clear</button></div>
        <div id="lab-cal-status"></div>
        <p class="keys">Hold the hand flat for 2 s: curl is then measured from your own straight. Saved in this browser.</p>
      </section>
      <section class="hand tab-lab" id="lab-gestures"></section>
      <section class="hand tab-lab" id="lab-hand-right"></section>
      <section class="hand tab-lab" id="lab-hand-left"></section>
      <p class="foot tab-lab">The big label is what the classifier has committed; "holding" shows a shape on its way
      there (0.4 s for verbs, 1 s for rabbit and fox). The bars show how far inside each shape's ranges the hand
      is: above the line matches. <a href="./webcam.html">Webcam bench</a> shows the camera image with
      landmarks.</p>
      <input type="file" accept=".json,application/json" hidden id="lab-file" />`;
    document.body.append(this.root);
    const guide = this.root.querySelector<HTMLDetailsElement>('#lab-guide');
    if (guide) guide.open = this.synthetic === null;

    const file = this.root.querySelector<HTMLInputElement>('#lab-file')!;
    file.addEventListener('change', () => {
      if (file.files?.[0]) void this.switchSource('replay', file.files[0]);
      file.value = '';
    });
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      const { act, arg } = b.dataset;
      const s = this.synthetic;
      if (act === 'source') {
        if (arg === 'replay') file.click();
        else void this.switchSource(arg as LabSource);
      } else if (act === 'hand') this.selected = arg as Handedness;
      else if (act === 'lock' && this.mode.source.name === 'webcam')
        (this.mode.source as WebcamSource).lockSide = arg === 'auto' ? null : (arg as Handedness);
      else if (act === 'shape') s?.setShape(this.selected, arg as PresetName);
      else if (act === 'hide-panel') return this.view.hide?.();
      else if (act === 'hide') s?.setShape(this.selected, s.shapeOf(this.selected) === null ? 'relaxed' : null);
      else if (act === 'jitter' && s) s.jitter = s.jitter > 0 ? 0 : JITTER_M;
      else if (act === 'pause') this.mode.paused = !this.mode.paused;
      else if (act === 'record') this.toggleRecording();
      else if (act === 'settings') this.view.settings?.toggle();
      else if (act === 'menu') this.view.menu?.cycle();
      else if (act === 'calibrate') this.shapes.startCalibration(arg as Handedness);
      else if (act === 'uncalibrate') {
        this.shapes.setCalibration('left', null);
        this.shapes.setCalibration('right', null);
        this.shapes.calibrating = null;
        saveCalibration(this.shapes);
      } else if (act === 'guided') {
        if (this.guided) this.finishGuided();
        else this.startGuided();
      } else if (act === 'tab') this.setTab(arg === 'steps' ? 'steps' : 'lab');
      else if (act === 'step') void this.runStep(arg ?? '');
      this.renderControls();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropped = e.dataTransfer?.files[0];
      if (!dropped) return;
      if (this.guided) {
        this.message = 'Stop the guided recording before replaying a file.';
        return this.renderControls();
      }
      void this.switchSource('replay', dropped);
    });
    this.renderControls();
    this.renderLive();
  }

  private setTab(tab: LabTab): void {
    this.tab = tab;
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      // Storage unavailable: the tab lasts until reload.
    }
  }

  /** Runs a Steps button. The candle step plays with the device's hands, so a mock source gives way to them first. */
  private async runStep(step: string): Promise<void> {
    const steps = this.view.steps;
    if (!steps || this.busy || this.guided || this.recording) return;
    if (step === 'candle') {
      if (!this.device) await this.switchSource('device');
      steps.candle();
    } else if (step === 'reset') steps.reset();
    this.renderControls();
  }

  /** The Steps tab: ready-made setups that move the emulator's headset and hands. */
  private renderSteps(): void {
    const el = this.root.querySelector('#lab-steps');
    if (!el) return;
    const steps = this.view.steps;
    const why = !steps
      ? "Needs the dev server's emulator."
      : this.guided || this.recording
        ? 'Stop the recording first.'
        : '';
    const step = (arg: string, label: string, help: string) =>
      `<div class="step"><button type="button" data-act="step" data-arg="${arg}" ${why || this.busy ? 'disabled' : ''}>${label}</button><p class="keys">${help}</p></div>`;
    el.innerHTML = `<h2>Steps <span>emulator setups</span></h2>
      ${step('candle', 'Hand over the candle', 'Match over the wick: lights in 3 s.')}
      ${step('reset', 'Reset position', 'Headset and hands back to the start.')}
      ${why ? `<p class="msg">${why}</p>` : '<p class="msg" id="lab-step-status"></p>'}`;
    this.renderStepStatus();
  }

  private renderStepStatus(): void {
    const el = this.root.querySelector('#lab-step-status');
    const status = this.view.steps?.status() ?? '';
    if (el && el.textContent !== status) el.textContent = status;
  }

  private renderControls(): void {
    this.root.dataset.tab = this.tab;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-act="tab"]')) {
      const on = b.dataset.arg === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    }
    this.renderSteps();
    const s = this.synthetic;
    const kind = this.kind;
    // While a guided recording runs, its clock must keep moving forward: no source changes or pausing. A recording keeps its
    // source. The device's hands are read by the game itself: the lab neither pauses nor records them.
    const locked = new Set(
      this.guided
        ? ['source', 'pause', 'record']
        : this.recording
          ? ['guided', 'source']
          : this.device
            ? ['pause', 'record', 'guided']
            : [],
    );
    const btn = (act: string, arg: string, label: string, on = false, title = '') =>
      `<button type="button" data-act="${act}" data-arg="${arg}" class="${on ? 'on' : ''}" ${title ? `title="${title}"` : ''} ${this.busy || locked.has(act) ? 'disabled' : ''}>${label}</button>`;
    const sources = (
      [
        ['device', 'Device', "The emulator's or the headset's own hands"],
        ['synthetic', 'Synthetic', 'Hands you pose with buttons or keys'],
        ['script', 'Script', 'Every shape on each hand, in a loop'],
        ['replay', 'Replay…', 'Play a .handrec.json (or drop one on the page)'],
        ['webcam', 'Webcam', 'Your real hands, through the laptop camera'],
      ] as const
    )
      .map(([k, label, title]) => btn('source', k, label, kind === k, title))
      .join('');
    const synth = s
      ? `<div class="row">${btn('hand', 'left', 'Left', this.selected === 'left')}${btn('hand', 'right', 'Right', this.selected === 'right')}
           ${btn('hide', '', s.shapeOf(this.selected) === null ? 'Show' : 'Hide', false, 'H')}
           ${btn('jitter', '', 'Jitter', s.jitter > 0, 'J: add a few mm of tracking noise')}</div>
         <div class="grid">${SHAPE_KEYS.map((p, i) => btn('shape', p, `<kbd>${i}</kbd>${p}`, s.shapeOf(this.selected) === p)).join('')}</div>
         <p class="keys">Keys: 0–6 shapes · R/L hand · H hide · arrows move (Shift: depth) · Q/E roll · Z/X turn · T/Y tilt fingers up/down · J jitter · Space pause</p>`
      : '';
    this.root.querySelector('#lab-controls')!.innerHTML = `
      <h2>Source</h2><div class="row">${sources}</div>
      ${this.message ? `<p class="msg">${this.message}</p>` : ''}
      ${synth ? `<h2>Pose <span>${this.selected} hand</span></h2>${synth}` : ''}
      ${kind === 'webcam' ? this.lockRow(btn) : ''}
      <div class="row">${btn('pause', '', this.mode.paused ? 'Resume' : 'Pause', this.mode.paused, 'Space')}
        ${this.view.menu ? btn('menu', '', `Menu: ${this.view.menu.label()}`, this.view.menu.label() !== 'off', 'Show and hide the pause screen') : ''}
        ${this.view.settings ? btn('settings', '', 'Settings', this.view.settings.isOpen(), 'The accessibility settings panel') : ''}
        ${btn('record', '', this.recording ? 'Stop and download' : '● Record', !!this.recording)}
        ${btn('guided', '', this.guided ? 'Stop guided' : 'Guided recording', !!this.guided, 'Prompts every shape on each hand (84 s) and saves a labelled recording')}
        <span class="time" id="lab-time"></span></div>
      <div class="prompt" id="lab-prompt" ${this.guided ? '' : 'hidden'}></div>`;
    // Fill the new prompt element now rather than leaving it blank until the next live update.
    if (this.guided) this.renderLive();
  }

  /** For one hand in front of the webcam: say which it is, since MediaPipe often guesses a lone hand wrong. */
  private lockRow(btn: (act: string, arg: string, label: string, on?: boolean, title?: string) => string): string {
    const lock = (this.mode.source as WebcamSource).lockSide;
    return `<h2>One hand is <span>${lock ?? 'auto'}</span></h2><div class="row">${btn('lock', 'auto', 'Auto', lock === null)}${btn('lock', 'left', 'Left', lock === 'left')}${btn('lock', 'right', 'Right', lock === 'right')}</div>`;
  }

  private renderLive(): void {
    this.renderStepStatus();
    // The default view is from the player's eyes, looking down -Z.
    for (const side of ['right', 'left'] as const) {
      const el = this.root.querySelector(`#lab-hand-${side}`);
      if (el)
        el.innerHTML = handCardHtml(
          this.hands[side],
          ['toward you', 'away from you'],
          this.device ? null : (this.mode.source.shapeOf?.(side) ?? null),
          this.shapes[side].state,
          this.shapes[side].margins,
        );
    }
    const cal = this.root.querySelector('#lab-cal-status');
    if (cal) {
      const run = this.shapes.calibrating;
      if (run && run.state !== 'collecting' && !this.calibrationSaved) {
        if (run.state === 'done') saveCalibration(this.shapes);
        this.calibrationSaved = true;
      }
      if (run?.state === 'collecting') this.calibrationSaved = false;
      const line = (h: Handedness) => {
        const b = this.shapes.calibration[h];
        const on = b.some((v) => v > 0);
        return `<dt>${h}</dt><dd>${
          on
            ? FINGER_NAMES.slice(1)
                .map((n, i) => `${n.slice(0, 1)} ${b[i + 1].toFixed(2)}`)
                .join(' · ')
            : 'not calibrated'
        }</dd>`;
      };
      const status =
        run?.state === 'collecting'
          ? `<p class="msg">Hold your ${run.hand} hand flat, fingers straight and together… ${(run.progress * 100).toFixed(0)}%</p>`
          : run?.state === 'failed'
            ? `<p class="msg">${run.reason}</p>`
            : '';
      cal.innerHTML = `${status}<dl>${line('left')}${line('right')}</dl>`;
    }
    const gestures = this.root.querySelector('#lab-gestures');
    if (gestures) {
      const s = this.gestures.state[this.selected];
      const live = s.pinching
        ? `pinching ${s.pinchHeldS.toFixed(1)} s`
        : s.nearLantern
          ? `over the lantern ${(s.coverProgress * 100).toFixed(0)}%`
          : `lantern ${Number.isFinite(s.lanternDistM) ? `${(s.lanternDistM * 100).toFixed(0)} cm` : 'off'}`;
      gestures.innerHTML =
        `<h2>Lantern gestures <span>${this.selected} hand: ${live}</span></h2>` +
        `<p class="keys">P pinch (let go to place) · G hand to the lantern, then 2 for a fist (cover the flame) · B hand back</p>` +
        (this.gestureLog.length
          ? `<ol class="log">${this.gestureLog.map((l) => `<li>${l}</li>`).join('')}</ol>`
          : '<p class="keys">No gestures yet.</p>');
    }
    const prompt = this.root.querySelector('#lab-prompt');
    if (prompt && this.guided) {
      const p = this.guided.prompt;
      const [title, detail] = p.text.split('\n');
      const done = Math.min(Math.max((this.mode.time - this.guidedStart) / this.guided.script.duration, 0), 1);
      const shape = this.guided.script.shapeAt(p.index);
      const step = this.guided.script.steps[p.index];
      prompt.innerHTML =
        (shape ? `<img src="${sampleImage(shape, '#f0a24a', step.hand)}" alt="">` : '') +
        `<b>${title}</b>${detail ? `<span>${detail}</span>` : ''}` +
        `<em>${p.remaining > 0 ? Math.ceil(p.remaining) : ''}</em><i style="width:${(done * 100).toFixed(1)}%"></i>`;
    }
    const time = this.root.querySelector('#lab-time');
    if (time) {
      const rec = this.recording ? ` · recording ${(this.mode.time - this.recordStart).toFixed(1)} s` : '';
      const status = this.device ? 'device hands' : (this.mode.source.status?.() ?? this.mode.source.name);
      time.textContent = `${status} · ${this.mode.time.toFixed(1)} s${rec}`;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      if (this.guided) return e.preventDefault();
      this.mode.paused = !this.mode.paused;
      e.preventDefault();
      return this.renderControls();
    }
    const s = this.synthetic;
    if (!s) return;
    const k = e.key.toLowerCase();
    const sel = this.selected;
    if (e.key >= '0' && e.key <= '6') s.setShape(sel, SHAPE_KEYS[Number(e.key)]);
    else if (k === 'h') s.setShape(sel, s.shapeOf(sel) === null ? 'relaxed' : null);
    else if (k === 'r') this.selected = 'right';
    else if (k === 'l') this.selected = 'left';
    else if (k === 'j') s.jitter = s.jitter > 0 ? 0 : JITTER_M;
    else if (k === 'p') s.setPinch(sel, !s.pinching(sel));
    else if (k === 'g') {
      this.desk.toDesk(this.lantern, this.deskLantern);
      s.placeOver(sel, [this.deskLantern[0], this.deskLantern[1], this.deskLantern[2]]);
    } else if (k === 'b') s.home(sel);
    else if (k === 'q') s.turn(sel, -TURN_DEG, 0);
    else if (k === 'e') s.turn(sel, TURN_DEG, 0);
    else if (k === 'z') s.turn(sel, 0, TURN_DEG);
    else if (k === 'x') s.turn(sel, 0, -TURN_DEG);
    else if (k === 't') s.turn(sel, 0, 0, TURN_DEG);
    else if (k === 'y') s.turn(sel, 0, 0, -TURN_DEG);
    else if (e.key === 'ArrowLeft') s.move(sel, -STEP_M, 0, 0);
    else if (e.key === 'ArrowRight') s.move(sel, STEP_M, 0, 0);
    else if (e.key === 'ArrowUp') s.move(sel, 0, e.shiftKey ? 0 : STEP_M, e.shiftKey ? -STEP_M : 0);
    else if (e.key === 'ArrowDown') s.move(sel, 0, e.shiftKey ? 0 : -STEP_M, e.shiftKey ? STEP_M : 0);
    else return;
    e.preventDefault();
    this.renderControls();
  }
}

/** The tab last open in this browser (Lab by default). */
function readTab(): LabTab {
  try {
    return localStorage.getItem(TAB_KEY) === 'steps' ? 'steps' : 'lab';
  } catch {
    return 'lab';
  }
}

function kindOf(sourceName: string): MockSourceKind {
  return sourceName.startsWith('replay') ? 'replay' : (sourceName as MockSourceKind);
}

const CSS = `
.lab {
  --ink: #ece6d8; --muted: #a8a294; --panel: #1b1e26; --line: #2e333f; --stage: #262a34;
  --accent: #f0a24a; --right: #f09a3e; --left: #5aa0d8;
  position: fixed; top: 0; right: 0; bottom: 0; width: ${PANEL_W}px; z-index: 10000; overflow-y: auto; /* over the title screen (9998) and launcher (9999) */
  box-sizing: border-box; padding: 14px; display: grid; gap: 12px; align-content: start;
  background: #14161c; color: var(--ink); border-left: 1px solid var(--line);
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (max-width: 699px) { .lab { top: auto; left: 0; width: auto; height: 45vh; border-left: 0; border-top: 1px solid var(--line); } }
.lab h1 { margin: 0; font-size: 18px; font-weight: 650; }
.lab .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--line); }
.lab .tabs button { border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 6px 14px; color: var(--muted); }
.lab .tabs button.on { background: none; color: var(--ink); border-bottom-color: var(--accent); }
.lab[data-tab="steps"] .tab-lab, .lab[data-tab="lab"] .tab-steps { display: none; }
.lab .tab-steps { display: grid; gap: 10px; }
.lab .step { display: grid; gap: 4px; justify-items: start; }
.lab .tab-steps h2 { margin: 0; }
.lab header p, .lab .foot, .lab .keys { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
.lab .foot a, .lab header a { color: var(--accent); }
.lab h2 { margin: 6px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.lab h2 span { text-transform: none; letter-spacing: 0; color: var(--ink); margin-left: 6px; }
.lab .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
.lab .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 6px; }
.lab button { font: 500 12.5px inherit; font-family: inherit; color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; padding: 6px 9px; cursor: pointer; text-transform: capitalize; }
.lab button:hover { border-color: var(--muted); }
.lab button.on { background: var(--accent); border-color: var(--accent); color: #14161c; }
.lab button:disabled { opacity: .5; cursor: default; }
.lab kbd { font: 10px ui-monospace, monospace; opacity: .6; margin-right: 4px; }
.lab .msg { margin: 0; color: var(--accent); }
.lab .log { margin: 0; padding-left: 18px; font: 11.5px ui-monospace, monospace; color: var(--ink); display: grid; gap: 2px; }
.lab .prompt { position: relative; overflow: hidden; display: grid; gap: 2px; padding: 12px 14px 16px; border-radius: 10px;
  background: var(--panel); border: 1px solid var(--accent); }
.lab .prompt[hidden] { display: none; }
.lab .prompt b { font-size: 20px; }
.lab .prompt img { float: left; width: 72px; height: 72px; margin-right: 10px; }
.lab .guide { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; }
.lab .guide summary { cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.lab .guide .shapes { display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; }
.lab .guide figure { margin: 0; display: grid; grid-template-columns: 84px 1fr; gap: 10px; align-items: center; }
.lab .guide img { width: 84px; height: 84px; }
.lab .guide figcaption { font-size: 11px; color: var(--muted); }
.lab .guide figcaption b { display: block; color: var(--ink); font-size: 12.5px; text-transform: capitalize; }
.lab .prompt span { color: var(--muted); }
.lab .prompt em { position: absolute; right: 14px; top: 10px; font: 600 22px ui-monospace, monospace; color: var(--accent); font-style: normal; }
.lab .prompt i { position: absolute; left: 0; bottom: 0; height: 4px; background: var(--accent); }
.lab .time { font: 11.5px ui-monospace, monospace; color: var(--muted); }
.lab .hand { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; }
.lab .hand h2 { margin: 0; color: var(--ink); display: flex; gap: 8px; align-items: center; }
.lab .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.lab .shape { font-size: 16px; font-weight: 600; }
.lab .shape.none { color: var(--muted); font-weight: 400; }
.lab .guess { color: var(--muted); font-size: 12px; margin-top: -4px; }
.lab .hold { position: relative; height: 18px; border-radius: 4px; background: var(--stage); overflow: hidden; font-size: 11px; }
.lab .hold span { position: relative; z-index: 1; padding-left: 6px; line-height: 18px; }
.lab .hold i { position: absolute; left: 0; top: 0; bottom: 0; opacity: .55; }
.lab .margins { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.lab .margins .m { display: grid; gap: 2px; justify-items: center; font: 9.5px ui-monospace, monospace; color: var(--muted); }
.lab .margins .m.on { color: var(--ink); }
.lab .margins .b { width: 100%; height: 26px; border-radius: 3px; background: var(--stage); position: relative; overflow: hidden;
  background-image: linear-gradient(to top, transparent calc(50% - 0.5px), var(--muted) 50%, transparent calc(50% + 0.5px)); }
.lab .margins .b i { position: absolute; left: 0; right: 0; bottom: 0; background: var(--muted); opacity: .5; }
.lab .margins .m.on .b i { background: var(--accent); opacity: 1; }
.lab dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.lab dt { color: var(--muted); }
.lab dd { margin: 0; text-align: right; font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.lab .curls { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.lab .curl { display: grid; gap: 2px; justify-items: center; font: 10px ui-monospace, monospace; color: var(--muted); }
.lab .curl .b { width: 100%; height: 30px; background: var(--stage); border-radius: 4px; position: relative; overflow: hidden; }
.lab .curl .b i { position: absolute; left: 0; right: 0; bottom: 0; background: currentColor; }
`;

const CALIBRATION_KEY = 'wsw.lab.calibration.v1';

/** Remembers the calibration in this browser, so it survives a reload. */
function saveCalibration(shapes: ShapeRecognizer): void {
  try {
    const data = { left: Array.from(shapes.calibration.left), right: Array.from(shapes.calibration.right) };
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private window): calibration lasts until reload.
  }
}

function loadCalibration(shapes: ShapeRecognizer): void {
  try {
    const data = JSON.parse(localStorage.getItem(CALIBRATION_KEY) ?? 'null') as Record<Handedness, number[]> | null;
    if (!data) return;
    for (const h of ['left', 'right'] as const)
      if (Array.isArray(data[h]) && data[h].length === FINGER_NAMES.length) shapes.setCalibration(h, data[h]);
  } catch {
    // Ignore a broken or missing entry.
  }
}
