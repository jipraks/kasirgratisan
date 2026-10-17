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
import { restoreFromBackupData } from '@/lib/backup';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { t, i18n } = useTranslation('onboarding');
  const isNative = useMemo(() => isNativePlatform(), []);

  const tutorialSlides = useMemo(() => [
    {
      icon: Store,
      title: t('slides.welcome.title'),
      description: t('slides.welcome.description'),
      color: 'text-primary bg-primary/10',
      isWelcome: true,
    },
    {
      icon: ShoppingCart,
      title: t('slides.cashier.title'),
      description: t('slides.cashier.description'),
      color: 'text-primary bg-primary/10',
    },
    {
      icon: Package,
      title: t('slides.stock.title'),
      description: t('slides.stock.description'),
      color: 'text-accent bg-accent/10',
    },
    {
      icon: BarChart3,
      title: t('slides.reports.title'),
      description: t('slides.reports.description'),
      color: 'text-success bg-success/10',
    },
    {
      icon: Shield,
      title: t('slides.data.title'),
      description: t('slides.data.description'),
      color: 'text-warning bg-warning/10',
    },
  ], [t]);
  // Web/PWA: tutorial slides (0-3), install (4), store setup (5)
  // APK/native: tutorial slides (0-3), store setup (4)
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loadDummy, setLoadDummy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [themeColor, setThemeColorState] = useState('215');
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
      { name: 'Arroz con pollo', sku: 'NG001', categoryId: 1, price: 15000, hpp: 8000, stock: 50, unit: 'porción', description: 'Arroz con pollo desmechado, maduro y ensalada', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Bandeja paisa', sku: 'MG001', categoryId: 1, price: 12000, hpp: 6000, stock: 40, unit: 'porción', description: 'Frijoles, arroz, carne molida, chicharrón, huevo y arepa', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Pollo asado', sku: 'AB001', categoryId: 1, price: 20000, hpp: 12000, stock: 30, unit: 'porción', description: 'Cuarto de pollo asado con papa y ensalada', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Empanadas (x5)', sku: 'SA001', categoryId: 1, price: 18000, hpp: 10000, stock: 25, unit: 'porción', description: '5 empanadas de carne con ají', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Sancocho', sku: 'BU001', categoryId: 1, price: 15000, hpp: 7000, stock: 35, unit: 'plato', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Limonada', sku: 'ET001', categoryId: 2, price: 5000, hpp: 1500, stock: 100, unit: 'vaso', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Jugo de naranja', sku: 'EJ001', categoryId: 2, price: 7000, hpp: 2500, stock: 80, unit: 'vaso', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Café con leche', sku: 'KS001', categoryId: 2, price: 10000, hpp: 4000, stock: 60, unit: 'vaso', description: 'Café con leche y panela', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Agua', sku: 'AM001', categoryId: 2, price: 4000, hpp: 2000, stock: 120, unit: 'botella', description: '600ml', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Servilletas', sku: 'TS001', categoryId: 3, price: 2000, hpp: 1000, stock: 200, unit: 'pcs', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Papas de paquete', sku: 'KR001', categoryId: 3, price: 3000, hpp: 1500, stock: 150, unit: 'paquete', createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null },
    ];

    const dummySuppliers = [
      { name: 'Distribuidora Fresca S.A.S.', phone: '3011112233', address: 'Calle 15 # 8-20', notes: 'Proveedor de verduras y carnes', createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Bebidas del Valle', phone: '3022223344', address: 'Carrera 8 # 12-40', notes: 'Proveedor de bebidas', createdAt: now, isDeleted: 0, deletedAt: null },
    ];

    // Ensure all units used by sample products exist in master units table.
    // seedDefaultData() already adds the 9 default units; here we only add
    // the extras that the sample data uses (e.g. 'plato').
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
      { transactionId: tx1Id as number, productId: 1, productName: 'Arroz con pollo', quantity: 2, price: 15000, hpp: 8000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 30000 },
      { transactionId: tx1Id as number, productId: 6, productName: 'Limonada', quantity: 2, price: 5000, hpp: 1500, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
    ]);

    const tx2Id = await db.transactions.add({
      subtotal: 30000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 30000,
      paymentMethodId: 3, paymentAmount: 30000, change: 0, profit: 14000,
      date: new Date(now.getTime() - 1800000), receiptNumber: 'TX-DEMO-002',
    });
    await db.transactionItems.bulkAdd([
      { transactionId: tx2Id as number, productId: 3, productName: 'Pollo asado', quantity: 1, price: 20000, hpp: 12000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 20000 },
      { transactionId: tx2Id as number, productId: 8, productName: 'Café con leche', quantity: 1, price: 10000, hpp: 4000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 10000 },
    ]);

    const tx3Id = await db.transactions.add({
      subtotal: 40000, discountType: discNull, discountValue: 0, discountAmount: 0, total: 40000,
      paymentMethodId: 1, paymentAmount: 50000, change: 10000, profit: 18500,
      date: new Date(now.getTime() - 900000), receiptNumber: 'TX-DEMO-003',
    });
    await db.transactionItems.bulkAdd([
      { transactionId: tx3Id as number, productId: 1, productName: 'Arroz con pollo', quantity: 1, price: 15000, hpp: 8000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 15000 },
      { transactionId: tx3Id as number, productId: 4, productName: 'Empanadas (x5)', quantity: 1, price: 18000, hpp: 10000, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 18000 },
      { transactionId: tx3Id as number, productId: 7, productName: 'Jugo de naranja', quantity: 1, price: 7000, hpp: 2500, discountType: discNull, discountValue: 0, discountAmount: 0, subtotal: 7000 },
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
        await restoreFromBackupData(data);
        await finishAfterRestore(t('toast.restoreSuccess'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toast.restoreError'));
      } finally {
        setRestoring(false);
      }
    };
    input.click();
  };

  // Tutup wizard onboarding setelah restore berhasil (paksa onboardingDone).
  const finishAfterRestore = async (successMsg: string) => {
    const s = await db.storeSettings.toCollection().first();
    if (s?.id) {
      await db.storeSettings.update(s.id, { onboardingDone: true });
    } else {
      await db.storeSettings.add({
        storeName: 'Mi tienda',
        address: '',
        phone: '',
        receiptFooter: '¡Gracias por su visita!',
        printLogo: false,
        onboardingDone: true,
        lastBackupAt: null,
        deviceId: crypto.randomUUID(),
      });
    }
    await markAllFeaturesSeen();
    toast.success(successMsg);
    onComplete();
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
          receiptFooter: '¡Gracias por su visita!',
          printLogo: false,
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
                  {tutorialIndex === 0 ? (
                    <>
                      <img
                        src="/header-icon.png"
                        alt="FreeKasir"
                        className="w-28 h-28 object-contain"
                      />
                      <div className="space-y-3">
                        <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
                        <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">{slide.description}</p>
                      </div>
                      {/* Language picker */}
                      <div className="w-full max-w-xs space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">{t('language.title')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {SUPPORTED_LANGUAGES.map(({ code, label, flag }) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => i18n.changeLanguage(code as SupportedLanguage)}
                              className={cn(
                                'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200',
                                i18n.language === code
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
                              )}
                            >
                              <span className="text-2xl">{flag}</span>
                              <span className={cn(
                                'text-[11px] font-semibold leading-tight text-center',
                                i18n.language === code ? 'text-primary' : 'text-foreground'
                              )}>
                                {label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className={cn('w-24 h-24 rounded-3xl flex items-center justify-center', slide.color)}>
                      <Icon className="w-12 h-12" />
                    </div>
                  )}
                  {tutorialIndex === 0 ? null : (
                    <div className="space-y-3">
                      <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
                      <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">{slide.description}</p>
                    </div>
                  )}
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
                {isInstalled || installDone ? t('install.installed') : t('install.title')}
              </h2>
              <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {isInstalled || installDone
                  ? t('install.installedDesc')
                  : t('install.desc')}
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
                        toast.success(t('install.success'));
                      }
                    }}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {t('install.button')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="w-full h-12 text-base text-muted-foreground"
                    onClick={() => setStep(s => s + 1)}
                  >
                    <Globe className="w-5 h-5 mr-2" />
                    {t('install.continueBrowser')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-w-xs">
                  <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('install.chromeHint') }} />
                  <p className="text-xs text-muted-foreground/70">
                    {t('install.safariHint')}
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
              <h2 className="text-2xl font-bold tracking-tight">{t('store.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('store.subtitle')}</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t('restore.title')}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">{t('restore.desc')}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleRestore} disabled={restoring}>
                <Upload className="w-4 h-4" />
                {restoring ? t('restore.restoring') : t('restore.backupButton')}
              </Button>

            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName" className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  {t('store.storeName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="storeName"
                  placeholder={t('store.storeNamePlaceholder')}
                  value={storeName}
                  onChange={e => setStoreName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {t('store.address')}
                </Label>
                <Input
                  id="address"
                  placeholder={t('store.addressPlaceholder')}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {t('store.phone')}
                </Label>
                <Input
                  id="phone"
                  placeholder={t('store.phonePlaceholder')}
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
                    <p className="text-sm font-medium">{t('store.loadDummy')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('store.loadDummyDesc')}</p>
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
                    <p className="text-sm font-medium">{t('store.theme')}</p>
                    <p className="text-[10px] text-muted-foreground">{t('store.themeDesc')}</p>
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
                {t('navigation.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {!canInstall && !isInstalled && !installDone && (
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-semibold"
                onClick={() => setStep(s => s + 1)}
              >
                {t('navigation.next')}
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
            {saving ? t('navigation.saving') : t('navigation.finish')}
          </Button>
        ) : (
          <Button
            size="lg"
            className="flex-1 h-12 text-base font-semibold"
            onClick={() => setStep(s => s + 1)}
           
          >
            {t('navigation.next')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
}
