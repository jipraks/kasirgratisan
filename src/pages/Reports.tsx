import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, DollarSign, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function Laporan() {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const days = Number(period);

  const transactions = useLiveQuery(async () => {
    const since = startOfDay(subDays(new Date(), days));
    return db.transactions.where('date').aboveOrEqual(since).toArray();
  }, [days]);

  const totalSales = transactions?.reduce((s, t) => s + t.total, 0) ?? 0;
  const totalProfit = transactions?.reduce((s, t) => s + t.profit, 0) ?? 0;
  const txCount = transactions?.length ?? 0;

  // P&L breakdown
  const totalRevenue = transactions?.reduce((s, t) => s + t.subtotal, 0) ?? 0;
  const totalDiscount = transactions?.reduce((s, t) => s + t.discountAmount, 0) ?? 0;
  const totalHpp = transactions?.reduce((s, t) => {
    return s + t.items.reduce((is, item) => is + item.hpp * item.quantity, 0);
  }, 0) ?? 0;
  const netSales = totalRevenue - totalDiscount; // same as totalSales
  const grossProfit = netSales - totalHpp;
  const marginPercent = netSales > 0 ? (grossProfit / netSales * 100) : 0;

  // Chart data
  const chartData = (() => {
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      map[d] = 0;
    }
    transactions?.forEach(t => {
      const d = format(new Date(t.date), 'dd/MM');
      if (map[d] !== undefined) map[d] += t.total;
    });
    return Object.entries(map).map(([date, sales]) => ({ date, sales }));
  })();

  // Top products
  const productSales: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
  transactions?.forEach(t => {
    t.items.forEach(item => {
      if (!productSales[item.productName]) productSales[item.productName] = { name: item.productName, qty: 0, revenue: 0, profit: 0 };
      productSales[item.productName].qty += item.quantity;
      productSales[item.productName].revenue += item.subtotal;
      productSales[item.productName].profit += (item.price - item.hpp) * item.quantity - item.discountAmount;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="px-4 pt-6 pb-20 space-y-5">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        Laporan
      </h1>

      <Tabs value={period} onValueChange={v => setPeriod(v as '7' | '30')}>
        <TabsList className="w-full">
          <TabsTrigger value="7" className="flex-1">7 Hari</TabsTrigger>
          <TabsTrigger value="30" className="flex-1">30 Hari</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{txCount}</p>
            <p className="text-[10px] text-muted-foreground">Transaksi</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
            <p className="text-sm font-bold">{rp(totalSales)}</p>
            <p className="text-[10px] text-muted-foreground">Penjualan</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-sm font-bold">{rp(totalProfit)}</p>
            <p className="text-[10px] text-muted-foreground">Profit</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit & Loss */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <DollarSign className="w-4 h-4" />
            Laba Rugi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-success" />
              <span>Pendapatan Kotor</span>
            </div>
            <span className="font-semibold">{rp(totalRevenue)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm text-destructive">
              <div className="flex items-center gap-2">
                <Minus className="w-3.5 h-3.5" />
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
              <ArrowDown className="w-3.5 h-3.5" />
              <span>HPP (Modal)</span>
            </div>
            <span className="font-semibold">-{rp(totalHpp)}</span>
          </div>
          <div className="flex justify-between items-center text-base border-t pt-2">
            <span className="font-bold">Laba Kotor</span>
            <span className={`font-bold ${grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {rp(grossProfit)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Margin</span>
            <span className="font-semibold">{marginPercent.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tren Penjualan</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => [`Rp ${v.toLocaleString('id-ID')}`, 'Penjualan']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="sales" fill="hsl(25, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Produk Terlaris
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
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
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
