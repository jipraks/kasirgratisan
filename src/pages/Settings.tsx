import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Store, CreditCard, Tag, Download, Edit2, Info, Truck, ArrowDownToLine, ArrowUpFromLine, ChevronRight, Receipt, Palette, HardDrive, Package, Camera, X, Ruler, Users as UsersIcon, ShieldCheck, LogOut, Smartphone, CheckCircle2, Globe, Share2, Wallet, Sparkles, LineChart, Cloud, Clock3 } from 'lucide-react';
import WhatsNewModal from '@/components/WhatsNewModal';
import { FEATURES, getUnseenFeatures } from '@/lib/whats-new';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { compressImage } from '@/lib/image-utils';
import { useAuth } from '@/hooks/use-auth';
import { useCloudAuth } from '@/hooks/use-cloud-auth';
import { createUser, isValidPin, isValidUsername, saveSession } from '@/lib/auth';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { isNativePlatform, getDefaultBluetoothPrinter, setDefaultBluetoothPrinter, listPairedBluetoothDevices, type BluetoothPrinter } from '@/lib/printer';
import { Printer } from 'lucide-react';
import { APP_VERSION } from '@/lib/app-version';

export default function Pengaturan() {
  const isNative = isNativePlatform();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const usersCount = useLiveQuery(() => db.users.count());
  const units = useLiveQuery(() => db.units.where('isDeleted').equals(0).toArray());
  const expenseCategories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );

  const { multiUserEnabled, currentUser, isOwner, can, logout } = useAuth();
  const { isLoggedIn: cloudLoggedIn, isSubscribed: cloudSubscribed } = useCloudAuth();

  // PWA install
  const { canInstall, isInstalled, isIOS, install } = usePWAInstall();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  // Multi-user activation
  const [activateOpen, setActivateOpen] = useState(false);
  const [actName, setActName] = useState('');
  const [actUsername, setActUsername] = useState('');
  const [actPin, setActPin] = useState('');
  const [actPinConfirm, setActPinConfirm] = useState('');
  const [activating, setActivating] = useState(false);

  // Disable multi-user confirmation
  const [disableOpen, setDisableOpen] = useState(false);

  // Logout confirmation
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Analytics opt-out (default: tracking on)
  const [analyticsOn, setAnalyticsOn] = useState(isAnalyticsEnabled());

  // Native Bluetooth printer settings
  const [defaultPrinter, setDefaultPrinter] = useState<BluetoothPrinter | null>(() => getDefaultBluetoothPrinter());
  const [pairedPrinters, setPairedPrinters] = useState<BluetoothPrinter[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  const refreshPairedPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const devices = await listPairedBluetoothDevices();
      setPairedPrinters(devices);
      if (devices.length === 0) {
        toast.error('Belum ada perangkat Bluetooth yang dipasangkan');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membaca daftar printer');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const selectDefaultPrinter = (printer: BluetoothPrinter) => {
    setDefaultBluetoothPrinter(printer);
    setDefaultPrinter(printer);
    toast.success(`Printer default: ${printer.name}`);
  };

  const clearDefaultPrinter = () => {
    setDefaultBluetoothPrinter(null);
    setDefaultPrinter(null);
    toast.success('Printer default dihapus');
  };

  const handleToggleAnalytics = (enabled: boolean) => {
    setAnalyticsOn(enabled);
    setAnalyticsEnabled(enabled);
    toast.success(enabled ? 'Analitik diaktifkan' : 'Analitik dinonaktifkan');
  };

  // Store edit
  const [storeDialog, setStoreDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddr, setStoreAddr] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeLogo, setStoreLogo] = useState<string | undefined>(undefined);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Storage info (CR-9)
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageUsage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      });
    }
  }, []);

  // What's New
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const unseenFeatures = useMemo(
    () => getUnseenFeatures(storeSettings?.seenWhatsNewIds),
    [storeSettings?.seenWhatsNewIds],
  );

  const openStoreEdit = () => {
    setStoreName(storeSettings?.storeName ?? '');
    setStoreAddr(storeSettings?.address ?? '');
    setStorePhone(storeSettings?.phone ?? '');
    setStoreLogo(storeSettings?.logo);
    setStoreDialog(true);
  };

  const saveStore = async () => {
    if (storeSettings?.id) {
      await db.storeSettings.update(storeSettings.id, { storeName: storeName.trim(), address: storeAddr.trim(), phone: storePhone.trim(), logo: storeLogo || undefined });
      toast.success('Info toko disimpan');
      setStoreDialog(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setStoreLogo(compressed);
    } catch {
      toast.error('Gagal memproses gambar');
    }
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // === Multi-user activation ===

  const openActivateDialog = () => {
    setActName('');
    setActUsername('');
    setActPin('');
    setActPinConfirm('');
    setActivateOpen(true);
  };

  const handleActivateMultiUser = async () => {
    if (!storeSettings?.id) return;
    if (!actName.trim()) { toast.error('Nama pemilik wajib diisi'); return; }
    if (!isValidUsername(actUsername)) {
      toast.error('Username 3-20 karakter, hanya huruf/angka/underscore');
      return;
    }
    if (!isValidPin(actPin)) {
      toast.error('PIN harus 4-6 digit angka');
      return;
    }
    if (actPin !== actPinConfirm) {
      toast.error('Konfirmasi PIN tidak cocok');
      return;
    }

    setActivating(true);
    try {
      // Check if owner already exists (idempotent — safety net)
      const existingOwner = await db.users.where('role').equals('owner').first();
      let ownerId = existingOwner?.id;

      if (!existingOwner) {
        const result = await createUser({
          username: actUsername,
          pin: actPin,
          name: actName,
          role: 'owner',
          permissions: [],
        });
        if (!result.ok) {
          toast.error(result.error || 'Gagal membuat akun pemilik');
          return;
        }
        ownerId = result.userId;
      }

      // Flip the flag
      await db.storeSettings.update(storeSettings.id, { multiUserEnabled: true });

      // Persist session for the owner so they stay logged in immediately
      if (ownerId && storeSettings.deviceId) {
        saveSession(ownerId, storeSettings.deviceId);
      }

      toast.success('Multi-user aktif. Anda login sebagai pemilik.');
      setActivateOpen(false);
      // Reload so AuthProvider picks up the new session + flag from a clean state.
      window.location.reload();
    } finally {
      setActivating(false);
    }
  };

  const handleDisableMultiUser = async () => {
    if (!storeSettings?.id) return;
    await db.storeSettings.update(storeSettings.id, { multiUserEnabled: false });
    setDisableOpen(false);
    toast.success('Multi-user dinonaktifkan');
    // Force reload so AuthProvider re-evaluates state.
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    setLogoutOpen(false);
    // Reload to drop any in-memory state and route back to login screen cleanly.
    window.location.reload();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Status kartu Cloud Backup di Settings.
  const cloudAutoOn = (storeSettings?.cloudAutoBackupInterval ?? 'off') !== 'off';
  const cloudStatus = !(cloudLoggedIn && cloudSubscribed)
    ? {
        theme: 'bg-destructive/10 ring-destructive/20',
        iconWrap: 'bg-destructive/15 text-destructive',
        badge: 'bg-destructive text-white',
        badgeText: 'BELUM AKTIF',
        desc: 'Data toko belum terbackup otomatis. Aktifkan agar aman walau HP hilang, rusak, atau ganti perangkat.',
      }
    : !cloudAutoOn
    ? {
        theme: 'bg-warning/10 ring-warning/20',
        iconWrap: 'bg-warning/15 text-warning',
        badge: 'bg-warning text-white',
        badgeText: 'PERLU DIATUR',
        desc: 'Langganan aktif, tapi backup otomatis belum dinyalakan. Atur jadwalnya agar data tersimpan rutin.',
      }
    : {
        theme: 'bg-success/10 ring-success/20',
        iconWrap: 'bg-success/15 text-success',
        badge: 'bg-success text-white',
        badgeText: 'AKTIF',
        desc: 'Backup otomatis aktif. Data toko aman tersimpan di cloud.',
      };

  return (
    <div className="space-y-5 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Settings className="h-5 w-5 text-primary" />
          Pengaturan
        </h1>
      </div>

      {/* Store Info */}
      <Card
        className={`border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow ${can('manage_store_settings') ? 'cursor-pointer hover:shadow-card' : 'cursor-default opacity-90'}`}
        onClick={() => can('manage_store_settings') && openStoreEdit()}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 rounded-2xl bg-primary/10 text-primary items-center justify-center overflow-hidden shrink-0">
            {storeSettings?.logo ? (
              <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{storeSettings?.storeName || 'Toko Saya'}</p>
            <p className="text-xs text-muted-foreground">{storeSettings?.address || 'Belum diatur'}</p>
          </div>
          {can('manage_store_settings') && <Edit2 className="h-4 w-4 text-muted-foreground" />}
        </CardContent>
      </Card>

      {/* Cloud Backup — featured, status-aware */}
      {can('manage_backup') && (
        <Link to="/settings/cloud-backup" className="block mt-2">
          <Card className={`cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card overflow-hidden ring-1 ${cloudStatus.theme}`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-11 w-11 rounded-2xl items-center justify-center shrink-0 ${cloudStatus.iconWrap}`}>
                <Cloud className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold">Cloud Backup</p>
                  <span className={`text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${cloudStatus.badge}`}>
                    {cloudStatus.badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {cloudStatus.desc}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Install as App — hidden when already installed */}
      {!isInstalled && (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="flex items-center gap-3 p-3.5">
            <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Install sebagai Aplikasi</p>
              <p className="text-[10px] text-muted-foreground">
                Buka langsung dari home screen, tanpa browser
              </p>
            </div>
            {canInstall ? (
              <Button
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={async () => {
                  const ok = await install();
                  if (ok) toast.success('Berhasil install FreeKasir!');
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Install
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setInstallHelpOpen(true)}
              >
                Cara Install
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Karyawan & Akses (current user / multi-user activation) */}
      {multiUserEnabled && currentUser ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 rounded-2xl items-center justify-center shrink-0 ${currentUser.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-[10px] text-muted-foreground">
                @{currentUser.username} · {currentUser.role === 'owner' ? 'Pemilik' : 'Karyawan'}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-full px-3 text-xs text-destructive" onClick={() => setLogoutOpen(true)}>
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Karyawan & Akses links/activation */}
      {isOwner && (
        <div className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Karyawan & Akses</h2>
          {!multiUserEnabled ? (
            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center shrink-0">
                  <UsersIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Aktifkan Multi-User</p>
                  <p className="text-[10px] text-muted-foreground">
                    Buat akun karyawan dengan akses terbatas. Data Anda tetap aman.
                  </p>
                </div>
                <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={openActivateDialog}>
                  Aktifkan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Link to="/users">
                <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
                  <CardContent className="flex items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><UsersIcon className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Kelola Karyawan</p>
                      <p className="text-[10px] text-muted-foreground">{usersCount ?? 0} akun terdaftar · atur akses per karyawan</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
              <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="flex h-9 w-9 rounded-2xl bg-muted text-muted-foreground items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Multi-User Aktif</p>
                    <p className="text-[10px] text-muted-foreground">Karyawan harus login untuk akses kasir</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs text-destructive" onClick={() => setDisableOpen(true)}>
                    Nonaktifkan
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Transaksi & Stok */}
      <div className="space-y-3">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Transaksi & Stok</h2>
        <Link to="/history">
          <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><Receipt className="h-4 w-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Riwayat Transaksi</p><p className="text-[10px] text-muted-foreground">Lihat semua transaksi & cetak ulang struk</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        {can('manage_supplier') && (
          <Link to="/supplier">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-accent/10 text-accent items-center justify-center"><Truck className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Supplier</p><p className="text-[10px] text-muted-foreground">Kelola data supplier</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('manage_customers') && (
          <Link to="/customers">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><UsersIcon className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Pelanggan</p><p className="text-[10px] text-muted-foreground">Kelola data pelanggan</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('manage_stock_inout') && (
          <>
            <Link to="/stock-in">
              <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="flex h-9 w-9 rounded-2xl bg-success/10 text-success items-center justify-center"><ArrowDownToLine className="h-4 w-4" /></div>
                  <div className="flex-1"><p className="text-sm font-semibold">Stock In</p><p className="text-[10px] text-muted-foreground">Catat barang masuk & HPP otomatis</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link to="/stock-out">
              <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
                <CardContent className="flex items-center gap-3 p-3.5">
                  <div className="flex h-9 w-9 rounded-2xl bg-destructive/10 text-destructive items-center justify-center"><ArrowUpFromLine className="h-4 w-4" /></div>
                  <div className="flex-1"><p className="text-sm font-semibold">Stock Out</p><p className="text-[10px] text-muted-foreground">Catat barang keluar non-penjualan</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </>
        )}
        {(can('manage_expenses') || can('view_expenses')) && (
          <Link to="/expenses">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-warning/10 text-warning items-center justify-center"><Wallet className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Pengeluaran</p><p className="text-[10px] text-muted-foreground">Catat biaya operasional non-stok (listrik, gaji, sewa, dll)</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('view_reports') && (
          <Link to="/stock-report">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><Package className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Laporan Stok</p><p className="text-[10px] text-muted-foreground">Lihat pergerakan stok per periode</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Master Data & Preferensi */}
      <div className="space-y-3">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Master Data & Preferensi</h2>

        {can('manage_shifts') && (
          <Link to="/shifts">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><Clock3 className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Shift Kasir</p><p className="text-[10px] text-muted-foreground">Buka, tutup, dan cetak laporan shift</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/payment-methods">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><CreditCard className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Metode Pembayaran</p><p className="text-[10px] text-muted-foreground">{paymentMethods?.length ?? 0} metode · tunai, transfer, e-wallet, qris</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/product-category">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-accent/10 text-accent items-center justify-center"><Tag className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Kategori Produk</p><p className="text-[10px] text-muted-foreground">{categories?.length ?? 0} kategori</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/expense-category">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-warning/10 text-warning items-center justify-center"><Wallet className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Kategori Pengeluaran</p><p className="text-[10px] text-muted-foreground">{expenseCategories?.length ?? 0} kategori</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        <Link to="/settings/units">
          <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="flex h-9 w-9 rounded-2xl bg-primary/10 text-primary items-center justify-center"><Ruler className="h-4 w-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Satuan</p><p className="text-[10px] text-muted-foreground">{units?.length ?? 0} satuan · pcs, kg, porsi, dll</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {can('manage_store_settings') && (
          <Link to="/settings/theme">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card mb-2">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-accent/10 text-accent items-center justify-center"><Palette className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Warna Tema</p><p className="text-[10px] text-muted-foreground">Sesuaikan warna aksen aplikasi</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_backup') && (
          <Link to="/settings/backup">
            <Card className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card">
              <CardContent className="flex items-center gap-3 p-3.5">
                <div className="flex h-9 w-9 rounded-2xl bg-success/10 text-success items-center justify-center"><Download className="h-4 w-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Backup & Restore</p><p className="text-[10px] text-muted-foreground">Export / import data toko (JSON)</p></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Bluetooth Printer (APK only) */}
      {isNative && can('manage_store_settings') && (
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Printer className="h-4 w-4" /> Printer Bluetooth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-[11px] text-muted-foreground mb-1">Printer Default</p>
            {defaultPrinter ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{defaultPrinter.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{defaultPrinter.address}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={clearDefaultPrinter}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum dipilih — struk akan dicetak ke printer terpasang pertama yang ditemukan.</p>
            )}
          </div>

          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={refreshPairedPrinters} disabled={loadingPrinters}>
            <Printer className="h-4 w-4" /> {loadingPrinters ? 'Mencari...' : 'Cari Printer Terpasang'}
          </Button>

          {pairedPrinters.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Pilih printer:</p>
              {pairedPrinters.map(printer => {
                const isSelected = defaultPrinter?.address === printer.address;
                return (
                  <button
                    key={printer.address}
                    type="button"
                    onClick={() => selectDefaultPrinter(printer)}
                    className={`flex items-center justify-between w-full text-left rounded-lg border px-3 py-2 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{printer.name || 'Tanpa Nama'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{printer.address}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug">
            Pastikan printer sudah dipasangkan (paired) lewat Pengaturan Bluetooth Android terlebih dahulu.
          </p>
        </CardContent>
      </Card>
      )}

      {/* Privasi & Analitik */}
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><LineChart className="h-4 w-4" /> Privasi & Analitik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5 pr-3">
              <Label className="text-sm">Bantu Kami dengan Data Anonim</Label>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Mengirim statistik penggunaan anonim (halaman yang dibuka & aksi seperti buat produk/transaksi) untuk membantu pengembangan. Data bisnis seperti nama produk, harga, dan nominal transaksi tidak pernah dikirim.
              </p>
            </div>
            <Switch checked={analyticsOn} onCheckedChange={handleToggleAnalytics} />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-2 p-4 text-center">
           <p className="text-sm font-bold">FreeKasir</p>
           <p className="text-xs text-muted-foreground">POS Gratis untuk UMKM Indonesia 🇮🇩</p>
           <p className="text-[10px] text-muted-foreground">v{APP_VERSION} • Data tersimpan di perangkat</p>

           {/* Links */}
           <div className="flex flex-col gap-2 pt-2">
             <button
               type="button"
               onClick={() => setWhatsNewOpen(true)}
               className="flex items-center justify-center gap-2 h-9 w-full rounded-2xl border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
             >
               <Sparkles className="h-3.5 w-3.5" />
               Yang Baru di FreeKasir
               {unseenFeatures.length > 0 && (
                 <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                   {unseenFeatures.length}
                 </span>
               )}
             </button>
             <a
               href="https://kasirgratisan.fider.io"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 h-9 w-full rounded-2xl border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
             >
               💡 Request Fitur
             </a>
             <a
               href="https://traktir.jipraks.com"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 h-9 w-full rounded-2xl border border-warning/30 bg-warning/5 text-xs font-semibold text-warning hover:bg-warning/10 transition-colors"
             >
               ☕ Traktir Kopi untuk Developer
             </a>
             <a
               href="https://t.me/kasirgratisan"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 h-9 w-full rounded-2xl border border-sky-500/30 bg-sky-500/5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors"
             >
               💬 Gabung Grup Telegram
             </a>
           </div>
           {storageUsage && (
             <div className="pt-2 border-t">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                 <HardDrive className="h-3.5 w-3.5" />
                 <span>Penyimpanan Terpakai</span>
               </div>
               <p className="text-xs font-semibold">
                 {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
               </p>
               <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                 <div
                   className="h-full bg-primary rounded-full transition-all"
                   style={{ width: `${Math.min(100, (storageUsage.usage / storageUsage.quota) * 100)}%` }}
                 />
               </div>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Install Help Dialog */}
      <Dialog open={installHelpOpen} onOpenChange={setInstallHelpOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Cara Install Aplikasi
            </DialogTitle>
            <DialogDescription>
              Browser kamu belum menampilkan tombol install otomatis. Ikuti langkah berikut sesuai perangkat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isIOS ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    Buka aplikasi ini di browser <strong>Safari</strong> (bukan Chrome).
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    Ketuk tombol <Share2 className="h-3.5 w-3.5 inline mx-0.5" /> <strong>Share</strong> di bawah layar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    Pilih <strong>"Add to Home Screen"</strong>, lalu ketuk <strong>Add</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    Buka aplikasi ini di browser <strong>Chrome</strong> atau <strong>Edge</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    Ketuk menu <strong>(⋮)</strong> di pojok kanan atas browser.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 rounded-full bg-primary/10 text-primary items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen"</strong>.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Kalau opsi tidak muncul, refresh halaman dulu lalu coba lagi. Beberapa browser butuh kunjungan kedua sebelum menawarkan install.
                  </span>
                </div>
              </div>
            )}
          </div>
          <Button className="w-full mt-2" variant="outline" onClick={() => setInstallHelpOpen(false)}>
            Tutup
          </Button>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle>Info Toko</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Logo picker */}
            <div className="space-y-1.5">
              <Label>Logo Toko</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {storeLogo ? (
                    <img src={storeLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {storeLogo ? 'Ganti Logo' : 'Pilih Logo'}
                  </Button>
                  {storeLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive gap-1.5"
                      onClick={() => setStoreLogo(undefined)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Hapus Logo
                    </Button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Nama Toko</Label><Input value={storeName} onChange={e => setStoreName(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Alamat</Label><Input value={storeAddr} onChange={e => setStoreAddr(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Telepon</Label><Input value={storePhone} onChange={e => setStorePhone(e.target.value)} className="h-11" type="tel" /></div>
            <Button className="w-full h-11" onClick={saveStore}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-User Activation Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-md rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aktifkan Multi-User</DialogTitle>
            <DialogDescription className="text-xs">
              Buat akun pemilik. Setelah aktif, Anda harus login dengan username & PIN ini setiap kali buka aplikasi.
              Data toko Anda tetap utuh.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Anda *</Label>
              <Input value={actName} onChange={e => setActName(e.target.value)} placeholder="Contoh: Pak Budi" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>Username *</Label>
              <Input
                value={actUsername}
                onChange={e => setActUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                placeholder="Contoh: owner"
                className="h-11 font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">3-20 karakter, huruf/angka/underscore. Tidak bisa diubah.</p>
            </div>
            <div className="space-y-1.5">
              <Label>PIN *</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={actPin}
                onChange={e => setActPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4-6 digit angka"
                className="h-11 font-mono text-center tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Konfirmasi PIN *</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={actPinConfirm}
                onChange={e => setActPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="Ketik ulang PIN"
                className="h-11 font-mono text-center tracking-widest"
              />
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-foreground">
              <p className="font-semibold mb-1">Penting:</p>
              <p className="text-muted-foreground">
                Catat username & PIN dengan baik. Jika lupa, satu-satunya cara untuk reset adalah dengan menghapus
                data aplikasi (data toko juga terhapus). Pastikan Anda sudah backup.
              </p>
            </div>
            <Button className="w-full h-11" onClick={handleActivateMultiUser} disabled={activating}>
              {activating ? 'Mengaktifkan…' : 'Aktifkan Multi-User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Multi-User Confirmation */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Multi-User?</AlertDialogTitle>
            <AlertDialogDescription>
              Aplikasi akan kembali ke mode tanpa login. Akun karyawan tetap tersimpan dan akan aktif kembali
              jika multi-user diaktifkan lagi. Data transaksi tetap utuh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableMultiUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-sm rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari Akun?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan diarahkan ke halaman login. Pastikan tidak ada open bill yang belum disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* What's New (manual open from Settings — show full catalog, do not auto-mark seen) */}
      <WhatsNewModal
        open={whatsNewOpen}
        onOpenChange={setWhatsNewOpen}
        features={FEATURES}
        markSeenOnClose={false}
      />
    </div>
  );
}
