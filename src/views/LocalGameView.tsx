import { useEffect, useState } from 'react';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../components/Button.tsx';
import { PlayerBar, ResultCard, statusText } from '../components/GameParts.tsx';
import { MoveList } from '../components/MoveList.tsx';
import { openAnalysis } from '../components/openAnalysis.ts';
import { useStore } from '../components/useStore.ts';
import { opposite, type Color, type GameResult, type MoveInput } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { LocalMatch, TIME_PRESETS, type TimePreset } from '../state/index.ts';

const STORAGE_KEY = 'chess.local.v1';

function loadSavedMatch(): LocalMatch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? LocalMatch.fromJSON(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveMatch(match: LocalMatch): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(match.toJSON()));
  } catch {
    // Storage may be full or blocked; the game still works for this visit.
  }
}

export function LocalGameView() {
  const [match, setMatch] = useState<LocalMatch | null>(loadSavedMatch);
  const [settingUp, setSettingUp] = useState(match === null);
  // A new key per started game resets view state such as orientation.
  const [gameKey, setGameKey] = useState(0);

  if (!match || settingUp) {
    return (
      <SetupPanel
        replacing={match !== null}
        onCancel={match ? () => setSettingUp(false) : null}
        onStart={(preset) => {
          const next = LocalMatch.create({ timeControl: preset.control });
          saveMatch(next);
          setMatch(next);
          setGameKey((key) => key + 1);
          setSettingUp(false);
        }}
      />
    );
  }
  return <LocalGame key={gameKey} match={match} onNewGame={() => setSettingUp(true)} />;
}

function SetupPanel({
  replacing,
  onCancel,
  onStart,
}: {
  replacing: boolean;
  onCancel: (() => void) | null;
  onStart: (preset: TimePreset) => void;
}) {
  const { t } = useI18n();
  const [presetId, setPresetId] = useState<TimePreset['id']>('none');
  const preset = TIME_PRESETS.find((p) => p.id === presetId) ?? TIME_PRESETS[0];

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5" aria-labelledby="setup-heading">
      <h1 id="setup-heading" className="text-2xl font-semibold">
        {t('local.title')} · {t('setup.heading')}
      </h1>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('setup.timeControl')}</legend>
        {TIME_PRESETS.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-felt-raised px-3 py-2 has-[:checked]:border-brass"
          >
            <input
              type="radio"
              name="time-control"
              value={option.id}
              checked={option.id === presetId}
              onChange={() => setPresetId(option.id)}
              className="accent-brass"
            />
            {t(`time.${option.id}`)}
          </label>
        ))}
      </fieldset>
      {replacing && <p className="text-sm text-ivory-muted">{t('setup.replaceWarning')}</p>}
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => preset && onStart(preset)}>
          {t('setup.start')}
        </Button>
        {onCancel && <Button onClick={onCancel}>{t('setup.cancel')}</Button>}
      </div>
    </section>
  );
}

function LocalGame({ match, onNewGame }: { match: LocalMatch; onNewGame: () => void }) {
  const { t } = useI18n();
  const snapshot = useStore(match.store);
  const [orientation, setOrientation] = useState<Color>('w');
  const [confirmResign, setConfirmResign] = useState(false);
  const [dismissedResult, setDismissedResult] = useState<GameResult | null>(null);

  useEffect(() => match.store.subscribe(() => saveMatch(match)), [match]);

  const clockRunning = snapshot.clock?.running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => match.tick(), 200);
    return () => window.clearInterval(id);
  }, [match, clockRunning]);

  const { result, turn } = snapshot;
  const color = (c: Color) => t(`color.${c}`);
  const onMove = (move: MoveInput) => {
    setConfirmResign(false);
    match.play(move);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-11rem))] flex-col gap-2">
        <PlayerBar snapshot={snapshot} color={opposite(orientation)} />
        <div className="relative overflow-hidden rounded-md shadow-2xl shadow-black/40">
          <ChessBoard
            pieces={snapshot.pieces}
            orientation={orientation}
            legalMoves={snapshot.legalMoves}
            lastMove={snapshot.lastMove}
            checkSquare={snapshot.checkSquare}
            onMove={onMove}
          />
          {result && result !== dismissedResult && (
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
              <Button onClick={() => setDismissedResult(result)}>{t('action.close')}</Button>
            </ResultCard>
          )}
        </div>
        <PlayerBar snapshot={snapshot} color={orientation} />
      </div>

      <aside className="flex flex-col gap-4">
        <p className="text-lg font-medium" role="status" data-testid="status">
          {statusText(t, snapshot)}
        </p>

        {!result && snapshot.drawOffer && (
          <div
            className="flex flex-col gap-2 rounded-md border border-brass/50 bg-brass/10 p-3 text-sm"
            data-testid="draw-offer"
          >
            <p>
              {t('draw.offered', { color: color(snapshot.drawOffer) })} {t('draw.declineHint')}
            </p>
            <Button variant="primary" onClick={() => match.acceptDraw()}>
              {t('action.acceptDraw', { color: color(opposite(snapshot.drawOffer)) })}
            </Button>
          </div>
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
          <Button onClick={() => match.undo()} disabled={!snapshot.canUndo}>
            {t('action.undo')}
          </Button>
          <Button onClick={() => setOrientation(opposite(orientation))}>{t('action.flip')}</Button>
          {!result && (
            <>
              <Button onClick={() => match.offerDraw()} disabled={snapshot.drawOffer !== null}>
                {t('action.offerDraw')}
              </Button>
              <Button variant="danger" onClick={() => setConfirmResign(true)}>
                {t('action.resign')}
              </Button>
            </>
          )}
          <Button onClick={onNewGame}>{t('action.newGame')}</Button>
        </div>

        {confirmResign && !result && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-400/40 p-3 text-sm">
            <span className="mr-auto">{t('action.resignConfirm', { color: color(turn) })}</span>
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
