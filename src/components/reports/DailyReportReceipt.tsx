import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Share2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { isNativePlatform, printRawNativeBluetooth, getDailyReportESCPOSData, type DailyReportPrintData } from '@/lib/printer';
import { Capacitor } from '@capacitor/core';
import { downloadOrShareFile } from '@/lib/file-utils';

interface DailyReportReceiptProps {
  open: boolean;
  onClose: () => void;
  data: DailyReportPrintData;
}

const CURRENCY_SYMBOL: Record<string, string> = { id: 'Rp', en: 'Rp', ms: 'Rp' };
const NUMBER_LOCALES: Record<string, string> = { id: 'id-ID', en: 'en-US', ms: 'ms-MY' };

export default function DailyReportReceipt({ open, onClose, data }: DailyReportReceiptProps) {
  const { t, i18n } = useTranslation(['reports', 'settings']);
  const numberLocale = NUMBER_LOCALES[i18n.language] ?? 'id-ID';
  const currencySymbol = CURRENCY_SYMBOL[i18n.language] ?? 'Rp';
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);

  const captureReceipt = async (): Promise<HTMLCanvasElement | null> => {
    if (!receiptRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return canvas;
    } catch {
      toast.error(t('dailyReceipt.captureError'));
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;
    try {
      const fileName = `laporan-closing-${data.dateStr}.png`;
      const dataUrl = canvas.toDataURL('image/png');
      await downloadOrShareFile(dataUrl, {
        fileName,
        mimeType: 'image/png',
        dialogTitle: t('dailyReceipt.downloadSuccess'),
        shareTitle: `${t('dailyReceipt.shareTitle')} ${data.dateStr}`,
        shareText: t('dailyReceipt.shareText', { storeName: data.storeSettings?.storeName || t('dailyReceipt.storeFallback') }),
      });
      toast.success(t('dailyReceipt.downloadSuccess'));
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh laporan');
    }
  };

  const rp = (n: number) => `${currencySymbol} ${n.toLocaleString(numberLocale)}`;

  const handleShare = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `laporan-closing-${data.dateStr}.png`;

      if (Capacitor.isNativePlatform()) {
        await downloadOrShareFile(dataUrl, {
          fileName,
          mimeType: 'image/png',
          dialogTitle: `${t('dailyReceipt.shareTitle')} ${data.dateStr}`,
          shareTitle: `${t('dailyReceipt.shareTitle')} ${data.dateStr}`,
          shareText: t('dailyReceipt.shareText', { storeName: data.storeSettings?.storeName || t('dailyReceipt.storeFallback') }),
        });
        return;
      }

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      if (navigator.share) {
        const file = new File([blob], fileName, { type: 'image/png' });
        await navigator.share({
          title: `${t('dailyReceipt.shareTitle')} ${data.dateStr}`,
          text: t('dailyReceipt.shareText', { storeName: data.storeSettings?.storeName || t('dailyReceipt.storeFallback') }),
          files: [file],
        });
      } else {
        const text = encodeURIComponent(
          `*${t('dailyReceipt.shareFallbackTitle', { storeName: data.storeSettings?.storeName || t('dailyReceipt.storeFallback') })}*\n` +
          `${t('dailyReceipt.dateLabel')}: ${data.dateStr}\n` +
          `${t('dailyReceipt.period')}: ${data.periodStr}\n\n` +
          `*${t('dailyReceipt.sales')}*\n` +
          `${t('dailyReceipt.grossSales')}: ${rp(data.grossSales)}\n` +
          `${t('dailyReceipt.discount')}: ${rp(data.discount)}\n` +
          `${t('dailyReceipt.netSales')}: ${rp(data.netSales)}\n\n` +
          `*${t('dailyReceipt.summary')}*\n` +
          `${t('dailyReceipt.transactionCount')}: ${data.txCount}\n` +
          `${t('dailyReceipt.itemCount')}: ${data.itemCount}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(t('dailyReceipt.shareFailed'));
      }
    }
  };

  const handleBluetoothPrint = async () => {
    setPrinting(true);
    try {
      const rawText = getDailyReportESCPOSData({
        ...data,
        language: i18n.language,
      });

      if (isNativePlatform()) {
        await printRawNativeBluetooth(rawText, toast);
        return;
      }

      if (!('bluetooth' in navigator)) {
        toast.error(t('dailyReceipt.bluetoothUnavailable'));
        return;
      }

      toast.info(t('dailyReceipt.searchingPrinter'));
      // @ts-expect-error Web Bluetooth API is not fully typed in TypeScript
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      const encoder = new TextEncoder();
      const payload = encoder.encode(rawText);

      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        await characteristic.writeValue(chunk);
      }

      toast.success(t('dailyReceipt.printSuccess'));
      await server.disconnect();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(t('dailyReceipt.printFailed'));
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl p-4">
        <DialogHeader className="relative">
          <DialogTitle className="text-center text-base font-bold">{t('dailyReceipt.title')}</DialogTitle>
        </DialogHeader>

        {/* Receipt preview - this gets captured as image */}
        <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg mx-auto border" style={{ width: '280px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
          {/* Store Header */}
          <div className="text-center mb-2">
            {data.storeSettings?.logo && (
              <img src={data.storeSettings.logo} alt={t('dailyReceipt.logoAlt')} className="w-12 h-12 object-contain mx-auto mb-1" />
            )}
            <p className="font-bold text-xs">{data.storeSettings?.storeName || t('dailyReceipt.storeFallback')}</p>
            {data.storeSettings?.address && <p className="text-[9px]">{data.storeSettings.address}</p>}
            {data.storeSettings?.phone && <p className="text-[9px]">{data.storeSettings.phone}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Report Title */}
          <div className="text-center font-bold text-xs my-1">
            <p>{t('dailyReceipt.reportTitle')}</p>
            <p>{data.dateStr}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Info */}
          <div className="text-[10px] space-y-0.5">
            <p className="font-bold">{t('dailyReceipt.period')}:</p>
            <p>{data.periodStr}</p>
            <div className="flex justify-between mt-2">
              <span>{t('dailyReceipt.transactionCount')}:</span>
              <span className="font-bold">{data.txCount}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('dailyReceipt.itemCount')}:</span>
              <span className="font-bold">{data.itemCount}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Sales Section */}
          <p className="font-bold text-[10px] mb-1">{t('dailyReceipt.sales')}</p>
          <div className="space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>{t('dailyReceipt.grossSales')}</span>
              <span>{rp(data.grossSales)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('dailyReceipt.discount')}</span>
                <span>-{rp(data.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-dashed border-gray-300 pt-0.5 mt-0.5">
              <span>{t('dailyReceipt.netSales')}</span>
              <span>{rp(data.netSales)}</span>
            </div>
          </div>

          {/* Expenses section */}
          {data.includeExpenses && data.expensesAmount !== undefined && data.expensesAmount > 0 && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <p className="font-bold text-[10px] mb-1">{t('dailyReceipt.expensesSection')}</p>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>{t('dailyReceipt.netSales')}</span>
                  <span>{rp(data.netSales)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>{t('dailyReceipt.expenses')}</span>
                  <span>-{rp(data.expensesAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed border-gray-300 pt-0.5 mt-0.5">
                  <span>{t('dailyReceipt.netProfit')}</span>
                  <span>{rp(data.netProfit || 0)}</span>
                </div>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Payments Section */}
          <p className="font-bold text-[10px] mb-1">{t('dailyReceipt.payment')}</p>
          <div className="space-y-0.5 text-[10px]">
            {data.paymentBreakdown.length === 0 ? (
              <p className="text-gray-500 italic">{t('dailyReceipt.noPayment')}</p>
            ) : (
              data.paymentBreakdown.map((pm, i) => (
                <div key={i} className="flex justify-between">
                  <span>{pm.name}</span>
                  <span>{rp(pm.amount)}</span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Top Products Section */}
          <p className="font-bold text-[10px] mb-1">{t('dailyReceipt.topProducts')}</p>
          <div className="space-y-1 text-[10px]">
            {data.topProducts.length === 0 ? (
              <p className="text-gray-500 italic">{t('dailyReceipt.noSales')}</p>
            ) : (
              data.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-start">
                  <span className="max-w-[200px] truncate">{i + 1}. {p.name}</span>
                  <span className="font-bold pl-1">{p.qty}</span>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center text-[9px] text-gray-500 space-y-0.5">
            <p>{t('dailyReceipt.endOfReport')}</p>
            {data.cashierName && <p>{t('dailyReceipt.printedBy')}: {data.cashierName}</p>}
          </div>

          {/* Watermark */}
          {!data.storeSettings?.hideWatermark && (
            <div className="text-center text-[9px] text-gray-400 mt-2 pt-1 border-t border-dotted border-gray-200 space-y-0.5">
              <p>{t('settings:receipt.watermarkLine1')}</p>
              <p className="font-semibold">{t('settings:receipt.watermarkLine2')}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-2.5" onClick={handleDownload} disabled={generating || printing}>
            <Download className="w-4 h-4" />
            <span className="text-[9px]">{t('dailyReceipt.download')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-2.5" onClick={handleShare} disabled={generating || printing}>
            <Share2 className="w-4 h-4" />
            <span className="text-[9px]">{t('dailyReceipt.share')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-2.5" onClick={handleBluetoothPrint} disabled={generating || printing}>
            <Printer className="w-4 h-4" />
            <span className="text-[9px]">{t('dailyReceipt.print')}</span>
          </Button>
        </div>

        <Button variant="secondary" className="w-full mt-2" onClick={onClose}>
          {t('dailyReceipt.done')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
