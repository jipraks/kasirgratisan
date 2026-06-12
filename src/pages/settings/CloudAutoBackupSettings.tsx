import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link } from 'react-router-dom';
import { ChevronLeft, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useCloudAuth } from '@/hooks/use-cloud-auth';

type Interval = 'off' | 'hourly' | 'daily' | 'weekly';
const DEFAULT_HOURS = 6;

export default function CloudAutoBackupSettings() {
  const { can } = useAuth();
  const { isLoggedIn, isSubscribed } = useCloudAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  if (!can('manage_backup')) {
    return <LockedPage title="Backup Otomatis" permissionLabel="Kelola Backup" />;
  }

  const interval: Interval = (storeSettings?.cloudAutoBackupInterval as Interval) ?? 'off';
  const hours = storeSettings?.cloudAutoBackupHours ?? DEFAULT_HOURS;

  const setInterval = async (value: Interval) => {
    if (!storeSettings?.id) return;
    const patch: { cloudAutoBackupInterval: Interval; cloudAutoBackupHours?: number } = { cloudAutoBackupInterval: value };
    if (value === 'hourly' && !storeSettings.cloudAutoBackupHours) patch.cloudAutoBackupHours = DEFAULT_HOURS;
    await db.storeSettings.update(storeSettings.id, patch);
    const label =
      value === 'off' ? 'dimatikan'
      : value === 'hourly' ? `setiap ${patch.cloudAutoBackupHours ?? hours} jam`
      : value === 'daily' ? 'harian'
      : 'mingguan';
    toast.success(`Auto-backup ${label}`);
  };

  const saveHours = async (raw: string) => {
    if (!storeSettings?.id) return;
    const parsed = Math.floor(Number(raw));
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error('Jam minimal 1');
      return;
    }
    await db.storeSettings.update(storeSettings.id, { cloudAutoBackupHours: parsed });
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings/cloud-backup">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Clock className="h-5 w-5 text-primary" />
          Backup Otomatis
        </h1>
      </div>

      {!isLoggedIn || !isSubscribed ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Aktifkan langganan cloud dulu untuk mengatur backup otomatis.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Jadwal Backup Otomatis</p>
              <Select value={interval} onValueChange={(v) => setInterval(v as Interval)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Nonaktif</SelectItem>
                  <SelectItem value="hourly">Setiap beberapa jam</SelectItem>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                </SelectContent>
              </Select>
              {interval === 'hourly' && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Setiap</span>
                  <Input
                    key={hours}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={hours}
                    onBlur={(e) => saveHours(e.target.value)}
                    className="h-9 w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground">jam</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Backup berjalan otomatis saat aplikasi dibuka bila sudah lewat dari interval. (PWA tidak menjalankan backup di latar belakang saat aplikasi tertutup.)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
