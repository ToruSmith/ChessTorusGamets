import type { MessageKey } from '../i18n/index.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';

interface ModeCard {
  id: string;
  title: MessageKey;
  description: MessageKey;
  /** Route for modes that are ready to play. */
  href?: string;
}

const HUB_URL = 'https://torusmith.github.io/QiguanGamets/';

const MODES: readonly ModeCard[] = [
  {
    id: 'local',
    title: 'mode.local.title',
    description: 'mode.local.description',
    href: '#/local',
  },
  {
    id: 'online',
    title: 'mode.online.title',
    description: 'mode.online.description',
    href: '#/online',
  },
  {
    id: 'computer',
    title: 'mode.computer.title',
    description: 'mode.computer.description',
    href: '#/computer',
  },
  {
    id: 'analysis',
    title: 'mode.analysis.title',
    description: 'mode.analysis.description',
    href: '#/analysis',
  },
];

export function HomeView() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-wide sm:text-5xl">{t('app.title')}</h1>
        <p className="max-w-prose text-ivory-muted">{t('app.tagline')}</p>
        <a
          href={HUB_URL}
          className="w-fit text-sm text-ivory-muted underline underline-offset-4 hover:text-ivory"
        >
          {t('home.hub')}
        </a>
      </section>

      <section aria-labelledby="modes-heading" className="flex flex-col gap-4">
        <h2 id="modes-heading" className="text-lg font-medium">
          {t('home.modesHeading')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <li key={mode.id} data-mode={mode.id}>
              {mode.href ? (
                <a
                  href={mode.href}
                  className="flex h-full flex-col gap-1 rounded-lg border border-brass/50 bg-felt-raised p-4 transition-colors hover:border-brass hover:bg-[#33423a] focus-visible:outline-2 focus-visible:outline-brass"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(mode.title)}</span>
                    <span className="rounded-full bg-brass px-2 py-0.5 text-xs text-felt">
                      {t('home.play')}
                    </span>
                  </span>
                  <span className="text-sm text-ivory-muted">{t(mode.description)}</span>
                </a>
              ) : (
                <div className="flex h-full flex-col gap-1 rounded-lg border border-white/10 bg-felt-raised p-4 opacity-80">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t(mode.title)}</span>
                    <span className="rounded-full bg-walnut/40 px-2 py-0.5 text-xs text-ivory-muted">
                      {t('home.comingSoon')}
                    </span>
                  </span>
                  <span className="text-sm text-ivory-muted">{t(mode.description)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
