import { remainingAt, type Color } from '../core/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { ClockView } from '../state/index.ts';
import { useNow } from './useNow.ts';

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (clamped < 10_000) return `0:0${seconds}.${Math.floor((clamped % 1000) / 100)}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ClockFace({ clock, color }: { clock: ClockView; color: Color }) {
  const { t } = useI18n();
  const ticking = clock.running && clock.turn === color;
  const now = useNow(ticking);
  const remaining = ticking ? remainingAt(clock, now)[color] : clock.remaining[color];
  const low = remaining < 20_000;
  return (
    <span
      role="timer"
      aria-label={t('clock.label', { color: t(`color.${color}`) })}
      data-clock={color}
      className={`rounded-md px-3 py-1 font-mono text-xl tabular-nums ${
        ticking
          ? low
            ? 'bg-red-700 text-white'
            : 'bg-ivory text-felt'
          : 'bg-black/30 text-ivory-muted'
      }`}
    >
      {formatClock(remaining)}
    </span>
  );
}
