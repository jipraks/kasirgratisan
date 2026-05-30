import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod, type Category, type Unit, type ExpenseCategory, type Product } from '@/lib/db';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Store, CreditCard, Tag, Download, Upload, Plus, Trash2, Edit2, Info, Truck, ArrowDownToLine, ArrowUpFromLine, ChevronRight, Receipt, Palette, HardDrive, Package, Camera, X, Ruler, Users as UsersIcon, ShieldCheck, LogOut, Smartphone, CheckCircle2, Globe, Share2, Wallet, Sparkles, LineChart } from 'lucide-react';
import WhatsNewModal from '@/components/WhatsNewModal';
import { FEATURES, getUnseenFeatures } from '@/lib/whats-new';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { setThemeColor } from '@/hooks/use-theme-color';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { exportBackupData } from '@/components/BackupReminder';
import { compressImage } from '@/lib/image-utils';
import { useAuth } from '@/hooks/use-auth';
import { createUser, isValidPin, isValidUsername, saveSession } from '@/lib/auth';
import { isAnalyticsEnabled, setAnalyticsEnabled } from '@/lib/analytics';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { isNativePlatform, getDefaultBluetoothPrinter, setDefaultBluetoothPrinter, listPairedBluetoothDevices, type BluetoothPrinter } from '@/lib/printer';
import { Printer } from 'lucide-react';

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
  // Payment method
  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);

  // Category
  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);

  // Expense category
  const [expCatDialog, setExpCatDialog] = useState(false);
  const [expCatName, setExpCatName] = useState('');
  const [expCatIcon, setExpCatIcon] = useState('📦');
  const [expCatColor, setExpCatColor] = useState('#FBBF24');
  const [expCatEditId, setExpCatEditId] = useState<number | null>(null);

  // Unit
  const [unitDialog, setUnitDialog] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitEditId, setUnitEditId] = useState<number | null>(null);
  const [unitOriginalName, setUnitOriginalName] = useState('');
  const [unitDeleteTarget, setUnitDeleteTarget] = useState<Unit | null>(null);
  const [unitDeleteUsage, setUnitDeleteUsage] = useState(0);

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

  const openPmAdd = () => { setPmEditId(null); setPmName(''); setPmCategory('tunai'); setPmDialog(true); };
  const openPmEdit = (pm: PaymentMethod) => { setPmEditId(pm.id!); setPmName(pm.name); setPmCategory(pm.category); setPmDialog(true); };
  const savePm = async () => {
    if (!pmName.trim()) return;
    if (pmEditId) await db.paymentMethods.update(pmEditId, { name: pmName.trim(), category: pmCategory });
    else await db.paymentMethods.add({ name: pmName.trim(), category: pmCategory, isDefault: false, createdAt: new Date() });
    setPmDialog(false);
    toast.success('Metode pembayaran disimpan');
  };
  const deletePm = async (id: number) => { await db.paymentMethods.delete(id); toast.success('Dihapus'); };

  const openCatAdd = () => { setCatEditId(null); setCatName(''); setCatIcon('📦'); setCatColor('#FF6B35'); setCatDialog(true); };
  const openCatEdit = (c: Category) => { setCatEditId(c.id!); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDialog(true); };
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (catEditId) await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
    else await db.categories.add({ name: catName.trim(), icon: catIcon, color: catColor, createdAt: new Date(), isDeleted: 0, deletedAt: null });
    setCatDialog(false);
    toast.success('Kategori disimpan');
  };
  const deleteCat = async (id: number) => { await db.categories.update(id, { isDeleted: 1, deletedAt: new Date() }); toast.success('Dihapus'); };

  const openExpCatAdd = () => { setExpCatEditId(null); setExpCatName(''); setExpCatIcon('📦'); setExpCatColor('#FBBF24'); setExpCatDialog(true); };
  const openExpCatEdit = (c: ExpenseCategory) => { setExpCatEditId(c.id!); setExpCatName(c.name); setExpCatIcon(c.icon); setExpCatColor(c.color); setExpCatDialog(true); };
  const saveExpCat = async () => {
    const name = expCatName.trim();
    if (!name) return;
    if (expCatEditId) {
      await db.expenseCategories.update(expCatEditId, { name, icon: expCatIcon, color: expCatColor });
    } else {
      await db.expenseCategories.add({
        name,
        icon: expCatIcon,
        color: expCatColor,
        isDefault: 0,
        createdAt: new Date(),
        isDeleted: 0,
        deletedAt: null,
      });
    }
    setExpCatDialog(false);
    toast.success('Kategori pengeluaran disimpan');
  };
  const deleteExpCat = async (cat: ExpenseCategory) => {
    if (!cat.id) return;
    const usage = await db.expenses.where('categoryId').equals(cat.id).filter(e => e.isDeleted === 0).count();
    if (usage > 0) {
      toast.error(`Tidak bisa dihapus: dipakai oleh ${usage} pengeluaran`);
      return;
    }
    await db.expenseCategories.update(cat.id, { isDeleted: 1, deletedAt: new Date() });
    toast.success('Kategori pengeluaran dihapus');
  };

  const openUnitAdd = () => {
    setUnitEditId(null);
    setUnitName('');
    setUnitOriginalName('');
    setUnitDialog(true);
  };
  const openUnitEdit = (u: Unit) => {
    setUnitEditId(u.id!);
    setUnitName(u.name);
    setUnitOriginalName(u.name);
    setUnitDialog(true);
  };
  const saveUnit = async () => {
    const name = unitName.trim();
    if (!name) return;

    // Uniqueness check (active units only — soft-deleted records still occupy &name index,
    // but we want to surface a clearer message on conflict)
    const existing = await db.units.where('name').equals(name).first();
    if (existing && existing.id !== unitEditId) {
      if (existing.isDeleted === 1) {
        toast.error(`Satuan "${name}" pernah dihapus. Pakai nama lain atau pulihkan via backup.`);
      } else {
        toast.error(`Satuan "${name}" sudah ada`);
      }
      return;
    }

    try {
      if (unitEditId) {
        await db.units.update(unitEditId, { name });
        // Cascade rename to all products using the old name so the dropdown stays consistent
        if (unitOriginalName && unitOriginalName !== name) {
          await db.products.where('unit').equals(unitOriginalName).modify({ unit: name, updatedAt: new Date() });
        }
      } else {
        await db.units.add({
          name,
          isDefault: 0,
          createdAt: new Date(),
          isDeleted: 0,
          deletedAt: null,
        });
      }
      setUnitDialog(false);
      toast.success('Satuan disimpan');
    } catch {
      toast.error('Gagal menyimpan satuan');
    }
  };
  const requestDeleteUnit = async (u: Unit) => {
    const usage = await db.products.where('unit').equals(u.name).filter(p => p.isDeleted === 0).count();
    setUnitDeleteUsage(usage);
    setUnitDeleteTarget(u);
  };
  const confirmDeleteUnit = async () => {
    if (!unitDeleteTarget?.id) return;
    await db.units.update(unitDeleteTarget.id, { isDeleted: 1, deletedAt: new Date() });
    setUnitDeleteTarget(null);
    toast.success('Satuan dihapus');
  };

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
        if (!data.version) { toast.error('File tidak valid'); return; }

        // Validate at least 1 table has data
        const hasSomeData = ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(
          key => Array.isArray(data[key]) && data[key].length > 0
        );
        if (!hasSomeData) { toast.error('File backup tidak berisi data'); return; }

        // CR-7: Snapshot existing data before clearing
        const snapshot = {
          categories: await db.categories.toArray(),
          products: await db.products.toArray(),
          suppliers: await db.suppliers.toArray(),
          customers: await db.customers.toArray(),
          stockIns: await db.stockIns.toArray(),
          stockOuts: await db.stockOuts.toArray(),
          hppHistory: await db.hppHistory.toArray(),
          paymentMethods: await db.paymentMethods.toArray(),
          transactions: await db.transactions.toArray(),
          transactionItems: await db.transactionItems.toArray(),
          storeSettings: await db.storeSettings.toArray(),
          users: await db.users.toArray(),
          units: await db.units.toArray(),
          expenseCategories: await db.expenseCategories.toArray(),
          expenses: await db.expenses.toArray(),
        };

        try {
          // Clear all tables
          await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
          await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
          await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
          await db.storeSettings.clear();
          // Only clear users if backup file has them (v4+); preserve user accounts
          // when restoring older backups (v1-v3) so login still works after restore.
          if (Array.isArray(data.users)) {
            await db.users.clear();
          }
          await db.units.clear();
          // Only clear expense tables if backup file has them (v5+).
          // Older backups (v1-v4) didn't include them; keep existing rows so the
          // user doesn't lose locally-tracked expenses when restoring an older file.
          if (Array.isArray(data.expenseCategories) || Array.isArray(data.expenses)) {
            await db.expenseCategories.clear();
            await db.expenses.clear();
          }
          // Only clear customers if backup file has them (v10+ export).
          // Older backups didn't include them; keep existing rows so the user
          // doesn't lose locally-managed customers when restoring an older file.
          if (Array.isArray(data.customers)) {
            await db.customers.clear();
          }

          // BulkAdd from file
          if (data.categories?.length) await db.categories.bulkAdd(data.categories);
          if (data.products?.length) {
            const normalizedProducts = (data.products as Product[]).map((p) =>
              p && p.trackStock === undefined ? { ...p, trackStock: true } : p
            );
            await db.products.bulkAdd(normalizedProducts);
          }
          if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
          if (data.customers?.length) await db.customers.bulkAdd(data.customers);
          if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
          if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
          if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
          if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
          if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
          if (data.storeSettings?.length) await db.storeSettings.bulkAdd(data.storeSettings);
          if (data.users?.length) await db.users.bulkAdd(data.users);
          if (data.expenseCategories?.length) await db.expenseCategories.bulkAdd(data.expenseCategories);
          if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses);

          // Units (v3+ backup) or harvest from products (v1/v2 backup)
          if (Array.isArray(data.units) && data.units.length > 0) {
            await db.units.bulkAdd(data.units);
          } else {
            const now = new Date();
            const defaults = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
            const seen = new Set<string>();
            const toAdd: any[] = [];

            for (const name of defaults) {
              seen.add(name);
              toAdd.push({ name, isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null });
            }
            if (Array.isArray(data.products)) {
              for (const p of data.products) {
                const u = (p?.unit as string | undefined)?.trim();
                if (!u || seen.has(u)) continue;
                seen.add(u);
                toAdd.push({ name: u, isDefault: 0, createdAt: now, isDeleted: 0, deletedAt: null });
              }
            }
            if (toAdd.length) await db.units.bulkAdd(toAdd);
          }

          // Handle transactionItems
          if (data.transactionItems?.length) {
            // v2 format: items already in separate table
            await db.transactionItems.bulkAdd(data.transactionItems);
          } else if (data.version === 1 && data.transactions?.length) {
            // v1 format: migrate embedded items[] to transactionItems
            for (const t of data.transactions) {
              if (Array.isArray(t.items) && t.items.length > 0) {
                const records = t.items.map((item: any) => ({
                  transactionId: t.id,
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                  hpp: item.hpp,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  discountAmount: item.discountAmount,
                  subtotal: item.subtotal,
                }));
                await db.transactionItems.bulkAdd(records);
              }
            }
          }

          toast.success('Data berhasil di-restore!');
        } catch (importErr) {
          // CR-7: Rollback — restore from snapshot
          try {
            await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
            await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
            await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
            await db.storeSettings.clear();
            await db.users.clear();
            await db.units.clear();
            await db.expenseCategories.clear();
            await db.expenses.clear();
            await db.customers.clear();

            if (snapshot.categories.length) await db.categories.bulkAdd(snapshot.categories);
            if (snapshot.products.length) await db.products.bulkAdd(snapshot.products);
            if (snapshot.suppliers.length) await db.suppliers.bulkAdd(snapshot.suppliers);
            if (snapshot.customers.length) await db.customers.bulkAdd(snapshot.customers);
            if (snapshot.stockIns.length) await db.stockIns.bulkAdd(snapshot.stockIns);
            if (snapshot.stockOuts.length) await db.stockOuts.bulkAdd(snapshot.stockOuts);
            if (snapshot.hppHistory.length) await db.hppHistory.bulkAdd(snapshot.hppHistory);
            if (snapshot.paymentMethods.length) await db.paymentMethods.bulkAdd(snapshot.paymentMethods);
            if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions);
            if (snapshot.transactionItems.length) await db.transactionItems.bulkAdd(snapshot.transactionItems);
            if (snapshot.storeSettings.length) await db.storeSettings.bulkAdd(snapshot.storeSettings);
            if (snapshot.users.length) await db.users.bulkAdd(snapshot.users);
            if (snapshot.units.length) await db.units.bulkAdd(snapshot.units);
            if (snapshot.expenseCategories.length) await db.expenseCategories.bulkAdd(snapshot.expenseCategories);
            if (snapshot.expenses.length) await db.expenses.bulkAdd(snapshot.expenses);

            toast.error('Import gagal, data dikembalikan');
          } catch {
            toast.error('Import gagal dan rollback gagal. Coba restore dari file backup.');
          }
        }
      } catch { toast.error('Gagal membaca file'); }
    };
    input.click();
  };

  const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];
  const expenseEmojiOptions = ['💡', '🏠', '👤', '🚚', '🧰', '📦', '💧', '📞', '🌐', '☕', '🧾', '💼'];

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
        Pengaturan
      </h1>

      {/* Store Info */}
      <Card
        className={`border-0 shadow-sm ${can('manage_store_settings') ? 'cursor-pointer' : 'cursor-default opacity-90'}`}
        onClick={() => can('manage_store_settings') && openStoreEdit()}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0">
            {storeSettings?.logo ? (
              <img src={storeSettings.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{storeSettings?.storeName || 'Toko Saya'}</p>
            <p className="text-xs text-muted-foreground">{storeSettings?.address || 'Belum diatur'}</p>
          </div>
          {can('manage_store_settings') && <Edit2 className="w-4 h-4 text-muted-foreground" />}
        </CardContent>
      </Card>

      {/* Install as App — hidden when already installed */}
      {!isInstalled && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
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
                className="h-8 text-xs"
                onClick={async () => {
                  const ok = await install();
                  if (ok) toast.success('Berhasil install KasirGratisan!');
                }}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Install
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
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
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentUser.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-[10px] text-muted-foreground">
                @{currentUser.username} · {currentUser.role === 'owner' ? 'Pemilik' : 'Karyawan'}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-destructive" onClick={() => setLogoutOpen(true)}>
              <LogOut className="w-3.5 h-3.5" />
              Keluar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Karyawan & Akses links/activation */}
      {isOwner && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Karyawan & Akses</h2>
          {!multiUserEnabled ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UsersIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Aktifkan Multi-User</p>
                  <p className="text-[10px] text-muted-foreground">
                    Buat akun karyawan dengan akses terbatas. Data Anda tetap aman.
                  </p>
                </div>
                <Button size="sm" className="h-8 text-xs" onClick={openActivateDialog}>
                  Aktifkan
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
                      <p className="text-sm font-semibold">Kelola Karyawan</p>
                      <p className="text-[10px] text-muted-foreground">{usersCount ?? 0} akun terdaftar · atur akses per karyawan</p>
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
                    <p className="text-sm font-semibold">Multi-User Aktif</p>
                    <p className="text-[10px] text-muted-foreground">Karyawan harus login untuk akses kasir</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setDisableOpen(true)}>
                    Nonaktifkan
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Transaksi & Stok */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Transaksi & Stok</h2>
        <Link to="/history">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Riwayat Transaksi</p><p className="text-[10px] text-muted-foreground">Lihat semua transaksi & cetak ulang struk</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        {can('manage_supplier') && (
          <Link to="/supplier">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Truck className="w-4 h-4" /></div>
                <div className="flex-1"><p className="text-sm font-semibold">Supplier</p><p className="text-[10px] text-muted-foreground">Kelola data supplier</p></div>
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
                <div className="flex-1"><p className="text-sm font-semibold">Pelanggan</p><p className="text-[10px] text-muted-foreground">Kelola data pelanggan</p></div>
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
                  <div className="flex-1"><p className="text-sm font-semibold">Stock In</p><p className="text-[10px] text-muted-foreground">Catat barang masuk & HPP otomatis</p></div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link to="/stock-out">
              <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><ArrowUpFromLine className="w-4 h-4" /></div>
                  <div className="flex-1"><p className="text-sm font-semibold">Stock Out</p><p className="text-[10px] text-muted-foreground">Catat barang keluar non-penjualan</p></div>
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
                <div className="flex-1"><p className="text-sm font-semibold">Pengeluaran</p><p className="text-[10px] text-muted-foreground">Catat biaya operasional non-stok (listrik, gaji, sewa, dll)</p></div>
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
                <div className="flex-1"><p className="text-sm font-semibold">Laporan Stok</p><p className="text-[10px] text-muted-foreground">Lihat pergerakan stok per periode</p></div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {/* Payment Methods */}
      {can('manage_categories_payments') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Metode Pembayaran</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openPmAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {paymentMethods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pm.category}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPmEdit(pm)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePm(pm.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Categories */}
      {can('manage_categories_payments') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Tag className="w-4 h-4" /> Kategori Produk</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openCatAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {categories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCat(c.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Expense Categories */}
      {can('manage_categories_payments') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Kategori Pengeluaran</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openExpCatAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {expenseCategories && expenseCategories.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">Belum ada kategori pengeluaran</p>
          )}
          {expenseCategories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openExpCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExpCat(c)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      )}

      {/* Units */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Ruler className="w-4 h-4" /> Satuan</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openUnitAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {units && units.length === 0 && (
            <p className="text-xs text-muted-foreground py-1.5">Belum ada satuan</p>
          )}
          {units?.map(u => (
            <div key={u.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm font-medium">{u.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openUnitEdit(u)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDeleteUnit(u)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Bluetooth Printer (APK only) */}
      {isNative && can('manage_store_settings') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Printer className="w-4 h-4" /> Printer Bluetooth</CardTitle>
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
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum dipilih — struk akan dicetak ke printer terpasang pertama yang ditemukan.</p>
            )}
          </div>

          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={refreshPairedPrinters} disabled={loadingPrinters}>
            <Printer className="w-4 h-4" /> {loadingPrinters ? 'Mencari...' : 'Cari Printer Terpasang'}
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
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
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

      {/* Theme Color */}
      {can('manage_store_settings') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Palette className="w-4 h-4" /> Warna Tema</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeColorPicker
            value={storeSettings?.themeColor ?? '25'}
            onChange={hue => setThemeColor(hue)}
          />
        </CardContent>
      </Card>
      )}

      {/* Backup & Restore */}
      {can('manage_backup') && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={exportBackupData}>
            <Download className="w-4 h-4" /> Export Backup (JSON)
          </Button>
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleImport}>
            <Upload className="w-4 h-4" /> Import / Restore Data
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">Terakhir backup: {new Date(storeSettings.lastBackupAt).toLocaleString('id-ID')}</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Privasi & Analitik */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><LineChart className="w-4 h-4" /> Privasi & Analitik</CardTitle>
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
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center space-y-2">
           <p className="text-sm font-bold">KasirGratisan</p>
           <p className="text-xs text-muted-foreground">POS Gratis untuk UMKM Indonesia 🇮🇩</p>
           <p className="text-[10px] text-muted-foreground">v1.0 • Data tersimpan di perangkat</p>

           {/* Links */}
           <div className="flex flex-col gap-2 pt-2">
             <button
               type="button"
               onClick={() => setWhatsNewOpen(true)}
               className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
             >
               <Sparkles className="w-3.5 h-3.5" />
               Yang Baru di KasirGratisan
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
               className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
             >
               💡 Request Fitur
             </a>
             <a
               href="https://traktir.jipraks.com"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-warning/30 bg-warning/5 text-xs font-semibold text-warning hover:bg-warning/10 transition-colors"
             >
               ☕ Traktir Kopi untuk Developer
             </a>
             <a
               href="https://t.me/kasirgratisan"
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 w-full h-9 rounded-lg border border-sky-500/30 bg-sky-500/5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors"
             >
               💬 Gabung Grup Telegram
             </a>
           </div>
           {storageUsage && (
             <div className="pt-2 border-t">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                 <HardDrive className="w-3.5 h-3.5" />
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
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
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
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    Buka aplikasi ini di browser <strong>Safari</strong> (bukan Chrome).
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    Ketuk tombol <Share2 className="w-3.5 h-3.5 inline mx-0.5" /> <strong>Share</strong> di bawah layar.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    Pilih <strong>"Add to Home Screen"</strong>, lalu ketuk <strong>Add</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                  <p className="text-sm flex-1">
                    Buka aplikasi ini di browser <strong>Chrome</strong> atau <strong>Edge</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                  <p className="text-sm flex-1">
                    Ketuk menu <strong>(⋮)</strong> di pojok kanan atas browser.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                  <p className="text-sm flex-1">
                    Pilih <strong>"Install app"</strong> atau <strong>"Add to Home screen"</strong>.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
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
        <DialogContent className="max-w-[95vw] rounded-xl">
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
                    <Camera className="w-3.5 h-3.5" />
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
                      <X className="w-3.5 h-3.5" />
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

      {/* Payment Method Dialog */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama</Label><Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder="Contoh: Transfer BCA" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button key={c} onClick={() => setPmCategory(c)} className={`p-2 rounded-lg text-xs font-semibold border-2 capitalize transition-colors ${pmCategory === c ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <Button className="w-full h-11" onClick={savePm} disabled={!pmName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{catEditId ? 'Edit' : 'Tambah'} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Kategori</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Contoh: Snack" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button key={e} onClick={() => setCatIcon(e)} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${catIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveCat} disabled={!catName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Category Dialog */}
      <Dialog open={expCatDialog} onOpenChange={setExpCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{expCatEditId ? 'Edit' : 'Tambah'} Kategori Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Kategori</Label>
              <Input
                value={expCatName}
                onChange={e => setExpCatName(e.target.value)}
                placeholder="Contoh: Internet, Marketing"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {expenseEmojiOptions.map(e => (
                  <button
                    key={e}
                    onClick={() => setExpCatIcon(e)}
                    className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${expCatIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={expCatColor} onChange={e => setExpCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveExpCat} disabled={!expCatName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-User Activation Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
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

      {/* Unit Dialog */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{unitEditId ? 'Edit' : 'Tambah'} Satuan</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Satuan</Label>
              <Input
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                placeholder="Contoh: pak, lusin, mangkok"
                className="h-11"
              />
              {unitEditId && unitOriginalName && unitName.trim() && unitName.trim() !== unitOriginalName && (
                <p className="text-[11px] text-muted-foreground">
                  Semua produk yang memakai "{unitOriginalName}" akan otomatis di-rename ke "{unitName.trim()}".
                </p>
              )}
            </div>
            <Button className="w-full h-11" onClick={saveUnit} disabled={!unitName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Multi-User Confirmation */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
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
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
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

      {/* Unit Delete Confirm */}
      <AlertDialog open={!!unitDeleteTarget} onOpenChange={(o) => { if (!o) setUnitDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Satuan "{unitDeleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {unitDeleteUsage > 0
                ? `Saat ini dipakai oleh ${unitDeleteUsage} produk. Produk yang sudah ada tetap menyimpan satuan "${unitDeleteTarget?.name}", tapi satuan ini tidak akan muncul lagi di pilihan saat tambah/edit produk baru.`
                : 'Satuan ini tidak dipakai oleh produk manapun. Aman untuk dihapus.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnit} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
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
