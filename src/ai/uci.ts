// Parsing of UCI engine output. Pure; no engine needed.

/** Engine score from the side to move's point of view. */
export type Score =
  | { readonly type: 'cp'; readonly value: number }
  | { readonly type: 'mate'; readonly value: number };

export interface InfoLine {
  readonly depth: number;
  readonly multipv: number;
  readonly score: Score | null;
  readonly pv: readonly string[];
}

/** Parse an `info … score … pv …` line; null for other lines (e.g. `info string`). */
export function parseInfo(line: string): InfoLine | null {
  if (!line.startsWith('info ') || line.startsWith('info string')) return null;
  const tokens = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  let pv: string[] = [];
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === 'depth') depth = Number(tokens[++i]);
    else if (token === 'multipv') multipv = Number(tokens[++i]);
    else if (token === 'score') {
      const type = tokens[++i];
      const value = Number(tokens[++i]);
      if ((type === 'cp' || type === 'mate') && Number.isFinite(value)) score = { type, value };
      // Skip "lowerbound"/"upperbound" markers.
      if (tokens[i + 1] === 'lowerbound' || tokens[i + 1] === 'upperbound') i += 1;
    } else if (token === 'pv') {
      pv = tokens.slice(i + 1).filter(Boolean);
      break;
    }
  }
  if (!Number.isFinite(depth) || depth <= 0) return null;
  return { depth, multipv, score, pv };
}

/** Parse `bestmove e2e4 [ponder e7e5]`. `(none)` (no legal moves) gives null. */
export function parseBestMove(line: string): { move: string | null } | null {
  const match = /^bestmove\s+(\S+)/.exec(line);
  if (!match) return null;
  const move = match[1] ?? '';
  return { move: /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : null };
}
