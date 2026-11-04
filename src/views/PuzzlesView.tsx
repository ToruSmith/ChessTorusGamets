import { useMemo, useState } from 'react';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../components/Button.tsx';
import {
  Game,
  PUZZLES,
  pickDefence,
  solves,
  type MoveInput,
  type Puzzle,
  type Square,
} from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';

const STORAGE_KEY = 'chess.puzzles.v1';

function loadSolved(): readonly string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveSolved(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Without storage the progress lasts for this visit.
  }
}

type Status = 'playing' | 'wrong' | 'solved';

export function PuzzlesView() {
  const { t } = useI18n();
  const [solved, setSolved] = useState(loadSolved);
  const [index, setIndex] = useState(() => {
    const first = PUZZLES.findIndex((puzzle) => !loadSolved().includes(puzzle.id));
    return Math.max(first, 0);
  });
  const puzzle = PUZZLES[index] as Puzzle;

  const markSolved = () => {
    if (solved.includes(puzzle.id)) return;
    const next = [...solved, puzzle.id];
    setSolved(next);
    saveSolved(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('puzzles.title')}</h1>
      <p className="text-ivory-muted" data-testid="puzzles-progress">
        {t('puzzles.progress', { done: solved.length, total: PUZZLES.length })}
      </p>
      <Board
        key={puzzle.id}
        puzzle={puzzle}
        number={index + 1}
        onSolved={markSolved}
        onNext={() => setIndex((index + 1) % PUZZLES.length)}
      />
    </div>
  );
}

function Board({
  puzzle,
  number,
  onSolved,
  onNext,
}: {
  puzzle: Puzzle;
  number: number;
  onSolved: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const game = useMemo(() => {
    void attempt;
    return new Game(puzzle.fen);
  }, [puzzle, attempt]);
  const [, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [movesLeft, setMovesLeft] = useState<number>(puzzle.mateIn);
  const player = useMemo(() => new Game(puzzle.fen).turn(), [puzzle]);

  const onMove = (input: MoveInput) => {
    if (!solves(game, input, movesLeft)) {
      setStatus('wrong');
      return;
    }
    game.play(input);
    if (game.automaticResult()?.reason === 'checkmate') {
      setStatus('solved');
      onSolved();
    } else {
      const reply = pickDefence(game);
      if (reply) game.play(reply.uci);
      setMovesLeft(movesLeft - 1);
      setStatus('playing');
    }
    setVersion((version) => version + 1);
  };

  const restart = () => {
    setAttempt(attempt + 1);
    setMovesLeft(puzzle.mateIn);
    setStatus('playing');
  };

  const pieces = game.pieces();
  const checkSquare: Square | null = game.inCheck()
    ? (pieces.find((piece) => piece.type === 'k' && piece.color === game.turn())?.square ?? null)
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-13rem))]">
        <ChessBoard
          pieces={pieces}
          orientation={player}
          legalMoves={status === 'solved' ? [] : game.legalMoves()}
          lastMove={game.lastMove}
          checkSquare={checkSquare}
          onMove={onMove}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          {t('puzzles.heading', {
            n: number,
            color: t(`color.${player}`),
            moves: puzzle.mateIn,
          })}
        </h2>
        <p role="status" data-testid="puzzle-status" className="min-h-6 text-ivory-muted">
          {status === 'solved' ? t('puzzles.solved') : ''}
          {status === 'wrong' ? t('puzzles.wrong') : ''}
        </p>
        <div className="flex gap-2">
          <Button onClick={restart}>{t('puzzles.reset')}</Button>
          <Button onClick={onNext}>{t('puzzles.next')}</Button>
        </div>
      </aside>
    </div>
  );
}
