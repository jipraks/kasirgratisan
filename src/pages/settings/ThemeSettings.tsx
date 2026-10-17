import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Palette, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import ThemeModeToggle from '@/components/ThemeModeToggle';
import { setThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';

export default function ThemeSettings() {
  const { t } = useTranslation('settings');
  const { can } = useAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          {t('masterData.theme.title')}
        </h1>
      </div>

      {/* Light/dark mode is a per-device preference, so every user can change it. */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">{t('masterData.theme.modeTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('masterData.theme.modeDescription')}</p>
          </div>
          <ThemeModeToggle />
        </CardContent>
      </Card>

      {/* The accent color is a store setting, so it stays behind the permission. */}
      {can('manage_store_settings') && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">{t('masterData.theme.colorTitle')}</p>
            <ThemeColorPicker
              value={storeSettings?.themeColor ?? '215'}
              onChange={hue => setThemeColor(hue)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
