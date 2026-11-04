import { useEffect, useMemo, useState } from 'react';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../components/Button.tsx';
import { PlayerBar, ResultCard, statusText } from '../components/GameParts.tsx';
import { MoveList } from '../components/MoveList.tsx';
import { openAnalysis } from '../components/openAnalysis.ts';
import { useStore } from '../components/useStore.ts';
import { opposite, type Color, type GameResult } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import {
  ComputerMatch,
  LEVELS,
  TIME_PRESETS,
  getEngine,
  type EngineFactory,
  type TimePreset,
} from '../state/index.ts';

const STORAGE_KEY = 'chess.computer.v1';

function save(match: ComputerMatch): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match.toJSON()));
  } catch {
    // The game still works for this visit.
  }
}

function load(engine: EngineFactory): ComputerMatch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? ComputerMatch.fromJSON(getEngine(engine), JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function ComputerGameView({ engine }: { engine: EngineFactory }) {
  const [match, setMatch] = useState<ComputerMatch | null>(() => load(engine));
  const [settingUp, setSettingUp] = useState(match === null);
  const [gameKey, setGameKey] = useState(0);

  if (!match || settingUp) {
    return (
      <Setup
        onCancel={match ? () => setSettingUp(false) : null}
        onStart={(humanColor, level, timeControl) => {
          match?.dispose();
          const settings = { humanColor, level, timeControl };
          const next = ComputerMatch.create(getEngine(engine), settings);
          save(next);
          setMatch(next);
          setGameKey((key) => key + 1);
          setSettingUp(false);
        }}
      />
    );
  }
  return <Game key={gameKey} match={match} onNewGame={() => setSettingUp(true)} />;
}

function Setup({
  onStart,
  onCancel,
}: {
  onStart: (humanColor: Color, level: number, timeControl: TimePreset['control']) => void;
  onCancel: (() => void) | null;
}) {
  const { t } = useI18n();
  const [color, setColor] = useState<Color | 'random'>('w');
  const [level, setLevel] = useState(3);
  const [presetId, setPresetId] = useState<TimePreset['id']>('none');
  const preset = TIME_PRESETS.find((option) => option.id === presetId);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5" aria-labelledby="computer-setup">
      <h1 id="computer-setup" className="text-2xl font-semibold">
        {t('computer.title')} · {t('setup.heading')}
      </h1>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('online.yourColor')}</legend>
        {(['w', 'b', 'random'] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-felt-raised px-3 py-2 has-[:checked]:border-brass"
          >
            <input
              type="radio"
              name="computer-color"
              checked={option === color}
              onChange={() => setColor(option)}
              className="accent-brass"
            />
            {t(`online.color.${option}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('computer.level')}</legend>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-felt-raised px-2 py-2 has-[:checked]:border-brass"
            >
              <input
                type="radio"
                name="computer-level"
                checked={option.id === level}
                onChange={() => setLevel(option.id)}
                className="accent-brass"
                aria-label={t('computer.levelN', { n: option.id })}
              />
              {option.id}
            </label>
          ))}
        </div>
        <p className="text-sm text-ivory-muted">{t('computer.levelHint')}</p>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('setup.timeControl')}</legend>
        {TIME_PRESETS.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-felt-raised px-3 py-2"
          >
            <input
              type="radio"
              name="computer-time"
              value={option.id}
              checked={option.id === presetId}
              onChange={() => setPresetId(option.id)}
              className="accent-brass"
            />
            {t(`time.${option.id}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={() =>
            onStart(
              color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color,
              level,
              preset?.control ?? null,
            )
          }
        >
          {t('setup.start')}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t('setup.cancel')}</Button>}
      </div>
    </section>
  );
}

function Game({ match, onNewGame }: { match: ComputerMatch; onNewGame: () => void }) {
  const { t } = useI18n();
  const snapshot = useStore(match.store);
  const [orientation, setOrientation] = useState<Color>(snapshot.humanColor);
  const [confirmResign, setConfirmResign] = useState(false);
  const [dismissed, setDismissed] = useState<GameResult | null>(null);

  useEffect(() => {
    const unsubscribe = match.store.subscribe(() => save(match));
    match.start();
    return unsubscribe;
  }, [match]);

  const clockRunning = snapshot.clock?.running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => match.tick(), 200);
    return () => window.clearInterval(id);
  }, [match, clockRunning]);

  const arrows = useMemo(() => (snapshot.hint ? [snapshot.hint] : []), [snapshot.hint]);
  const { result, humanColor } = snapshot;
  const note = (c: Color) =>
    c === humanColor ? t('computer.you') : t('computer.engine', { n: snapshot.level });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-11rem))] flex-col gap-2">
        <PlayerBar
          snapshot={snapshot}
          color={opposite(orientation)}
          note={note(opposite(orientation))}
        />
        <div className="relative overflow-hidden rounded-md shadow-2xl shadow-black/40">
          <ChessBoard
            pieces={snapshot.pieces}
            orientation={orientation}
            legalMoves={snapshot.legalMoves}
            lastMove={snapshot.lastMove}
            checkSquare={snapshot.checkSquare}
            onMove={(move) => {
              setConfirmResign(false);
              match.play(move);
            }}
            arrows={arrows}
          />
          {result && result !== dismissed && (
            <ResultCard result={result}>
              {snapshot.analysis && (
                <Button
                  variant="primary"
                  onClick={() => snapshot.analysis && openAnalysis(snapshot.analysis)}
                >
                  {t('action.analyze')}
                </Button>
              )}
              <Button onClick={onNewGame}>{t('action.newGame')}</Button>
              <Button onClick={() => setDismissed(result)}>{t('action.close')}</Button>
            </ResultCard>
          )}
        </div>
        <PlayerBar snapshot={snapshot} color={orientation} note={note(orientation)} />
      </div>

      <aside className="flex flex-col gap-4">
        <p className="text-lg font-medium" role="status" data-testid="status">
          {statusText(t, snapshot)}
        </p>
        {snapshot.thinking && (
          <p className="animate-pulse text-sm text-ivory-muted" data-testid="thinking">
            {t('computer.thinking')}
          </p>
        )}

        {snapshot.drawClaim && (
          <div
            className="flex flex-col gap-2 rounded-md border border-brass/50 bg-brass/10 p-3 text-sm"
            data-testid="draw-claim"
          >
            <p>{t(`claim.${snapshot.drawClaim}`)}</p>
            <Button variant="primary" onClick={() => match.claimDraw()}>
              {t('action.claimDraw')}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!result && (
            <Button onClick={() => void match.hint()} disabled={snapshot.legalMoves.length === 0}>
              {t('action.hint')}
            </Button>
          )}
          <Button onClick={() => match.undo()} disabled={!snapshot.canUndo}>
            {t('action.undo')}
          </Button>
          <Button onClick={() => setOrientation(opposite(orientation))}>{t('action.flip')}</Button>
          {!result && (
            <Button variant="danger" onClick={() => setConfirmResign(true)}>
              {t('action.resign')}
            </Button>
          )}
          {snapshot.analysis && (
            <Button onClick={() => snapshot.analysis && openAnalysis(snapshot.analysis)}>
              {t('action.analyze')}
            </Button>
          )}
          <Button onClick={onNewGame}>{t('action.newGame')}</Button>
        </div>

        {confirmResign && !result && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-400/40 p-3 text-sm">
            <span className="mr-auto">
              {t('action.resignConfirm', { color: t(`color.${humanColor}`) })}
            </span>
            <Button
              variant="danger"
              onClick={() => {
                match.resign();
                setConfirmResign(false);
              }}
            >
              {t('action.confirm')}
            </Button>
            <Button onClick={() => setConfirmResign(false)}>{t('action.cancel')}</Button>
          </div>
        )}

        <section aria-labelledby="moves-heading" className="flex flex-col gap-2">
          <h2 id="moves-heading" className="text-sm text-ivory-muted">
            {t('moves.heading')}
          </h2>
          <MoveList moves={snapshot.history} />
        </section>
      </aside>
    </div>
  );
}
