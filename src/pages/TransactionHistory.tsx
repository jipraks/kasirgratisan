import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Search, Receipt as ReceiptIcon, Calendar, ChevronRight, ShoppingBag, CalendarIcon, X, Trash2, ShoppingCart, UserCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ReceiptDialog from '@/components/Receipt';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can, multiUserEnabled } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreStock, setRestoreStock] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'open'>('all');
  const [filterCashier, setFilterCashier] = useState<string>('all');

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );

  // Query all transaction items and build lookup map
  const txItemsMap = useLiveQuery(async () => {
    const items = await db.transactionItems.toArray();
    const map: Record<number, TransactionItemRecord[]> = {};
    for (const item of items) {
      if (!map[item.transactionId]) map[item.transactionId] = [];
      map[item.transactionId].push(item);
    }
    return map;
  });

  const getTxItems = (txId: number | undefined): TransactionItemRecord[] =>
    txId ? (txItemsMap?.[txId] ?? []) : [];
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const users = useLiveQuery(() => db.users.toArray());

  const userById = (uid?: number) => (uid ? users?.find((u) => u.id === uid) : undefined);
  const cashierName = (uid?: number) => userById(uid)?.name ?? '—';

  // Auto-open detail if txId is in URL
  const txIdParam = searchParams.get('txId');
  useEffect(() => {
    if (txIdParam && transactions) {
      const tx = transactions.find(t => t.id === Number(txIdParam) || t.receiptNumber === txIdParam);
      if (tx) {
        setSelectedTx(tx);
        setDetailOpen(true);
      }
    }
  }, [txIdParam, transactions]);

  const getPaymentName = (pmId: number) =>
    paymentMethods?.find(pm => pm.id === pmId)?.name || 'Tunai';

  const filtered = transactions?.filter(tx => {
    // Status filter
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
    // Cashier filter
    if (filterCashier !== 'all') {
      if (filterCashier === 'unknown') {
        if (tx.createdBy !== undefined && tx.createdBy !== null) return false;
      } else if (String(tx.createdBy) !== filterCashier) {
        return false;
      }
    }
    // Date filter
    if (dateFrom) {
      const txDate = new Date(tx.date);
      if (txDate < startOfDay(dateFrom)) return false;
    }
    if (dateTo) {
      const txDate = new Date(tx.date);
      if (txDate > endOfDay(dateTo)) return false;
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const items = getTxItems(tx.id);
      return (
        tx.receiptNumber.toLowerCase().includes(q) ||
        items.some(it => it.productName.toLowerCase().includes(q))
      );
    }
    return true;
  }) ?? [];

  // Group by date
  const grouped = filtered.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = format(new Date(tx.date), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const filteredTotal = filtered.filter(t => t.status !== 'open').reduce((s, t) => s + t.total, 0);
  const hasDateFilter = dateFrom || dateTo;

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const openReceipt = () => {
    setDetailOpen(false);
    setTimeout(() => setReceiptOpen(true), 200);
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTx?.id) return;
    try {
      if (restoreStock) {
        const items = getTxItems(selectedTx.id);
        for (const item of items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, { stock: product.stock + item.quantity });
          }
        }
      }
      await db.transactionItems.where('transactionId').equals(selectedTx.id).delete();
      await db.transactions.delete(selectedTx.id);
      setDeleteDialogOpen(false);
      setDetailOpen(false);
      setSelectedTx(null);
      toast.success('Transaksi berhasil dihapus');
    } catch {
      toast.error('Gagal menghapus transaksi');
    }
  };

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <ReceiptIcon className="h-5 w-5 text-primary" />
          Riwayat Transaksi
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari no. struk atau nama produk..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-11 rounded-2xl border-border/70 bg-card/80 pl-9 shadow-soft"
        />
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 flex-1 gap-1.5 rounded-full bg-card/80 text-xs shadow-soft", dateFrom && "border-primary text-primary")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: localeId }) : 'Dari tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">—</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-10 flex-1 gap-1.5 rounded-full bg-card/80 text-xs shadow-soft", dateTo && "border-primary text-primary")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: localeId }) : 'Sampai tanggal'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hasDateFilter && (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={clearDateFilter}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-muted/50 p-1">
        {([
          { value: 'all', label: 'Semua' },
          { value: 'open', label: 'Open Bill' },
          { value: 'completed', label: 'Lunas' },
        ] as const).map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              filterStatus === tab.value ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:bg-background/70'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cashier filter (only when multi-user is on) */}
      {multiUserEnabled && users && users.length > 0 && (
        <div>
          <Select value={filterCashier} onValueChange={setFilterCashier}>
            <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-card/80 text-xs shadow-soft">
              <div className="flex items-center gap-1.5">
                <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Filter Kasir" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kasir</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} (@{u.username})
                </SelectItem>
              ))}
              <SelectItem value="unknown">Tanpa Kasir (data lama)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground">Total Transaksi</p>
              <p className="text-lg font-extrabold text-primary">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground">Total Penjualan</p>
              <p className="text-lg font-extrabold text-primary">{rp(filteredTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {dateKeys.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 py-16 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasDateFilter ? 'Tidak ada transaksi di rentang tanggal ini' : 'Belum ada transaksi'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateKeys.map(dateKey => (
            <div key={dateKey}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                </p>
                <Badge variant="secondary" className="h-5 rounded-full text-[10px]">
                  {grouped[dateKey].length} transaksi
                </Badge>
              </div>
              <div className="space-y-2">
                {grouped[dateKey].map(tx => (
                  <Card
                    key={tx.id ?? tx.receiptNumber}
                    className="cursor-pointer border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99]"
                    onClick={() => openDetail(tx)}
                  >
                    <CardContent className="flex items-center gap-3 p-3.5">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', tx.status === 'open' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary')}>
                        {tx.status === 'open' ? <ShoppingCart className="h-4 w-4" /> : <ReceiptIcon className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-mono text-xs text-muted-foreground">{tx.receiptNumber}</p>
                            {tx.status === 'open' ? (
                              <Badge variant="secondary" className="h-4 border-warning/30 bg-warning/20 px-1.5 text-[9px] text-warning">Open</Badge>
                            ) : (
                              <Badge variant="secondary" className="h-4 border-success/30 bg-success/20 px-1.5 text-[9px] text-success">Lunas</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.date), 'HH:mm')}</p>
                        </div>
                        <p className="text-sm font-extrabold text-primary">{rp(tx.total)}</p>
                        <div className="flex items-center gap-2 truncate text-[10px] text-muted-foreground">
                          {multiUserEnabled && (
                            <span className="flex items-center gap-0.5">
                              <UserCircle2 className="h-3 w-3" />
                              {cashierName(tx.createdBy)}
                            </span>
                          )}
                          {tx.customerName && <span>👤 {tx.customerName}</span>}
                          {tx.tableNumber && <span>Meja {tx.tableNumber}</span>}
                          {tx.remarks && <span>📝 {tx.remarks}</span>}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {getTxItems(tx.id).map(it => it.productName).join(', ')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="mx-auto flex h-[80vh] max-w-lg flex-col rounded-t-3xl border-border/70 bg-card md:max-w-xl">
          <SheetHeader className="shrink-0 border-b border-border/70 pb-3">
            <SheetTitle className="text-left text-lg font-extrabold">Detail Transaksi</SheetTitle>
          </SheetHeader>
          {selectedTx && (
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-6">
              <div className="space-y-1.5 rounded-2xl bg-muted/50 p-3.5">
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn('font-semibold', selectedTx.status === 'open' ? 'text-warning' : 'text-success')}>
                    {selectedTx.status === 'open' ? 'Open Bill' : 'Lunas'}
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">No. Struk</span>
                  <span className="font-mono font-medium">{selectedTx.receiptNumber}</span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{format(new Date(selectedTx.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}</span>
                </div>
                 <div className="flex justify-between gap-4 text-xs">
                   <span className="text-muted-foreground">Pembayaran</span>
                   <span>{selectedTx.status === 'open' ? '-' : getPaymentName(selectedTx.paymentMethodId)}</span>
                 </div>
                 {multiUserEnabled && (
                   <div className="flex justify-between gap-4 text-xs">
                     <span className="text-muted-foreground">Kasir</span>
                     <span className="flex items-center gap-1">
                       <UserCircle2 className="h-3 w-3" />
                       {cashierName(selectedTx.createdBy)}
                     </span>
                   </div>
                 )}
                 {selectedTx.customerName && (
                   <div className="flex justify-between gap-4 text-xs">
                     <span className="text-muted-foreground">Pelanggan</span>
                     <span>👤 {selectedTx.customerName}</span>
                   </div>
                 )}
                 {selectedTx.tableNumber && (
                   <div className="flex justify-between gap-4 text-xs">
                     <span className="text-muted-foreground">Meja</span>
                     <span>{selectedTx.tableNumber}</span>
                   </div>
                 )}
                  {selectedTx.remarks && (
                    <div className="flex justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">Catatan</span>
                      <span className="max-w-[60%] text-right">{selectedTx.remarks}</span>
                    </div>
                  )}
                </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Item</p>
                {getTxItems(selectedTx.id).map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-2xl bg-muted/40 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} × {rp(item.price)}
                        {item.discountAmount > 0 && ` (diskon ${rp(item.discountAmount)})`}
                      </p>
                      {item.notes && (
                        <p className="mt-0.5 text-[10px] text-accent">📝 {item.notes}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{rp(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{rp(selectedTx.subtotal)}</span>
                </div>
                {selectedTx.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Diskon</span>
                    <span>-{rp(selectedTx.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">{rp(selectedTx.total)}</span>
                </div>
                {selectedTx.status !== 'open' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bayar</span>
                      <span>{rp(selectedTx.paymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Kembali</span>
                      <span className="font-medium text-success">{rp(selectedTx.change)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit</span>
                      <span className="font-medium text-success">{rp(selectedTx.profit)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs italic text-warning">Bill belum dibayar</p>
                )}
              </div>

              {selectedTx.status === 'open' ? (
                <Button className="h-11 w-full rounded-full" onClick={() => { setDetailOpen(false); navigate('/cashier'); }}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Lanjutkan di Kasir
                </Button>
              ) : (
                <Button className="h-11 w-full rounded-full" onClick={openReceipt}>
                  <ReceiptIcon className="mr-2 h-4 w-4" />
                  Lihat & Cetak Struk
                </Button>
              )}

              <Button
                variant="outline"
                className="h-11 w-full rounded-full border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={() => { setRestoreStock(true); setDeleteDialogOpen(true); }}
                disabled={!can('delete_transaction')}
                title={!can('delete_transaction') ? 'Anda tidak punya akses untuk menghapus transaksi' : undefined}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus Transaksi
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Receipt reprint */}
      {selectedTx && (
        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={selectedTx}
          items={getTxItems(selectedTx.id)}
          storeSettings={storeSettings}
          paymentMethodName={getPaymentName(selectedTx.paymentMethodId)}
          cashierName={selectedTx.createdBy ? cashierName(selectedTx.createdBy) : undefined}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Transaksi <span className="font-mono font-semibold">{selectedTx?.receiptNumber}</span> senilai <span className="font-semibold">Rp {selectedTx?.total.toLocaleString('id-ID')}</span> akan dihapus permanen.</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="restore-stock"
                    checked={restoreStock}
                    onCheckedChange={(checked) => setRestoreStock(checked === true)}
                  />
                  <label htmlFor="restore-stock" className="text-sm cursor-pointer">
                    Kembalikan stok produk
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
