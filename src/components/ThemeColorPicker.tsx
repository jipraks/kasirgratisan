import { THEME_COLORS, getThemeHSL } from '@/hooks/use-theme-color';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ThemeColorPickerProps {
  value: string;
  onChange: (hue: string) => void;
}

export default function ThemeColorPicker({ value, onChange }: ThemeColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {THEME_COLORS.map(color => {
        const isActive = value === color.hue;
        const hsl = getThemeHSL(color.hue);
        return (
          <button
            key={color.hue}
            onClick={() => onChange(color.hue)}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-all border-2',
              isActive ? 'scale-110 shadow-lg border-foreground/30' : 'border-transparent hover:scale-105'
            )}
            style={{ backgroundColor: `hsl(${hsl})` }}
            title={color.name}
          >
            {isActive && <Check className="w-5 h-5 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
