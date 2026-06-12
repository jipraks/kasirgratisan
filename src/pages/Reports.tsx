import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus, Wallet, CreditCard, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import ExportReportDialog from '@/components/reports/ExportReportDialog';
import UserTypeModal from '@/components/UserTypeModal';
import { shouldShowUserTypeSurvey } from '@/lib/user-type';

export default function Laporan() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<'daily' | '7' | '30'>('7');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const days = period === 'daily' ? 1 : Number(period);

  useEffect(() => {
    if (shouldShowUserTypeSurvey()) {
      const t = setTimeout(() => setSurveyOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dateRange = (() => {
    if (period === 'daily') {
      const date = new Date(`${selectedDate}T00:00:00`);
      return { start: startOfDay(date), end: endOfDay(date) };
    }

    return { start: startOfDay(subDays(new Date(), days - 1)), end: endOfDay(new Date()) };
  })();

  const transactions = useLiveQuery(async () => {
    const all = await db.transactions.where('date').between(dateRange.start, dateRange.end, true, true).toArray();
    return all.filter(t => t.status !== 'open');
  }, [dateRange.start.getTime(), dateRange.end.getTime()]);

  const txItems = useLiveQuery(async () => {
    if (!transactions || transactions.length === 0) return [];
    const txIds = transactions.map(t => t.id!).filter(Boolean);
    return db.transactionItems.where('transactionId').anyOf(txIds).toArray();
  }, [transactions]);

  const expenses = useLiveQuery(async () => {
    const all = await db.expenses.where('date').between(dateRange.start, dateRange.end, true, true).toArray();
    return all.filter(e => e.isDeleted === 0);
  }, [dateRange.start.getTime(), dateRange.end.getTime()]);

  const expenseCategories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );

  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  if (!can('view_reports')) {
    return <LockedPage title="Laporan" permissionLabel="Lihat Laporan & Profit" />;
  }

  const allItems = txItems ?? [];
  const totalSales = transactions?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalProfit = transactions?.reduce((s, t) => s + t.profit, 0) ?? 0;
  const txCount = transactions?.length ?? 0;
  const averageTransaction = txCount > 0 ? totalSales / txCount : 0;

  const totalRevenue = transactions?.reduce((s, t) => s + t.subtotal, 0) ?? 0;
  const totalDiscount = transactions?.reduce((s, t) => s + t.discountAmount, 0) ?? 0;
  const totalHpp = allItems.reduce((s, item) => s + item.hpp * item.quantity, 0);
  const netSales = totalRevenue - totalDiscount;
  const grossProfit = netSales - totalHpp;
  const marginPercent = netSales > 0 ? (grossProfit / netSales * 100) : 0;

  const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;
  const appliedExpenses = includeExpenses ? totalExpenses : 0;
  const netProfit = grossProfit - appliedExpenses;
  const netMarginPercent = netSales > 0 ? (netProfit / netSales * 100) : 0;

  const expenseByCategory: Record<string, { name: string; icon: string; color: string; amount: number }> = {};
  expenses?.forEach(e => {
    const cat = expenseCategories?.find(c => c.id === e.categoryId);
    const key = cat?.name ?? 'Tanpa kategori';
    if (!expenseByCategory[key]) {
      expenseByCategory[key] = {
        name: key,
        icon: cat?.icon ?? '📦',
        color: cat?.color ?? '#6B7280',
        amount: 0,
      };
    }
    expenseByCategory[key].amount += e.amount;
  });
  const topExpenseCategories = Object.values(expenseByCategory)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const chartData = (() => {
    const map: Record<string, number> = {};

    if (period === 'daily') {
      map[format(new Date(`${selectedDate}T00:00:00`), 'dd/MM')] = 0;
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'dd/MM');
        map[d] = 0;
      }
    }

    transactions?.forEach(t => {
      const d = format(new Date(t.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += t.total;
    });
    return Object.entries(map).map(([date, sales]) => ({ date, sales }));
  })();

  const productSales: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
  allItems.forEach(item => {
    if (!productSales[item.productName]) productSales[item.productName] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
    productSales[item.productName].qty += item.quantity;
    productSales[item.productName].revenue += item.subtotal;
    productSales[item.productName].profit += (item.price - item.hpp) * item.quantity - item.discountAmount;
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, period === 'daily' ? 10 : 5);

  const paymentSummary: Record<number, { name: string; amount: number; count: number }> = {};
  transactions?.forEach(t => {
    const method = paymentMethods?.find(p => p.id === t.paymentMethodId);
    const key = t.paymentMethodId ?? 0;
    if (!paymentSummary[key]) paymentSummary[key] = { name: method?.name ?? 'Tanpa metode', amount: 0, count: 0 };
    paymentSummary[key].amount += t.total;
    paymentSummary[key].count += 1;
  });
  const paymentBreakdown = Object.values(paymentSummary).sort((a, b) => b.amount - a.amount);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const compactRp = (n: number) => `Rp ${Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;

  return (
    <div className="space-y-5 px-4 pb-40 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <BarChart3 className="h-5 w-5 text-primary" />
          Laporan
        </h1>
        <Button size="sm" variant="outline" className="h-10 gap-1.5 rounded-full bg-card/80 px-4 shadow-soft" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <ExportReportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaultStartMs={dateRange.start.getTime()}
        defaultEndMs={dateRange.end.getTime()}
      />

      <UserTypeModal open={surveyOpen} onClose={() => setSurveyOpen(false)} />

      <Tabs value={period} onValueChange={v => setPeriod(v as 'daily' | '7' | '30')}>
        <TabsList className="h-11 w-full rounded-2xl bg-muted/70 p-1">
          <TabsTrigger value="daily" className="flex-1 rounded-xl">Harian</TabsTrigger>
          <TabsTrigger value="7" className="flex-1 rounded-xl">7 Hari</TabsTrigger>
          <TabsTrigger value="30" className="flex-1 rounded-xl">30 Hari</TabsTrigger>
        </TabsList>
      </Tabs>

      {period === 'daily' && (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-date" className="text-xs">Tanggal Laporan</Label>
              <Input
                id="report-date"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
              <div>
                <Label htmlFor="include-expenses" className="text-sm font-medium">Masukkan pengeluaran</Label>
                <p className="text-[10px] text-muted-foreground">Pengeluaran akan mengurangi laba bersih</p>
              </div>
              <Switch id="include-expenses" checked={includeExpenses} onCheckedChange={setIncludeExpenses} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm sm:col-span-1">
          <CardContent className="flex items-center gap-3 p-3.5 sm:block sm:text-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:mx-auto sm:mb-2 sm:h-9 sm:w-9"><ShoppingCart className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight">{txCount}</p>
              <p className="text-[10px] text-muted-foreground">Transaksi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm sm:col-span-1">
          <CardContent className="flex items-center gap-3 p-3.5 sm:block sm:text-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/10 text-success sm:mx-auto sm:mb-2 sm:h-9 sm:w-9"><TrendingUp className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold leading-tight sm:text-sm" title={rp(totalSales)}>{compactRp(totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">Penjualan</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-border/70 bg-card/80 shadow-soft backdrop-blur-sm sm:col-span-1">
          <CardContent className="flex items-center gap-3 p-3.5 sm:block sm:text-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent sm:mx-auto sm:mb-2 sm:h-9 sm:w-9"><TrendingUp className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold leading-tight sm:text-sm" title={rp(totalProfit)}>{compactRp(totalProfit)}</p>
              <p className="text-[10px] text-muted-foreground">Profit</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {period === 'daily' && (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
              <CreditCard className="h-4 w-4" />
              Total Penjualan Harian
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">Total Omzet</p>
                <p className="text-sm font-extrabold">{rp(totalSales)}</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">Rata-rata Transaksi</p>
                <p className="text-sm font-extrabold">{rp(averageTransaction)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {paymentBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">Belum ada penjualan</p>
              ) : paymentBreakdown.map(method => (
                <div key={method.name} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{method.name}</p>
                    <p className="text-[10px] text-muted-foreground">{method.count} transaksi</p>
                  </div>
                  <p className="font-bold">{rp(method.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
            <DollarSign className="h-4 w-4" />
            Laba Rugi{period === 'daily' ? ' Harian' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-3.5 w-3.5 text-success" />
              <span>Pendapatan Kotor</span>
            </div>
            <span className="font-semibold">{rp(totalRevenue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <Minus className="h-3.5 w-3.5" />
                <span>Diskon</span>
              </div>
              <span className="font-semibold">-{rp(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-medium">Penjualan Bersih</span>
            <span className="font-bold">{rp(netSales)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-3.5 w-3.5" />
              <span>HPP (Modal)</span>
            </div>
            <span className="font-semibold">-{rp(totalHpp)}</span>
          </div>
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">Laba Kotor</span>
            <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{rp(grossProfit)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Margin Kotor</span>
            <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
          </div>
          {totalExpenses > 0 && (
            <div className={`flex justify-between items-center text-sm ${includeExpenses ? 'text-warning' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" />
                <span>Pengeluaran Operasional{!includeExpenses ? ' (tidak dihitung)' : ''}</span>
              </div>
              <span className="font-semibold">-{rp(totalExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">Laba Bersih</span>
            <span className={`font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{rp(netProfit)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Margin Bersih</span>
            <span className="font-semibold">{netMarginPercent.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {topExpenseCategories.length > 0 && includeExpenses && (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
              <Wallet className="h-4 w-4" />
              Pengeluaran per Kategori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topExpenseCategories.map(cat => {
                const percent = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: cat.color + '20' }}>{cat.icon}</span>
                        <span className="text-sm">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{rp(cat.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{percent.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {period !== 'daily' && (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
              <BarChart3 className="h-4 w-4" />
              Tren Penjualan
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [`Rp ${v.toLocaleString('id-ID')}`, 'Penjualan']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
                    color: 'hsl(var(--foreground))',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                  itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-extrabold">
            <Package className="h-4 w-4" />
            Produk Terlaris{period === 'daily' ? ' Harian' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Belum ada data penjualan</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{rp(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.qty} terjual · laba {rp(p.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
