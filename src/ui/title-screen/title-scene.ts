// The title screen's backdrop, drawn as one inline SVG (no image files): a dark, cosy room at night. An arched window
// with the moon, a candle on a table with books and a mug, and on the wall a patch of candlelight with a hand-shadow
// bird flapping in it. Three groups shift a few pixels with the pointer (--px, --py in -1..1) for depth. Plain strings.

const FLAME = 'M0 -34C8 -18 16 -10 16 2C16 12 9 18 0 18C-9 18 -16 12 -16 2C-16 -10 -8 -18 0 -34Z';

export const SCENE_SVG = `<svg class="wsw-scene" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
  <linearGradient id="wsw-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1412"/><stop offset="1" stop-color="#0a0707"/></linearGradient>
  <radialGradient id="wsw-lit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffc46e" stop-opacity=".34"/><stop offset=".6" stop-color="#ff9a4a" stop-opacity=".1"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>
  <radialGradient id="wsw-candle" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd89a" stop-opacity=".55"/><stop offset=".4" stop-color="#ffb056" stop-opacity=".16"/><stop offset="1" stop-color="#ffb056" stop-opacity="0"/></radialGradient>
  <linearGradient id="wsw-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25325e"/><stop offset="1" stop-color="#0d1226"/></linearGradient>
  <linearGradient id="wsw-moonbeam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8c8ff" stop-opacity=".12"/><stop offset="1" stop-color="#b8c8ff" stop-opacity="0"/></linearGradient>
  <filter id="wsw-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="wsw-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .86  0 0 0 0 .7  0 0 0 .07 0"/></filter>
</defs>
<rect width="1000" height="620" fill="url(#wsw-wall)"/>
<rect width="1000" height="620" filter="url(#wsw-grain)"/>
<g class="wsw-par wsw-par-far">
  <path d="M0 150H1000M0 300H1000M0 450H1000" stroke="#000" stroke-opacity=".18" stroke-width="2"/>
  <path d="M70 430V250A80 80 0 0 1 230 250V430Z" fill="url(#wsw-night)" stroke="#2c211c" stroke-width="12"/>
  <path d="M150 170V430M70 300H230" stroke="#2c211c" stroke-width="6"/>
  <circle cx="190" cy="236" r="22" fill="#eef2ff"/><circle cx="198" cy="230" r="19" fill="#25325e"/>
  <circle cx="180" cy="222" r="26" fill="#9fb4ff" opacity=".18"/>
  <g fill="#fff"><circle cx="105" cy="228" r="1.6"/><circle cx="125" cy="272" r="1.2"/><circle cx="205" cy="318" r="1.4"/><circle cx="96" cy="350" r="1.1"/><circle cx="176" cy="386" r="1.3"/></g>
  <rect x="52" y="430" width="196" height="14" rx="3" fill="#251b17"/>
  <path d="M60 444H240L560 640H300Z" fill="url(#wsw-moonbeam)" filter="url(#wsw-soft)"/>
</g>
<ellipse cx="830" cy="380" rx="250" ry="210" fill="url(#wsw-lit)"/>
<g class="wsw-par wsw-par-mid">
  <g transform="translate(830 372)" fill="#000" fill-opacity=".82" filter="url(#wsw-soft)" class="wsw-bird">
    <path d="M-62 18C-32 -8 20 -12 52 -2C60 -18 78 -22 88 -12L116 -8L90 2C84 14 70 20 52 22C20 36 -30 38 -62 18ZM-62 18L-108 4L-100 26Z"/>
    <path class="wsw-wing wsw-wing-a" d="M-8 -4C-30 -54 -72 -84 -124 -94C-102 -62 -92 -30 -58 -2Z"/>
    <path class="wsw-wing wsw-wing-b" d="M12 -4C22 -52 52 -88 94 -104C84 -68 72 -34 52 -2Z"/>
  </g>
</g>
<g class="wsw-par wsw-par-near">
  <ellipse cx="200" cy="470" rx="300" ry="260" fill="url(#wsw-candle)" class="wsw-candle-glow"/>
  <path d="M0 548H372V640H0Z" fill="#0b0807"/><path d="M0 548H372" stroke="#5a4130" stroke-width="3"/>
  <path d="M22 548L26 520H52L56 548Z" fill="#3a2a22"/><g fill="#1f3a2c"><path d="M39 520C26 500 22 486 30 470C40 486 42 500 39 520Z"/><path d="M39 520C48 502 62 494 74 496C66 510 54 518 39 520Z"/><path d="M39 520C30 508 14 506 6 512C16 520 28 522 39 520Z"/></g><rect x="70" y="528" width="96" height="14" rx="2" fill="#2a1d19"/><rect x="82" y="514" width="74" height="14" rx="2" fill="#3a2a22"/>
  <rect x="192" y="486" width="22" height="62" rx="3" fill="#ead9b8"/><path d="M192 498Q203 506 214 498V490H192Z" fill="#cdb98f"/>
  <g transform="translate(203 478)"><path class="wsw-flame" d="${FLAME}" fill="#ffb340"/><path class="wsw-flame" d="${FLAME}" fill="#ffe27a" transform="scale(.55 .6) translate(0 8)"/></g>
  <path d="M296 520H334V548H296Z" fill="#4a3226"/><path d="M334 526Q352 528 350 538Q348 546 334 544" fill="none" stroke="#4a3226" stroke-width="5"/>
  <g fill="none" stroke="#c9bfae" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"><path class="wsw-steam" d="M308 512Q300 500 308 490Q316 480 308 470"/><path class="wsw-steam wsw-steam-b" d="M322 512Q314 502 322 492Q330 482 322 474"/></g>
</g>
</svg>`;
