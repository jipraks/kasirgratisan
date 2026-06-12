import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, History, CreditCard, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useCloudAuth } from '@/hooks/use-cloud-auth';
import { fetchPaymentHistory, verifyPayment, type PaymentTransaction } from '@/lib/cloud-api';

const PAGE_SIZE = 10;
const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Berhasil', PENDING: 'Menunggu', FAILED: 'Gagal' };
const STATUS_COLOR: Record<string, string> = { COMPLETED: 'text-success', PENDING: 'text-warning', FAILED: 'text-destructive' };

export default function CloudHistorySettings() {
  const { can } = useAuth();
  const { isLoggedIn, refreshProfile } = useCloudAuth();

  const [history, setHistory] = useState<PaymentTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    try {
      const { items, pagination } = await fetchPaymentHistory({ page: p, limit: PAGE_SIZE });
      setHistory((prev) => (append ? [...prev, ...items] : items));
      setPage(pagination.page);
      setHasMore(pagination.hasMore);
    } catch {
      /* diabaikan */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) load(1, false);
  }, [isLoggedIn, load]);

  if (!can('manage_backup')) {
    return <LockedPage title="Riwayat Transaksi" permissionLabel="Kelola Backup" />;
  }

  const handleCheckPayment = async (txId: string) => {
    setBusy(`verify:${txId}`);
    try {
      const result = await verifyPayment(txId);
      await load(1, false);
      if (result.transaction.status === 'COMPLETED') {
        await refreshProfile();
        toast.success('Pembayaran berhasil! Langganan aktif. 🎉');
      } else {
        toast.info('Pembayaran belum terdeteksi. Coba lagi beberapa saat.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal cek pembayaran');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2">
        <Link to="/settings/cloud-backup">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <History className="h-5 w-5 text-primary" />
          Riwayat Transaksi
        </h1>
      </div>

      {!isLoggedIn ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">Login dulu untuk melihat riwayat transaksi.</CardContent>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-4 space-y-2">
            {loading && history.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Belum ada transaksi</p>
            ) : (
              <>
                {history.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between garounded-2xl p-2 border p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{tx.plan?.name ?? tx.planId}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold">{rp(tx.amount)}</p>
                        <span className={`text-[10px] font-semibold ${STATUS_COLOR[tx.status] ?? 'text-muted-foreground'}`}>
                          {STATUS_LABEL[tx.status] ?? tx.status}
                        </span>
                      </div>
                      {tx.status === 'PENDING' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" disabled={busy === `verify:${tx.id}`} onClick={() => handleCheckPayment(tx.id)}>
                          {busy === `verify:${tx.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                          Cek
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs" disabled={loading} onClick={() => load(page + 1, true)}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Muat lebih banyak'}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
