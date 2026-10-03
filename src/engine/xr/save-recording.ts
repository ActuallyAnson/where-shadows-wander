// Saving a hand recording: into recordings/ through the dev server when the page
// was served by one (no browser download, which crashed Chrome for Testing and
// is awkward to get off a headset), else as a browser download. Dev server
// middleware: vite.config.ts (saveRecordings).
import type { HandRecording } from '../hands/hand-recording';

export function recordingFileName(rec: HandRecording, prefix: string): string {
  return `${prefix}-${rec.recordedAt.replace(/[:.]/g, '-')}.handrec.json`;
}

/** POSTs the recording to the dev server. Resolves false when there is none (a built page) or it refused. */
export async function postRecording(name: string, json: string): Promise<boolean> {
  try {
    const res = await fetch(`./__wsw/recordings/${name}`, { method: 'POST', body: json });
    return res.ok;
  } catch {
    return false;
  }
}

/** A browser download of `json` as `name`. Needs a user gesture on most browsers. */
export function downloadJson(json: string, name: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Saves through the dev server, else downloads. Resolves to where it went. */
export async function saveRecording(rec: HandRecording, prefix: string): Promise<string> {
  const name = recordingFileName(rec, prefix);
  const json = JSON.stringify(rec);
  if (await postRecording(name, json)) return `Saved recordings/${name}`;
  downloadJson(json, name);
  return `Downloaded ${name}`;
}
