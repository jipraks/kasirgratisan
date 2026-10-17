import { X, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { buildBackupJsonString, backupFileName } from '@/lib/backup';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';
import i18n, { getDateLocale } from '@/i18n';

const backupText = (key: string) => i18n.t(`backupFile.${key}`, { ns: 'common' }) as string;

interface BackupReminderProps {
  lastBackupAt: Date | string | null;
  onDismiss: () => void;
  onBackup: () => void;
}

export default function BackupReminder({ lastBackupAt, onDismiss, onBackup }: BackupReminderProps) {
  const { t, i18n } = useTranslation('settings');
  const dateLocale = getDateLocale(i18n.language);

  const timeAgo = lastBackupAt
    ? formatDistanceToNow(lastBackupAt instanceof Date ? lastBackupAt : new Date(lastBackupAt), { addSuffix: true, locale: dateLocale })
    : null;

  return (
    <Card className="border-warning/30 bg-warning/5 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0 mt-0.5">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t('backupReminder.title')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastBackupAt
                ? t('backupReminder.lastBackup', { time: timeAgo })
                : t('backupReminder.neverBackedUp')}
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
          {t('backupReminder.backupNow')}
        </Button>
      </CardContent>
    </Card>
  );
}

// Utility to check if backup reminder should show
export function shouldShowBackupReminder(lastBackupAt: Date | string | null): boolean {
  if (!lastBackupAt) return true;
  const date = lastBackupAt instanceof Date ? lastBackupAt : new Date(lastBackupAt);
  const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 24;
}

// Export all data as JSON and trigger download
export async function exportBackupData() {
  const fileName = backupFileName();
  const jsonString = await buildBackupJsonString();

  if (Capacitor.isNativePlatform()) {
    try {
      // Save JSON file in cache directory so we can share it
      const result = await Filesystem.writeFile({
        path: fileName,
        data: jsonString,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      // Share the written file using Android system share dialog
      await Share.share({
        title: backupText('shareTitle'),
        text: backupText('shareText'),
        url: result.uri,
        dialogTitle: backupText('dialogTitle'),
      });

      toast.success(backupText('success'));
    } catch {
      toast.error(backupText('failed'));
    }
  } else {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(backupText('downloaded'));
  }

  // Update last backup time
  const settings = await db.storeSettings.toCollection().first();
  if (settings?.id) {
    await db.storeSettings.update(settings.id, { lastBackupAt: new Date() });
  }
}
