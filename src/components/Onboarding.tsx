import { useState } from 'react';
import { Store, MapPin, Phone, ChevronRight, ChevronLeft, ShoppingCart, Package, BarChart3, Shield, Database, Palette, Download, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { applyThemeColor } from '@/hooks/use-theme-color';
import { usePWAInstall } from '@/hooks/use-pwa-install';

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
  const [step, setStep] = useState(0); // 0-3 = tutorial, 4 = install, 5 = store setup
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loadDummy, setLoadDummy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [themeColor, setThemeColorState] = useState('25');
  const [installDone, setInstallDone] = useState(false);
  const { canInstall, isInstalled, install } = usePWAInstall();

  // Steps: tutorial slides (0-3), install (4), store setup (5)
  const totalSteps = tutorialSlides.length + 2;
  const isInstallStep = step === tutorialSlides.length;
  const isStoreStep = step === tutorialSlides.length + 1;

  const seedDummyData = async () => {
    const dummyProducts = [
      { name: 'Nasi Goreng Spesial', sku: 'NG001', categoryId: 1, price: 15000, hpp: 8000, stock: 50, unit: 'porsi', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Mie Goreng', sku: 'MG001', categoryId: 1, price: 12000, hpp: 6000, stock: 40, unit: 'porsi', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Ayam Bakar', sku: 'AB001', categoryId: 1, price: 20000, hpp: 12000, stock: 30, unit: 'porsi', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Sate Ayam (10 tusuk)', sku: 'SA001', categoryId: 1, price: 18000, hpp: 10000, stock: 25, unit: 'porsi', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Bakso Urat', sku: 'BU001', categoryId: 1, price: 15000, hpp: 7000, stock: 35, unit: 'mangkok', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Es Teh Manis', sku: 'ET001', categoryId: 2, price: 5000, hpp: 1500, stock: 100, unit: 'gelas', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Es Jeruk', sku: 'EJ001', categoryId: 2, price: 7000, hpp: 2500, stock: 80, unit: 'gelas', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Kopi Susu', sku: 'KS001', categoryId: 2, price: 10000, hpp: 4000, stock: 60, unit: 'gelas', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Air Mineral', sku: 'AM001', categoryId: 2, price: 4000, hpp: 2000, stock: 120, unit: 'botol', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Tisu', sku: 'TS001', categoryId: 3, price: 2000, hpp: 1000, stock: 200, unit: 'pcs', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Kerupuk', sku: 'KR001', categoryId: 3, price: 3000, hpp: 1500, stock: 150, unit: 'bungkus', createdAt: new Date(), updatedAt: new Date() },
    ];

    const dummySuppliers = [
      { name: 'PT Bahan Segar', phone: '08111222333', address: 'Jl. Pasar Baru No. 15', notes: 'Supplier sayur & daging', createdAt: new Date() },
      { name: 'UD Minuman Jaya', phone: '08222333444', address: 'Jl. Raya Industri No. 8', notes: 'Supplier minuman', createdAt: new Date() },
    ];

    await db.products.bulkAdd(dummyProducts);
    await db.suppliers.bulkAdd(dummySuppliers);

    // Add some dummy transactions for today
    const now = new Date();
    const discNull: 'percentage' | 'nominal' | null = null;
    const txs = [
      {
        items: [
          { productId: 1, productName: 'Nasi Goreng Spesial', quantity: 2, price: 15000, hpp: 8000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 30000 },
          { productId: 6, productName: 'Es Teh Manis', quantity: 2, price: 5000, hpp: 1500, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
        ],
        subtotal: 40000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 40000,
        paymentMethodId: 1, paymentAmount: 50000, change: 10000, profit: 21000,
        date: new Date(now.getTime() - 3600000), receiptNumber: 'TX-DEMO-001',
      },
      {
        items: [
          { productId: 3, productName: 'Ayam Bakar', quantity: 1, price: 20000, hpp: 12000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 20000 },
          { productId: 8, productName: 'Kopi Susu', quantity: 1, price: 10000, hpp: 4000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
        ],
        subtotal: 30000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 30000,
        paymentMethodId: 3, paymentAmount: 30000, change: 0, profit: 14000,
        date: new Date(now.getTime() - 1800000), receiptNumber: 'TX-DEMO-002',
      },
    ];
    await db.transactions.bulkAdd(txs);
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
        toast.success('Data contoh berhasil dimuat!');
      }

      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-background max-w-lg mx-auto overflow-y-auto" style={{ height: '100dvh', WebkitOverflowScrolling: 'touch' }}>
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

      <div className="flex-1 flex flex-col px-6">
        {!isInstallStep && !isStoreStep ? (
          /* Tutorial slides */
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            {(() => {
              const slide = tutorialSlides[step];
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
          /* Install as app step */
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center', 
              isInstalled || installDone ? 'text-success bg-success/10' : 'text-primary bg-primary/10'
            )}>
              {isInstalled || installDone ? <CheckCircle2 className="w-12 h-12" /> : <Download className="w-12 h-12" />}
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                {isInstalled || installDone ? 'Sudah Terinstall! ✅' : 'Install di HP Kamu'}
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {isInstalled || installDone 
                  ? 'KasirGratisan sudah terinstall sebagai aplikasi. Kamu bisa buka langsung dari home screen!'
                  : 'Jadikan KasirGratisan sebagai aplikasi di HP kamu. Akses lebih cepat langsung dari home screen, tanpa buka browser!'}
              </p>
            </div>
            {!isInstalled && !installDone && (
              canInstall ? (
                <Button
                  size="lg"
                  className="h-12 px-8 text-base font-semibold"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) {
                      setInstallDone(true);
                      toast.success('Berhasil install KasirGratisan!');
                    }
                  }}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Install Sekarang
                </Button>
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
          /* Store setup */
          <div className="flex-1 flex flex-col overflow-y-auto space-y-6 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Store className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Setup Toko Kamu</h2>
              <p className="text-sm text-muted-foreground">Informasi ini akan tampil di struk belanja</p>
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
                    <p className="text-[10px] text-muted-foreground">11 produk, 2 supplier, 2 transaksi demo</p>
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
      <div className="px-6 pt-4 flex items-center gap-3" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
        {step > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => setStep(s => s - 1)}
            className="h-12"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        {isStoreStep ? (
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
            {isInstallStep ? 'Lewati' : 'Lanjut'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}
