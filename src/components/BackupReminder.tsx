import { X, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface BackupReminderProps {
  lastBackupAt: Date | null;
  onDismiss: () => void;
  onBackup: () => void;
}

export default function BackupReminder({ lastBackupAt, onDismiss, onBackup }: BackupReminderProps) {
  const timeAgo = lastBackupAt
    ? formatDistanceToNow(lastBackupAt, { addSuffix: true, locale: id })
    : null;

  return (
    <Card className="border-warning/30 bg-warning/5 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0 mt-0.5">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Backup Data Kamu</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastBackupAt
                ? `Terakhir backup ${timeAgo}`
                : 'Kamu belum pernah backup data'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={onDismiss} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 h-8 text-xs font-semibold border-warning/30 text-warning hover:bg-warning/10"
          onClick={onBackup}
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Backup Sekarang
        </Button>
      </CardContent>
    </Card>
  );
}

// Utility to check if backup reminder should show
export function shouldShowBackupReminder(lastBackupAt: Date | null): boolean {
  if (!lastBackupAt) return true; // never backed up
  const hoursSince = (Date.now() - lastBackupAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 24;
}

// Export all data as JSON and trigger download
export async function exportBackupData() {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    suppliers: await db.suppliers.toArray(),
    stockIns: await db.stockIns.toArray(),
    stockOuts: await db.stockOuts.toArray(),
    hppHistory: await db.hppHistory.toArray(),
    paymentMethods: await db.paymentMethods.toArray(),
    transactions: await db.transactions.toArray(),
    transactionItems: await db.transactionItems.toArray(),
    storeSettings: await db.storeSettings.toArray(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kasirgratisan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Update last backup time
  const settings = await db.storeSettings.toCollection().first();
  if (settings?.id) {
    await db.storeSettings.update(settings.id, { lastBackupAt: new Date() });
  }
}
