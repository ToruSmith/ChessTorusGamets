// Replays a stored game — moves with timestamps plus appended events — into one result.
// Both online players run this on the same data, so they always reach the same verdict.
import { createClock, isFlagged, pressClock, type ClockState, type TimeControl } from './clock.ts';
import { Game } from './game.ts';
import type { GameResult } from './outcome.ts';
import { STARTING_FEN, opposite, type Color } from './types.ts';
import { parseUci } from './uci.ts';

export interface TimedMove {
  /** UCI, e.g. `e2e4`, `e7e8q`. */
  readonly uci: string;
  /** When the move was made (server time in online play). */
  readonly t: number;
}

export type MatchEventType = 'resign' | 'draw-offer' | 'draw-accept' | 'draw-claim';

export interface MatchEvent {
  readonly type: MatchEventType;
  readonly by: Color;
  /** Number of moves on the board when the event was written. */
  readonly ply: number;
  readonly t: number;
}

export interface MatchRecord {
  readonly startFen?: string;
  /** null for an untimed game. */
  readonly timeControl: TimeControl | null;
  /** When the first player's clock started. */
  readonly startedAt: number;
  readonly moves: readonly TimedMove[];
  readonly events: readonly MatchEvent[];
}

export interface MatchState {
  /** The position after every move that counts. */
  readonly game: Game;
  readonly result: GameResult | null;
  /** null for an untimed game. */
  readonly clock: ClockState | null;
  /** The side with a standing draw offer, if any. */
  readonly drawOffer: Color | null;
}

/**
 * Replay a match record. `now` is used only to detect a flag fall after the last
 * stored move or event; omit it to judge the record alone.
 *
 * Rules applied (FIDE Laws of Chess):
 * - A move or event at or after the running clock's deadline does not count; the
 *   player whose clock ran out loses, or draws under 6.9.
 * - A stored move that is not legal loses for the player who made it.
 * - Resignation ends the game at once (5.1.2).
 * - A draw offer stands until the opponent accepts it or makes a move (9.1.2). Offers
 *   from both sides amount to agreement.
 * - A draw claim (9.2, 9.3) counts when the claimant is to move and the position
 *   qualifies, or when it was written together with the claimant's own move (same
 *   ply and timestamp) that produced a qualifying position. A wrong claim is ignored.
 */
export function replayMatch(record: MatchRecord, now?: number): MatchState {
  const game = new Game(record.startFen ?? STARTING_FEN);
  const control = record.timeControl;
  let clock: ClockState | null = control
    ? createClock(control, record.startedAt, game.turn())
    : null;
  let result: GameResult | null = null;
  let drawOffer: Color | null = null;

  const eventsAtPly = new Map<number, MatchEvent[]>();
  for (const event of record.events) {
    const list = eventsAtPly.get(event.ply) ?? [];
    list.push(event);
    eventsAtPly.set(event.ply, list);
  }
  for (const list of eventsAtPly.values()) list.sort((a, b) => a.t - b.t);

  const flagFell = (t: number): boolean => {
    if (!clock || !isFlagged(clock, t)) return false;
    result = game.timeoutResult(clock.turn);
    return true;
  };

  const applyEvent = (event: MatchEvent): void => {
    switch (event.type) {
      case 'resign':
        result = { winner: opposite(event.by), reason: 'resignation', ply: game.ply };
        return;
      case 'draw-offer':
        if (drawOffer === null) drawOffer = event.by;
        else if (drawOffer !== event.by)
          result = { winner: null, reason: 'agreement', ply: game.ply };
        return;
      case 'draw-accept':
        if (drawOffer !== null && drawOffer !== event.by) {
          result = { winner: null, reason: 'agreement', ply: game.ply };
        }
        return;
      case 'draw-claim': {
        const reason = game.drawClaimReason();
        if (!reason) return;
        const last = game.lastMove;
        const lastTime = record.moves[game.ply - 1]?.t;
        const claimantToMove = event.by === game.turn();
        const claimedWithMove = last !== null && last.color === event.by && lastTime === event.t;
        if (claimantToMove || claimedWithMove) result = { winner: null, reason, ply: game.ply };
        return;
      }
    }
  };

  const processEvents = (ply: number): void => {
    for (const event of eventsAtPly.get(ply) ?? []) {
      if (result || flagFell(event.t)) return;
      applyEvent(event);
    }
  };

  for (const [index, timed] of record.moves.entries()) {
    processEvents(index);
    if (result || flagFell(timed.t)) break;

    const input = parseUci(timed.uci);
    const mover = game.turn();
    if (!input || !game.isLegal(input)) {
      result = { winner: opposite(mover), reason: 'illegal-move', ply: game.ply };
      break;
    }
    game.play(input);
    if (clock && control) clock = pressClock(clock, control, timed.t);
    if (drawOffer !== null && drawOffer !== mover) drawOffer = null;

    result = game.automaticResult();
    if (result) break;
  }

  if (!result) processEvents(game.ply);
  if (!result && now !== undefined) flagFell(now);

  return { game, result, clock, drawOffer: result ? null : drawOffer };
}
