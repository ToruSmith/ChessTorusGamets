import { useEffect, useMemo, useState } from 'react';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../components/Button.tsx';
import { resultTitle } from '../components/GameParts.tsx';
import { ANALYSIS_STORAGE_KEY } from '../components/openAnalysis.ts';
import { useStore } from '../components/useStore.ts';
import { Game, opposite, type Color, type Square } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import {
  AnalysisSession,
  getEngine,
  parseAnalysisRequest,
  type AnalysisSnapshot,
  type EngineFactory,
  type MoveJudgement,
} from '../state/index.ts';

const MARKS: Partial<Record<MoveJudgement, { symbol: string; className: string }>> = {
  inaccuracy: { symbol: '?!', className: 'text-yellow-300' },
  mistake: { symbol: '?', className: 'text-orange-400' },
  blunder: { symbol: '??', className: 'text-red-400' },
};

function loadRequest() {
  try {
    const raw = localStorage.getItem(ANALYSIS_STORAGE_KEY);
    return raw ? parseAnalysisRequest(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function AnalysisView({ engine }: { engine: EngineFactory }) {
  const { t } = useI18n();
  const [request] = useState(loadRequest);
  if (!request) {
    return (
      <p
        className="mx-auto max-w-md rounded-md border border-white/10 bg-felt-raised p-4"
        data-testid="analysis-empty"
      >
        {t('analysis.empty')}
      </p>
    );
  }
  return <Review engine={engine} request={request} />;
}

function Review({
  engine,
  request,
}: {
  engine: EngineFactory;
  request: NonNullable<ReturnType<typeof parseAnalysisRequest>>;
}) {
  const { t } = useI18n();
  const session = useMemo(() => new AnalysisSession(getEngine(engine), request), [engine, request]);
  useEffect(() => {
    void session.start();
    return () => session.dispose();
  }, [session]);
  const snapshot = useStore(session.store);
  const [orientation, setOrientation] = useState<Color>('w');

  const { index, positions, evals, moves } = snapshot;
  const position = positions[index];
  const evaluation = evals[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const moves: Record<string, number> = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        Home: 0,
        End: positions.length - 1,
      };
      const target = moves[event.key];
      if (target !== undefined) {
        event.preventDefault();
        session.goTo(target);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, index, positions.length]);

  const best = evaluation?.best ?? null;
  const arrows = best ? [{ from: best.slice(0, 2) as Square, to: best.slice(2, 4) as Square }] : [];
  const bestSan = useMemo(() => {
    if (!best || !position) return null;
    try {
      return new Game(position.fen).findLegal(best)?.san ?? null;
    } catch {
      return null;
    }
  }, [best, position]);

  if (!position) return null;
  const whiteWin = evaluation?.win ?? 50;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-11rem))] flex-col gap-3">
        <div className="flex gap-2">
          <EvalBar
            whiteWin={whiteWin}
            orientation={orientation}
            label={t('analysis.whiteWin', { percent: Math.round(whiteWin) })}
          />
          <div className="flex-1 overflow-hidden rounded-md shadow-2xl shadow-black/40">
            <ChessBoard
              pieces={position.pieces}
              orientation={orientation}
              legalMoves={[]}
              lastMove={position.lastMove}
              checkSquare={position.checkSquare}
              onMove={() => undefined}
              arrows={arrows}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2" role="toolbar">
          <Button onClick={() => session.goTo(0)} aria-label={t('analysis.first')}>
            ⏮
          </Button>
          <Button onClick={() => session.goTo(index - 1)} aria-label={t('analysis.prev')}>
            ◀
          </Button>
          <Button onClick={() => session.goTo(index + 1)} aria-label={t('analysis.next')}>
            ▶
          </Button>
          <Button
            onClick={() => session.goTo(positions.length - 1)}
            aria-label={t('analysis.last')}
          >
            ⏭
          </Button>
          <Button onClick={() => setOrientation(opposite(orientation))}>{t('action.flip')}</Button>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{t('analysis.title')}</h1>
        <p className="text-ivory-muted">
          {resultTitle(t, snapshot.result)} · {t(`reason.${snapshot.result.reason}`)}
        </p>
        {snapshot.openings[index] && (
          <p className="text-sm" data-testid="analysis-opening">
            {t('analysis.opening', {
              name: snapshot.openings[index]?.name ?? '',
              eco: snapshot.openings[index]?.eco ?? '',
            })}
          </p>
        )}
        <p className="text-sm" data-testid="analysis-progress">
          {snapshot.done
            ? t('analysis.done')
            : t('analysis.progress', { percent: Math.round(snapshot.progress * 100) })}
        </p>
        <EvalGraph
          snapshot={snapshot}
          onSelect={(i) => session.goTo(i)}
          label={t('analysis.graph')}
        />
        <p className="text-sm" data-testid="analysis-eval">
          {evaluation
            ? evaluation.mate !== null
              ? t('analysis.mate', {
                  side: t(`color.${evaluation.mate > 0 ? 'w' : 'b'}`),
                  n: Math.abs(evaluation.mate),
                })
              : t('analysis.whiteWin', { percent: Math.round(evaluation.win) })
            : '…'}
          {bestSan && (
            <span className="ml-2 text-ivory-muted" data-testid="analysis-best">
              {t('analysis.best', { move: bestSan })}
            </span>
          )}
        </p>
        <dl
          className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"
          data-testid="analysis-summary"
        >
          {(['w', 'b'] as const).map((color) => (
            <div key={color} className="contents">
              <dt>{t(`color.${color}`)}</dt>
              <dd className="text-ivory-muted">{t('analysis.summary', snapshot.summary[color])}</dd>
            </div>
          ))}
        </dl>
        <ol
          className="grid max-h-80 grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto text-sm"
          data-testid="analysis-moves"
        >
          <li className="contents">
            <span />
            <button
              type="button"
              className={`col-span-2 text-left ${index === 0 ? 'text-brass' : 'text-ivory-muted'}`}
              onClick={() => session.goTo(0)}
            >
              {t('analysis.start')}
            </button>
          </li>
          {pairs(moves.length, moves[0]?.color === 'b').map(({ number, white, black }) => (
            <li key={number} className="contents">
              <span className="text-ivory-muted tabular-nums">{number}.</span>
              {[white, black].map((moveIndex, column) =>
                moveIndex === null ? (
                  <span key={column}>{column === 0 ? '…' : ''}</span>
                ) : (
                  <MoveButton
                    key={column}
                    san={moves[moveIndex]?.san ?? ''}
                    judgement={snapshot.judgements[moveIndex] ?? null}
                    active={index === moveIndex + 1}
                    onClick={() => session.goTo(moveIndex + 1)}
                    label={(j) => t(`judgement.${j}`)}
                  />
                ),
              )}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function pairs(count: number, blackFirst: boolean) {
  const rows: { number: number; white: number | null; black: number | null }[] = [];
  const offset = blackFirst ? 1 : 0;
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor((i + offset) / 2);
    rows[row] ??= { number: row + 1, white: null, black: null };
    if ((i + offset) % 2 === 0) rows[row].white = i;
    else rows[row].black = i;
  }
  return rows;
}

function MoveButton({
  san,
  judgement,
  active,
  onClick,
  label,
}: {
  san: string;
  judgement: MoveJudgement | null;
  active: boolean;
  onClick: () => void;
  label: (judgement: MoveJudgement) => string;
}) {
  const mark = judgement ? MARKS[judgement] : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      data-judgement={judgement ?? ''}
      title={judgement ? label(judgement) : undefined}
      className={`rounded px-1 text-left ${active ? 'bg-brass text-felt' : 'hover:bg-white/10'}`}
    >
      {san}
      {mark && (
        <span className={`ml-0.5 font-semibold ${active ? '' : mark.className}`}>
          {mark.symbol}
        </span>
      )}
    </button>
  );
}

function EvalBar({
  whiteWin,
  orientation,
  label,
}: {
  whiteWin: number;
  orientation: Color;
  label: string;
}) {
  const white = `${whiteWin}%`;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(whiteWin)}
      className={`relative w-3 shrink-0 overflow-hidden rounded bg-[#2c2621] sm:w-4 ${orientation === 'b' ? 'rotate-180' : ''}`}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-ivory transition-[height] duration-300"
        style={{ height: white }}
      />
    </div>
  );
}

function EvalGraph({
  snapshot,
  onSelect,
  label,
}: {
  snapshot: AnalysisSnapshot;
  onSelect: (index: number) => void;
  label: string;
}) {
  const width = 300;
  const height = 80;
  const count = Math.max(1, snapshot.positions.length - 1);
  const points = snapshot.evals
    .map((evaluation, i) =>
      evaluation ? `${(i / count) * width},${height - (evaluation.win / 100) * height}` : null,
    )
    .filter(Boolean)
    .join(' ');
  const x = (snapshot.index / count) * width;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full cursor-pointer rounded bg-[#2c2621]"
      role="img"
      aria-label={label}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        onSelect(Math.round(((event.clientX - box.left) / box.width) * count));
      }}
    >
      {points && (
        <polygon
          points={`0,${height} ${points} ${((snapshot.evals.filter(Boolean).length - 1) / count) * width},${height}`}
          fill="#f3ead6"
          opacity={0.85}
        />
      )}
      <line
        x1={0}
        x2={width}
        y1={height / 2}
        y2={height / 2}
        stroke="#c9a24a"
        strokeOpacity={0.5}
        strokeDasharray="4 4"
      />
      <line x1={x} x2={x} y1={0} y2={height} stroke="#c9a24a" strokeWidth={2} />
    </svg>
  );
}
