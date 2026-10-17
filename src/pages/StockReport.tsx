import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import { Package, ArrowDownToLine, ArrowUpFromLine, TrendingUp, AlertTriangle, Warehouse, BarChart3, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';


export default function StockReport() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t, i18n } = useTranslation('settings');
  const numberLocale = NUMBER_LOCALE;
  const currencySymbol = CURRENCY_SYMBOL;
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const days = Number(period);
  const since = startOfDay(subDays(new Date(), days));

  const products = useLiveQuery(() => db.products.toArray());
  const stockIns = useLiveQuery(async () => db.stockIns.where('date').aboveOrEqual(since).toArray(), [days]);
  const stockOuts = useLiveQuery(async () => db.stockOuts.where('date').aboveOrEqual(since).toArray(), [days]);

  if (!can('view_reports')) {
    return <LockedPage title={t('stockReport.locked.title')} permissionLabel={t('stockReport.locked.permissionLabel')} />;
  }

  const totalStockIn = stockIns?.reduce((s, si) => s + si.quantity, 0) ?? 0;
  const totalStockInValue = stockIns?.reduce((s, si) => s + si.totalPrice, 0) ?? 0;
  const totalStockOut = stockOuts?.reduce((s, so) => s + so.quantity, 0) ?? 0;

  const stockOutByReason = stockOuts?.reduce((acc, so) => {
    acc[so.reason] = (acc[so.reason] || 0) + so.quantity;
    return acc;
  }, {} as Record<string, number>) ?? {};

  const currentStock = products?.reduce((s, p) => s + p.stock, 0) ?? 0;
  const lowStockProducts = products?.filter(p => p.stock > 0 && p.stock <= 5) ?? [];
  const outOfStockProducts = products?.filter(p => p.stock === 0) ?? [];

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';

  const chartData = (() => {
    const map: Record<string, { stockIn: number; stockOut: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map[d] = { stockIn: 0, stockOut: 0 };
    }
    stockIns?.forEach(si => {
      const d = format(new Date(si.date), 'dd/MM');
      if (map[d]) map[d].stockIn += si.quantity;
    });
    stockOuts?.forEach(so => {
      const d = format(new Date(so.date), 'dd/MM');
      if (map[d]) map[d].stockOut += so.quantity;
    });
    return Object.entries(map).map(([date, data]) => ({ date, ...data }));
  })();

  const stockMovementData = (() => {
    const map: Record<string, number> = {};
    let cumulative = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map[d] = 0;
    }
    stockIns?.forEach(si => {
      const d = format(new Date(si.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += si.quantity;
    });
    stockOuts?.forEach(so => {
      const d = format(new Date(so.date), 'dd/MM');
      if (map[d] !== undefined) map[d] -= so.quantity;
    });
    return Object.entries(map).map(([date, movement]) => {
      cumulative += movement;
      return { date, stock: cumulative };
    });
  })();

  const rp = (n: number) => `${currencySymbol} ${n.toLocaleString(numberLocale)}`;

  const getReasonLabel = (reason: string) => {
    const keyMap: Record<string, string> = {
      rusak: 'damaged',
      hilang: 'lost',
      retur: 'return',
      expired: 'expired',
      sample: 'sample',
      opname: 'opname',
      lain: 'other',
    };
    return t(`stockReport.reasons.${keyMap[reason] ?? 'other'}`, reason);
  };

  const stockInLabel = t('stockReport.movementChart.in');
  const stockOutLabel = t('stockReport.movementChart.out');

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/settings')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-primary" />
          {t('stockReport.title')}
        </h1>
      </div>

      <Tabs value={period} onValueChange={v => setPeriod(v as '7' | '30')}>
        <TabsList className="w-full">
          <TabsTrigger value="7" className="flex-1">{t('stockReport.period.7days')}</TabsTrigger>
          <TabsTrigger value="30" className="flex-1">{t('stockReport.period.30days')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowDownToLine className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-lg font-bold">{totalStockIn}</p>
            <p className="text-[10px] text-muted-foreground">{t('stockReport.summary.in')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ArrowUpFromLine className="w-4 h-4 mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold">{totalStockOut}</p>
            <p className="text-[10px] text-muted-foreground">{t('stockReport.summary.out')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <Package className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{currentStock}</p>
            <p className="text-[10px] text-muted-foreground">{t('stockReport.summary.available')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock In Value */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-success" />
            {t('stockReport.stockInValue.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('stockReport.stockInValue.totalPurchase')}</span>
            <span className="text-lg font-bold text-success">{rp(totalStockInValue)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('stockReport.stockInValue.average', { avg: totalStockIn > 0 ? rp(totalStockInValue / totalStockIn) : rp(0) })}
          </p>
        </CardContent>
      </Card>

      {/* Stock Movement Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" />
            {t('stockReport.movementChart.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip 
                formatter={(v: number, name: string) => [v, name === 'stockIn' ? stockInLabel : stockOutLabel]} 
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontSize: 10 }}
              />
              <Bar dataKey="stockIn" fill="hsl(142, 71%, 45%)" radius={[2, 2, 0, 0]} name={stockInLabel} />
              <Bar dataKey="stockOut" fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} name={stockOutLabel} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stock Out by Reason */}
      {Object.keys(stockOutByReason).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ArrowUpFromLine className="w-4 h-4 text-destructive" />
              {t('stockReport.reasons.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stockOutByReason).map(([reason, qty]) => (
              <div key={reason} className="flex items-center justify-between">
                <span className="text-sm">{getReasonLabel(reason)}</span>
                <span className="font-semibold text-destructive">{qty} {t('stockReport.reasons.unit')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <Card className="border-0 shadow-sm border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-warning">
              <AlertTriangle className="w-4 h-4" />
              {t('stockReport.lowStock.title', { count: lowStockProducts.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockProducts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-sm font-bold text-warning">{p.stock} {p.unit}</span>
              </div>
            ))}
            {lowStockProducts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                {t('stockReport.lowStock.more', { count: lowStockProducts.length - 5 })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Out of Stock */}
      {outOfStockProducts.length > 0 && (
        <Card className="border-0 shadow-sm border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-destructive">
              <Package className="w-4 h-4" />
              {t('stockReport.outOfStock.title', { count: outOfStockProducts.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {outOfStockProducts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{p.name}</span>
                <span className="text-xs text-destructive">0 {p.unit}</span>
              </div>
            ))}
            {outOfStockProducts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                {t('stockReport.lowStock.more', { count: outOfStockProducts.length - 5 })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
