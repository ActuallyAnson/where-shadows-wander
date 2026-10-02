// The Hand Lab: mock mode's control panel (?mock=1). One page to try hand
// sources (synthetic, scripted, replay, webcam), make shapes, read the
// classifier's features, record, and look around the hands in 3D.
import type { PerspectiveCamera, Scene } from '@iwsdk/core';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HandFrame, Handedness } from '../engine/hands/hand';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import { SHAPES } from '../engine/hands/shapes';
import type { PresetName } from '../engine/hands/synthetic-hand';
import { HandBones } from './hand-bones';
import { downloadRecording, handCardHtml } from './hand-card';
import { MOCK_WRIST } from './hand-source';
import { createMockSource, type MockMode, type MockSourceKind } from './mock-mode';
import { replayFromFile } from './replay-source';
import { SyntheticSource } from './synthetic-source';

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
  private readonly orbit: OrbitControls;
  private readonly root = document.createElement('aside');
  private selected: Handedness = 'right';
  private recording: HandRecording | null = null;
  private recordStart = 0;
  private busy = false;
  private message = '';

  constructor(
    private readonly mode: MockMode,
    private readonly hands: Record<Handedness, HandFrame>,
    private readonly view: LabView,
  ) {
    view.scene.add(this.bones.mesh);
    this.orbit = new OrbitControls(view.camera, view.canvas);
    const [lx, ly, lz] = MOCK_WRIST.left;
    const [rx] = MOCK_WRIST.right;
    this.orbit.target.set((lx + rx) / 2, ly, lz - 0.08);
    // Closer than the player's eyes and a little to the side, so finger curl is easy to see.
    view.camera.position.set(0.16, ly + 0.17, lz + 0.22);
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
    if (this.recording)
      recordFrame(this.recording, this.mode.time - this.recordStart, this.hands.left, this.hands.right, null);
  }

  /** Keeps the hands centred in the part of the window the panel doesn't cover. */
  private fitView(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    const narrow = w < 700;
    this.view.camera.setViewOffset(w, h, narrow ? 0 : PANEL_W / 2, narrow ? h * 0.22 : 0, w, h);
  }

  private get synthetic(): SyntheticSource | null {
    return this.mode.source instanceof SyntheticSource ? this.mode.source : null;
  }

  private onSourceChanged(): void {
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
      this.mode.setSource(source);
      this.onSourceChanged();
      this.message = '';
    } catch (e) {
      this.message = `Couldn't start ${kind}: ${e instanceof Error ? e.message : String(e)}`;
    }
    this.busy = false;
    this.renderControls();
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
      <section class="hand" id="lab-hand-right"></section>
      <section class="hand" id="lab-hand-left"></section>
      <p class="foot">The big label is the shape the hand is posed as. The rough guess only knows flat, fist and
      open; the real classifier (week 3) will recognise all six. <a href="./webcam.html">Webcam bench</a> shows
      the camera image with landmarks.</p>
      <input type="file" accept=".json,application/json" hidden id="lab-file" />`;
    document.body.append(this.root);

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
      else if (act === 'shape') s?.setShape(this.selected, arg as PresetName);
      else if (act === 'hide') s?.setShape(this.selected, s.shapeOf(this.selected) === null ? 'relaxed' : null);
      else if (act === 'jitter' && s) s.jitter = s.jitter > 0 ? 0 : JITTER_M;
      else if (act === 'pause') this.mode.paused = !this.mode.paused;
      else if (act === 'record') this.toggleRecording();
      this.renderControls();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropped = e.dataTransfer?.files[0];
      if (dropped) void this.switchSource('replay', dropped);
    });
    this.renderControls();
    this.renderLive();
  }

  private renderControls(): void {
    const s = this.synthetic;
    const kind = kindOf(this.mode.source.name);
    const btn = (act: string, arg: string, label: string, on = false, title = '') =>
      `<button type="button" data-act="${act}" data-arg="${arg}" class="${on ? 'on' : ''}" ${title ? `title="${title}"` : ''} ${this.busy ? 'disabled' : ''}>${label}</button>`;
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
         <p class="keys">Keys: 0–6 shapes · R/L hand · H hide · arrows move (Shift: depth) · Q/E roll · Z/X turn · J jitter · Space pause</p>`
      : '';
    this.root.querySelector('#lab-controls')!.innerHTML = `
      <h2>Source</h2><div class="row">${sources}</div>
      ${this.message ? `<p class="msg">${this.message}</p>` : ''}
      ${synth ? `<h2>Pose <span>${this.selected} hand</span></h2>${synth}` : ''}
      <div class="row">${btn('pause', '', this.mode.paused ? 'Resume' : 'Pause', this.mode.paused, 'Space')}
        ${btn('record', '', this.recording ? 'Stop and download' : '● Record', !!this.recording)}
        <span class="time" id="lab-time"></span></div>`;
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
        );
    }
    const time = this.root.querySelector('#lab-time');
    if (time) {
      const rec = this.recording ? ` · recording ${(this.mode.time - this.recordStart).toFixed(1)} s` : '';
      time.textContent = `${this.mode.source.name} · ${this.mode.time.toFixed(1)} s${rec}`;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
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
    else if (k === 'q') s.turn(sel, -TURN_DEG, 0);
    else if (k === 'e') s.turn(sel, TURN_DEG, 0);
    else if (k === 'z') s.turn(sel, 0, TURN_DEG);
    else if (k === 'x') s.turn(sel, 0, -TURN_DEG);
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
.lab .time { font: 11.5px ui-monospace, monospace; color: var(--muted); }
.lab .hand { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; }
.lab .hand h2 { margin: 0; color: var(--ink); display: flex; gap: 8px; align-items: center; }
.lab .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.lab .shape { font-size: 16px; font-weight: 600; }
.lab .shape.none { color: var(--muted); font-weight: 400; }
.lab .guess { color: var(--muted); font-size: 12px; margin-top: -4px; }
.lab dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.lab dt { color: var(--muted); }
.lab dd { margin: 0; text-align: right; font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.lab .curls { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.lab .curl { display: grid; gap: 2px; justify-items: center; font: 10px ui-monospace, monospace; color: var(--muted); }
.lab .curl .b { width: 100%; height: 30px; background: var(--stage); border-radius: 4px; position: relative; overflow: hidden; }
.lab .curl .b i { position: absolute; left: 0; right: 0; bottom: 0; background: currentColor; }
`;
