import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { Download, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Shift, StoreSettings } from '@/lib/db';

interface ShiftReportReceiptProps {
  open: boolean;
  onClose: () => void;
  shift: Shift;
  storeSettings?: StoreSettings | null;
  openedByName?: string;
  closedByName?: string;
}

const money = (value = 0) => `Rp ${value.toLocaleString('id-ID')}`;

export default function ShiftReportReceipt({ open, onClose, shift, storeSettings, openedByName, closedByName }: ShiftReportReceiptProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const difference = shift.cashDifference ?? 0;

  const captureReport = async (): Promise<HTMLCanvasElement | null> => {
    if (!reportRef.current) return null;
    setGenerating(true);
    try {
      return await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
    } catch {
      toast.error('Gagal membuat gambar laporan shift');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const canvas = await captureReport();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `laporan-shift-${shift.code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Laporan shift berhasil diunduh');
  };

  const handleShare = async () => {
    const canvas = await captureReport();
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      if (navigator.share) {
        const file = new File([blob], `laporan-shift-${shift.code}.png`, { type: 'image/png' });
        await navigator.share({
          title: `Laporan Shift ${shift.code}`,
          text: `Laporan shift ${storeSettings?.storeName || 'Toko'} - ${shift.code}`,
          files: [file],
        });
        return;
      }

      const text = encodeURIComponent(
        `*${storeSettings?.storeName || 'Toko'}*\nLaporan Shift: ${shift.code}\nTotal Penjualan: ${money(shift.totalSales)}\nSelisih Kas: ${money(difference)}`,
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        toast.error('Gagal membagikan laporan shift');
      }
    }
  };

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm print:max-w-none print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Laporan Shift</DialogTitle>
        </DialogHeader>

        <div ref={reportRef} className="shift-report-print space-y-4 rounded-lg bg-white p-4 font-mono text-sm text-black">
          <div className="space-y-1 text-center">
            <p className="text-base font-bold">{storeSettings?.storeName || 'KasirGratisan'}</p>
            {storeSettings?.address && <p className="text-xs text-gray-500">{storeSettings.address}</p>}
            {storeSettings?.phone && <p className="text-xs text-gray-500">{storeSettings.phone}</p>}
            <div className="my-3 border-t border-dashed border-gray-400" />
            <p className="font-bold">LAPORAN SHIFT</p>
            <p className="text-xs">{shift.code}</p>
          </div>

          <div className="space-y-1 text-xs">
            <Row label="Status" value={shift.status === 'closed' ? 'Ditutup' : 'Aktif'} />
            <Row label="Dibuka" value={format(shift.openedAt, 'dd MMM yyyy HH:mm', { locale: localeId })} />
            {shift.closedAt && <Row label="Ditutup" value={format(shift.closedAt, 'dd MMM yyyy HH:mm', { locale: localeId })} />}
            <Row label="Pembuka" value={openedByName || '-'} />
            <Row label="Penutup" value={closedByName || '-'} />
          </div>

          <div className="border-t border-dashed border-gray-400" />

          <div className="space-y-1 text-xs">
            <Row label="Jumlah Transaksi" value={`${shift.totalTransactions} transaksi`} />
            <Row label="Total Penjualan" value={money(shift.totalSales)} />
            <Row label="Penjualan Tunai" value={money(shift.totalCashSales)} />
            <Row label="Penjualan Non Tunai" value={money(shift.totalNonCashSales)} />
            <Row label="Profit" value={money(shift.totalProfit)} />
          </div>

          <div className="border-t border-dashed border-gray-400" />

          <div className="space-y-1 text-xs">
            <Row label="Kas Awal" value={money(shift.openingCash)} />
            <Row label="Expected Cash" value={money(shift.expectedCash ?? shift.openingCash + shift.totalCashSales)} />
            <Row label="Kas Aktual" value={money(shift.closingCash ?? 0)} />
            <Row label="Selisih" value={money(difference)} strong valueClass={difference < 0 ? 'text-destructive' : difference > 0 ? 'text-success' : ''} />
          </div>

          {shift.notes && (
            <>
              <div className="border-t border-dashed border-gray-400" />
              <div className="text-xs">
                <p className="font-semibold">Catatan:</p>
                <p>{shift.notes}</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 print:hidden">
          <Button variant="outline" className="flex h-auto flex-col items-center gap-1 py-3" onClick={handleDownload} disabled={generating}>
            <Download className="h-5 w-5" />
            <span className="text-[10px]">Unduh</span>
          </Button>
          <Button variant="outline" className="flex h-auto flex-col items-center gap-1 py-3" onClick={handleShare} disabled={generating}>
            <Share2 className="h-5 w-5" />
            <span className="text-[10px]">Bagikan</span>
          </Button>
          <Button variant="outline" className="flex h-auto flex-col items-center gap-1 py-3" onClick={handlePrint} disabled={generating}>
            <Printer className="h-5 w-5" />
            <span className="text-[10px]">Cetak</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong, valueClass }: { label: string; value: string; strong?: boolean; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={`${strong ? 'font-bold' : 'font-medium'} text-right ${valueClass ?? ''}`}>{value}</span>
    </div>
  );
}
