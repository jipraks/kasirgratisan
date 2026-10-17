import { useState } from 'react';
import { Search, ScanBarcode, Check, X, Package as PackageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Product } from '@/lib/db';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useTranslation } from 'react-i18next';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';


interface ProductPickerProps {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  filter?: (p: Product) => boolean;
  placeholder?: string;
  showHpp?: boolean;
}

export default function ProductPicker({
  products,
  value,
  onChange,
  filter,
  placeholder,
  showHpp = false,
}: ProductPickerProps) {
  const { t, i18n } = useTranslation('settings');
  const numberLocale = NUMBER_LOCALE;
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const available = filter ? products.filter(filter) : products;
  const selected = products.find(p => p.id === Number(value));

  const q = query.trim().toLowerCase();
  const matches = available.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.sku?.toLowerCase().includes(q) ||
    p.barcode?.toLowerCase().includes(q)
  );

  const handleScan = (code: string) => {
    setScannerOpen(false);
    const product = available.find(p => p.sku === code || p.barcode === code);
    if (product) {
      onChange(product.id!.toString());
      setQuery('');
    } else {
      toast.error(t('productPicker.skuBarcodeNotFound', { code }));
    }
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-primary/5 border-primary/30 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{selected.name}</p>
          <p className="text-xs text-muted-foreground">
            {selected.sku}
            {selected.barcode ? ` · ${selected.barcode}` : ''} · {t('productPicker.stockLabel')} {selected.stock} {selected.unit}
          </p>
          {showHpp && (
            <p className="text-xs text-muted-foreground">
              {t('productPicker.hppLabel')} {CURRENCY_SYMBOL} {selected.hpp.toLocaleString(numberLocale)}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => { onChange(''); setQuery(''); }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder={placeholder ?? t('productPicker.placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="w-5 h-5" />
        </Button>
      </div>

      {q && (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border bg-popover shadow-lg divide-y">
        {matches.length === 0 ? (
          <div className="text-center py-8">
            <PackageIcon className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">{t('productPicker.notFound')}</p>
          </div>
        ) : (
          matches.map(p => (
            <button
              type="button"
              key={p.id}
              onClick={() => { onChange(p.id!.toString()); setQuery(''); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60 active:bg-muted"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.sku}{p.barcode ? ` · ${p.barcode}` : ''}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{t('productPicker.stockLabel')} {p.stock}</span>
            </button>
          ))
        )}
      </div>
      )}

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
