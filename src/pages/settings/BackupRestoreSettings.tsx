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

export default function BackupRestoreSettings() {
  const { can } = useAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  if (!can('manage_backup')) {
    return <LockedPage title="Backup & Restore" permissionLabel="Kelola Backup" />;
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
        if (!text.trim()) { toast.error('File kosong'); return; }
        const data = JSON.parse(text);
        await restoreFromBackupData(data);
        toast.success('Data berhasil di-restore!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membaca file');
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Download className="h-5 w-5 text-primary" />
          Backup & Restore
        </h1>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="p-4 space-y-2">
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={exportBackupData}>
            <Download className="h-4 w-4" /> Export Backup (JSON)
          </Button>
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleImport}>
            <Upload className="h-4 w-4" /> Import / Restore Data
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">Terakhir backup: {new Date(storeSettings.lastBackupAt).toLocaleString('id-ID')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
