// Light/dark mode preference. Stored per device in localStorage (it is a UI
// preference, not business data). Dark is the default until the user picks light.
// Keep THEME_STORAGE_KEY and DEFAULT_THEME in sync with the inline script in index.html.
export const THEME_STORAGE_KEY = 'theme';
export const THEME_MODES = ['dark', 'light'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const DEFAULT_THEME: ThemeMode = 'dark';
