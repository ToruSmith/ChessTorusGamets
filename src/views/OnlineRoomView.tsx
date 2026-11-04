import { useEffect, useMemo, useState } from 'react';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../components/Button.tsx';
import { PlayerBar, ResultCard, statusText } from '../components/GameParts.tsx';
import { MoveList } from '../components/MoveList.tsx';
import { useStore } from '../components/useStore.ts';
import { opposite, type Color, type GameResult, type MoveInput } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { OnlineConfig, OnlineMatch, OnlineService } from '../state/index.ts';
import { OnlineGate, goToRoom, timeControlLabel } from './OnlineLobbyView.tsx';

export function OnlineRoomView({ config, code }: { config: OnlineConfig | null; code: string }) {
  return (
    <OnlineGate config={config}>
      {(service) => <Room key={code} service={service} code={code} />}
    </OnlineGate>
  );
}

function Room({ service, code }: { service: OnlineService; code: string }) {
  const match = useMemo(() => service.open(code), [service, code]);
  useEffect(() => {
    match.start();
    return () => match.dispose();
  }, [match]);
  const snapshot = useStore(match.store);
  const { t } = useI18n();

  // Both players follow the link to the rematch room.
  useEffect(() => {
    if (snapshot.next && snapshot.seat) goToRoom(snapshot.next);
  }, [snapshot.next, snapshot.seat]);

  if (snapshot.phase === 'loading') return <p>{t('online.connecting')}</p>;
  if (snapshot.phase === 'missing') {
    return (
      <div className="flex flex-col items-start gap-3" data-testid="room-missing">
        <p>{t('room.missing')}</p>
        <a href="#/online" className="underline underline-offset-4">
          {t('online.backToLobby')}
        </a>
      </div>
    );
  }
  if (snapshot.phase === 'waiting') return <Waiting match={match} />;
  return <Game match={match} />;
}

function Waiting({ match }: { match: OnlineMatch }) {
  const { t } = useI18n();
  const snapshot = useStore(match.store);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}#/r/${snapshot.code}`;
  const room = snapshot.room;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4" data-testid="room-waiting">
      <h1 className="font-mono text-2xl tracking-widest">
        {t('room.code', { code: snapshot.code })}
      </h1>
      {room && (
        <p className="text-ivory-muted">
          {timeControlLabel(t, room.config.initialMs > 0 ? room.config : null)}
        </p>
      )}
      {snapshot.seat ? (
        <>
          <p>{t('room.share')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="max-w-full truncate rounded bg-black/30 px-2 py-1 text-sm"
              data-testid="room-link"
            >
              {link}
            </code>
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(link).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? t('room.copied') : t('room.copy')}
            </Button>
          </div>
          <p className="animate-pulse text-ivory-muted">{t('room.waiting')}</p>
        </>
      ) : snapshot.canJoin ? (
        <>
          <p>{t('room.joinPrompt')}</p>
          <Button variant="primary" className="self-start" onClick={() => void match.join()}>
            {t('room.joinButton')}
          </Button>
        </>
      ) : null}
      {snapshot.error && <p className="text-sm text-red-300">{t('room.writeFailed')}</p>}
    </section>
  );
}

function Game({ match }: { match: OnlineMatch }) {
  const { t } = useI18n();
  const snapshot = useStore(match.store);
  const game = snapshot.match;
  const seat = snapshot.seat;
  const [orientation, setOrientation] = useState<Color>(seat ?? 'w');
  const [pendingClaim, setPendingClaim] = useState<MoveInput | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [dismissed, setDismissed] = useState<GameResult | null>(null);

  const clockRunning = game?.clock?.running ?? false;
  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => match.tick(), 250);
    return () => window.clearInterval(id);
  }, [match, clockRunning]);

  if (!game) return null;
  const result = game.result;
  const color = (c: Color) => t(`color.${c}`);
  const note = (c: Color) => (c === seat ? t('room.you') : undefined);

  const onMove = (move: MoveInput) => {
    setConfirmResign(false);
    if (match.claimAfter(move)) setPendingClaim(move);
    else void match.play(move);
  };

  const claimReason = pendingClaim ? match.claimAfter(pendingClaim) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-11rem))] flex-col gap-2">
        <PlayerBar
          snapshot={game}
          color={opposite(orientation)}
          note={note(opposite(orientation))}
        />
        <div className="relative overflow-hidden rounded-md shadow-2xl shadow-black/40">
          <ChessBoard
            pieces={game.pieces}
            orientation={orientation}
            legalMoves={pendingClaim ? [] : game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            onMove={onMove}
          />
          {result && result !== dismissed && (
            <ResultCard result={result}>
              {seat && <RematchButton match={match} />}
              <Button onClick={() => setDismissed(result)}>{t('action.close')}</Button>
            </ResultCard>
          )}
        </div>
        <PlayerBar snapshot={game} color={orientation} note={note(orientation)} />
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-medium" role="status" data-testid="status">
            {statusText(t, game)}
          </p>
          <span className="font-mono text-sm text-ivory-muted">
            {t('room.code', { code: snapshot.code })}
          </span>
        </div>
        {!seat && (
          <p className="text-sm text-ivory-muted" data-testid="spectating">
            {t('room.spectating')}
          </p>
        )}
        {!snapshot.analysisAllowed && seat && (
          <p className="text-xs text-ivory-muted">{t('room.noAnalysis')}</p>
        )}

        {pendingClaim && claimReason && (
          <div
            className="flex flex-col gap-2 rounded-md border border-brass/50 bg-brass/10 p-3 text-sm"
            data-testid="claim-with-move"
          >
            <p>{t('room.claimWithMove', { reason: t(`reason.${claimReason}`) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  void match.play(pendingClaim, { claimDraw: true });
                  setPendingClaim(null);
                }}
              >
                {t('room.claimAndMove')}
              </Button>
              <Button
                onClick={() => {
                  void match.play(pendingClaim);
                  setPendingClaim(null);
                }}
              >
                {t('room.moveOnly')}
              </Button>
              <Button onClick={() => setPendingClaim(null)}>{t('action.cancel')}</Button>
            </div>
          </div>
        )}

        {!result && seat && game.drawOffer === opposite(seat) && (
          <div
            className="flex flex-col gap-2 rounded-md border border-brass/50 bg-brass/10 p-3 text-sm"
            data-testid="draw-offer"
          >
            <p>{t('room.opponentOffered')}</p>
            <Button variant="primary" onClick={() => void match.acceptDraw()}>
              {t('room.acceptDraw')}
            </Button>
          </div>
        )}
        {!result && seat && game.drawOffer === seat && (
          <p className="text-sm text-ivory-muted" data-testid="draw-offer-sent">
            {t('room.offerSent')}
          </p>
        )}

        {game.drawClaim && (
          <div
            className="flex flex-col gap-2 rounded-md border border-brass/50 bg-brass/10 p-3 text-sm"
            data-testid="draw-claim"
          >
            <p>{t(`claim.${game.drawClaim}`)}</p>
            <Button variant="primary" onClick={() => void match.claimDraw()}>
              {t('action.claimDraw')}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOrientation(opposite(orientation))}>{t('action.flip')}</Button>
          {!result && seat && (
            <>
              <Button onClick={() => void match.offerDraw()} disabled={game.drawOffer !== null}>
                {t('action.offerDraw')}
              </Button>
              <Button variant="danger" onClick={() => setConfirmResign(true)}>
                {t('action.resign')}
              </Button>
            </>
          )}
          <a
            href="#/online"
            className="rounded-md border border-white/15 px-3 py-2 text-sm hover:border-brass hover:text-brass"
          >
            {t('online.backToLobby')}
          </a>
        </div>

        {confirmResign && !result && seat && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-400/40 p-3 text-sm">
            <span className="mr-auto">{t('action.resignConfirm', { color: color(seat) })}</span>
            <Button
              variant="danger"
              onClick={() => {
                void match.resign();
                setConfirmResign(false);
              }}
            >
              {t('action.confirm')}
            </Button>
            <Button onClick={() => setConfirmResign(false)}>{t('action.cancel')}</Button>
          </div>
        )}

        {result && seat && <RematchStatus match={match} />}
        {snapshot.error && <p className="text-sm text-red-300">{t('room.writeFailed')}</p>}

        <section aria-labelledby="moves-heading" className="flex flex-col gap-2">
          <h2 id="moves-heading" className="text-sm text-ivory-muted">
            {t('moves.heading')}
          </h2>
          <MoveList moves={game.history} />
        </section>
      </aside>
    </div>
  );
}

function RematchButton({ match }: { match: OnlineMatch }) {
  const { t } = useI18n();
  const snapshot = useStore(match.store);
  const voted = snapshot.seat ? Boolean(snapshot.rematch[snapshot.seat]) : false;
  return (
    <Button variant="primary" disabled={voted} onClick={() => void match.voteRematch()}>
      {t('room.rematch')}
    </Button>
  );
}

function RematchStatus({ match }: { match: OnlineMatch }) {
  const { t } = useI18n();
  const { seat, rematch } = useStore(match.store);
  if (!seat) return null;
  if (rematch[seat])
    return (
      <p className="text-sm text-ivory-muted" data-testid="rematch-status">
        {t('room.rematchWaiting')}
      </p>
    );
  if (rematch[opposite(seat)]) {
    return (
      <div className="flex flex-col gap-2 text-sm" data-testid="rematch-status">
        <p>{t('room.rematchOffered')}</p>
        <RematchButton match={match} />
      </div>
    );
  }
  return null;
}
