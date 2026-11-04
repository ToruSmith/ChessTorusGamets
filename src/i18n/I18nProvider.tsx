import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  HTML_LANG,
  isLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from './index.ts';

const STORAGE_KEY = 'chess.locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
    document.title = translate(locale, 'app.documentTitle');
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore: the choice still applies for this visit.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }),
    [locale, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
