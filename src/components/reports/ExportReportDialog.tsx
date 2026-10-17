import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportReportToExcel } from '@/lib/export-report';

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Rentang default saat dialog dibuka (mengikuti periode aktif di Laporan),
   * dalam epoch ms agar identitasnya stabil antar-render parent.
   */
  defaultStartMs: number;
  defaultEndMs: number;
}

export default function ExportReportDialog({
  open,
  onOpenChange,
  defaultStartMs,
  defaultEndMs,
}: ExportReportDialogProps) {
  const { t } = useTranslation('reports');
  const [startDate, setStartDate] = useState(() => format(defaultStartMs, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(defaultEndMs, 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  // Sinkronkan input dengan periode aktif setiap kali dialog dibuka, atau saat
  // periode aktif berubah.
  useEffect(() => {
    if (open) {
      setStartDate(format(defaultStartMs, 'yyyy-MM-dd'));
      setEndDate(format(defaultEndMs, 'yyyy-MM-dd'));
    }
  }, [open, defaultStartMs, defaultEndMs]);

  const invalidRange = !startDate || !endDate || startDate > endDate;

  const handleExport = async () => {
    if (invalidRange) {
      toast.error(t('exportDialog.invalidRangeToast'));
      return;
    }
    setExporting(true);
    try {
      const result = await exportReportToExcel(
        new Date(`${startDate}T00:00:00`),
        new Date(`${endDate}T00:00:00`),
      );
      if (result.txCount === 0 && result.expenseCount === 0) {
        toast.info(t('exportDialog.noDataToast'));
      } else {
        toast.success(
          t('exportDialog.successToast', { txCount: result.txCount, expenseCount: result.expenseCount }),
        );
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Report export failed:', err);
      toast.error(t('exportDialog.errorToast'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !exporting && onOpenChange(o)}>
      <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            {t('exportDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('exportDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="export-start" className="text-xs">
                {t('exportDialog.fromDate')}
              </Label>
              <Input
                id="export-start"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="export-end" className="text-xs">
                {t('exportDialog.toDate')}
              </Label>
              <Input
                id="export-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {invalidRange && startDate && endDate && (
            <p className="text-xs text-destructive">
              {t('exportDialog.invalidRange')}
            </p>
          )}

          <Button
            className="w-full h-12 text-base font-semibold gap-2"
            onClick={handleExport}
            disabled={exporting || invalidRange}
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {t('exportDialog.creating')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> {t('exportDialog.exportButton')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
