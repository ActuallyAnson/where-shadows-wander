// A readout card for one hand: rough shape, palm direction and the classifier's
// features. Shared by the webcam bench and the Hand Lab (?mock=1). Styling uses
// the classes .shape, .none, dl, .curls, .curl and .b, and the --right/--left colours.
import { download } from './download';
import { derivePalm, type HandFrame } from '../engine/hands/hand';
import { FINGER_NAMES, handFeatures, roughShape } from '../engine/hands/hand-features';
import type { HandRecording } from '../engine/hands/hand-recording';
import type { PresetName } from '../engine/hands/synthetic-hand';

/**
 * @param zLabels how to describe a palm facing +Z and -Z on this page. On the
 *   bench +Z faces the camera; in the game the camera looks down -Z, so +Z faces the viewer.
 */
export function handCardHtml(
  hand: HandFrame,
  zLabels: readonly [string, string],
  posedAs: PresetName | null = null,
): string {
  const color = hand.handedness === 'right' ? 'var(--right)' : 'var(--left)';
  const title = `<h2><i class="dot" style="background:${color}"></i>${hand.handedness} hand</h2>`;
  const f = handFeatures(hand);
  const palm = derivePalm(hand);
  if (!f || !palm) return `${title}<div class="shape none">Not seen</div>`;
  const [, ny, nz] = palm.normal;
  const facing = ny > 0.6 ? 'up' : ny < -0.6 ? 'down' : nz > 0.6 ? zLabels[0] : nz < -0.6 ? zLabels[1] : 'sideways';
  // roughShape only knows pinch, fist, flat and open; cup, rabbit and fox need the classifier (#11).
  const guess = roughShape(f);
  const head = posedAs
    ? `<div class="shape">${posedAs}</div><div class="guess">Rough guess: ${guess}</div>`
    : `<div class="shape">${guess}</div><div class="guess">Rough guess, not the classifier</div>`;
  return `${title}
    ${head}
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

/** Saves a recording as `<prefix>-<time>.handrec.json`. */
export function downloadRecording(rec: HandRecording, prefix: string): void {
  download(JSON.stringify(rec), `${prefix}-${rec.recordedAt.replace(/[:.]/g, '-')}.handrec.json`);
}
