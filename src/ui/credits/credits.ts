// What the end credits say (the roll after he falls asleep, credits-view.ts draws it). The team is the README's Credits section
// and the third-party work is CREDITS.md: keep the three in step. Nyove is credited by that alias only. Plain data: no browser.

export type CreditKind = 'title' | 'heading' | 'name' | 'small' | 'gap';

export interface CreditLine {
  readonly kind: CreditKind;
  readonly text: string;
}

const line = (kind: CreditKind, text = ''): CreditLine => ({ kind, text });

export const CREDITS: readonly CreditLine[] = [
  line('title', 'Where Shadows Wander'),
  line('gap'),
  line('heading', 'Made by'),
  line('name', 'Anson Teng'),
  line('name', 'Lim Zhen Eu Damon'),
  line('name', 'Nyove'),
  line('gap'),
  line('heading', 'Models'),
  line('small', 'Furniture Kit by Kenney (CC0)'),
  line('small', 'Candlestick by CreativeTrio (CC0)'),
  line('small', 'Candles by Quaternius (CC0)'),
  line('small', 'Welding Glove by vr.district.0 (CC BY 4.0)'),
  line('small', 'Slap Battles Glove Rig by senseiwords203 (CC BY 4.0)'),
  line('gap'),
  line('heading', 'Lettering'),
  line('small', 'Cinzel and Cinzel Decorative by Natanael Gama'),
  line('small', '(SIL Open Font License 1.1)'),
  line('gap'),
  line('heading', 'Built with'),
  line('small', "Meta's Immersive Web SDK"),
];

/** The last words, alone on the black after the roll. */
export const THANKS = 'Thank you for playing';
