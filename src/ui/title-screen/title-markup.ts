// The title screen's markup and style as plain strings, so a unit test can check them with no DOM. The look is
// docs/UI-STYLE.md: near-black, pale spaced capitals, a candle-coloured glow that follows the pointer, drifting fog and a
// few dust motes. Plain TypeScript.

export interface TitleItem {
  label: string;
  /** Dimmer than the others, for the way-out items ("Trouble starting?"). */
  quiet?: boolean;
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const DIVIDER = `<svg class="wsw-divider" width="420" height="20" viewBox="0 0 420 20" aria-hidden="true">
  <path d="M0 10H180M240 10H420" stroke="#5c6678" stroke-width="1"/>
  <path d="M210 2L218 10L210 18L202 10Z" fill="none" stroke="#9aa5b8" stroke-width="1.2"/>
  <circle cx="190" cy="10" r="2" fill="#9aa5b8"/><circle cx="230" cy="10" r="2" fill="#9aa5b8"/>
</svg>`;

const EMBLEM = `<svg class="wsw-emblem" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="none" stroke="#9aa5b8" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#5c6678" stroke-width="1"/>
  <path class="wsw-flame" d="M32 14C39 26 45 31 45 40C45 47 39 52 32 52C25 52 19 47 19 40C19 31 25 26 32 14Z" fill="#ffd89a"/>
  <path d="M32 30C36 36 38 38 38 42C38 46 35 48 32 48C29 48 26 46 26 42C26 38 28 36 32 30Z" fill="#05070d"/>
</svg>`;

/** The title screen's inner HTML: the title, then one button per item, in order. */
export function titleMarkup(items: readonly TitleItem[]): string {
  const buttons = items
    .map(
      (it) =>
        `<button type="button" class="wsw-item${it.quiet ? ' wsw-quiet' : ''}"><span class="wsw-mark wsw-l"></span>${escapeHtml(
          it.label,
        )}<span class="wsw-mark wsw-r"></span></button>`,
    )
    .join('');
  return `<div class="wsw-fog wsw-fog-a"></div><div class="wsw-fog wsw-fog-b"></div><div class="wsw-shaft"></div>
<span class="wsw-dust" style="left:21%;animation-duration:9s"></span><span class="wsw-dust" style="left:43%;animation-duration:12s;animation-delay:3s"></span><span class="wsw-dust" style="left:60%;animation-duration:10s;animation-delay:5s"></span><span class="wsw-dust" style="left:76%;animation-duration:13s;animation-delay:1s"></span><span class="wsw-dust" style="left:33%;animation-duration:11s;animation-delay:7s"></span>
<header class="wsw-head">${EMBLEM}<p class="wsw-kicker">WHERE</p><h1 class="wsw-title">SHADOWS WANDER</h1>${DIVIDER}<p class="wsw-hint">SEATED · HANDS ONLY</p></header>
<nav class="wsw-menu" aria-label="Menu">${buttons}</nav>
<p class="wsw-note" role="status" hidden></p>
<div class="wsw-glow"></div><div class="wsw-vignette"></div>`;
}

const SERIF = "'Cinzel','Trajan Pro','Optima','Palatino Linotype','Book Antiqua',Georgia,'Noto Serif',serif";

export const TITLE_CSS = `
.wsw-screen{position:fixed;inset:0;z-index:9998;overflow:hidden;background:#05070d;color:#f2f5f9;font-family:${SERIF};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6vmin 4vmin max(5vmin,96px);box-sizing:border-box}
.wsw-head{display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;z-index:1}
.wsw-emblem{width:clamp(44px,9vmin,72px);height:auto}
.wsw-kicker{margin:2vmin 0 0;font-size:clamp(13px,2.6vmin,22px);letter-spacing:.7em;padding-left:.7em;color:#9aa5b8}
.wsw-title{margin:.4vmin 0 0;font-weight:600;font-size:clamp(26px,8vmin,72px);letter-spacing:.14em;padding-left:.14em;color:#f2f5f9;text-shadow:0 0 30px rgba(180,200,240,.25)}
.wsw-divider{margin-top:2vmin;width:min(420px,70vw);height:auto}
.wsw-menu{display:flex;flex-direction:column;align-items:center;gap:1vmin;position:relative;z-index:1}
.wsw-item{background:none;border:0;color:#7f8898;font-family:inherit;font-weight:400;font-size:clamp(18px,4.2vmin,32px);letter-spacing:.3em;min-height:56px;padding:1.4vmin 9vmin;position:relative;cursor:pointer;outline:none;touch-action:manipulation;transition:color .45s ease,letter-spacing .45s ease,text-shadow .45s ease,transform .2s ease}
.wsw-quiet{font-size:clamp(14px,2.8vmin,20px);color:#5c6678}
.wsw-mark{position:absolute;top:50%;width:9px;height:9px;background:#ffd89a;opacity:0;transform:translateY(-50%) rotate(45deg) scale(0);transition:transform .4s cubic-bezier(.2,1.7,.4,1),opacity .35s ease,left .4s ease,right .4s ease;box-shadow:0 0 12px rgba(255,200,120,.9)}
.wsw-l{left:5vmin}
.wsw-r{right:5vmin}
.wsw-item:hover,.wsw-item:focus-visible{color:#fff;letter-spacing:.38em;text-shadow:0 0 22px rgba(255,200,130,.75)}
.wsw-item:hover .wsw-mark,.wsw-item:focus-visible .wsw-mark{opacity:1;transform:translateY(-50%) rotate(45deg) scale(1)}
.wsw-item:hover .wsw-l,.wsw-item:focus-visible .wsw-l{left:2vmin}
.wsw-item:hover .wsw-r,.wsw-item:focus-visible .wsw-r{right:2vmin}
.wsw-item:active{transform:scale(.97);color:#ffd89a}
.wsw-note{margin:0;max-width:30rem;text-align:center;font-size:clamp(13px,2.4vmin,18px);line-height:1.5;color:#b5bfd0;letter-spacing:.06em;position:relative;z-index:1}
.wsw-hint{margin:1.6vmin 0 0;font-size:clamp(11px,1.9vmin,14px);letter-spacing:.4em;padding-left:.4em;color:#4d5666;position:relative;z-index:1}
.wsw-glow{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(circle 32vmin at var(--gx,50%) var(--gy,68%),rgba(255,196,110,.30),rgba(255,196,110,.10) 50%,rgba(255,196,110,0) 100%);animation:wsw-flicker 4s ease-in-out infinite}
.wsw-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,.85) 100%)}
.wsw-shaft{position:absolute;left:50%;top:-4vmin;width:46vmin;height:110vmin;margin-left:-23vmin;background:linear-gradient(180deg,rgba(210,225,255,.16),rgba(210,225,255,0));clip-path:polygon(38% 0,62% 0,100% 100%,0 100%);filter:blur(10px);pointer-events:none}
.wsw-fog{position:absolute;left:-20%;width:140%;pointer-events:none;background:radial-gradient(ellipse at center,rgba(120,140,170,.2),rgba(120,140,170,0) 65%)}
.wsw-fog-a{top:62%;height:30%;animation:wsw-drift 26s ease-in-out infinite}
.wsw-fog-b{top:18%;height:26%;opacity:.6;animation:wsw-drift 38s ease-in-out infinite reverse}
.wsw-dust{position:absolute;bottom:-1vmin;width:3px;height:3px;border-radius:50%;background:#ffd89a;opacity:0;pointer-events:none;animation:wsw-rise 10s linear infinite}
.wsw-flame{animation:wsw-flicker 3s ease-in-out infinite}
@keyframes wsw-drift{0%,100%{transform:translateX(-5%)}50%{transform:translateX(5%)}}
@keyframes wsw-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.7}100%{transform:translateY(-70vh);opacity:0}}
@keyframes wsw-flicker{0%,100%{opacity:1}22%{opacity:.82}41%{opacity:.96}63%{opacity:.78}80%{opacity:.94}}
@media (prefers-reduced-motion:reduce){.wsw-fog,.wsw-dust,.wsw-glow,.wsw-flame{animation:none}.wsw-dust{display:none}.wsw-item,.wsw-mark{transition-duration:.01s}}
`;
