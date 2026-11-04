import type { TimeControl } from '../core/index.ts';

export interface TimePreset {
  /** Also the i18n key suffix: `time.<id>`. */
  readonly id: 'none' | '3+2' | '5+0' | '10+0' | '15+10' | '30+0';
  readonly control: TimeControl | null;
}

const minutes = (m: number, incrementSeconds = 0): TimeControl => ({
  initialMs: m * 60_000,
  incrementMs: incrementSeconds * 1_000,
});

export const TIME_PRESETS: readonly TimePreset[] = [
  { id: 'none', control: null },
  { id: '3+2', control: minutes(3, 2) },
  { id: '5+0', control: minutes(5) },
  { id: '10+0', control: minutes(10) },
  { id: '15+10', control: minutes(15, 10) },
  { id: '30+0', control: minutes(30) },
];
