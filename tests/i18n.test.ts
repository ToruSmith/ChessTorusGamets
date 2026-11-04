import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, isLocale, translate } from '../src/i18n/index.ts';

describe('i18n', () => {
  it('defaults to Traditional Chinese', () => {
    assert.equal(DEFAULT_LOCALE, 'zh-TW');
    assert.equal(translate('zh-TW', 'app.title'), '西洋棋');
    assert.equal(translate('en', 'app.title'), 'Chess');
  });

  it('has the same non-empty keys in every locale', () => {
    const reference = Object.keys(DICTIONARIES[DEFAULT_LOCALE]).sort();
    for (const locale of LOCALES) {
      const messages = DICTIONARIES[locale];
      assert.deepEqual(Object.keys(messages).sort(), reference, locale);
      for (const [key, text] of Object.entries(messages)) {
        assert.ok(text.trim().length > 0, `${locale} ${key} is empty`);
      }
    }
  });

  it('uses the same placeholders in every locale', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const reference = DICTIONARIES[DEFAULT_LOCALE];
    for (const locale of LOCALES) {
      for (const [key, text] of Object.entries(DICTIONARIES[locale])) {
        const expected = reference[key as keyof typeof reference];
        assert.deepEqual(placeholders(text), placeholders(expected), `${locale} ${key}`);
      }
    }
  });

  it('recognises supported locales only', () => {
    assert.equal(isLocale('zh-TW'), true);
    assert.equal(isLocale('en'), true);
    assert.equal(isLocale('ja'), false);
    assert.equal(isLocale(null), false);
  });
});
