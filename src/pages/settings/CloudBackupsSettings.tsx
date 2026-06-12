import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link } from 'react-router-dom';
import { ChevronLeft, HardDrive, UploadCloud, DownloadCloud, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useCloudAuth } from '@/hooks/use-cloud-auth';
import { listBackups, uploadBackup, downloadBackup, deleteBackup, type CloudBackup } from '@/lib/cloud-api';
import { buildBackupJsonString, backupFileName, restoreFromBackupData } from '@/lib/backup';

const PAGE_SIZE = 10;
const fmtMb = (mb: number) => `${mb.toFixed(2)} MB`;

export default function CloudBackupsSettings() {
  const { can } = useAuth();
  const { isLoggedIn, isSubscribed, profile, refreshProfile } = useCloudAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<CloudBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudBackup | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    try {
      const { items, pagination } = await listBackups({ page: p, limit: PAGE_SIZE });
      setBackups((prev) => (append ? [...prev, ...items] : items));
      setPage(pagination.page);
      setHasMore(pagination.hasMore);
    } catch {
      /* diabaikan */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn && isSubscribed) load(1, false);
  }, [isLoggedIn, isSubscribed, load]);

  if (!can('manage_backup')) {
    return <LockedPage title="Backup Tersimpan" permissionLabel="Kelola Backup" />;
  }

  const handleBackupNow = async () => {
    setBusy('upload');
    try {
      const json = await buildBackupJsonString();
      await uploadBackup(json, backupFileName());
      if (storeSettings?.id) await db.storeSettings.update(storeSettings.id, { lastCloudBackupAt: new Date() });
      await Promise.all([refreshProfile(), load(1, false)]);
      toast.success('Backup ke cloud berhasil');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal backup ke cloud');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setBusy(`restore:${target.id}`);
    try {
      const data = await downloadBackup(target.id);
      await restoreFromBackupData(data);
      toast.success('Data berhasil di-restore dari cloud!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal restore dari cloud');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusy(`delete:${target.id}`);
    try {
      await deleteBackup(target.id);
      await Promise.all([refreshProfile(), load(1, false)]);
      toast.success('Backup cloud dihapus');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus backup');
    } finally {
      setBusy(null);
    }
  };

  const usage = profile?.storageUsage;

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings/cloud-backup">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <HardDrive className="h-5 w-5 text-primary" />
          Backup Tersimpan
        </h1>
      </div>

      {!isLoggedIn || !isSubscribed ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Aktifkan langganan cloud dulu untuk menyimpan backup.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              {usage && (
                <p className="text-xs text-muted-foreground">
                  {fmtMb(usage.usedMb)} dari {fmtMb(usage.limitMb)} terpakai
                </p>
              )}
              <Button className="h-11 w-full rounded-full gap-2 font-semibold" disabled={busy === 'upload'} onClick={handleBackupNow}>
                {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Backup ke Cloud Sekarang
              </Button>
              {storeSettings?.lastCloudBackupAt && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Backup cloud terakhir: {new Date(storeSettings.lastCloudBackupAt).toLocaleString('id-ID')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-4 space-y-2">
              {loading && backups.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : backups.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Belum ada backup di cloud</p>
              ) : (
                <>
                  {backups.map((b) => (
                    <div key={b.id} className="flex items-center garounded-2xl p-2 border p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{b.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmtMb(b.fileSize / (1024 * 1024))} · {format(new Date(b.createdAt), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" title="Restore" disabled={!!busy} onClick={() => setRestoreTarget(b)}>
                        {busy === `restore:${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0 text-destructive" title="Hapus" disabled={!!busy} onClick={() => setDeleteTarget(b)}>
                        {busy === `delete:${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                  {hasMore && (
                    <Button variant="ghost" size="sm" className="w-full h-8 text-xs" disabled={loading} onClick={() => load(page + 1, true)}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Muat lebih banyak'}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore dari cloud?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua data lokal saat ini akan <strong>diganti</strong> dengan isi backup "{restoreTarget?.fileName}". Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus backup cloud?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.fileName}" akan dihapus permanen dari cloud.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
