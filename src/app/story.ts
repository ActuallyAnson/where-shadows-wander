// What the wall says as the night goes, in ink: the room dreams every night, but tonight its dreams have sunk too deep to wake,
// and one spark is left to wake the five sleepers (the lamp, the bunting, the pictures, the globe, the window), one by one.
// Each puzzle has a line before it (the sleeper and what lies in the way) and a line after it (the sleeper wakes). Plain data.

/** The line under each puzzle (0 = the books .. 4 = the castle), said a moment after the puzzle appears. */
export const PUZZLE_LINES: readonly string[] = [
  'The lamp sleeps beyond the books.',
  'The bunting sleeps past a step too tall.',
  'The pictures sleep behind the rain.',
  'The globe sleeps in a cold wind.',
  'The window sleeps in the castle’s shadow.',
];

/** The line when each puzzle is solved and its sleeper wakes. */
export const WAKE_LINES: readonly string[] = [
  'The lamp wakes first. It remembers being fire.',
  'The paper flags wake, and flutter without wind.',
  'The painted moon opens one eye.',
  'The globe turns over, and dreams of every sea.',
  'The window wakes last, and holds the night like a cup.',
];

/** When the candle gutters before the fan. */
export const DIMMING_LINE = 'The candle gutters. Something old holds its breath.';
/** When the castle is reached and the window lights. */
export const RETURN_LINE = 'Every sleeper is awake. The room is dreaming.';

/** Seconds after a puzzle appears before its line starts, and how long the line holds once it is written. */
export const LINE_DELAY_S = 2;
export const LINE_HOLD_S = 3;
/** The wake line starts this soon after the solve and holds this long. */
export const WAKE_DELAY_S = 0.4;
export const WAKE_HOLD_S = 2.2;

/** The line for puzzle `index`, or '' when there is none. */
export function lineForPuzzle(index: number): string {
  return PUZZLE_LINES[index] ?? '';
}

/** The wake line for puzzle `index`, or '' when there is none. */
export function wakeLineFor(index: number): string {
  return WAKE_LINES[index] ?? '';
}
