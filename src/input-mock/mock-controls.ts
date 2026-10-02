// Keyboard controls and a small status panel for mock mode. Keys act on the
// selected hand of the synthetic source; Space pauses any source.
import type { Handedness } from '../engine/hands/hand';
import { SHAPES } from '../engine/hands/shapes';
import type { MockMode } from './mock-mode';
import { replayFromFile } from './replay-source';
import { SyntheticSource } from './synthetic-source';

const STEP_M = 0.01;
const TURN_DEG = 15;
const JITTER_M = 0.003;

const HELP =
  '1–6 flat fist cup spread rabbit fox · 0 relaxed · H hide · R/L pick hand · arrows move (Shift: depth) · ' +
  'Q/E roll · Z/X turn · J jitter · Space pause · drop a .handrec.json to replay it';

export function mountMockControls(mode: MockMode): void {
  let selected: Handedness = 'right';
  // Start with only the right hand showing, like a player gesturing one-handed.
  if (mode.source instanceof SyntheticSource) mode.source.setShape('left', null);

  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:10;max-width:34rem;padding:10px 12px;border-radius:8px;' +
    'background:rgba(20,22,28,.85);color:#ece6d8;font:13px/1.45 system-ui,sans-serif;pointer-events:none';
  document.body.append(panel);

  const render = () => {
    const s = mode.source;
    const hand = (h: Handedness) => {
      const mark = h === selected ? ' ◀' : '';
      const shape = s instanceof SyntheticSource ? (s.shapeOf(h) ?? 'hidden') : '';
      return `<div>${h}: <b>${shape}</b>${mark}</div>`;
    };
    panel.innerHTML =
      `<div><b>Mock mode</b> · ${s.name} · ${mode.time.toFixed(1)} s${mode.paused ? ' · <b>paused</b>' : ''}</div>` +
      (s instanceof SyntheticSource ? hand('right') + hand('left') : '') +
      `<div style="opacity:.7;margin-top:4px">${s instanceof SyntheticSource ? HELP : 'Space pause · drop a .handrec.json to replay it'}</div>`;
  };
  render();
  setInterval(render, 250);

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Space') {
      mode.paused = !mode.paused;
      e.preventDefault();
      return render();
    }
    const s = mode.source;
    if (!(s instanceof SyntheticSource)) return;
    const k = e.key.toLowerCase();
    const n = Number(e.key);
    if (e.key >= '1' && e.key <= '6') s.setShape(selected, SHAPES[n - 1]);
    else if (e.key === '0') s.setShape(selected, 'relaxed');
    else if (k === 'h') s.setShape(selected, s.shapeOf(selected) === null ? 'relaxed' : null);
    else if (k === 'r') selected = 'right';
    else if (k === 'l') selected = 'left';
    else if (k === 'j') s.jitter = s.jitter > 0 ? 0 : JITTER_M;
    else if (k === 'q') s.turn(selected, -TURN_DEG, 0);
    else if (k === 'e') s.turn(selected, TURN_DEG, 0);
    else if (k === 'z') s.turn(selected, 0, TURN_DEG);
    else if (k === 'x') s.turn(selected, 0, -TURN_DEG);
    else if (e.key === 'ArrowLeft') s.move(selected, -STEP_M, 0, 0);
    else if (e.key === 'ArrowRight') s.move(selected, STEP_M, 0, 0);
    else if (e.key === 'ArrowUp') s.move(selected, 0, e.shiftKey ? 0 : STEP_M, e.shiftKey ? -STEP_M : 0);
    else if (e.key === 'ArrowDown') s.move(selected, 0, e.shiftKey ? 0 : -STEP_M, e.shiftKey ? STEP_M : 0);
    else return;
    e.preventDefault();
    render();
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    replayFromFile(file)
      .then((source) => mode.setSource(source))
      .catch((err) => alert(`Couldn't replay ${file.name}: ${err instanceof Error ? err.message : String(err)}`));
  });
}
