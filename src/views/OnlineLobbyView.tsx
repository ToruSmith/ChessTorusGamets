import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../components/Button.tsx';
import { useOnlineService } from '../components/useOnlineService.ts';
import type { Color, TimeControl } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import {
  TIME_PRESETS,
  normalizeRoomCode,
  type LobbyRoom,
  type OnlineConfig,
  type OnlineService,
  type TimePreset,
} from '../state/index.ts';

export function goToRoom(code: string): void {
  window.location.hash = `#/r/${code}`;
}

export function OnlineGate({
  config,
  children,
}: {
  config: OnlineConfig | null;
  children: (service: OnlineService) => ReactNode;
}) {
  const { t } = useI18n();
  const state = useOnlineService(config);
  if (state.status === 'unconfigured') {
    return <Notice testId="online-unconfigured">{t('online.notConfigured')}</Notice>;
  }
  if (state.status === 'connecting') return <Notice>{t('online.connecting')}</Notice>;
  if (state.status === 'failed') return <Notice>{t('online.connectFailed')}</Notice>;
  return <>{children(state.service)}</>;
}

function Notice({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      className="mx-auto max-w-md rounded-md border border-white/10 bg-felt-raised p-4"
      data-testid={testId}
    >
      {children}
    </p>
  );
}

export function timeControlLabel(
  t: ReturnType<typeof useI18n>['t'],
  control: TimeControl | null,
): string {
  const preset = TIME_PRESETS.find(
    (p) =>
      p.control?.initialMs === control?.initialMs &&
      p.control?.incrementMs === control?.incrementMs,
  );
  if (preset) return t(`time.${preset.id}`);
  if (!control) return t('time.none');
  return `${control.initialMs / 60_000}+${control.incrementMs / 1000}`;
}

export function OnlineLobbyView({ config }: { config: OnlineConfig | null }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('online.title')}</h1>
      <OnlineGate config={config}>{(service) => <Lobby service={service} />}</OnlineGate>
    </div>
  );
}

function Lobby({ service }: { service: OnlineService }) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <CreateRoom service={service} />
      <div className="flex flex-col gap-8">
        <JoinByCode />
        <OpenRooms service={service} />
      </div>
    </div>
  );
}

function CreateRoom({ service }: { service: OnlineService }) {
  const { t } = useI18n();
  const [presetId, setPresetId] = useState<TimePreset['id']>('10+0');
  const [color, setColor] = useState<Color | 'random'>('random');
  const [isPublic, setPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const preset = TIME_PRESETS.find((p) => p.id === presetId);
      const code = await service.createRoom({
        timeControl: preset?.control ?? null,
        color,
        public: isPublic,
      });
      goToRoom(code);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-labelledby="create-heading">
      <h2 id="create-heading" className="text-lg font-medium">
        {t('online.create')}
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('setup.timeControl')}</legend>
        {TIME_PRESETS.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-felt-raised px-3 py-2 has-[:checked]:border-brass"
          >
            <input
              type="radio"
              name="online-time"
              checked={option.id === presetId}
              onChange={() => setPresetId(option.id)}
              className="accent-brass"
            />
            {t(`time.${option.id}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm text-ivory-muted">{t('online.yourColor')}</legend>
        {(['w', 'b', 'random'] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-felt-raised px-3 py-2 has-[:checked]:border-brass"
          >
            <input
              type="radio"
              name="online-color"
              checked={option === color}
              onChange={() => setColor(option)}
              className="accent-brass"
            />
            {t(`online.color.${option}`)}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setPublic(event.target.checked)}
          className="accent-brass"
        />
        {t('online.public')}
      </label>
      {failed && <p className="text-sm text-red-300">{t('room.writeFailed')}</p>}
      <Button type="submit" variant="primary" disabled={busy} className="self-start">
        {t('online.createButton')}
      </Button>
    </form>
  );
}

function JoinByCode() {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeRoomCode(input);
    if (code) goToRoom(code);
    else setInvalid(true);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-labelledby="join-heading">
      <h2 id="join-heading" className="text-lg font-medium">
        {t('online.joinByCode')}
      </h2>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="room-code">
          {t('online.codeLabel')}
        </label>
        <input
          id="room-code"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setInvalid(false);
          }}
          placeholder={t('online.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={6}
          className="w-40 rounded-md border border-white/15 bg-black/20 px-3 py-2 font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal focus-visible:outline-2 focus-visible:outline-brass"
        />
        <Button type="submit">{t('online.go')}</Button>
      </div>
      {invalid && <p className="text-sm text-red-300">{t('online.codeInvalid')}</p>}
    </form>
  );
}

function OpenRooms({ service }: { service: OnlineService }) {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<readonly LobbyRoom[] | null>(null);
  const refresh = useCallback(() => {
    service.lobby().then(setRooms, () => setRooms([]));
  }, [service]);
  useEffect(refresh, [refresh]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="lobby-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="lobby-heading" className="text-lg font-medium">
          {t('online.lobby')}
        </h2>
        <Button onClick={refresh}>{t('online.refresh')}</Button>
      </div>
      {rooms && rooms.length === 0 && (
        <p className="text-sm text-ivory-muted">{t('online.noRooms')}</p>
      )}
      <ul className="flex flex-col gap-2" data-testid="lobby">
        {rooms?.map((room) => (
          <li
            key={room.code}
            data-room={room.code}
            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-felt-raised px-3 py-2"
          >
            <span className="flex flex-col">
              <span>{timeControlLabel(t, room.timeControl)}</span>
              <span className="text-sm text-ivory-muted">
                {t('online.youPlay', { color: t(`color.${room.yourColor}`) })}
              </span>
            </span>
            <Button
              variant="primary"
              onClick={() => {
                // Take the seat, then open the room (if the seat is gone, the room shows why).
                service.join(room.code).then(
                  () => goToRoom(room.code),
                  () => goToRoom(room.code),
                );
              }}
            >
              {t('online.join')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
