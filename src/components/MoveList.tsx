import { useEffect, useRef } from 'react';
import type { Move } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';

/** Moves in pairs: 1. e4 e5  2. Nf3 … Assumes the game started with White to move. */
export function MoveList({
  moves,
  firstMoveNumber = 1,
}: {
  moves: readonly Move[];
  firstMoveNumber?: number;
}) {
  const { t } = useI18n();
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [moves.length]);

  if (moves.length === 0) return <p className="text-sm text-ivory-muted">{t('moves.empty')}</p>;

  const offset = moves[0]?.color === 'b' ? 1 : 0;
  const rows: { number: number; white?: Move; black?: Move }[] = [];
  moves.forEach((move, index) => {
    const row = Math.floor((index + offset) / 2);
    rows[row] ??= { number: firstMoveNumber + row };
    if (move.color === 'w') rows[row].white = move;
    else rows[row].black = move;
  });

  return (
    <ol
      className="grid max-h-64 grid-cols-[2.5rem_1fr_1fr] gap-x-2 overflow-y-auto text-sm"
      data-testid="move-list"
    >
      {rows.map((row, index) => (
        <li key={row.number} ref={index === rows.length - 1 ? end : undefined} className="contents">
          <span className="text-ivory-muted tabular-nums">{row.number}.</span>
          <span data-san>{row.white?.san ?? '…'}</span>
          <span data-san>{row.black?.san ?? ''}</span>
        </li>
      ))}
    </ol>
  );
}
