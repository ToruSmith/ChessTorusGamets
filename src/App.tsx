import { LanguageSwitch } from './components/LanguageSwitch.tsx';
import { useHashRoute } from './components/useHashRoute.ts';
import { useI18n } from './i18n/I18nProvider.tsx';
import { HomeView } from './views/HomeView.tsx';
import { LocalGameView } from './views/LocalGameView.tsx';

const SOURCE_URL = 'https://github.com/ToruSmith/ChessTorusGamets';

export function App() {
  const { t } = useI18n();
  const route = useHashRoute();
  const view = route === '/local' ? <LocalGameView /> : <HomeView />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <a
          href="#/"
          className="text-sm tracking-widest text-ivory-muted hover:text-ivory"
          title={t('nav.home')}
        >
          ChessTorusGamets
        </a>
        <LanguageSwitch />
      </header>
      <main className="flex-1 py-6">{view}</main>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-sm text-ivory-muted">
        <span>{t('footer.license')}</span>
        <a className="underline underline-offset-4 hover:text-ivory" href={SOURCE_URL}>
          {t('footer.source')}
        </a>
      </footer>
    </div>
  );
}
