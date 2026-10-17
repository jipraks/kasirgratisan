import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { DEFAULT_THEME, THEME_MODES, THEME_STORAGE_KEY } from '@/lib/theme';

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      themes={[...THEME_MODES]}
      storageKey={THEME_STORAGE_KEY}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
