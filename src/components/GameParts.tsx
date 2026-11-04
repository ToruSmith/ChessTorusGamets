// Pieces of the play screen shared by local and online games.
import type { ReactNode } from 'react';
import type { Color, GameResult } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { MatchSnapshot } from '../state/index.ts';
import { ClockFace } from './ClockFace.tsx';

export function PlayerBar({
  snapshot,
  color,
  note,
}: {
  snapshot: MatchSnapshot;
  color: Color;
  /** Extra text after the colour, e.g. "(you)". */
  note?: string | undefined;
}) {
  const { t } = useI18n();
  const toMove = !snapshot.result && snapshot.turn === color;
  return (
    <div className="flex items-center justify-between gap-3" data-player={color}>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block size-3 rounded-full border border-black/40 ${color === 'w' ? 'bg-ivory' : 'bg-[#2c2621]'} ${toMove ? 'ring-2 ring-brass ring-offset-2 ring-offset-felt' : ''}`}
        />
        {t(`color.${color}`)}
        {note && <span className="text-sm text-ivory-muted">{note}</span>}
      </span>
      {snapshot.clock && <ClockFace clock={snapshot.clock} color={color} />}
    </div>
  );
}

export function resultTitle(t: ReturnType<typeof useI18n>['t'], result: GameResult): string {
  if (result.reason === 'unfinished') return t('reason.unfinished');
  return result.winner ? t('result.win', { color: t(`color.${result.winner}`) }) : t('result.draw');
}

/** Overlay on the board announcing the result; actions go in `children`. */
export function ResultCard({ result, children }: { result: GameResult; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="result-title"
        data-testid="result"
        className="flex w-full max-w-xs flex-col items-center gap-3 rounded-lg border border-brass/60 bg-felt p-5 text-center shadow-xl"
      >
        <h2 id="result-title" className="text-2xl font-semibold">
          {resultTitle(t, result)}
        </h2>
        <p className="text-ivory-muted">{t(`reason.${result.reason}`)}</p>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

/** The line under the board title: whose turn, check, or the result. */
export function statusText(t: ReturnType<typeof useI18n>['t'], snapshot: MatchSnapshot): string {
  const color = (c: Color) => t(`color.${c}`);
  if (snapshot.result)
    return `${resultTitle(t, snapshot.result)} · ${t(`reason.${snapshot.result.reason}`)}`;
  return snapshot.checkSquare
    ? t('status.check', { color: color(snapshot.turn) })
    : t('status.toMove', { color: color(snapshot.turn) });
}
