import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Receipt, ChevronLeft, Save } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { toast } from 'sonner';

export default function ReceiptSettings() {
  const { t } = useTranslation('settings');
  const { can } = useAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const [footerText, setFooterText] = useState('');
  const [printLogo, setPrintLogo] = useState(false);
  const [hideWatermark, setHideWatermark] = useState(false);

  // Sync state with db loaded value
  useEffect(() => {
    if (storeSettings) {
      setFooterText(storeSettings.receiptFooter ?? '');
      setPrintLogo(storeSettings.printLogo ?? false);
      setHideWatermark(storeSettings.hideWatermark ?? false);
    }
  }, [storeSettings]);

  if (!can('manage_store_settings')) {
    return <LockedPage title={t('receiptSettings.title')} permissionLabel={t('masterData.theme.permissionLabel')} />;
  }

  const handleSave = async () => {
    if (!storeSettings?.id) return;
    try {
      await db.storeSettings.update(storeSettings.id, {
        receiptFooter: footerText.trim(),
        printLogo,
        hideWatermark,
      });
      toast.success(t('receiptSettings.saveSuccess'));
    } catch {
      toast.error(t('receiptSettings.saveFailed'));
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          {t('receiptSettings.title')}
        </h1>
      </div>

      {/* Editor Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-5">
          {/* Logo Toggle */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="print-logo-switch" className="text-sm font-semibold cursor-pointer">
                {t('receiptSettings.printLogoLabel')}
              </Label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                {t('receiptSettings.printLogoDescription')}
              </p>
            </div>
            <Switch
              id="print-logo-switch"
              checked={printLogo}
              onCheckedChange={setPrintLogo}
            />
          </div>

          {/* Watermark Toggle */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
            <div className="space-y-0.5">
              <Label 
                htmlFor="hide-watermark-switch" 
                className="text-sm font-semibold cursor-pointer"
              >
                {t('receiptSettings.hideWatermarkLabel')}
              </Label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                {t('receiptSettings.hideWatermarkDescActive')}
              </p>
            </div>
            <Switch
              id="hide-watermark-switch"
              checked={hideWatermark}
              onCheckedChange={setHideWatermark}
            />
          </div>

          {/* Footer Input */}
          <div className="space-y-1.5">
            <Label htmlFor="receipt-footer-input" className="text-sm font-semibold">
              {t('receiptSettings.footerLabel')}
            </Label>
            <Input
              id="receipt-footer-input"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder={t('receipt.footerFallback')}
              className="h-11"
              maxLength={80}
            />
            <p className="text-[10px] text-muted-foreground">
              {t('masterData.receiptFooter.description')}
            </p>
          </div>

          <Button className="w-full h-11 gap-2" onClick={handleSave}>
            <Save className="w-4 h-4" />
            {t('common:save')}
          </Button>
        </CardContent>
      </Card>

      {/* Live Preview Card */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
          Preview Struk
        </span>
        <Card className="border border-dashed border-border/80 bg-white dark:bg-zinc-900 shadow-inner rounded-xl overflow-hidden">
          <CardContent className="p-6 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 space-y-4">
            
            {/* Logo Preview */}
            {printLogo && storeSettings?.logo && (
              <div className="flex justify-center mb-2">
                <img
                  src={storeSettings.logo}
                  alt="Store Logo"
                  className="w-12 h-12 object-contain filter grayscale contrast-125"
                />
              </div>
            )}

            <div className="text-center space-y-1 opacity-55">
              <p className="font-bold text-xs">TOKO MAJU JAYA</p>
              <p>Tangerang</p>
              <p>081208120812</p>
            </div>
            
            <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700" />
            
            <div className="space-y-1.5 opacity-55">
              <div className="flex justify-between">
                <span>Nasi Goreng Spesial</span>
                <span>$ 15.000</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-800 dark:text-zinc-200">
                <span>TOTAL</span>
                <span>$ 15.000</span>
              </div>
            </div>

            <div className="border-t border-dashed border-zinc-300 dark:border-zinc-700" />
            
            {/* Real-time footer preview */}
            <div className="text-center py-2 text-zinc-900 dark:text-zinc-100 font-semibold break-words transition-all px-4 pb-1">
              {footerText.trim() || t('receipt.footerFallback')}
            </div>

            {/* Watermark preview */}
            {!hideWatermark && (
              <div className="text-center text-[10px] text-zinc-500 pt-2 border-t border-dotted border-zinc-200 dark:border-zinc-800 space-y-0.5">
                <p>Dicetak Dari Aplikasi</p>
                <p className="font-semibold">FreeKasir.com</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
