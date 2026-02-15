import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

// Predefined theme color options with HSL values
export const THEME_COLORS = [
  { name: 'Oranye', hue: '25', saturation: '95%', lightness: '53%' },
  { name: 'Biru', hue: '217', saturation: '91%', lightness: '60%' },
  { name: 'Hijau', hue: '142', saturation: '71%', lightness: '45%' },
  { name: 'Ungu', hue: '262', saturation: '83%', lightness: '58%' },
  { name: 'Merah', hue: '0', saturation: '84%', lightness: '60%' },
  { name: 'Pink', hue: '330', saturation: '81%', lightness: '60%' },
  { name: 'Teal', hue: '172', saturation: '66%', lightness: '50%' },
  { name: 'Kuning', hue: '45', saturation: '93%', lightness: '47%' },
] as const;

export function getThemeHSL(hue: string) {
  const preset = THEME_COLORS.find(c => c.hue === hue);
  if (preset) return `${preset.hue} ${preset.saturation} ${preset.lightness}`;
  return `${hue} 95% 53%`;
}

export function applyThemeColor(hue: string) {
  const hsl = getThemeHSL(hue);
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  // Update meta theme-color for PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', `hsl(${hsl})`);
}

export function useThemeColor() {
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  useEffect(() => {
    if (storeSettings?.themeColor) {
      applyThemeColor(storeSettings.themeColor);
    }
  }, [storeSettings?.themeColor]);

  return storeSettings?.themeColor ?? '25';
}

export async function setThemeColor(hue: string) {
  const settings = await db.storeSettings.toCollection().first();
  if (settings?.id) {
    await db.storeSettings.update(settings.id, { themeColor: hue });
  }
  applyThemeColor(hue);
}
