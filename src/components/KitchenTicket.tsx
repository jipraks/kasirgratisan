import { useRef, useState } from 'react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { Download, Share2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Transaction, StoreSettings, TransactionItemRecord } from '@/lib/db';
import { isNativePlatform, printRawNativeBluetooth, getKitchenTicketESCPOSData } from '@/lib/printer';
import { Capacitor } from '@capacitor/core';
import { downloadOrShareFile } from '@/lib/file-utils';
import { getDateLocale } from '@/i18n';

interface KitchenTicketProps {
  open: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  cashierName?: string;
}

export default function KitchenTicket({ open, onClose, transaction, items, storeSettings, cashierName }: KitchenTicketProps) {
  const { t, i18n } = useTranslation('settings');
  const ticketRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const dateLocale = getDateLocale(i18n.language);

  const storeName = storeSettings?.storeName || t('receipt.storeFallback');

  const captureTicket = async (): Promise<HTMLCanvasElement | null> => {
    if (!ticketRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
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
    const canvas = await captureTicket();
    if (!canvas) return;
    try {
      const fileName = `kitchen-${transaction.receiptNumber}.png`;
      const dataUrl = canvas.toDataURL('image/png');
      await downloadOrShareFile(dataUrl, {
        fileName,
        mimeType: 'image/png',
        dialogTitle: t('receipt.toast.downloadSuccess'),
        shareTitle: t('kitchenTicket.title'),
        shareText: t('receipt.shareText', { storeName }),
      });
      toast.success(t('receipt.toast.downloadSuccess'));
    } catch (err) {
      console.error(err);
      toast.error(t('common:files.downloadFailed'));
    }
  };

  const handleShare = async () => {
    const canvas = await captureTicket();
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = `kitchen-${transaction.receiptNumber}.png`;

      if (Capacitor.isNativePlatform()) {
        await downloadOrShareFile(dataUrl, {
          fileName,
          mimeType: 'image/png',
          dialogTitle: t('kitchenTicket.title'),
          shareTitle: t('kitchenTicket.title'),
          shareText: t('receipt.shareText', { storeName }),
        });
        return;
      }

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      if (navigator.share) {
        const file = new File([blob], fileName, { type: 'image/png' });
        await navigator.share({
          title: t('kitchenTicket.title'),
          text: t('receipt.shareText', { storeName }),
          files: [file],
        });
      } else {
        const text = encodeURIComponent(
          `[KITCHEN TICKET] ${transaction.receiptNumber} - ${transaction.customerName || ''} - Meja ${transaction.tableNumber || '-'}`
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
    const printData = { transaction, items, cashierName };

    if (isNativePlatform()) {
      const rawText = getKitchenTicketESCPOSData(printData);
      const textBytes = new TextEncoder().encode(rawText);
      await printRawNativeBluetooth(textBytes, toast);
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
          <DialogTitle className="text-center">{t('kitchenTicket.title')}</DialogTitle>
        </DialogHeader>

        {/* Ticket preview - this gets captured as image */}
        <div ref={ticketRef} className="bg-white text-black p-4 rounded-lg mx-auto" style={{ width: '280px', fontFamily: 'monospace', fontSize: '12px' }}>
          {/* Header */}
          <div className="text-center mb-2">
            <p className="font-bold text-base">KITCHEN TICKET</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Ticket info */}
          <div className="flex justify-between text-[10px]">
            <span>No: {transaction.receiptNumber}</span>
          </div>
          <div className="flex justify-between text-[10px] mb-1">
            <span>{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</span>
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
            <div key={i} className="mb-2 flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-[11px] font-bold leading-tight">{item.quantity} x {item.productName}</p>
                {item.notes && <p className="text-[10px] text-gray-700 italic font-semibold mt-0.5">  * {t('common:printer.itemNote')}: {item.notes}</p>}
              </div>
              <div className="w-4 h-4 border border-black rounded-sm shrink-0 mt-0.5" />
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2" />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleDownload} disabled={generating}>
            <Download className="w-5 h-5" />
            <span className="text-[10px]">{t('receipt.download')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleShare} disabled={generating}>
            <Share2 className="w-5 h-5" />
            <span className="text-[10px]">{t('receipt.share')}</span>
          </Button>
          <Button variant="outline" className="flex flex-col items-center gap-1 h-auto py-3" onClick={handleBluetoothPrint} disabled={generating}>
            <Printer className="w-5 h-5" />
            <span className="text-[10px]">{t('receipt.print')}</span>
          </Button>
        </div>

        <Button variant="secondary" className="w-full mt-1" onClick={onClose}>
          {t('kitchenTicket.done', 'Selesai')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
