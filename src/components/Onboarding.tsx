import { useState, useMemo } from 'react';
import { Store, MapPin, Phone, ChevronRight, ChevronLeft, ShoppingCart, Package, BarChart3, Shield, Database, Palette, Download, CheckCircle2, Globe, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { db, type Product } from '@/lib/db';
import { markAllFeaturesSeen } from '@/lib/whats-new';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { applyThemeColor } from '@/hooks/use-theme-color';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { isNativePlatform } from '@/lib/printer';

interface OnboardingProps {
  onComplete: () => void;
}

const tutorialSlides = [
  {
    icon: ShoppingCart,
    title: 'Kasir Cepat & Mudah',
    description: 'Proses transaksi dengan cepat. Pilih produk, atur diskon, dan pilih metode pembayaran — semua dalam hitungan detik.',
    color: 'text-primary bg-primary/10',
  },
  {
    icon: Package,
    title: 'Kelola Stok Otomatis',
    description: 'Catat barang masuk dari supplier, stok berkurang otomatis saat penjualan, dan HPP dihitung otomatis.',
    color: 'text-accent bg-accent/10',
  },
  {
    icon: BarChart3,
    title: 'Laporan Lengkap',
    description: 'Pantau penjualan harian, profit, dan produk terlaris. Semua data tersaji dalam grafik yang mudah dipahami.',
    color: 'text-success bg-success/10',
  },
  {
    icon: Shield,
    title: 'Data Aman di HP Kamu',
    description: 'Semua data tersimpan di perangkatmu. Tidak perlu internet, tidak perlu server. Gratis selamanya!',
    color: 'text-warning bg-warning/10',
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const isNative = useMemo(() => isNativePlatform(), []);
  // Web/PWA: tutorial slides (0-3), install (4), store setup (5)
  // APK/native: tutorial slides (0-3), store setup (4)
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loadDummy, setLoadDummy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [themeColor, setThemeColorState] = useState('25');
  const [installDone, setInstallDone] = useState(false);
  const { canInstall, isInstalled, install } = usePWAInstall();

  const hasInstallStep = !isNative;
  const totalSteps = tutorialSlides.length + (hasInstallStep ? 2 : 1); // tutorials + (install) + store setup
  const isTutorialStep = step < tutorialSlides.length;
  const isInstallStep = hasInstallStep && step === tutorialSlides.length;
  const isStoreStep = step === tutorialSlides.length + (hasInstallStep ? 1 : 0);
  const tutorialIndex = step;

  const seedDummyData = async () => {
    const now = new Date();
    const dummyProducts = [
      { name: 'Nasi Goreng Spesial', sku: 'NG001', categoryId: 1, price: 15000, hpp: 8000, stock: 50, unit: 'porsi', description: 'Nasi goreng dengan telur mata sapi, ayam suwir, dan kerupuk', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Mie Goreng', sku: 'MG001', categoryId: 1, price: 12000, hpp: 6000, stock: 40, unit: 'porsi', description: 'Mie goreng dengan sayur dan telur', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Ayam Bakar', sku: 'AB001', categoryId: 1, price: 20000, hpp: 12000, stock: 30, unit: 'porsi', description: 'Ayam bakar bumbu kecap, sambal, dan lalapan', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Sate Ayam (10 tusuk)', sku: 'SA001', categoryId: 1, price: 18000, hpp: 10000, stock: 25, unit: 'porsi', description: 'Isi 10 tusuk + bumbu kacang + lontong', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Bakso Urat', sku: 'BU001', categoryId: 1, price: 15000, hpp: 7000, stock: 35, unit: 'mangkok', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Es Teh Manis', sku: 'ET001', categoryId: 2, price: 5000, hpp: 1500, stock: 100, unit: 'gelas', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Es Jeruk', sku: 'EJ001', categoryId: 2, price: 7000, hpp: 2500, stock: 80, unit: 'gelas', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Kopi Susu', sku: 'KS001', categoryId: 2, price: 10000, hpp: 4000, stock: 60, unit: 'gelas', description: 'Kopi susu gula aren', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Air Mineral', sku: 'AM001', categoryId: 2, price: 4000, hpp: 2000, stock: 120, unit: 'botol', description: '600ml', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Tisu', sku: 'TS001', categoryId: 3, price: 2000, hpp: 1000, stock: 200, unit: 'pcs', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Kerupuk', sku: 'KR001', categoryId: 3, price: 3000, hpp: 1500, stock: 150, unit: 'bungkus', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
    ];

    const dummySuppliers = [
      { name: 'PT Bahan Segar', phone: '08111222333', address: 'Jl. Pasar Baru No. 15', notes: 'Supplier sayur & daging', createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'UD Minuman Jaya', phone: '08222333444', address: 'Jl. Raya Industri No. 8', notes: 'Supplier minuman', createdAt: now, isDeleted: 0, deletedAt: null },
    ];

    // Ensure all units used by sample products exist in master units table.
    // seedDefaultData() already adds the 9 default units; here we only add
    // the extras that the sample data uses (e.g. 'mangkok', 'gelas').
    const sampleUnits = Array.from(new Set(dummyProducts.map(p => p.unit).filter(Boolean)));
    const existingUnits = await db.units.toArray();
    const existingNames = new Set(existingUnits.map(u => u.name));
    const unitNow = new Date();
    for (const u of sampleUnits) {
      if (existingNames.has(u)) continue;
      try {
        await db.units.add({
          name: u,
          isDefault: 1,
          createdAt: unitNow,
          isDeleted: 0,
          deletedAt: null,
        });
        existingNames.add(u);
      } catch {
        // unique-constraint race: ignore
      }
    }

    await db.products.bulkAdd(dummyProducts);
    await db.suppliers.bulkAdd(dummySuppliers);

    const discNull: 'percentage' | 'nominal' | null = null;

    const tx1Id = await db.transactions.add({
      subtotal: 40000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 40000,
      paymentMethodId: 1, paymentAmount: 50000, change: 10000, profit: 21000,
      date: new Date(now.getTime() - 3600000), receiptNumber: 'TX-DEMO-001',
    });
    await db.transactionItems.bulkAdd([
      { transactionId: tx1Id as number, productId: 1, productName: 'Nasi Goreng Spesial', quantity: 2, price: 15000, hpp: 8000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 30000 },
      { transactionId: tx1Id as number, productId: 6, productName: 'Es Teh Manis', quantity: 2, price: 5000, hpp: 1500, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
    ]);

    const tx2Id = await db.transactions.add({
      subtotal: 30000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 30000,
      paymentMethodId: 3, paymentAmount: 30000, change: 0, profit: 14000,
      date: new Date(now.getTime() - 1800000), receiptNumber: 'TX-DEMO-002',
    });
    await db.transactionItems.bulkAdd([
      { transactionId: tx2Id as number, productId: 3, productName: 'Ayam Bakar', quantity: 1, price: 20000, hpp: 12000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 20000 },
      { transactionId: tx2Id as number, productId: 8, productName: 'Kopi Susu', quantity: 1, price: 10000, hpp: 4000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
    ]);

    const tx3Id = await db.transactions.add({
      subtotal: 40000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 40000,
      paymentMethodId: 1, paymentAmount: 50000, change: 10000, profit: 18500,
      date: new Date(now.getTime() - 900000), receiptNumber: 'TX-DEMO-003',
    });
    await db.transactionItems.bulkAdd([
      { transactionId: tx3Id as number, productId: 1, productName: 'Nasi Goreng Spesial', quantity: 1, price: 15000, hpp: 8000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 15000 },
      { transactionId: tx3Id as number, productId: 4, productName: 'Sate Ayam (10 tusuk)', quantity: 1, price: 18000, hpp: 10000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 18000 },
      { transactionId: tx3Id as number, productId: 7, productName: 'Es Jeruk', quantity: 1, price: 7000, hpp: 2500, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 7000 },
    ]);
  };

  const handleRestore = () => {
    if (restoring) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setRestoring(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version) { toast.error('File backup tidak valid'); setRestoring(false); return; }

        const hasSomeData = ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(
          key => Array.isArray(data[key]) && data[key].length > 0,
        );
        if (!hasSomeData) { toast.error('File backup tidak berisi data'); setRestoring(false); return; }

        // Fresh install: clear seeded defaults then load from file.
        await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
        await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
        await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
        await db.storeSettings.clear();
        if (Array.isArray(data.users)) await db.users.clear();
        await db.units.clear();
        if (Array.isArray(data.expenseCategories) || Array.isArray(data.expenses)) {
          await db.expenseCategories.clear();
          await db.expenses.clear();
        }
        if (Array.isArray(data.customers)) await db.customers.clear();

        if (data.categories?.length) await db.categories.bulkAdd(data.categories);
        if (data.products?.length) {
          const normalized = (data.products as Product[]).map((p) =>
            p && p.trackStock === undefined ? { ...p, trackStock: true } : p,
          );
          await db.products.bulkAdd(normalized);
        }
        if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
        if (data.customers?.length) await db.customers.bulkAdd(data.customers);
        if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
        if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
        if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
        if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
        if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
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
          const toAdd: Array<{ name: string; isDefault: number; createdAt: Date; isDeleted: number; deletedAt: null }> = [];
          for (const name of defaults) { seen.add(name); toAdd.push({ name, isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null }); }
          if (Array.isArray(data.products)) {
            for (const p of data.products as Product[]) {
              const u = p?.unit?.trim();
              if (!u || seen.has(u)) continue;
              seen.add(u);
              toAdd.push({ name: u, isDefault: 0, createdAt: now, isDeleted: 0, deletedAt: null });
            }
          }
          if (toAdd.length) await db.units.bulkAdd(toAdd);
        }

        if (data.transactionItems?.length) await db.transactionItems.bulkAdd(data.transactionItems);

        // Restored storeSettings carries onboardingDone from the source device.
        // Force it true so the wizard closes and the app opens straight away.
        if (data.storeSettings?.length) {
          const restored = data.storeSettings.map((s: Record<string, unknown>) => ({ ...s, onboardingDone: true }));
          await db.storeSettings.bulkAdd(restored);
        } else {
          await db.storeSettings.add({
            storeName: 'Toko Saya',
            address: '',
            phone: '',
            receiptFooter: 'Terima kasih atas kunjungan Anda!',
            onboardingDone: true,
            lastBackupAt: null,
            deviceId: crypto.randomUUID(),
          });
        }

        await markAllFeaturesSeen();
        toast.success('Data berhasil di-restore!');
        onComplete();
      } catch {
        toast.error('Gagal membaca / restore file backup');
      } finally {
        setRestoring(false);
      }
    };
    input.click();
  };

  const handleFinish = async () => {
    if (!storeName.trim()) return;
    setSaving(true);
    try {
      const existing = await db.storeSettings.toCollection().first();
      if (existing?.id) {
        await db.storeSettings.update(existing.id, {
          storeName: storeName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          onboardingDone: true,
          themeColor,
        });
      } else {
        await db.storeSettings.add({
          storeName: storeName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          receiptFooter: 'Terima kasih atas kunjungan Anda!',
          onboardingDone: true,
          lastBackupAt: null,
          themeColor,
        });
      }

      if (loadDummy) {
        await seedDummyData();
      }

      // Fresh installs shouldn't see the "What's New" modal for shipped
      // features that exist at install time — those aren't new to them.
      // Mark every current feature id as seen so they only get future ones.
      await markAllFeaturesSeen();

      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-background max-w-lg md:max-w-6xl mx-auto overflow-y-auto" style={{ height: '100dvh', WebkitOverflowScrolling: 'touch' }}>
      <div className="min-h-full flex flex-col">
        <div className="flex items-center justify-center gap-2 pt-8 pb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>

      <div className="flex-1 flex flex-col px-4">
        {isTutorialStep ? (
          /* Tutorial slides */
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            {(() => {
              const slide = tutorialSlides[tutorialIndex];
              const Icon = slide.icon;
              return (
                <>
                  <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center', slide.color)}>
                    <Icon className="w-12 h-12" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
                    <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">{slide.description}</p>
                  </div>
                </>
              );
            })()}
          </div>
        ) : isInstallStep ? (
          /* Install step - FIRST, before anything else */
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center',
              isInstalled || installDone ? 'text-success bg-success/10' : 'text-primary bg-primary/10'
            )}>
              {isInstalled || installDone ? <CheckCircle2 className="w-12 h-12" /> : <Download className="w-12 h-12" />}
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                {isInstalled || installDone ? 'Sudah Terinstall! ✅' : 'Install sebagai Aplikasi'}
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {isInstalled || installDone
                  ? 'KasirGratisan sudah terinstall. Kamu bisa buka langsung dari home screen!'
                  : 'Install KasirGratisan di HP kamu supaya bisa diakses langsung dari home screen, tanpa buka browser.'}
              </p>
            </div>
            {!isInstalled && !installDone && (
              canInstall ? (
                <div className="space-y-3 w-full max-w-xs">
                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-semibold"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) {
                        setInstallDone(true);
                        toast.success('Berhasil install KasirGratisan!');
                      }
                    }}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Install sebagai Aplikasi
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-full h-12 text-base text-muted-foreground"
                    onClick={() => setStep(s => s + 1)}
                  >
                    <Globe className="w-5 h-5 mr-2" />
                    Lanjut di Browser
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-w-xs">
                  <p className="text-sm text-muted-foreground">
                    Untuk install, buka di browser <strong>Chrome</strong> lalu ketuk menu (⋮) → <strong>"Add to Home screen"</strong> atau <strong>"Install app"</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Di Safari iOS: ketuk tombol Share (↑) → "Add to Home Screen"
                  </p>
                </div>
              )
            )}
          </div>
        ) : (
          /* Store setup - LAST */
          <div className="flex-1 flex flex-col overflow-y-auto space-y-6 py-4 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Store className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Setup Toko Kamu</h2>
              <p className="text-sm text-muted-foreground">Informasi ini akan tampil di struk belanja</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Sudah punya backup?</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">Restore file JSON dari device lama tanpa perlu setup toko ulang.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleRestore} disabled={restoring}>
                <Upload className="w-4 h-4" />
                {restoring ? 'Restore data...' : 'Restore Toko dari Backup'}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName" className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  Nama Toko <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="storeName"
                  placeholder="Contoh: Toko Berkah Jaya"
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Alamat
                </Label>
                <Input
                  id="address"
                  placeholder="Contoh: Jl. Merdeka No. 10, Jakarta"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Nomor Telepon
                </Label>
                <Input
                  id="phone"
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-12"
                  type="tel"
                />
              </div>

              {/* Dummy data toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Muat data contoh</p>
                    <p className="text-[10px] text-muted-foreground">11 produk, 2 supplier, 3 transaksi demo</p>
                  </div>
                </div>
                <Switch checked={loadDummy} onCheckedChange={setLoadDummy} />
              </div>

              {/* Theme color picker */}
              <div className="space-y-2.5 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Warna Tema</p>
                    <p className="text-[10px] text-muted-foreground">Pilih warna utama aplikasi</p>
                  </div>
                </div>
                <ThemeColorPicker
                  value={themeColor}
                  onChange={hue => {
                    setThemeColorState(hue);
                    applyThemeColor(hue);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-4 pt-4 flex items-center gap-3" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
        {step > 0 && !isInstallStep && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep(s => s - 1)}
            className="h-12"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        {isInstallStep ? (
          <>
            {(isInstalled || installDone) && (
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-semibold"
                onClick={() => setStep(s => s + 1)}
              >
                Lanjut
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {!canInstall && !isInstalled && !installDone && (
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-semibold"
                onClick={() => setStep(s => s + 1)}
              >
                Lanjut
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </>
        ) : isStoreStep ? (
          <Button
            size="lg"
            className="flex-1 h-12 text-base font-semibold"
            onClick={handleFinish}
            disabled={!storeName.trim() || saving}
          >
            {saving ? 'Menyimpan...' : 'Mulai Jualan! 🚀'}
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-12 text-base font-semibold"
            onClick={() => setStep(s => s + 1)}
          >
            Lanjut
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}
