import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Banknote, CalendarClock, CheckCircle2, Clock3, Printer, ReceiptText, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ShiftReportReceipt from '@/components/ShiftReportReceipt';
import LockedPage from '@/components/LockedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db, type Shift } from '@/lib/db';
import { calculateShiftSummary, closeShift, openShift } from '@/lib/shifts';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const money = (value = 0) => `Rp ${value.toLocaleString('id-ID')}`;

export default function ShiftsPage() {
  const { can, currentUser } = useAuth();
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedReport, setSelectedReport] = useState<Shift | null>(null);

  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());
  const shifts = useLiveQuery(() => db.shifts.orderBy('openedAt').reverse().limit(20).toArray());
  const users = useLiveQuery(() => db.users.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const liveSummary = useLiveQuery(async () => {
    if (!activeShift?.id) return null;
    return calculateShiftSummary(activeShift.id);
  }, [activeShift?.id]);

  const userNameById = useMemo(() => {
    const map = new Map<number, string>();
    users?.forEach((user) => user.id && map.set(user.id, user.name));
    return map;
  }, [users]);

  if (!can('manage_shifts')) {
    return <LockedPage title="Shift Kasir" permissionLabel="Kelola Shift Kasir" />;
  }

  const handleOpenShift = async () => {
    const value = Number(openingCash) || 0;
    try {
      await openShift({ openingCash: value, openedBy: currentUser?.id, notes });
      setOpeningCash('');
      setNotes('');
      toast.success('Shift berhasil dibuka');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuka shift');
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift?.id) return;
    const value = Number(closingCash);
    if (Number.isNaN(value) || value < 0) {
      toast.error('Kas akhir tidak valid');
      return;
    }

    try {
      const closed = await closeShift({ shiftId: activeShift.id, closingCash: value, closedBy: currentUser?.id, notes });
      setClosingCash('');
      setNotes('');
      setSelectedReport(closed);
      toast.success('Shift berhasil ditutup');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menutup shift');
    }
  };

  const expectedCash = liveSummary?.expectedCash ?? activeShift?.openingCash ?? 0;
  const closingValue = Number(closingCash) || 0;
  const differencePreview = closingCash ? closingValue - expectedCash : 0;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Clock3 className="h-5 w-5 text-primary" />
          Shift Kasir
        </h1>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/settings"><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Link>
        </Button>
      </div>

      {activeShift ? (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Shift Aktif
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{activeShift.code}</p>
              </div>
              <Badge className="bg-success text-white">Aktif</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Kas Awal" value={money(activeShift.openingCash)} icon={<Wallet className="h-4 w-4" />} />
              <Metric label="Expected Cash" value={money(expectedCash)} icon={<Banknote className="h-4 w-4" />} />
              <Metric label="Penjualan" value={money(liveSummary?.totalSales ?? 0)} icon={<ReceiptText className="h-4 w-4" />} />
              <Metric label="Transaksi" value={`${liveSummary?.totalTransactions ?? 0}`} icon={<CalendarClock className="h-4 w-4" />} />
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              Dibuka {format(activeShift.openedAt, 'dd MMM yyyy HH:mm', { locale: localeId })}
              {activeShift.openedBy ? ` oleh ${userNameById.get(activeShift.openedBy) ?? 'User'}` : ''}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="closingCash">Kas aktual di laci</Label>
                <Input id="closingCash" inputMode="numeric" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} placeholder="Contoh: 250000" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-muted-foreground">Expected</p>
                  <p className="font-bold">{money(expectedCash)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-muted-foreground">Selisih</p>
                  <p className={cn('font-bold', differencePreview < 0 ? 'text-destructive' : differencePreview > 0 ? 'text-success' : '')}>{money(differencePreview)}</p>
                </div>
              </div>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan shift (opsional)" />
              <Button className="w-full rounded-full" onClick={handleCloseShift} disabled={!closingCash}>Tutup Shift</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Buka Shift Baru</CardTitle>
            <p className="text-xs text-muted-foreground">Kasir perlu shift aktif sebelum transaksi bisa dibuat.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="openingCash">Kas awal</Label>
              <Input id="openingCash" inputMode="numeric" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} placeholder="Contoh: 100000" />
            </div>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan pembukaan shift (opsional)" />
            <Button className="w-full rounded-full" onClick={handleOpenShift}>Buka Shift</Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Riwayat Shift</h2>
        {shifts?.length ? shifts.map((shift) => (
          <Card key={shift.id} className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{shift.code}</p>
                  <p className="text-xs text-muted-foreground">{format(shift.openedAt, 'dd MMM yyyy HH:mm', { locale: localeId })}</p>
                </div>
                <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>{shift.status === 'open' ? 'Aktif' : 'Ditutup'}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Mini label="Penjualan" value={money(shift.totalSales)} />
                <Mini label="Transaksi" value={`${shift.totalTransactions}`} />
                <Mini label="Selisih" value={money(shift.cashDifference ?? 0)} className={(shift.cashDifference ?? 0) < 0 ? 'text-destructive' : (shift.cashDifference ?? 0) > 0 ? 'text-success' : ''} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {shift.id && (
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link to={`/history?shiftId=${shift.id}`}>
                      <ReceiptText className="h-4 w-4 mr-2" /> Lihat Transaksi
                    </Link>
                  </Button>
                )}
                {shift.status === 'closed' && (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSelectedReport(shift)}>
                    <Printer className="h-4 w-4 mr-2" /> Cetak Laporan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="border-dashed border-border/70 bg-card/60">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada riwayat shift.</CardContent>
          </Card>
        )}
      </section>

      {selectedReport && (
        <ShiftReportReceipt
          open={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          shift={selectedReport}
          storeSettings={storeSettings}
          openedByName={selectedReport.openedBy ? userNameById.get(selectedReport.openedBy) : undefined}
          closedByName={selectedReport.closedBy ? userNameById.get(selectedReport.closedBy) : undefined}
        />
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}

function Mini({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('font-bold', className)}>{value}</p>
    </div>
  );
}
