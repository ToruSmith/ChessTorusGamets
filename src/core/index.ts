// Public API of the rules core. Other layers import from here, never from chess.js.
export * from './types.ts';
export * from './square.ts';
export * from './uci.ts';
export * from './outcome.ts';
export * from './material.ts';
export * from './clock.ts';
export { Game, IllegalMoveError, InvalidFenError, checkFen, type FenCheck } from './game.ts';
export * from './match.ts';
