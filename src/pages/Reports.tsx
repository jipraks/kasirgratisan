import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus, Wallet, CreditCard, Download, Printer } from 'lucide-react';
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
import { printRawNativeBluetooth, getDailyReportESCPOSData, type DailyReportPrintData } from '@/lib/printer';
import DailyReportReceipt from '@/components/reports/DailyReportReceipt';
import { useTranslation } from 'react-i18next';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';


export default function Laporan() {
  const { can, currentUser } = useAuth();
  const { t, i18n } = useTranslation('reports');
  const numberLocale = NUMBER_LOCALE;
  const currencySymbol = CURRENCY_SYMBOL;
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const [period, setPeriod] = useState<'daily' | '7' | '30'>('daily');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState<DailyReportPrintData | null>(null);
  const days = period === 'daily' ? 1 : Number(period);

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

  const debtPayments = useLiveQuery(
    () => db.debtPayments.where('date').between(dateRange.start, dateRange.end, true, true).toArray(),
    [dateRange.start.getTime(), dateRange.end.getTime()],
  );

  const expenseCategories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );

  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  if (!can('view_reports')) {
    return <LockedPage title={t('locked.title')} permissionLabel={t('locked.permissionLabel')} />;
  }

  const allItems = txItems ?? [];
  const totalSales = transactions?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalProfit = transactions?.reduce((s, t) => s + t.profit, 0) ?? 0;
  const txCount = transactions?.length ?? 0;
  const averageTransaction = txCount > 0 ? totalSales / txCount : 0;
  const initialPayments = transactions?.reduce((sum, transaction) => sum + Math.min(transaction.paymentAmount, transaction.total), 0) ?? 0;
  const installmentPayments = debtPayments?.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
  const totalCashIn = initialPayments + installmentPayments;

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
    const key = cat?.name ?? t('fallbacks.uncategorized');
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
    if (t.paymentAmount <= 0) return;
    const method = paymentMethods?.find(p => p.id === t.paymentMethodId);
    const key = t.paymentMethodId ?? 0;
    if (!paymentSummary[key]) paymentSummary[key] = { name: method?.name ?? t('fallbacks.noMethod'), amount: 0, count: 0 };
    paymentSummary[key].amount += Math.min(t.paymentAmount, t.total);
    paymentSummary[key].count += 1;
  });
  debtPayments?.forEach((payment) => {
    const method = paymentMethods?.find((item) => item.id === payment.paymentMethodId);
    const key = payment.paymentMethodId;
    if (!paymentSummary[key]) paymentSummary[key] = { name: method?.name ?? t('fallbacks.deletedMethod'), amount: 0, count: 0 };
    paymentSummary[key].amount += payment.amount;
    paymentSummary[key].count += 1;
  });
  const paymentBreakdown = Object.values(paymentSummary).sort((a, b) => b.amount - a.amount);

  const rp = (n: number) => `${currencySymbol} ${n.toLocaleString(numberLocale)}`;

  const handlePrintDailyReport = () => {
    const itemsCount = allItems.reduce((s, item) => s + item.quantity, 0);
    const formattedDate = format(new Date(`${selectedDate}T00:00:00`), 'dd-MM-yyyy');
    
    const data: DailyReportPrintData = {
      dateStr: formattedDate,
      periodStr: `${formattedDate} 00:00 - 23:59`,
      txCount,
      itemCount: itemsCount,
      grossSales: totalRevenue,
      discount: totalDiscount,
      netSales: netSales,
      paymentBreakdown: paymentBreakdown.map(method => ({
        name: method.name,
        amount: method.amount,
        count: method.count
      })),
      topProducts: topProducts.map(p => ({
        name: p.name,
        qty: p.qty,
        revenue: p.revenue
      })),
      storeSettings,
      cashierName: currentUser?.name || t('fallbacks.owner'),
      includeExpenses,
      expensesAmount: appliedExpenses,
      netProfit: netProfit
    };

    setReportData(data);
    setReportOpen(true);
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          {t('title')}
        </h1>
        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setExportOpen(true)}>
          <Download className="w-4 h-4" /> {t('export')}
        </Button>
      </div>

      <ExportReportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaultStartMs={dateRange.start.getTime()}
        defaultEndMs={dateRange.end.getTime()}
      />

      {reportData && (
        <DailyReportReceipt
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          data={reportData}
        />
      )}

      <Tabs value={period} onValueChange={v => setPeriod(v as 'daily' | '7' | '30')}>
        <TabsList className="w-full">
          <TabsTrigger value="daily" className="flex-1">{t('tabs.daily')}</TabsTrigger>
          <TabsTrigger value="7" className="flex-1">{t('tabs.7days')}</TabsTrigger>
          <TabsTrigger value="30" className="flex-1">{t('tabs.30days')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {period === 'daily' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-date" className="text-xs">{t('daily.reportDate')}</Label>
              <Input
                id="report-date"
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div>
                <Label htmlFor="include-expenses" className="text-sm font-medium">{t('daily.includeExpenses')}</Label>
                <p className="text-[10px] text-muted-foreground">{t('daily.includeExpensesHint')}</p>
              </div>
              <Switch id="include-expenses" checked={includeExpenses} onCheckedChange={setIncludeExpenses} />
            </div>
            <Button
              className="w-full gap-2 mt-2"
              onClick={handlePrintDailyReport}
              disabled={txCount === 0}
            >
              <Printer className="w-4 h-4" />
              {t('daily.printClosingReport')}
            </Button>
            {txCount === 0 && (
              <p className="text-[10px] text-destructive text-center mt-1.5 font-medium">
                {t('daily.noSalesSelectedDate')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{txCount}</p>
            <p className="text-[10px] text-muted-foreground">{t('summary.transactions')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-sm font-bold">{rp(totalSales)}</p>
            <p className="text-[10px] text-muted-foreground">{t('summary.sales')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-sm font-bold">{rp(totalProfit)}</p>
            <p className="text-[10px] text-muted-foreground">{t('summary.profit')}</p>
          </CardContent>
        </Card>
      </div>

      {period === 'daily' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              {t('dailySales.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">{t('dailySales.grossSales')}</p>
                <p className="text-sm font-bold">{rp(totalSales)}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3">
                <p className="text-[10px] text-muted-foreground">{t('dailySales.cashIn')}</p>
                <p className="text-sm font-bold text-success">{rp(totalCashIn)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] text-muted-foreground">{t('dailySales.avgTransaction')}</p>
                <p className="text-xs font-bold">{rp(averageTransaction)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {paymentBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">{t('dailySales.noSales')}</p>
              ) : paymentBreakdown.map(method => (
                <div key={method.name} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{method.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t('dailySales.transactionCount', { count: method.count })}</p>
                  </div>
                  <p className="font-bold">{rp(method.amount)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            {t(period === 'daily' ? 'pl.daily' : 'pl.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-success" />
              <span>{t('pl.grossRevenue')}</span>
            </div>
            <span className="font-semibold">{rp(totalRevenue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <Minus className="w-3.5 h-3.5" />
                <span>{t('pl.discount')}</span>
              </div>
              <span className="font-semibold">-{rp(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm border-t pt-2">
            <span className="font-medium">{t('pl.netSales')}</span>
            <span className="font-bold">{rp(netSales)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-destructive">
            <div className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{t('pl.cogs')}</span>
            </div>
            <span className="font-semibold">-{rp(totalHpp)}</span>
          </div>
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">{t('pl.grossProfit')}</span>
            <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{rp(grossProfit)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{t('pl.grossMargin')}</span>
            <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
          </div>
          {totalExpenses > 0 && (
            <div className={`flex justify-between items-center text-sm ${includeExpenses ? 'text-warning' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5" />
                <span>{t('pl.operationalExpenses')}{!includeExpenses ? t('pl.notIncluded') : ''}</span>
              </div>
              <span className="font-semibold">-{rp(totalExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">{t('pl.netProfit')}</span>
            <span className={`font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{rp(netProfit)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{t('pl.netMargin')}</span>
            <span className="font-semibold">{netMarginPercent.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {topExpenseCategories.length > 0 && includeExpenses && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              {t('expenses.title')}
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
                        <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: cat.color + '20' }}>{cat.icon}</span>
                        <span className="text-sm">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{rp(cat.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{percent.toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
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
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('chart.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [`${currencySymbol} ${v.toLocaleString(numberLocale)}`, t('chart.tooltipLabel')]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            {t(period === 'daily' ? 'products.daily' : 'products.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('products.noData')}</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{rp(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{t('products.sold', { qty: p.qty, profit: rp(p.profit) })}</p>
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
