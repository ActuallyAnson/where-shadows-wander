import { describe, expect, it } from 'vitest';
import { developerPage, DEVELOPER_PAGE_TITLE, type DeveloperPageHooks, type RecorderState } from './developer-page';
import type { FlickerChoice } from './testing-options';

function fake() {
  const state = {
    lab: false,
    rec: null as RecorderState | null,
    flicker: null as FlickerChoice,
    errors: [] as string[],
    recorded: [] as boolean[],
    editor: 0,
  };
  const hooks: DeveloperPageHooks = {
    labShown: () => state.lab,
    showLab: (on) => (state.lab = on),
    recorder: () => state.rec,
    record: (shapes) => {
      state.recorded.push(shapes);
      state.rec = { shapes, started: false, finished: false };
    },
    flicker: () => state.flicker,
    setFlicker: (c) => (state.flicker = c),
    errorCount: () => state.errors.length,
    lastError: () => state.errors.at(-1) ?? null,
    openRoomEditor: () => state.editor++,
  };
  const page = developerPage(hooks);
  const item = (id: string) => page.items.find((i) => i.id === id)!;
  return { state, page, item };
}

describe('developerPage', () => {
  it('is one page of at most six buttons, titled Developer', () => {
    const { page } = fake();
    expect(page.title).toBe(DEVELOPER_PAGE_TITLE);
    expect(page.items.length).toBeLessThanOrEqual(6);
  });

  it('shows and hides the Hand Lab', () => {
    const { state, item } = fake();
    expect(item('hand-lab').text()).toBe('hidden');
    item('hand-lab').press();
    expect(state.lab).toBe(true);
    expect(item('hand-lab').text()).toBe('SHOWN');
  });

  it('starts one recording at a time, and another once it is saved', () => {
    const { state, item } = fake();
    item('record-free').press();
    expect(item('record-free').text()).toBe('Waiting for hands');
    expect(item('record-shapes').text()).toBe('Start');
    item('record-shapes').press(); // ignored while the first one runs
    expect(state.recorded).toEqual([false]);
    state.rec = { shapes: false, started: true, finished: true };
    expect(item('record-free').text()).toBe('Saved: again');
    item('record-shapes').press();
    expect(state.recorded).toEqual([false, true]);
  });

  it('cycles the test flicker through the setting, steady and fixed amounts', () => {
    const { item } = fake();
    const seen = [item('flicker').text()];
    for (let i = 0; i < 4; i++) {
      item('flicker').press();
      seen.push(item('flicker').text());
    }
    expect(seen).toEqual(['the setting', 'steady', '0.5', '1', 'the setting']);
  });

  it('counts errors and shows the newest as its help', () => {
    const { state, item } = fake();
    expect(item('errors').help).toMatch(/No errors/);
    state.errors.push('a', 'boom');
    expect(item('errors').text()).toBe('2');
    expect(item('errors').help).toBe('boom');
  });

  it('opens the room editor', () => {
    const { state, item } = fake();
    item('room-editor').press();
    expect(state.editor).toBe(1);
  });
});
