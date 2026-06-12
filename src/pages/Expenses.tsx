import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense, type ExpenseCategory } from '@/lib/db';
import { useState, useMemo } from 'react';
import { Wallet, Plus, ChevronLeft, Edit2, Trash2, Calendar, Receipt, FilterX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format, startOfDay, startOfMonth, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

type RangePreset = 'today' | '7' | '30' | 'month' | 'all';

const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Hari ini',
  '7': '7 hari',
  '30': '30 hari',
  month: 'Bulan ini',
  all: 'Semua',
};

function rangeStart(range: RangePreset): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return startOfDay(now);
    case '7':
      return startOfDay(subDays(now, 6));
    case '30':
      return startOfDay(subDays(now, 29));
    case 'month':
      return startOfMonth(now);
    case 'all':
      return null;
  }
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function ExpensesPage() {
  const { currentUser, can } = useAuth();

  const [range, setRange] = useState<RangePreset>('30');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('all');

  // Add/edit form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const expenses = useLiveQuery(async () => {
    const start = rangeStart(range);
    const all = start
      ? await db.expenses.where('date').aboveOrEqual(start).toArray()
      : await db.expenses.toArray();
    return all.filter((e) => e.isDeleted === 0).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [range]);

  const categories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  const canManage = can('manage_expenses');
  const canView = can('view_expenses') || canManage;

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (filterCategoryId === 'all') return expenses;
    return expenses.filter((e) => e.categoryId === Number(filterCategoryId));
  }, [expenses, filterCategoryId]);

  const totalAmount = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered],
  );

  const getCategory = (id: number): ExpenseCategory | undefined =>
    categories?.find((c) => c.id === id);
  const getPaymentName = (id: number): string =>
    paymentMethods?.find((p) => p.id === id)?.name ?? '-';

  // === Form helpers ===

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setCategoryId(categories && categories.length > 0 ? String(categories[0].id) : '');
    setAmount('');
    setPaymentMethodId(
      paymentMethods && paymentMethods.length > 0 ? String(paymentMethods[0].id) : '',
    );
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setTitle(exp.title);
    setCategoryId(String(exp.categoryId));
    setAmount(String(exp.amount));
    setPaymentMethodId(String(exp.paymentMethodId));
    setDate(format(new Date(exp.date), 'yyyy-MM-dd'));
    setNotes(exp.notes ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const numericAmount = Number(amount);
    if (!trimmedTitle) {
      toast.error('Judul pengeluaran wajib diisi');
      return;
    }
    if (!categoryId) {
      toast.error('Pilih kategori');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }
    if (!paymentMethodId) {
      toast.error('Pilih metode pembayaran');
      return;
    }
    if (!date) {
      toast.error('Pilih tanggal');
      return;
    }

    // Build a Date at midnight local; users only pick date, not time.
    const expenseDate = new Date(`${date}T00:00:00`);

    try {
      if (editing?.id) {
        await db.expenses.update(editing.id, {
          title: trimmedTitle,
          categoryId: Number(categoryId),
          amount: numericAmount,
          paymentMethodId: Number(paymentMethodId),
          date: expenseDate,
          notes: notes.trim() || undefined,
        });
        toast.success('Pengeluaran diperbarui');
      } else {
        await db.expenses.add({
          title: trimmedTitle,
          categoryId: Number(categoryId),
          amount: numericAmount,
          paymentMethodId: Number(paymentMethodId),
          date: expenseDate,
          notes: notes.trim() || undefined,
          createdAt: new Date(),
          createdBy: currentUser?.id,
          isDeleted: 0,
          deletedAt: null,
        });
        toast.success('Pengeluaran dicatat');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Gagal menyimpan pengeluaran');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    await db.expenses.update(deleteTarget.id, {
      isDeleted: 1,
      deletedAt: new Date(),
    });
    toast.success('Pengeluaran dihapus');
    setDeleteTarget(null);
  };

  // === Permission gates ===

  if (!canView) {
    return <LockedPage title="Pengeluaran" permissionLabel="Lihat Pengeluaran" />;
  }

  // === Render ===

  const noCategories = !categories || categories.length === 0;
  const noPaymentMethods = !paymentMethods || paymentMethods.length === 0;

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Wallet className="h-5 w-5 text-warning" />
            Pengeluaran
          </h1>
        </div>
        {canManage && (
          <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft">
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        )}
      </div>

      {/* Range filter */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              range === r
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-muted bg-background text-muted-foreground'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Total summary */}
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm bg-warning/5">
        <CardContent className="p-4 flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Total Pengeluaran ({RANGE_LABELS[range]})
            </p>
            <p className="text-lg font-bold">{rp(totalAmount)}</p>
            <p className="text-[10px] text-muted-foreground">{filtered.length} catatan</p>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
          <SelectTrigger className="h-10 flex-1">
            <SelectValue placeholder="Filter kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kategori</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterCategoryId !== 'all' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => setFilterCategoryId('all')}
            title="Hapus filter"
          >
            <FilterX className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 py-12 text-center">
          <Wallet className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {expenses && expenses.length === 0
              ? 'Belum ada pengeluaran tercatat'
              : 'Tidak ada pengeluaran sesuai filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((exp) => {
            const cat = getCategory(exp.categoryId);
            return (
              <Card key={exp.id} className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3.5">
                    <div
                      className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 text-base"
                      style={{ backgroundColor: (cat?.color ?? '#6B7280') + '20' }}
                    >
                      {cat?.icon ?? '📦'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{exp.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {cat?.name ?? '—'} · {getPaymentName(exp.paymentMethodId)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-warning shrink-0">
                          -{rp(exp.amount)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(exp.date), 'dd MMM yyyy', { locale: idLocale })}</span>
                      </div>
                      {exp.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic line-clamp-2">
                          {exp.notes}
                        </p>
                      )}
                      {canManage && (
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => openEdit(exp)}
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive gap-1"
                            onClick={() => setDeleteTarget(exp)}
                          >
                            <Trash2 className="h-3 w-3" /> Hapus
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</DialogTitle>
          </DialogHeader>

          {(noCategories || noPaymentMethods) && (
            <div className="rounded-2xl bg-warning/10 border border-warning/30 p-3.5 text-xs text-foreground">
              {noCategories && (
                <p>
                  Belum ada kategori pengeluaran. Tambahkan dulu di Pengaturan.
                </p>
              )}
              {noPaymentMethods && (
                <p>Belum ada metode pembayaran. Tambahkan dulu di Pengaturan.</p>
              )}
            </div>
          )}

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Judul *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Bayar listrik bulan ini"
                className="h-11"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kategori *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label>Nominal *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal *</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Metode Pembayaran *</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((pm) => (
                    <SelectItem key={pm.id} value={String(pm.id)}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opsional"
                rows={3}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleSave}
              disabled={noCategories || noPaymentMethods}
            >
              {editing ? 'Simpan Perubahan' : 'Catat Pengeluaran'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengeluaran?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" sebesar {deleteTarget && rp(deleteTarget.amount)} akan dihapus.
              Catatan ini tidak akan masuk ke laporan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
