import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Link } from 'react-router-dom';
import {
  Cloud,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CheckCircle2,
  Loader2,
  CreditCard,
  Clock,
  HardDrive,
  History,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { isNativePlatform } from '@/lib/printer';
import { nativeGoogleSignIn } from '@/lib/google-auth';
import { useCloudAuth } from '@/hooks/use-cloud-auth';
import { fetchPlans, checkoutPlan, verifyPayment, listBackups, type Plan } from '@/lib/cloud-api';
import { buildBackupJsonString } from '@/lib/backup';

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtMb = (mb: number) => `${mb.toFixed(2)} MB`;
const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const INTERVAL_LABEL: Record<string, string> = {
  off: 'Nonaktif',
  hourly: 'Setiap beberapa jam',
  daily: 'Harian',
  weekly: 'Mingguan',
};

export default function CloudBackupSettings() {
  const { can } = useAuth();
  const { isLoggedIn, googleUser, profile, loadingProfile, isSubscribed, login, logout, refreshProfile } = useCloudAuth();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const [plans, setPlans] = useState<Plan[]>([]);
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [backupCount, setBackupCount] = useState<number | null>(null);
  const [backupSizeBytes, setBackupSizeBytes] = useState<number | null>(null);
  const [showPlans, setShowPlans] = useState(false); // toggle daftar paket saat sudah berlangganan

  const loadPlans = useCallback(async () => {
    try {
      setPlans(await fetchPlans());
    } catch {
      /* diabaikan */
    }
  }, []);

  const loadBackupCount = useCallback(async () => {
    try {
      const { pagination } = await listBackups({ page: 1, limit: 1 });
      setBackupCount(pagination.totalItems);
    } catch {
      setBackupCount(null);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadPlans();
      // Ukur ukuran file backup saat ini untuk estimasi kapasitas paket.
      buildBackupJsonString()
        .then((json) => setBackupSizeBytes(new Blob([json]).size))
        .catch(() => setBackupSizeBytes(null));
    }
  }, [isLoggedIn, loadPlans]);

  useEffect(() => {
    if (isLoggedIn && isSubscribed) loadBackupCount();
  }, [isLoggedIn, isSubscribed, loadBackupCount]);

  if (!can('manage_backup')) {
    return <LockedPage title="Cloud Backup" permissionLabel="Kelola Backup" />;
  }

  const handleNativeLogin = async () => {
    setBusy('login');
    try {
      const idToken = await nativeGoogleSignIn();
      await login(idToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login Google gagal');
    } finally {
      setBusy(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setBusy(`checkout:${planId}`);
    try {
      const result = await checkoutPlan(planId, { redirectURL: `${window.location.origin}/settings/cloud-backup` });
      setPendingTxId(result.transaction.id);
      window.open(result.paymentLink, '_blank');
      toast.info('Selesaikan pembayaran, lalu tekan "Saya sudah bayar".');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memulai pembayaran');
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    if (!pendingTxId) return;
    setBusy('verify');
    try {
      const result = await verifyPayment(pendingTxId);
      if (result.transaction.status === 'COMPLETED') {
        await refreshProfile();
        setPendingTxId(null);
        setShowPlans(false);
        toast.success('Pembayaran berhasil! Langganan aktif. 🎉');
      } else {
        toast.info('Pembayaran belum terdeteksi. Coba lagi beberapa saat.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal verifikasi pembayaran');
    } finally {
      setBusy(null);
    }
  };

  const usage = profile?.storageUsage;
  const usagePct = usage && usage.limitMb > 0 ? Math.min(100, (usage.usedMb / usage.limitMb) * 100) : 0;
  const currentPlanId = profile?.subscription?.planId;
  const planButtonLabel = (planId: string) =>
    !isSubscribed ? 'Langganan' : planId === currentPlanId ? 'Perpanjang' : 'Pilih';

  const plansList = (
    <>
      <div className="space-y-2">
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Memuat paket…</p>
        ) : (
          plans.map((plan) => {
            const est = backupSizeBytes
              ? Math.max(1, Math.floor((plan.storageLimitMb * 1024 * 1024) / backupSizeBytes))
              : null;
            const isCurrent = isSubscribed && plan.id === currentPlanId;
            return (
              <div key={plan.id} className={`flex items-center justify-between rounded-2xl border p-3.5 ${isCurrent ? 'border-primary/40 bg-primary/5' : ''}`}>
                <div>
                  <p className="text-sm font-semibold">
                    {plan.name}
                    {isCurrent && <span className="ml-1.5 text-[10px] font-medium text-primary">(paket aktif)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{rp(plan.price)} / bulan · {plan.storageLimitMb} MB</p>
                  {est != null && (
                    <p className="text-[11px] text-success font-medium mt-0.5">≈ {est.toLocaleString('id-ID')} file backup</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isSubscribed && !isCurrent ? 'outline' : 'default'}
                  className="h-8"
                  disabled={busy === `checkout:${plan.id}`}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {busy === `checkout:${plan.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : planButtonLabel(plan.id)}
                </Button>
              </div>
            );
          })
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        *Estimasi berdasarkan ukuran data saat ini; bisa berubah seiring data toko bertambah.
      </p>
    </>
  );

  const interval = storeSettings?.cloudAutoBackupInterval ?? 'off';
  const intervalSubtitle =
    interval === 'hourly'
      ? `Setiap ${storeSettings?.cloudAutoBackupHours ?? 6} jam`
      : INTERVAL_LABEL[interval] ?? 'Nonaktif';

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Cloud className="h-5 w-5 text-primary" />
          Cloud Backup
        </h1>
      </div>

      {!isLoggedIn ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-5 space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Cloud className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Backup Otomatis ke Cloud</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Login dengan akun Google untuk mengaktifkan backup data toko ke cloud secara otomatis dan aman.
              </p>
            </div>
            <div className="flex justify-center">
              {isNativePlatform() ? (
                <Button className="h-11 gap-2" disabled={busy === 'login'} onClick={handleNativeLogin}>
                  {busy === 'login' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                  Lanjut dengan Google
                </Button>
              ) : (
                <GoogleLogin
                  onSuccess={(cr) => {
                    if (cr.credential) login(cr.credential).catch(() => toast.error('Gagal login'));
                    else toast.error('Login Google gagal');
                  }}
                  onError={() => toast.error('Login Google gagal')}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Account */}
          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3.5">
              {googleUser?.picture ? (
                <img src={googleUser.picture} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {googleUser?.name?.charAt(0) ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{googleUser?.name ?? 'Akun Google'}</p>
                <p className="text-xs text-muted-foreground truncate">{googleUser?.email}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={logout}>
                <LogOut className="h-4 w-4" /> Keluar
              </Button>
            </CardContent>
          </Card>

          {/* Subscription / quota */}
          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              {loadingProfile && !profile ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : isSubscribed && usage ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-semibold">{profile?.subscription?.plan.name ?? 'Langganan aktif'}</span>
                    </div>
                    {profile?.subscription?.endDate && (
                      <span className="text-[10px] text-muted-foreground">
                        s/d {format(new Date(profile.subscription.endDate), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{fmtMb(usage.usedMb)} terpakai</span>
                      <span>dari {fmtMb(usage.limitMb)}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-9"
                      disabled={!currentPlanId || busy === `checkout:${currentPlanId}`}
                      onClick={() => currentPlanId && handleSubscribe(currentPlanId)}
                    >
                      {busy === `checkout:${currentPlanId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perpanjang'}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-9" onClick={() => setShowPlans((v) => !v)}>
                      {showPlans ? 'Tutup' : 'Ubah Paket'}
                    </Button>
                  </div>
                  {showPlans && (
                    <div className="pt-1 space-y-3 border-t">
                      <p className="text-xs text-muted-foreground pt-2">
                        Pilih paket sama untuk memperpanjang (sisa hari ditambahkan), atau paket lain untuk ganti paket.
                      </p>
                      {plansList}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Pilih Paket Cloud</p>
                  <p className="text-xs text-muted-foreground">
                    Berlangganan untuk mengaktifkan backup ke cloud.
                    {backupSizeBytes != null && (
                      <> Ukuran backup datamu saat ini ~<span className="font-medium">{fmtSize(backupSizeBytes)}</span>.</>
                    )}
                  </p>
                  {plansList}
                </div>
              )}

              {pendingTxId && (
                <Button variant="outline" className="w-full h-10 gap-2" disabled={busy === 'verify'} onClick={handleVerify}>
                  {busy === 'verify' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Saya sudah bayar — Verifikasi
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {/* Auto-backup & backup tersimpan butuh langganan aktif */}
            {isSubscribed && (
              <>
                <MenuCard
                  to="/settings/cloud-backup/auto"
                  icon={<Clock className="h-4 w-4" />}
                  title="Pengaturan Backup Otomatis"
                  subtitle={intervalSubtitle}
                />
                <MenuCard
                  to="/settings/cloud-backup/backups"
                  icon={<HardDrive className="h-4 w-4" />}
                  title="Backup Tersimpan"
                  subtitle={
                    backupCount === null
                      ? (usage ? fmtMb(usage.usedMb) : '—')
                      : `${backupCount} backup${usage ? ` · ${fmtMb(usage.usedMb)}` : ''}`
                  }
                />
              </>
            )}
            {/* Riwayat transaksi selalu tampil saat login — agar bisa cek pembayaran PENDING walau belum berlangganan */}
            <MenuCard
              to="/settings/cloud-backup/history"
              icon={<History className="h-4 w-4" />}
              title="Riwayat Transaksi"
              subtitle="Lihat pembelian & cek status pembayaran"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuCard({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link to={to}>
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-3.5 flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
