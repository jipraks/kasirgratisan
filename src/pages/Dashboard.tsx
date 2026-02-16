import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDefaultData, type TransactionItemRecord } from '@/lib/db';
import { useEffect, useState } from 'react';
import { ShoppingCart, Package, BarChart3, TrendingUp, AlertTriangle, Receipt, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Onboarding from '@/components/Onboarding';
import BackupReminder, { shouldShowBackupReminder, exportBackupData } from '@/components/BackupReminder';

export default function Dashboard() {
  const [backupDismissed, setBackupDismissed] = useState(false);

  useEffect(() => {
    seedDefaultData();
  }, []);

  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTransactions = useLiveQuery(async () => {
    return db.transactions.where('date').aboveOrEqual(today).toArray();
  }, []);

  const lowStockProducts = useLiveQuery(() => db.products.filter(p => !p.isDeleted && p.stock <= 5).toArray());

  const recentTransactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().limit(5).toArray()
  );

  // Query items for recent transactions
  const recentTxItems = useLiveQuery(async () => {
    if (!recentTransactions || recentTransactions.length === 0) return {};
    const txIds = recentTransactions.map(t => t.id!).filter(Boolean);
    const items = await db.transactionItems.where('transactionId').anyOf(txIds).toArray();
    const map: Record<number, TransactionItemRecord[]> = {};
    for (const item of items) {
      if (!map[item.transactionId]) map[item.transactionId] = [];
      map[item.transactionId].push(item);
    }
    return map;
  }, [recentTransactions]);

  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  // Show onboarding if not done yet
  if (storeSettings === undefined) return null; // loading
  if (storeSettings && !storeSettings.onboardingDone) {
    return (
      <Onboarding onComplete={() => {
        // Dexie live query will auto-refresh
      }} />
    );
  }

  const totalSales = todayTransactions?.reduce((sum, t) => sum + t.total, 0) ?? 0;
  const totalProfit = todayTransactions?.reduce((sum, t) => sum + t.profit, 0) ?? 0;
  const txCount = todayTransactions?.length ?? 0;

  const showBackup = !backupDismissed && storeSettings && shouldShowBackupReminder(storeSettings.lastBackupAt);

  const quickActions = [
    { to: '/cashier', icon: ShoppingCart, label: 'Kasir', color: 'bg-primary/10 text-primary' },
    { to: '/products', icon: Package, label: 'Produk', color: 'bg-accent/10 text-accent' },
    { to: '/reports', icon: BarChart3, label: 'Laporan', color: 'bg-success/10 text-success' },
  ];

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}</p>
        <h1 className="text-2xl font-bold tracking-tight">{storeSettings?.storeName || 'KasirGratisan'}</h1>
      </div>

      {/* Backup Reminder */}
      {showBackup && (
        <BackupReminder
          lastBackupAt={storeSettings?.lastBackupAt ?? null}
          onDismiss={() => setBackupDismissed(true)}
          onBackup={exportBackupData}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-primary text-primary-foreground">
          <CardContent className="p-4">
            <p className="text-xs opacity-80">Penjualan Hari Ini</p>
            <p className="text-xl font-bold mt-1">Rp {totalSales.toLocaleString('id-ID')}</p>
            <p className="text-xs opacity-70 mt-1">{txCount} transaksi</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-success">
              <TrendingUp className="w-4 h-4" />
              <p className="text-xs font-medium">Profit Hari Ini</p>
            </div>
            <p className="text-xl font-bold mt-1">Rp {totalProfit.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Akses Cepat</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map(({ to, icon: Icon, label, color }) => (
            <Link key={to} to={to}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTransactions && recentTransactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-primary" />
              Transaksi Terakhir
            </h2>
            <Link to="/history">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                Lihat Semua <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {recentTransactions.map(tx => (
              <Link key={tx.id ?? tx.receiptNumber} to={`/history?txId=${tx.id ?? tx.receiptNumber}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow mb-2">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate">{(recentTxItems?.[tx.id!] ?? []).map(i => i.productName).join(', ')}</p>
                        <p className="text-[10px] text-muted-foreground shrink-0 ml-2">{format(new Date(tx.date), 'HH:mm')}</p>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-sm font-bold text-primary">Rp {tx.total.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-muted-foreground">{paymentMethods?.find(pm => pm.id === tx.paymentMethodId)?.name || 'Tunai'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Stok Menipis
          </h2>
          <div className="space-y-2">
            {lowStockProducts.slice(0, 5).map(product => (
              <Card key={product.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{product.name}</span>
                  <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                    Sisa {product.stock} {product.unit}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
