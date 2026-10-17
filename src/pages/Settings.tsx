import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Store, CreditCard, Tag, Download, Edit2, Info, Truck, ArrowDownToLine, ArrowUpFromLine, ChevronRight, Receipt, Palette, HardDrive, Package, Camera, X, Ruler, Users as UsersIcon, ShieldCheck, LogOut, Smartphone, CheckCircle2, Globe, Share2, Wallet, Sparkles, HandCoins, ClipboardCheck, LayoutGrid } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { compressImage } from '@/lib/image-utils';
import { useAuth } from '@/hooks/use-auth';
import { createUser, isValidPin, isValidUsername, saveSession } from '@/lib/auth';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { isNativePlatform, getDefaultBluetoothPrinter, setDefaultBluetoothPrinter, listPairedBluetoothDevices, type BluetoothPrinter } from '@/lib/printer';
import { Printer } from 'lucide-react';
import { APP_VERSION } from '@/lib/app-version';
import { useTranslation, Trans } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Pengaturan() {
  const { t } = useTranslation('settings');
  const isNative = isNativePlatform();
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const usersCount = useLiveQuery(() => db.users.count());
  const units = useLiveQuery(() => db.units.where('isDeleted').equals(0).toArray());
  const expenseCategories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );
  const activeDebts = useLiveQuery(() => db.debts.where('status').anyOf('unpaid', 'partial').toArray());

  const { multiUserEnabled, currentUser, isOwner, can, logout } = useAuth();

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

  // Cashier layout mode settings (default: 'grid')
  const [cashierLayoutMode, setCashierLayoutModeState] = useState<'grid' | 'rows'>(() => {
    try {
      return (localStorage.getItem('kg_cashier_layout_mode') as 'grid' | 'rows') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleCashierLayoutModeChange = (val: 'grid' | 'rows') => {
    setCashierLayoutModeState(val);
    try {
      localStorage.setItem('kg_cashier_layout_mode', val);
      toast.success(t('toast.saveSuccess'));
    } catch {
      toast.error(t('common:error') || 'Gagal');
    }
  };

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
        toast.error(t('toast.noPairedDevices'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.loadPrintersFailed'));
    } finally {
      setLoadingPrinters(false);
    }
  };

  const selectDefaultPrinter = (printer: BluetoothPrinter) => {
    setDefaultBluetoothPrinter(printer);
    setDefaultPrinter(printer);
    toast.success(t('toast.printerDefaultSet', { name: printer.name }));
  };

  const clearDefaultPrinter = () => {
    setDefaultBluetoothPrinter(null);
    setDefaultPrinter(null);
    toast.success(t('toast.printerDefaultCleared'));
  };

  const handleToggleDebt = async (enabled: boolean) => {
    if (!storeSettings?.id) return;
    await db.storeSettings.update(storeSettings.id, { allowDebt: enabled });
    toast.success(enabled ? t('toast.debtEnabled') : t('toast.debtDisabled'));
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
      toast.success(t('storeDialog.saveSuccess'));
      setStoreDialog(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('toast.invalidImage'));
      return;
    }
    try {
      const compressed = await compressImage(file);
      setStoreLogo(compressed);
    } catch {
      toast.error(t('toast.processImageFailed'));
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
    if (!actName.trim()) { toast.error(t('toast.nameRequired')); return; }
    if (!isValidUsername(actUsername)) {
      toast.error(t('toast.usernameInvalid'));
      return;
    }
    if (!isValidPin(actPin)) {
      toast.error(t('toast.pinInvalid'));
      return;
    }
    if (actPin !== actPinConfirm) {
      toast.error(t('toast.pinMismatch'));
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
          toast.error(result.error || t('toast.createOwnerFailed'));
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

      toast.success(t('toast.multiUserEnabled'));
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
    toast.success(t('toast.multiUserDisabled'));
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

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        {t('common:setting')}
      </h1>

      {/* Store Info */}
      <Card
        className={`border-0 shadow-sm ${can('manage_store_settings') ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
        onClick={() => can('manage_store_settings') && openStoreEdit()}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
            {storeSettings?.logo ? (
              <img src={storeSettings.logo} alt={t('storeDialog.logoPreviewAlt')} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{storeSettings?.storeName || t('storeFallback')}</p>
            <p className="text-xs text-muted-foreground">{storeSettings?.address || t('notSet')}</p>
          </div>
          {can('manage_store_settings') && <Edit2 className="w-4 h-4 text-muted-foreground" />}
        </CardContent>
      </Card>

      {/* Install as App — hidden when already installed */}
      {!isNative && !isInstalled && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t('installApp.title')}</p>
              <p className="text-[10px] text-muted-foreground">{t('installApp.hint')}</p>
            </div>
            {canInstall ? (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={async () => {
                  const ok = await install();
                  if (ok) toast.success(t('installApp.installSuccess'));
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {t('installApp.installButton')}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setInstallHelpOpen(true)}
              >
                {t('installApp.helpButton')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Karyawan & Akses (current user / multi-user activation) */}
      {multiUserEnabled && currentUser ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentUser.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-[10px] text-muted-foreground">
                @{currentUser.username} · {currentUser.role === 'owner' ? t('employees.owner') : t('employees.staff')}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => setLogoutOpen(true)}>
              <LogOut className="w-3.5 h-3.5" />
              {t('employees.logout')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Karyawan & Akses links/activation */}
      {isOwner && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('employees.sectionTitle')}</h2>
          {!multiUserEnabled ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UsersIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t('employees.activate.title')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('employees.activate.description')}</p>
                </div>
                <Button size="sm" className="h-8 text-xs" onClick={openActivateDialog}>
                  {t('employees.activate.button')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Link to="/users">
                <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><UsersIcon className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{t('employees.manage.title')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('employees.manage.description', { count: usersCount ?? 0 })}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t('employees.active.title')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('employees.active.description')}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setDisableOpen(true)}>
                    {t('employees.active.disable')}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Transaksi & Stok */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('transactionsAndStock.sectionTitle')}</h2>
        <Link to="/history">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.transactionHistory.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.transactionHistory.description')}</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        {can('manage_supplier') && (
          <Link to="/supplier">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Truck className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.supplier.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.supplier.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('manage_customers') && (
          <Link to="/customers">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><UsersIcon className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.customers.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.customers.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('manage_customers') && storeSettings?.allowDebt && (
          <Link to="/debts">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center"><HandCoins className="w-4 h-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{t('transactionsAndStock.debts.title')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.debts.description', { count: activeDebts?.length ?? 0 })}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('manage_stock_inout') && (
          <>
            <Link to="/stock-in">
              <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><ArrowDownToLine className="w-4 h-4" /></div>
                  <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.stockIn.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.stockIn.description')}</p></div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link to="/stock-out">
              <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><ArrowUpFromLine className="w-4 h-4" /></div>
                  <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.stockOut.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.stockOut.description')}</p></div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </>
        )}
        {(can('manage_expenses') || can('view_expenses')) && (
          <Link to="/expenses">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.expenses.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.expenses.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
        {can('view_reports') && (
          <Link to="/stock-report">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Package className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('transactionsAndStock.stockReport.title')}</p><p className="text-[10px] text-muted-foreground">{t('transactionsAndStock.stockReport.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Master Data & Preferensi */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('masterData.sectionTitle')}</h2>

        {can('manage_store_settings') && (
          <Card className="border-0 shadow-sm mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center"><HandCoins className="w-4 h-4" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t('masterData.allowDebt.title')}</p>
                <p className="text-[10px] text-muted-foreground">{t('masterData.allowDebt.description')}</p>
              </div>
              <Switch checked={storeSettings?.allowDebt ?? false} onCheckedChange={handleToggleDebt} />
            </CardContent>
          </Card>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/payment-methods" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><CreditCard className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.paymentMethods.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.paymentMethods.description', { count: paymentMethods?.length ?? 0 })}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/product-category" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Tag className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.productCategory.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.productCategory.description', { count: categories?.length ?? 0 })}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_categories_payments') && (
          <Link to="/settings/expense-category" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.expenseCategory.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.expenseCategory.description', { count: expenseCategories?.length ?? 0 })}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        <Link to="/settings/units" className="block">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Ruler className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.units.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.units.description', { count: units?.length ?? 0 })}</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {can('manage_store_settings') && (
          <Link to="/settings/receipt" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.receiptFooter.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.receiptFooter.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_stock_inout') && (
          <Link to="/settings/stock-opname" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><ClipboardCheck className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('stockOpname.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.stockOpname.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        {can('manage_store_settings') && (
          <Link to="/settings/theme" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Palette className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.theme.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.theme.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

        <Card className="border-0 shadow-sm mb-2">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t('masterData.cashierLayout.title')}</p>
                <p className="text-[10px] text-muted-foreground">{t('masterData.cashierLayout.description')}</p>
              </div>
            </div>
            <Select value={cashierLayoutMode} onValueChange={handleCashierLayoutModeChange}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">{t('masterData.cashierLayout.grid')}</SelectItem>
                <SelectItem value="rows">{t('masterData.cashierLayout.rows')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {can('manage_backup') && (
          <Link to="/settings/backup" className="block">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><Download className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">{t('masterData.backup.title')}</p><p className="text-[10px] text-muted-foreground">{t('masterData.backup.description')}</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}

      </div>

      {/* Bluetooth Printer (APK only) */}
      {isNative && can('manage_store_settings') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Printer className="w-4 h-4" /> {t('bluetoothPrinter.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="text-[11px] text-muted-foreground mb-1">{t('bluetoothPrinter.default')}</p>
            {defaultPrinter ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{defaultPrinter.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{defaultPrinter.address}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={clearDefaultPrinter}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('bluetoothPrinter.notSelected')}</p>
            )}
          </div>

          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={refreshPairedPrinters} disabled={loadingPrinters}>
            <Printer className="w-4 h-4" /> {loadingPrinters ? t('bluetoothPrinter.searching') : t('bluetoothPrinter.search')}
          </Button>

          {pairedPrinters.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">{t('bluetoothPrinter.selectPrinter')}</p>
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
                      <p className="text-sm font-medium truncate">{printer.name || t('bluetoothPrinter.unnamed')}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{printer.address}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug">
            {t('bluetoothPrinter.hint')}
          </p>
        </CardContent>
      </Card>
      )}

      {/* Bahasa */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Globe className="w-4 h-4" /> {t('language.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center space-y-2">
           <p className="text-sm font-bold">{t('about.appName')}</p>
           <p className="text-xs text-muted-foreground">{t('about.tagline')}</p>
           <p className="text-[10px] text-muted-foreground">{t('about.version', { version: APP_VERSION })}</p>

           {/* Links */}
           <div className="flex flex-col gap-2 pt-2">
             <button
               type="button"
               onClick={() => setWhatsNewOpen(true)}
               className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
             >
               <Sparkles className="w-3.5 h-3.5" />
               {t('about.whatsNew')}
               {unseenFeatures.length > 0 && (
                 <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                   {unseenFeatures.length}
                 </span>
               )}
             </button>
           </div>
           {storageUsage && (
             <div className="pt-2 border-t">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                 <HardDrive className="w-3.5 h-3.5" />
                 <span>{t('about.storageUsed')}</span>
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
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              {t('installHelp.title')}
            </DialogTitle>
            <DialogDescription>
              {t('installHelp.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isIOS ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.iosStep1" components={{ strong: <strong /> }} />
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.iosStep2" components={{ strong: <strong />, 0: <Share2 className="w-3.5 h-3.5 inline mx-0.5" /> }} />
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.iosStep3" components={{ strong: <strong /> }} />
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.androidStep1" components={{ strong: <strong /> }} />
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.androidStep2" components={{ strong: <strong /> }} />
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    <Trans i18nKey="settings:installHelp.androidStep3" components={{ strong: <strong /> }} />
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{t('installHelp.troubleshoot')}</span>
                </div>
              </div>
            )}
          </div>
          <Button className="w-full mt-2" variant="outline" onClick={() => setInstallHelpOpen(false)}>
            {t('common:close')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Store Dialog */}
      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{t('storeDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Logo picker */}
            <div className="space-y-1.5">
              <Label>{t('storeDialog.logoLabel')}</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {storeLogo ? (
                    <img src={storeLogo} alt={t('storeDialog.logoPreviewAlt')} className="w-full h-full object-cover" />
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
                    <Camera className="w-3.5 h-3.5" />
                    {storeLogo ? t('storeDialog.logoChange') : t('storeDialog.logoSelect')}
                  </Button>
                  {storeLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive gap-1.5"
                      onClick={() => setStoreLogo(undefined)}
                    >
                      <X className="w-3.5 h-3.5" />
                      {t('storeDialog.logoRemove')}
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
            <div className="space-y-1.5"><Label>{t('storeDialog.storeName')}</Label><Input value={storeName} onChange={e => setStoreName(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('storeDialog.address')}</Label><Input value={storeAddr} onChange={e => setStoreAddr(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('storeDialog.phone')}</Label><Input value={storePhone} onChange={e => setStorePhone(e.target.value)} className="h-11" type="tel" /></div>
            <Button className="w-full h-11" onClick={saveStore}>{t('common:save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-User Activation Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('employees.activateDialog.title')}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('employees.activateDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('employees.activateDialog.nameLabel')} *</Label>
              <Input value={actName} onChange={e => setActName(e.target.value)} placeholder={t('employees.activateDialog.namePlaceholder')} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.activateDialog.usernameLabel')} *</Label>
              <Input
                value={actUsername}
                onChange={e => setActUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                placeholder={t('employees.activateDialog.usernamePlaceholder')}
                className="h-11 font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">{t('employees.activateDialog.usernameHint')}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.activateDialog.pinLabel')} *</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={actPin}
                onChange={e => setActPin(e.target.value.replace(/\D/g, ''))}
                placeholder={t('employees.activateDialog.pinPlaceholder')}
                className="h-11 font-mono text-center tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.activateDialog.pinConfirmLabel')} *</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={actPinConfirm}
                onChange={e => setActPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder={t('employees.activateDialog.pinConfirmPlaceholder')}
                className="h-11 font-mono text-center tracking-widest"
              />
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-foreground">
              <p className="font-semibold mb-1">{t('employees.activateDialog.warningTitle')}</p>
              <p className="text-muted-foreground">
                {t('employees.activateDialog.warningText')}
              </p>
            </div>
            <Button className="w-full h-11" onClick={handleActivateMultiUser} disabled={activating}>
              {activating ? t('employees.activateDialog.submitting') : t('employees.activateDialog.submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Multi-User Confirmation */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employees.disableDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('employees.disableDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisableMultiUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('employees.disableDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employees.logoutDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('employees.logoutDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('employees.logoutDialog.confirm')}
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
