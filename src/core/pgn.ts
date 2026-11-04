// PGN export and import. Moves go through Game, so an imported record is always legal.
import { Game } from './game.ts';
import type { GameResult } from './outcome.ts';
import { STARTING_FEN, type Move } from './types.ts';

export class PgnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PgnError';
  }
}

export interface PgnRecord {
  readonly startFen: string;
  readonly moves: readonly Move[];
  readonly result: GameResult;
  readonly white?: string;
  readonly black?: string;
}

export interface ParsedPgn {
  readonly startFen: string;
  /** UCI, ready for `Game.fromUci`. */
  readonly moves: readonly string[];
  readonly result: GameResult;
}

const RESULT_TOKENS = ['1-0', '0-1', '1/2-1/2', '*'];

function resultToken(result: GameResult): string {
  if (result.reason === 'unfinished') return '*';
  if (result.winner === 'w') return '1-0';
  return result.winner === 'b' ? '0-1' : '1/2-1/2';
}

function resultFromToken(token: string, ply: number): GameResult {
  if (token === '1-0') return { winner: 'w', reason: 'imported', ply };
  if (token === '0-1') return { winner: 'b', reason: 'imported', ply };
  if (token === '1/2-1/2') return { winner: null, reason: 'imported', ply };
  return { winner: null, reason: 'unfinished', ply };
}

const quote = (text: string): string => text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export function exportPgn(record: PgnRecord): string {
  const token = resultToken(record.result);
  const tags: [string, string][] = [
    ['Event', 'ChessTorusGamets'],
    ['Site', '?'],
    ['Date', '????.??.??'],
    ['Round', '?'],
    ['White', record.white ?? '?'],
    ['Black', record.black ?? '?'],
    ['Result', token],
  ];
  if (record.startFen !== STARTING_FEN) {
    tags.push(['SetUp', '1'], ['FEN', record.startFen]);
  }

  const fields = record.startFen.split(' ');
  let number = Number(fields[5] ?? 1) || 1;
  const words: string[] = [];
  record.moves.forEach((move, index) => {
    if (move.color === 'w') words.push(`${number}.`);
    else if (index === 0) words.push(`${number}...`);
    words.push(move.san);
    if (move.color === 'b') number += 1;
  });
  words.push(token);

  const header = tags.map(([name, value]) => `[${name} "${quote(value)}"]`).join('\n');
  return `${header}\n\n${words.join(' ')}\n`;
}

/** Remove comments, variations, annotation glyphs and move numbers. */
function moveWords(text: string): string[] {
  let body = text.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  let previous = '';
  while (previous !== body) {
    previous = body;
    body = body.replace(/\([^()]*\)/g, ' ');
  }
  const plain = body.replace(/\$\d+/g, ' ').replace(/\d+\.+/g, ' ');
  return plain.split(/\s+/).filter(Boolean);
}

/** Read the first game of a PGN text. Throws PgnError when it cannot be replayed. */
export function parsePgn(text: string): ParsedPgn {
  const tags = new Map<string, string>();
  const body: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tag = /^\s*\[(\w+)\s+"(.*)"\]\s*$/.exec(line);
    if (tag?.[1] !== undefined && tag[2] !== undefined) tags.set(tag[1], tag[2]);
    else body.push(line);
  }

  let game: Game;
  try {
    game = new Game(tags.get('FEN') ?? STARTING_FEN);
  } catch {
    throw new PgnError('Invalid FEN tag');
  }

  let token = tags.get('Result') ?? '*';
  for (const word of moveWords(body.join('\n'))) {
    if (RESULT_TOKENS.includes(word)) {
      token = word;
      break;
    }
    try {
      game.playSan(word.replace(/0-0-0/, 'O-O-O').replace(/0-0/, 'O-O'));
    } catch {
      throw new PgnError(`Illegal move: ${word}`);
    }
  }
  if (game.ply === 0) throw new PgnError('No moves');
  return {
    startFen: game.startFen,
    moves: game.moves.map((move) => move.uci),
    result: game.automaticResult() ?? resultFromToken(token, game.ply),
  };
}
