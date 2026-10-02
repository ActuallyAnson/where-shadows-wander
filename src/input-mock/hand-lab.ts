// The Hand Lab: mock mode's control panel (?mock=1). One page to try hand
// sources (synthetic, scripted, replay, webcam), make shapes, read the
// classifier's features, record, and look around the hands in 3D.
import type { PerspectiveCamera, Scene } from '@iwsdk/core';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HandFrame, Handedness, Vec3 } from '../engine/hands/hand';
import { GuidedRecording } from '../engine/hands/guided-recording';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import type { GestureDetector } from '../engine/hands/gesture-detector';
import type { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { SHAPE_HOW, SHAPES_SCRIPT, ShapeScript } from '../engine/hands/shape-script';
import { sampleImage } from '../engine/xr/hand-sample-draw';
import { SHAPES } from '../engine/hands/shapes';
import type { PresetName } from '../engine/hands/synthetic-hand';
import { HandBones } from './hand-bones';
import { LanternMarker } from './lantern-marker';
import { downloadRecording, handCardHtml } from './hand-card';
import { MOCK_WRIST, type HandSource } from './hand-source';
import { createMockSource, type MockMode, type MockSourceKind } from './mock-mode';
import { replayFromFile } from './replay-source';
import { ScriptedSource } from './scripted-source';
import { SyntheticSource } from './synthetic-source';
import type { WebcamSource } from './webcam-source';

const PANEL_W = 320;
const STEP_M = 0.01;
const TURN_DEG = 15;
const JITTER_M = 0.003;
const SHAPE_KEYS: PresetName[] = ['relaxed', ...SHAPES];

export interface LabView {
  scene: Scene;
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
}

export class HandLab {
  private readonly bones = new HandBones();
  private readonly marker: LanternMarker;
  /** The latest gesture events, newest first (copied: the detector reuses its event objects). */
  private readonly gestureLog: string[] = [];
  private readonly orbit: OrbitControls;
  private readonly root = document.createElement('aside');
  private selected: Handedness = 'right';
  private recording: HandRecording | null = null;
  /** A guided recording in progress: prompts every shape and labels the file. */
  private guided: GuidedRecording | null = null;
  private guidedStart = 0;
  private recordStart = 0;
  private busy = false;
  private message = '';

  constructor(
    private readonly mode: MockMode,
    private readonly hands: Record<Handedness, HandFrame>,
    private readonly shapes: ShapeRecognizer,
    private readonly gestures: GestureDetector,
    private readonly lantern: Readonly<Vec3>,
    private readonly view: LabView,
  ) {
    view.scene.add(this.bones.mesh);
    this.marker = new LanternMarker(lantern, gestures.config.coverRadiusM);
    view.scene.add(this.marker.group);
    this.orbit = new OrbitControls(view.camera, view.canvas);
    const [lx, ly, lz] = MOCK_WRIST.left;
    const [rx] = MOCK_WRIST.right;
    // Between the hands and the lantern, which sits nearer the player on the table edge.
    this.orbit.target.set((lx + rx) / 2, (ly + lantern[1]) / 2, (lz + lantern[2]) / 2);
    // Above and to the side of the player, so curled fingers and the lantern are both in view.
    view.camera.position.set(0.3, ly + 0.3, lantern[2] + 0.35);
    this.orbit.update();
    this.fitView();
    window.addEventListener('resize', () => this.fitView());

    this.onSourceChanged();
    this.mount();
    setInterval(() => this.renderLive(), 100);
  }

  /** Call once per frame, after the hands are filled. */
  frame(): void {
    this.bones.update([this.hands.left, this.hands.right]);
    const g = this.gestures;
    this.marker.setProgress(Math.max(g.state.left.coverProgress, g.state.right.coverProgress));
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
  }

  /** Keeps the hands centred in the part of the window the panel doesn't cover. */
  private fitView(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    const narrow = w < 700;
    this.view.camera.setViewOffset(w, h, narrow ? 0 : PANEL_W / 2, narrow ? h * 0.22 : 0, w, h);
  }

  /** Changes the hand source; the classifier starts fresh, since mock time restarts at 0. */
  private setSource(source: HandSource): void {
    this.mode.setSource(source);
    this.shapes.reset();
    this.gestures.reset();
    this.gestureLog.length = 0;
  }

  private get synthetic(): SyntheticSource | null {
    return this.mode.source instanceof SyntheticSource ? this.mode.source : null;
  }

  private onSourceChanged(): void {
    // The guide matters most with real hands (webcam, replays); synthetic hands show the shape anyway.
    const guide = this.root.querySelector<HTMLDetailsElement>('#lab-guide');
    if (guide) guide.open = !(this.mode.source instanceof SyntheticSource);
    // Synthetic hands start one-handed, like a player gesturing.
    this.synthetic?.setShape('left', null);
    const url = new URL(location.href);
    url.searchParams.set('src', kindOf(this.mode.source.name));
    history.replaceState(null, '', url);
  }

  private async switchSource(kind: MockSourceKind, file?: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message =
      kind === 'webcam' ? 'Starting the camera. The first start downloads the hand model (about 8 MB)…' : '';
    this.renderControls();
    try {
      const source = file ? await replayFromFile(file) : await createMockSource({ source: kind, file: '' });
      this.setSource(source);
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
    this.guided = new GuidedRecording(
      new ShapeScript(SHAPES_SCRIPT),
      `Hand Lab guided, ${this.mode.source.name}`,
      navigator.userAgent,
      new Date().toISOString(),
    );
    this.renderControls();
  }

  /** Ends a guided recording (finished or stopped early) and downloads it with its labels. */
  private finishGuided(): void {
    if (!this.guided) return;
    const rec = this.guided.finish();
    this.guided = null;
    if (rec.frames.length) downloadRecording(rec, 'wsw-lab-guided');
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
      downloadRecording(this.recording, 'wsw-lab');
      this.recording = null;
    }
    this.renderControls();
  }

  private mount(): void {
    document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
    // The canvas is transparent (for passthrough); give the lab a dark backdrop so bones show up.
    document.body.style.background = '#101217';
    this.root.className = 'lab';
    this.root.innerHTML = `
      <header><h1>Hand Lab</h1><p>Mock hands for testing at a desk. Drag to look around, scroll to zoom.
        <a href="./">Back to the game</a></p></header>
      <section id="lab-controls"></section>
      <details class="guide" id="lab-guide"><summary>Shape guide</summary><div class="shapes">${SHAPES.map(
        (s) =>
          `<figure title="${SHAPE_HOW[s]}"><img src="${sampleImage(s, '#f0a24a', 'right', 168)}" alt=""><figcaption><b>${s}</b>${SHAPE_HOW[s]}</figcaption></figure>`,
      ).join('')}</div></details>
      <section class="hand" id="lab-gestures"></section>
      <section class="hand" id="lab-hand-right"></section>
      <section class="hand" id="lab-hand-left"></section>
      <p class="foot">The big label is what the classifier has committed; "holding" shows a shape on its way
      there (0.4 s for verbs, 1 s for rabbit and fox). The bars show how far inside each shape's ranges the hand
      is: above the line matches. <a href="./webcam.html">Webcam bench</a> shows the camera image with
      landmarks.</p>
      <input type="file" accept=".json,application/json" hidden id="lab-file" />`;
    document.body.append(this.root);
    const guide = this.root.querySelector<HTMLDetailsElement>('#lab-guide');
    if (guide) guide.open = !(this.mode.source instanceof SyntheticSource);

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
        else void this.switchSource(arg as MockSourceKind);
      } else if (act === 'hand') this.selected = arg as Handedness;
      else if (act === 'lock' && this.mode.source.name === 'webcam')
        (this.mode.source as WebcamSource).lockSide = arg === 'auto' ? null : (arg as Handedness);
      else if (act === 'shape') s?.setShape(this.selected, arg as PresetName);
      else if (act === 'hide') s?.setShape(this.selected, s.shapeOf(this.selected) === null ? 'relaxed' : null);
      else if (act === 'jitter' && s) s.jitter = s.jitter > 0 ? 0 : JITTER_M;
      else if (act === 'pause') this.mode.paused = !this.mode.paused;
      else if (act === 'record') this.toggleRecording();
      else if (act === 'guided') {
        if (this.guided) this.finishGuided();
        else this.startGuided();
      }
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

  private renderControls(): void {
    const s = this.synthetic;
    const kind = kindOf(this.mode.source.name);
    // While a guided recording runs, its clock must keep moving forward: no source changes or pausing.
    const locked = new Set(this.guided ? ['source', 'pause', 'record'] : this.recording ? ['guided'] : []);
    const btn = (act: string, arg: string, label: string, on = false, title = '') =>
      `<button type="button" data-act="${act}" data-arg="${arg}" class="${on ? 'on' : ''}" ${title ? `title="${title}"` : ''} ${this.busy || locked.has(act) ? 'disabled' : ''}>${label}</button>`;
    const sources = (
      [
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
      ${this.mode.source.name === 'webcam' ? this.lockRow(btn) : ''}
      <div class="row">${btn('pause', '', this.mode.paused ? 'Resume' : 'Pause', this.mode.paused, 'Space')}
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
    // The default view is from the player's eyes, looking down -Z.
    for (const side of ['right', 'left'] as const) {
      const el = this.root.querySelector(`#lab-hand-${side}`);
      if (el)
        el.innerHTML = handCardHtml(
          this.hands[side],
          ['toward you', 'away from you'],
          this.mode.source.shapeOf?.(side) ?? null,
          this.shapes[side].state,
          this.shapes[side].margins,
        );
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
      const status = this.mode.source.status?.() ?? this.mode.source.name;
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
    else if (k === 'g') s.placeOver(sel, this.lantern);
    else if (k === 'b') s.home(sel);
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

function kindOf(sourceName: string): MockSourceKind {
  return sourceName.startsWith('replay') ? 'replay' : (sourceName as MockSourceKind);
}

const CSS = `
.lab {
  --ink: #ece6d8; --muted: #a8a294; --panel: #1b1e26; --line: #2e333f; --stage: #262a34;
  --accent: #f0a24a; --right: #f09a3e; --left: #5aa0d8;
  position: fixed; top: 0; right: 0; bottom: 0; width: ${PANEL_W}px; z-index: 10; overflow-y: auto;
  box-sizing: border-box; padding: 14px; display: grid; gap: 12px; align-content: start;
  background: #14161c; color: var(--ink); border-left: 1px solid var(--line);
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (max-width: 699px) { .lab { top: auto; left: 0; width: auto; height: 45vh; border-left: 0; border-top: 1px solid var(--line); } }
.lab h1 { margin: 0; font-size: 18px; font-weight: 650; }
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
