// The player's accessibility settings: what exists, its range and default, a one-line explanation for the panel,
// and how a loose value is repaired. Plain TypeScript, no browser, no three.js: the panel, the saves and the
// applier all read this one table.

export type Hand = 'left' | 'right';

export interface Settings {
  /** Shape tolerance, 1 (normal) to 3 (widest): widens every shape's ranges for limited finger mobility. */
  tolerance: number;
  /** Seconds a shape must be held to commit, 0.2 to 1.0. Companions take 2.5 times as long. */
  holdTime: number;
  /** Scale of each hand's shadow, 1 (natural) to 2. */
  shadowSize: number;
  /** How much the shadow edge sharpens as a shape is recognised, 0 (off) to 1. */
  sharpen: number;
  /** How much the lantern flickers, 0 (steady) to 1. */
  flicker: number;
  /** Volumes, 0 to 1. */
  volumeMaster: number;
  volumeMusic: number;
  volumeEffects: number;
  volumeAmbience: number;
  /** How large the wall's writing is, 1 (natural) to 1.5. */
  textSize: number;
  /** Pure black on bright white, no paper texture. */
  highContrast: boolean;
  /** Text captions for the traveller's sounds and story beats . */
  captions: boolean;
  /** The hand the panel listens to and opens beside; the game may read it as the player's main hand. */
  hand: Hand;
}

export type NumericKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

export interface NumberSpec {
  kind: 'number';
  key: NumericKey;
  label: string;
  /** One line telling the player what it does. */
  help: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
export interface ToggleSpec {
  kind: 'toggle';
  key: 'highContrast' | 'captions';
  label: string;
  help: string;
  default: boolean;
}
export interface ChoiceSpec {
  kind: 'choice';
  key: 'hand';
  label: string;
  help: string;
  options: readonly Hand[];
  default: Hand;
}
export type SettingSpec = NumberSpec | ToggleSpec | ChoiceSpec;

/** Companions (the puppets that need a longer pose) hold 2.5 times the verb time: 0.4 s gives the GDD's 1 s. */
export const COMPANION_HOLD_FACTOR = 2.5;

export const SETTING_SPECS: readonly SettingSpec[] = [
  {
    kind: 'number',
    key: 'tolerance',
    label: 'Shape tolerance',
    help: 'Higher accepts looser hand shapes, for stiff or tired fingers.',
    min: 1,
    max: 3,
    step: 0.5,
    default: 1,
  },
  {
    kind: 'number',
    key: 'holdTime',
    label: 'Hold time',
    help: 'How long to keep a shape before it counts, in seconds.',
    min: 0.2,
    max: 1,
    step: 0.1,
    default: 0.4,
  },
  {
    kind: 'number',
    key: 'shadowSize',
    label: 'Shadow size',
    help: 'Makes the shadows of your hands bigger and easier to see.',
    min: 1,
    max: 2,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'number',
    key: 'sharpen',
    label: 'Recognition glow',
    help: 'How much a shadow sharpens when its shape is recognised; 0 turns it off.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'number',
    key: 'flicker',
    label: 'Lantern flicker',
    help: 'How much the flame flickers; 0 is perfectly steady.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'number',
    key: 'volumeMaster',
    label: 'Master volume',
    help: 'The overall loudness of everything.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'number',
    key: 'volumeMusic',
    label: 'Music',
    help: 'The loudness of the music.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 0.7,
  },
  {
    kind: 'number',
    key: 'volumeEffects',
    label: 'Sound effects',
    help: 'The loudness of the traveller, the paper and the shapes.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'number',
    key: 'volumeAmbience',
    label: 'Ambience',
    help: 'The loudness of the room around you.',
    min: 0,
    max: 1,
    step: 0.1,
    default: 0.6,
  },
  {
    kind: 'number',
    key: 'textSize',
    label: 'Wall text size',
    help: "How large the story's writing and the captions are on the wall.",
    min: 1,
    max: 1.5,
    step: 0.1,
    default: 1,
  },
  {
    kind: 'toggle',
    key: 'highContrast',
    label: 'High contrast',
    help: 'Pure black shadows on a bright white wall, with no paper texture.',
    default: false,
  },
  {
    kind: 'toggle',
    key: 'captions',
    label: 'Captions',
    help: 'Writes a few words on the wall for the sounds that matter, like a music-box note or a creak.',
    default: false,
  },
  {
    kind: 'choice',
    key: 'hand',
    label: 'Main hand',
    help: 'The hand you press this panel with, and the side it opens on.',
    options: ['left', 'right'],
    default: 'right',
  },
];

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze(
  Object.fromEntries(SETTING_SPECS.map((s) => [s.key, s.default])) as unknown as Settings,
);

export function specFor(key: keyof Settings): SettingSpec {
  return SETTING_SPECS.find((s) => s.key === key)!;
}

/** Keeps `v` in a spec's range and on its step grid. A value that is not a number gives the default. */
export function clampNumber(spec: NumberSpec, v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return spec.default;
  const c = Math.min(Math.max(v, spec.min), spec.max);
  const snapped = spec.min + Math.round((c - spec.min) / spec.step) * spec.step;
  // Rounded to 3 places so 0.1 steps do not leave 0.30000000000000004 in a save.
  return Math.min(Math.max(Math.round(snapped * 1000) / 1000, spec.min), spec.max);
}

/** One value made valid for its setting. */
export function repairValue<K extends keyof Settings>(key: K, v: unknown): Settings[K] {
  const spec = specFor(key);
  if (spec.kind === 'number') return clampNumber(spec, v) as Settings[K];
  if (spec.kind === 'toggle') return (typeof v === 'boolean' ? v : spec.default) as Settings[K];
  return (spec.options.includes(v as Hand) ? v : spec.default) as Settings[K];
}

export interface RepairedSettings {
  settings: Settings;
  /** How many values were missing, of the wrong type, out of range or unknown. 0 means it was already right. */
  repairs: number;
}

/**
 * Reads untrusted data into valid settings, one value at a time. A missing value takes the default without
 * counting (an older save simply has none); a wrong one is repaired and counted.
 */
export function repairSettings(raw: unknown): RepairedSettings {
  const out = { ...DEFAULT_SETTINGS } as Settings;
  let repairs = 0;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    return { settings: out, repairs: raw === undefined ? 0 : 1 };
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) if (!SETTING_SPECS.some((s) => s.key === k)) repairs++;
  for (const spec of SETTING_SPECS) {
    const v = obj[spec.key];
    if (v === undefined) continue;
    const fixed = repairValue(spec.key, v);
    if (fixed !== v) repairs++;
    (out as unknown as Record<string, unknown>)[spec.key] = fixed;
  }
  return { settings: out, repairs };
}

export function settingsEqual(a: Readonly<Settings>, b: Readonly<Settings>): boolean {
  return SETTING_SPECS.every((s) => a[s.key] === b[s.key]);
}
