import { BarChart3, Package, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-6 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight">KasirGratisan</h1>
            <p className="text-sm text-muted-foreground">
              Sistem kasir ringan untuk transaksi, stok, laporan, dan operasional toko harian.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="rounded-2xl bg-muted/50 p-3">
              <BarChart3 className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs font-semibold">Laporan rapi</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <Package className="mb-2 h-4 w-4 text-primary" />
              <p className="text-xs font-semibold">Stok terpantau</p>
            </div>
          </div>
          <Button asChild className="h-11 w-full rounded-full">
            <Link to="/dashboard">Masuk ke Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
