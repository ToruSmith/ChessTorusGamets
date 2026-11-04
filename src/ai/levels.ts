// Computer opponent strength. Lower levels use Stockfish's "Skill Level" (which makes it
// pick weaker moves on purpose) and a shallow search.

export interface Level {
  readonly id: number;
  readonly skill: number;
  readonly depth: number;
  /** Upper bound on thinking time per move, in ms. */
  readonly movetime: number;
}

export const LEVELS: readonly Level[] = [
  { id: 1, skill: 0, depth: 1, movetime: 100 },
  { id: 2, skill: 3, depth: 2, movetime: 150 },
  { id: 3, skill: 6, depth: 4, movetime: 250 },
  { id: 4, skill: 9, depth: 6, movetime: 400 },
  { id: 5, skill: 12, depth: 8, movetime: 600 },
  { id: 6, skill: 15, depth: 10, movetime: 800 },
  { id: 7, skill: 18, depth: 13, movetime: 1000 },
  { id: 8, skill: 20, depth: 18, movetime: 1500 },
];

export function levelById(id: number): Level {
  return LEVELS.find((level) => level.id === id) ?? (LEVELS[3] as Level);
}

/** Depth used for post-game analysis and hints. */
export const ANALYSIS_DEPTH = 12;
