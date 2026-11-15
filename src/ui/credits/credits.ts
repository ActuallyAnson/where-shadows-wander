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
  line('heading', 'Music'),
  line('small', 'I Got Lost (Emotional Mysterious Music)'),
  line('small', 'by Migfus20 (CC BY 4.0), freesound.org'),
  line('gap'),
  line('heading', 'Models'),
  line('small', 'Furniture Kit by Kenney (CC0)'),
  line('small', 'Cardboard Box Open and Coat Rack by Kenney (CC0)'),
  line('small', 'Furniture and Cardboard Boxes by Quaternius (CC0)'),
  line('small', 'Mug With Office Tool and Globe by CreativeTrio (CC0)'),
  line('small', 'Glass Jar by Jarlan Perez (CC BY 3.0), Poly Pizza'),
  line('small', 'Time Hotel 7.07 by S. Paul Michael (CC BY 3.0), Poly Pizza'),
  line('small', 'Fox and Blankets by Poly by Google (CC BY 3.0), Poly Pizza'),
  line('small', 'Slippers by J-Toastie (CC BY 3.0), Poly Pizza'),
  line('small', 'Welding Glove by vr.district.0 (CC BY 4.0)'),
  line('small', 'Slap Battles Glove Rig by senseiwords203 (CC BY 4.0)'),
  line('gap'),
  line('heading', 'Sounds'),
  line('small', 'Huge Thunder Crack [XY] by -CASK- (CC BY 4.0)'),
  line('small', 'Rain by klankbeeld (CC BY 4.0)'),
  line('small', 'freesound.org/people/klankbeeld'),
  line('small', 'Bed sheets by alexarje (CC BY 4.0)'),
  line('small', 'match strike 05 by tim.kahn (CC BY 4.0)'),
  line('small', 'Deck of Cards, Thump on Table by designerschoice (CC BY 4.0)'),
  line('small', 'Slide release by heyheytheree (CC BY 4.0)'),
  line('small', 'ManSighMovement by bennychico11 (CC BY 4.0)'),
  line('small', 'Fire crackling by AlexanderChe (CC0)'),
  line('small', 'Crinkle; Paper by Crovic (CC0)'),
  line('small', 'Button hover by Fachii (CC0)'),
  line('small', 'UI Button Press by el_boss (CC0)'),
  line('small', 'Footsteps - Stone, Rock, Concrete, Cement by SecureSubset (CC0)'),
  line('small', "Children's Toys Laughing by f-r-a-g-i-l-e (CC0)"),
  line('small', 'Torch Click 2 by BenjaminNelan (CC0)'),
  line('small', 'Thunder clip by csengeri (CC0)'),
  line('small', 'Yawn 2 by OwlStorm (CC0)'),
  line('small', 'All from freesound.org'),
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
