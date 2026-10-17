import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { es as esDateLocale, enUS, type Locale } from 'date-fns/locale';

import esCommon from './locales/es/common.json';
import esOnboarding from './locales/es/onboarding.json';
import esDashboard from './locales/es/dashboard.json';
import esReports from './locales/es/reports.json';
import esProducts from './locales/es/products.json';
import esSettings from './locales/es/settings.json';
import enCommon from './locales/en/common.json';
import enOnboarding from './locales/en/onboarding.json';
import enDashboard from './locales/en/dashboard.json';
import enReports from './locales/en/reports.json';
import enProducts from './locales/en/products.json';
import enSettings from './locales/en/settings.json';

export type SupportedLanguage = 'es' | 'en';
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';
export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'es', label: 'Español', flag: '🇨🇴' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: import.meta.env.DEV,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    ns: ['common', 'onboarding', 'dashboard', 'reports', 'products', 'settings'],
    defaultNS: 'common',
    resources: {
      es: { common: esCommon, onboarding: esOnboarding, dashboard: esDashboard, reports: esReports, products: esProducts, settings: esSettings },
      en: { common: enCommon, onboarding: enOnboarding, dashboard: enDashboard, reports: enReports, products: enProducts, settings: enSettings },
    },
    // Only an explicit user choice (stored in localStorage) switches away from Spanish.
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  });

/** Normalizes any language tag (e.g. "en-US", or a legacy "id") to a supported language. */
export const resolveLanguage = (language?: string | null): SupportedLanguage => {
  const base = language?.split('-')[0];
  return SUPPORTED_LANGUAGES.some((l) => l.code === base) ? (base as SupportedLanguage) : DEFAULT_LANGUAGE;
};

const DATE_LOCALES: Record<SupportedLanguage, Locale> = { es: esDateLocale, en: enUS };

/** date-fns locale for the given (possibly unsupported) language tag. */
export const getDateLocale = (language?: string | null): Locale => DATE_LOCALES[resolveLanguage(language)];

export default i18n;
