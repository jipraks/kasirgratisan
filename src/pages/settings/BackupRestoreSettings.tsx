import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Download, Upload, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { exportBackupData } from '@/components/BackupReminder';
import { restoreFromBackupData } from '@/lib/backup';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { NUMBER_LOCALE } from '@/lib/currency';


export default function BackupRestoreSettings() {
  const { t, i18n } = useTranslation('settings');
  const { can } = useAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const numberLocale = NUMBER_LOCALE;

  if (!can('manage_backup')) {
    return <LockedPage title={t('backupRestore.locked.title')} permissionLabel={t('backupRestore.locked.permissionLabel')} />;
  }

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (!text.trim()) { toast.error(t('backupRestore.emptyFile')); return; }
        const data = JSON.parse(text);
        await restoreFromBackupData(data);
        toast.success(t('backupRestore.restoreSuccess'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('backupRestore.readError'));
      }
    };
    input.click();
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          {t('backupRestore.title')}
        </h1>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-2">
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={exportBackupData}>
            <Download className="w-4 h-4" /> {t('backupRestore.exportButton')}
          </Button>
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleImport}>
            <Upload className="w-4 h-4" /> {t('backupRestore.importButton')}
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">{t('backupRestore.lastBackup', { time: new Date(storeSettings.lastBackupAt).toLocaleString(numberLocale) })}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
