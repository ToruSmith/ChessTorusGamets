import type { MessageKey } from '../i18n/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';

interface ModeCard {
  id: string;
  title: MessageKey;
  description: MessageKey;
}

const MODES: readonly ModeCard[] = [
  { id: 'local', title: 'mode.local.title', description: 'mode.local.description' },
  { id: 'online', title: 'mode.online.title', description: 'mode.online.description' },
  { id: 'computer', title: 'mode.computer.title', description: 'mode.computer.description' },
  { id: 'analysis', title: 'mode.analysis.title', description: 'mode.analysis.description' },
];

export function HomeView() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl">{t('app.title')}</h1>
        <p className="max-w-prose text-ivory-muted">{t('app.tagline')}</p>
      </section>

      <section aria-labelledby="modes-heading" className="flex flex-col gap-4">
        <h2 id="modes-heading" className="text-lg font-medium">
          {t('home.modesHeading')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <li
              key={mode.id}
              data-mode={mode.id}
              className="flex flex-col gap-1 rounded-lg border border-white/10 bg-felt-raised p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t(mode.title)}</span>
                <span className="rounded-full bg-walnut/40 px-2 py-0.5 text-xs text-ivory-muted">
                  {t('home.comingSoon')}
                </span>
              </div>
              <p className="text-sm text-ivory-muted">{t(mode.description)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
