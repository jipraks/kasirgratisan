import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import html2canvas from 'html2canvas';
import { Download, Share2, Printer, Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/lib/db';
import { isNativePlatform, printNativeBluetooth, getESCPOSData, printKitchenTicketBluetooth, getKitchenTicketESCPOSData } from '@/lib/printer';
import { Capacitor } from '@capacitor/core';
import { downloadOrShareFile } from '@/lib/file-utils';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';

const LOCALES: Record<string, Locale> = { id, en: enUS, ms };

interface ReceiptProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
  cashierName?: string;
}

export default function Receipt({ open, onClose, transaction, items, storeSettings, paymentMethodName, cashierName }: ReceiptProps) {
  const { t, i18n } = useTranslation('settings');
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const dateLocale = LOCALES[i18n.language] || id;
  const numberLocale = NUMBER_LOCALE;

  const rp = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(numberLocale)}`;

  const storeName = storeSettings?.storeName || t('receipt.storeFallback');

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
      toast.error(t('receipt.toast.captureError'));
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;
    try {
      const fileName = `struk-${transaction.receiptNumber}.png`;
      const dataUrl = canvas.toDataURL('image/png');
      await downloadOrShareFile(dataUrl, {
        fileName,
        mimeType: 'image/png',
        dialogTitle: t('receipt.toast.downloadSuccess'),
        shareTitle: t('receipt.shareTitle', { receiptNumber: transaction.receiptNumber }),
        shareText: t('receipt.shareText', { storeName }),
      });
      toast.success(t('receipt.toast.downloadSuccess'));
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh struk');
    }
  };

  const handleShare = async () => {
    const canvas = await captureReceipt();
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `struk-${transaction.receiptNumber}.png`;

      if (Capacitor.isNativePlatform()) {
        await downloadOrShareFile(dataUrl, {
          fileName,
          mimeType: 'image/png',
          dialogTitle: t('receipt.shareTitle', { receiptNumber: transaction.receiptNumber }),
          shareTitle: t('receipt.shareTitle', { receiptNumber: transaction.receiptNumber }),
          shareText: t('receipt.shareText', { storeName }),
        });
        return;
      }

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      if (navigator.share) {
        const file = new File([blob], fileName, { type: 'image/png' });
        await navigator.share({
          title: t('receipt.shareTitle', { receiptNumber: transaction.receiptNumber }),
          text: t('receipt.shareText', { storeName }),
          files: [file],
        });
      } else {
        const text = encodeURIComponent(
          t('receipt.whatsappFallback', {
            storeName,
            receiptNumber: transaction.receiptNumber,
            total: rp(transaction.total),
            date: format(new Date(transaction.date), 'dd MMM yyyy HH:mm', { locale: dateLocale }),
          })
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(t('receipt.toast.shareFailed'));
      }
    }
  };

  const handleBluetoothPrint = async () => {
    const printData = { 
      transaction, 
      items, 
      storeSettings, 
      paymentMethodName, 
      cashierName,
      language: i18n.language,
    };

    if (isNativePlatform()) {
      await printNativeBluetooth(printData, toast);
      return;
    }

    if (!('bluetooth' in navigator)) {
      toast.error(t('receipt.toast.bluetoothUnavailable'));
      return;
    }

    try {
      toast.info(t('receipt.toast.searchingPrinter'));
      // @ts-expect-error Web Bluetooth API is not fully typed in TypeScript
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      const data = new TextEncoder().encode(getESCPOSData(printData));
      
      for (let i = 0; i < data.length; i += 100) {
        const chunk = data.slice(i, i + 100);
        await characteristic.writeValue(chunk);
      }

      toast.success(t('receipt.toast.printSuccess'));
      await server.disconnect();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        toast.error(t('receipt.toast.printFailed'));
      }
    }
  };

  const handlePrintKitchenTicket = async () => {
    const printData = { transaction, items, cashierName };

    if (isNativePlatform()) {
      await printKitchenTicketBluetooth(printData, toast);
      return;
    }

    if (!('bluetooth' in navigator)) {
      toast.error(t('receipt.toast.bluetoothUnavailable'));
      return;
    }

    try {
      toast.info(t('receipt.toast.searchingPrinter'));
      // @ts-expect-error Web Bluetooth API is not fully typed in TypeScript
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      const data = new TextEncoder().encode(getKitchenTicketESCPOSData(printData));
      
      for (let i = 0; i < data.length; i += 100) {
        const chunk = data.slice(i, i + 100);
        await characteristic.writeValue(chunk);
      }

      toast.success(t('receipt.toast.printSuccess'));
      await server.disconnect();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        toast.error(t('receipt.toast.printFailed'));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl p-4">
        <DialogHeader>
          <DialogTitle className="text-center">{t('receipt.title')}</DialogTitle>
        </DialogHeader>

        {/* Receipt preview - this gets captured as image */}
        <div ref={receiptRef} className="bg-white text-black p-4 rounded-lg mx-auto" style={{ width: '280px', fontFamily: 'monospace', fontSize: '12px' }}>
          {/* Store Header */}
          <div className="text-center mb-2">
            {storeSettings?.logo && (
              <img src={storeSettings.logo} alt={t('receipt.logoAlt')} className="w-16 h-16 object-contain mx-auto mb-1" />
            )}
            <p className="font-bold text-sm">{storeName}</p>
            {storeSettings?.address && <p className="text-[10px]">{storeSettings.address}</p>}
            {storeSettings?.phone && <p className="text-[10px]">{storeSettings.phone}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Receipt info */}
          <div className="flex justify-between text-[10px]">
            <span>{t('receipt.no')}: {transaction.receiptNumber}</span>
          </div>
          <div className="flex justify-between text-[10px] mb-1">
            <span>{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</span>
            <span>{paymentMethodName}</span>
          </div>
          {cashierName && (
            <div className="flex justify-between text-[10px]">
              <span>{t('receipt.cashierLabel')}: {cashierName}</span>
            </div>
          )}
          {transaction.customerName && (
            <div className="flex justify-between text-[10px]">
              <span>{t('receipt.customerLabel')}: {transaction.customerName}</span>
            </div>
          )}
          {transaction.tableNumber && (
            <div className="flex justify-between text-[10px]">
              <span>{t('receipt.tableLabel')}: {transaction.tableNumber}</span>
            </div>
          )}
          {transaction.remarks && (
            <div className="text-[10px]">
              <span>{t('receipt.notesLabel')}: {transaction.remarks}</span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items */}
          {items.map((item, i) => (
            <div key={i} className="mb-1">
              <p className="text-[11px] font-medium">{item.productName}</p>
              {item.notes && <p className="text-[9px] text-gray-500 italic">  {item.notes}</p>}
              <div className="flex justify-between text-[10px]">
                <span>{item.quantity} x {rp(item.price)}</span>
                <span>{rp(item.subtotal)}</span>
              </div>
              {item.discountAmount > 0 && (
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>  {t('receipt.discountLabel')}</span>
                  <span>-{rp(item.discountAmount)}</span>
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>{t('receipt.subtotal')}</span>
              <span>{rp(transaction.subtotal)}</span>
            </div>
            {transaction.discountAmount > 0 && (
              <div className="flex justify-between">
                <span>{t('receipt.discount')}</span>
                <span>-{rp(transaction.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xs border-t border-dashed border-gray-400 pt-1 mt-1">
              <span>{t('receipt.total')}</span>
              <span>{rp(transaction.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('receipt.paid')}</span>
              <span>{rp(transaction.paymentAmount)}</span>
            </div>
            {transaction.debtAmount && transaction.debtAmount > 0 ? (
              <div className="flex justify-between font-bold">
                <span>{t('receipt.remainingDebt')}</span>
                <span>{rp(transaction.debtAmount)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>{t('receipt.change')}</span>
                <span>{rp(transaction.change)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-500">
            {storeSettings?.receiptFooter || t('receipt.footerFallback')}
          </p>

          {/* Watermark */}
          {!storeSettings?.hideWatermark && (
            <div className="text-center text-[9px] text-gray-400 mt-2 pt-1 border-t border-dotted border-gray-200 space-y-0.5">
              <p>{t('receipt.watermarkLine1')}</p>
              <p className="font-semibold">{t('receipt.watermarkLine2')}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-1 mt-3">
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3 px-1" onClick={handleDownload} disabled={generating}>
            <Download className="w-4 h-4" />
            <span className="text-[9px]">{t('receipt.download')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3 px-1" onClick={handleShare} disabled={generating}>
            <Share2 className="w-4 h-4" />
            <span className="text-[9px]">{t('receipt.share')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3 px-1" onClick={handleBluetoothPrint} disabled={generating}>
            <Printer className="w-4 h-4" />
            <span className="text-[9px]">{t('receipt.print')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3 px-1" onClick={handlePrintKitchenTicket} disabled={generating}>
            <Utensils className="w-4 h-4 text-orange-600" />
            <span className="text-[9px]">{t('receipt.printKitchen')}</span>
          </Button>
        </div>

        <Button variant="secondary" className="w-full mt-1" onClick={onClose}>
          {t('receipt.done')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
