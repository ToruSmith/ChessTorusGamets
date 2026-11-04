import { useI18n } from '../i18n/I18nProvider.tsx';

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <button
      type="button"
      className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:border-brass hover:text-brass focus-visible:outline-2 focus-visible:outline-brass"
      aria-label={t('app.languageSwitchLabel')}
      onClick={() => setLocale(locale === 'zh-TW' ? 'en' : 'zh-TW')}
    >
      {t('app.languageSwitch')}
    </button>
  );
}
