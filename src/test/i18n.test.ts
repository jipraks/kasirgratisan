import { describe, it, expect } from 'vitest';
import { es, enUS } from 'date-fns/locale';
import i18n, { SUPPORTED_LANGUAGES, resolveLanguage, getDateLocale } from '../i18n';

describe('i18n language defaults', () => {
  it('offers only Spanish and English, with Spanish first', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['es', 'en']);
  });

  it('starts in Spanish when the user has not chosen a language', () => {
    expect(i18n.resolvedLanguage).toBe('es');
    expect(i18n.t('nav.cashier')).toBe('Caja');
  });

  it('switches to English only when asked', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('nav.cashier')).toBe('Cashier');
    await i18n.changeLanguage('es');
  });

  it('maps legacy or unknown languages to Spanish', () => {
    expect(resolveLanguage('id')).toBe('es');
    expect(resolveLanguage('ms')).toBe('es');
    expect(resolveLanguage(undefined)).toBe('es');
    expect(resolveLanguage('en-US')).toBe('en');
  });

  it('picks the matching date-fns locale', () => {
    expect(getDateLocale('es')).toBe(es);
    expect(getDateLocale('en')).toBe(enUS);
    expect(getDateLocale('id')).toBe(es);
  });
});
