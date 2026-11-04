// Pure i18n helpers: no React, no DOM, so they run in Node tests too.
import { en } from './en.ts';
import { zhTW, type MessageKey, type Messages } from './zh-TW.ts';

export type { MessageKey, Messages };

export const LOCALES = ['zh-TW', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-TW';

export const DICTIONARIES: Record<Locale, Messages> = {
  'zh-TW': zhTW,
  en,
};

/** BCP 47 tag for the `lang` attribute of the document. */
export const HTML_LANG: Record<Locale, string> = {
  'zh-TW': 'zh-Hant-TW',
  en: 'en',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export type MessageParams = Record<string, string | number>;

/** Look up a message and replace `{name}` placeholders with `params.name`. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = DICTIONARIES[locale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
