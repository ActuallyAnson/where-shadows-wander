// A readout card for one hand: the classifier's state (committed shape, the
// shape being held and its progress, every shape's margin), palm direction and
// the features. Shared by the webcam bench and the Hand Lab. Styling
// uses the classes .shape, .none, .guess, .hold, .margins, dl, .curls, .curl
// and .b, and the --right/--left colours.
import { saveRecording } from '../engine/xr/save-recording';
import { derivePalm, type HandFrame } from '../engine/hands/hand';
import { FINGER_NAMES, handFeatures } from '../engine/hands/hand-features';
import type { ShapeState } from '../engine/hands/shape-events';
import { SHAPES } from '../engine/hands/shapes';
import type { PresetName } from '../engine/hands/synthetic-hand';

/**
 * @param zLabels how to describe a palm facing +Z and -Z on this page. On the
 *   bench +Z faces the camera; in the game the camera looks down -Z, so +Z faces the viewer.
 */
export function handCardHtml(
  hand: HandFrame,
  zLabels: readonly [string, string],
  posedAs: PresetName | null = null,
  state: Readonly<ShapeState> | null = null,
  margins: Float32Array | null = null,
): string {
  const color = hand.handedness === 'right' ? 'var(--right)' : 'var(--left)';
  const title = `<h2><i class="dot" style="background:${color}"></i>${hand.handedness} hand</h2>`;
  const f = handFeatures(hand);
  const palm = derivePalm(hand);
  if (!f || !palm) {
    const paused = state?.phase === 'paused' && hand.validJoints > 0;
    const held = state?.committed ? ` · still ${state.committed}` : '';
    return `${title}<div class="shape none">${paused ? `Paused (${hand.validJoints}/25 joints)${held}` : 'Not seen'}</div>`;
  }
  const [, ny, nz] = palm.normal;
  const facing = ny > 0.6 ? 'up' : ny < -0.6 ? 'down' : nz > 0.6 ? zLabels[0] : nz < -0.6 ? zLabels[1] : 'sideways';
  return `${title}
    ${classifierHtml(state, margins, color, posedAs)}
    <dl>
      <dt>Palm faces</dt><dd>${facing}</dd>
      <dt>Palm normal</dt><dd>${palm.normal.map((v) => v.toFixed(2)).join(' ')}</dd>
      <dt>Thumb–index gap</dt><dd>${f.pinchGapMm.toFixed(0)} mm</dd>
      <dt>Finger spread</dt><dd>${f.spreadDeg.toFixed(0)}°</dd>
      <dt>Mean curl</dt><dd>${f.meanCurl.toFixed(2)}</dd>
    </dl>
    <div class="curls" style="color:${color}">${FINGER_NAMES.map(
      (n) =>
        `<div class="curl"><div class="b"><i style="height:${(f.curl[n] * 100).toFixed(0)}%;background:${color}"></i></div>${n}</div>`,
    ).join('')}</div>`;
}

/** The classifier's state: committed shape (big), the shape being held with its progress, and per-shape margins. */
function classifierHtml(
  state: Readonly<ShapeState> | null,
  margins: Float32Array | null,
  color: string,
  posedAs: PresetName | null,
): string {
  const posed = posedAs ? `<div class="guess">Posed as ${posedAs}</div>` : '';
  if (!state) return `<div class="shape none">No classifier</div>${posed}`;
  const big = state.committed ?? (state.candidate ? `${state.candidate}…` : 'no shape');
  const hold = state.candidate
    ? `<div class="hold" title="Hold progress"><span>holding ${state.candidate}</span><i style="width:${(state.progress * 100).toFixed(0)}%;background:${color}"></i></div>`
    : '';
  const bars = margins
    ? `<div class="margins" title="How far inside each shape's ranges the hand is (tolerance units; above the line = matches)">${SHAPES.map(
        (s, i) => {
          const m = Number.isFinite(margins[i]) ? Math.max(-1, Math.min(1, margins[i])) : -1;
          const h = ((m + 1) / 2) * 100;
          return `<div class="m${m >= 0 ? ' on' : ''}"><div class="b"><i style="height:${h.toFixed(0)}%"></i></div>${s}</div>`;
        },
      ).join('')}</div>`
    : '';
  return `<div class="shape${state.committed ? '' : ' none'}">${big}</div>${hold}${posed}${bars}`;
}

/** Saves a recording: into recordings/ through the dev server, else as a download. Resolves to where it went. */
export const downloadRecording = saveRecording;
