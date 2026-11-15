import { describe, expect, it } from 'vitest';
import { fontFaceCss, TITLE_CSS, titleMarkup } from './title-markup';

describe('titleMarkup', () => {
  it('has the title and one button per item, in order', () => {
    const html = titleMarkup([{ label: 'BEGIN' }, { label: 'SETTINGS' }]);
    expect(html).toContain('<h1 class="wsw-title">SHADOWS WANDER</h1>');
    const labels = [...html.matchAll(/<button[^>]*>.*?<\/button>/g)].map((m) => m[0]);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain('BEGIN');
    expect(labels[1]).toContain('SETTINGS');
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
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
  });

  it('puts the backdrop first, behind the text', () => {
    expect(titleMarkup([]).startsWith('<svg class="wsw-scene"')).toBe(true);
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

describe('fontFaceCss', () => {
  it('declares both bundled weights from the given files, with a fallback while they load', () => {
    const css = fontFaceCss('/a.woff2', '/b.woff2');
    expect(css).toContain('font-weight:400');
    expect(css).toContain('url("/a.woff2")');
    expect(css).toContain('font-weight:700');
    expect(css).toContain('url("/b.woff2")');
    expect(css.match(/font-display:swap/g)).toHaveLength(2);
  });

  it('names the family the stylesheet asks for first', () => {
    expect(TITLE_CSS).toContain("font-family:'Cinzel Decorative'");
  });
});

describe('the busy look', () => {
  it('the guttering flame and the fade to black come from one class, and the items keep their look', () => {
    expect(TITLE_CSS).toContain('.wsw-busy .wsw-flame');
    expect(TITLE_CSS).toContain('.wsw-busy::after{opacity:1');
    expect(TITLE_CSS).not.toContain('.wsw-busy .wsw-item');
  });
});
