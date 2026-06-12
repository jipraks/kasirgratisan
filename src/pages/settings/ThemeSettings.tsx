import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Check, ChevronLeft, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { setThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const APPEARANCE_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    description: 'Tampilan terang untuk area kasir yang cerah.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Tampilan gelap yang nyaman untuk malam hari.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Ikuti pengaturan perangkat otomatis.',
    icon: Monitor,
  },
] as const;

type AppearanceValue = (typeof APPEARANCE_OPTIONS)[number]['value'];

export default function ThemeSettings() {
  const { can } = useAuth();
  const { theme, setTheme } = useTheme();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const activeTheme = (theme ?? 'system') as AppearanceValue;

  if (!can('manage_store_settings')) {
    return <LockedPage title="Warna Tema" permissionLabel="Kelola Pengaturan Toko" />;
  }

  return (
    <div className="space-y-5 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Palette className="h-5 w-5 text-primary" />
          Tema
        </h1>
      </div>

      <Card className="overflow-hidden border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-sm font-extrabold">Mode Tampilan</p>
            <p className="text-xs text-muted-foreground">Pilih light, dark, atau ikuti sistem perangkat.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {APPEARANCE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = activeTheme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'group relative rounded-3xl border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    selected
                      ? 'border-primary/50 bg-primary/10 shadow-soft'
                      : 'border-border/70 bg-background/70 hover:border-primary/25',
                  )}
                  aria-pressed={selected}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-2xl ring-1',
                      selected
                        ? 'bg-primary text-primary-foreground ring-primary/30'
                        : 'bg-muted text-muted-foreground ring-border/70 group-hover:text-primary',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {selected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-extrabold">{label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-4 p-4">
          <div>
            <p className="text-sm font-extrabold">Warna Tema</p>
            <p className="text-xs text-muted-foreground">Pilih warna aksen utama untuk tombol, badge, dan highlight.</p>
          </div>
          <ThemeColorPicker
            value={storeSettings?.themeColor ?? '215'}
            onChange={hue => setThemeColor(hue)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
