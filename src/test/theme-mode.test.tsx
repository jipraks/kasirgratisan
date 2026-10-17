import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '../i18n';
import AppThemeProvider from '@/components/AppThemeProvider';
import ThemeModeToggle from '@/components/ThemeModeToggle';
import { THEME_STORAGE_KEY } from '@/lib/theme';

function renderToggle() {
  return render(
    <AppThemeProvider>
      <ThemeModeToggle />
    </AppThemeProvider>,
  );
}

describe('theme mode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('uses dark mode when the user has not chosen a mode', () => {
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('data-state', 'on');
  });

  it('switches to light mode and remembers the choice', async () => {
    renderToggle();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a saved light choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderToggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('data-state', 'on');
  });
});
