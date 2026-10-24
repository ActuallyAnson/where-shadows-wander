import { describe, expect, it } from 'vitest';
import { TITLE_CSS, titleMarkup } from './title-markup';

describe('titleMarkup', () => {
  it('has the title and one button per item, in order', () => {
    const html = titleMarkup([{ label: 'BEGIN' }, { label: 'Trouble starting?', quiet: true }]);
    expect(html).toContain('<h1 class="wsw-title">SHADOWS WANDER</h1>');
    const labels = [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) => m[0]);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain('BEGIN');
    expect(labels[1]).toContain('Trouble starting?');
  });

  it('marks only the quiet items', () => {
    const html = titleMarkup([{ label: 'A' }, { label: 'B', quiet: true }]);
    expect(html.match(/wsw-quiet/g)).toHaveLength(1);
  });

  it('escapes labels, so a label can never inject markup', () => {
    const html = titleMarkup([{ label: '<img src=x onerror=alert(1)>&"\'' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;');
  });

  it('shows no buttons for no items', () => {
    expect(titleMarkup([])).not.toContain('<button');
  });

  it('keeps the decoration out of the accessibility tree', () => {
    const html = titleMarkup([]);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2);
  });
});

describe('TITLE_CSS', () => {
  it('lights an item the same way for the keyboard as for the pointer', () => {
    expect(TITLE_CSS).toContain('.wsw-item:focus-visible');
  });

  it('turns the ambient motion off for people who ask for reduced motion', () => {
    expect(TITLE_CSS).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });

  it('keeps the touch targets at least 56 px tall', () => {
    expect(TITLE_CSS).toContain('min-height:56px');
  });
});
