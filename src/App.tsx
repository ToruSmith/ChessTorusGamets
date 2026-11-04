import { LanguageSwitch } from './components/LanguageSwitch.tsx';
import { useHashRoute } from './components/useHashRoute.ts';
import { ONLINE_CONFIG } from './config.ts';
import { useI18n } from './i18n/I18nProvider.tsx';
import { normalizeRoomCode } from './state/index.ts';
import { HomeView } from './views/HomeView.tsx';
import { LocalGameView } from './views/LocalGameView.tsx';
import { OnlineLobbyView } from './views/OnlineLobbyView.tsx';
import { OnlineRoomView } from './views/OnlineRoomView.tsx';

const SOURCE_URL = 'https://github.com/ToruSmith/ChessTorusGamets';

export function App() {
  const { t } = useI18n();
  const route = useHashRoute();
  const view = renderRoute(route);

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

function renderRoute(route: string) {
  if (route === '/local') return <LocalGameView />;
  if (route === '/online') return <OnlineLobbyView config={ONLINE_CONFIG} />;
  const room = /^\/r\/([^/]+)$/.exec(route);
  const code = room?.[1] ? normalizeRoomCode(room[1]) : null;
  if (code) return <OnlineRoomView key={code} config={ONLINE_CONFIG} code={code} />;
  return <HomeView />;
}
