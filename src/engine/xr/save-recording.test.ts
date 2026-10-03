import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRecording } from '../hands/hand-recording';
import { postRecording, recordingFileName } from './save-recording';

describe('save recording', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names the file from the prefix and the recording time', () => {
    const rec = createRecording('', 'ua', '2026-10-03T08:51:51.878Z');
    expect(recordingFileName(rec, 'wsw-hands')).toBe('wsw-hands-2026-10-03T08-51-51-878Z.handrec.json');
  });

  it('posts to the dev server route and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await postRecording('a.handrec.json', '{}')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('./__wsw/recordings/a.handrec.json', { method: 'POST', body: '{}' });
  });

  it('reports false when the server refuses or there is no server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await postRecording('a.handrec.json', '{}')).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no server')));
    expect(await postRecording('a.handrec.json', '{}')).toBe(false);
  });
});
