import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DEFAULT_THEME, type ThemeMode } from '@/lib/theme';

export default function ThemeModeToggle() {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const current = (theme as ThemeMode | undefined) ?? DEFAULT_THEME;

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={current}
      onValueChange={value => value && setTheme(value)}
      className="grid grid-cols-2 gap-2"
    >
      <ToggleGroupItem value="dark" className="gap-2">
        <Moon className="w-4 h-4" />
        {t('masterData.theme.dark')}
      </ToggleGroupItem>
      <ToggleGroupItem value="light" className="gap-2">
        <Sun className="w-4 h-4" />
        {t('masterData.theme.light')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
