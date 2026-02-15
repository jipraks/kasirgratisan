import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '@/lib/db';
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Search, Receipt as ReceiptIcon, Calendar, ChevronRight, ShoppingBag, CalendarIcon, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import ReceiptDialog from '@/components/Receipt';

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

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
      return (
        tx.receiptNumber.toLowerCase().includes(q) ||
        tx.items.some(it => it.productName.toLowerCase().includes(q))
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

  const filteredTotal = filtered.reduce((s, t) => s + t.total, 0);
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

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ReceiptIcon className="w-5 h-5 text-primary" />
          Riwayat Transaksi
        </h1>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari no. struk atau nama produk..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 flex-1", dateFrom && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
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
            <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5 flex-1", dateTo && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
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
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={clearDateFilter}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Transaksi</p>
              <p className="text-lg font-bold text-primary">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">Total Penjualan</p>
              <p className="text-lg font-bold text-primary">{rp(filteredTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {dateKeys.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasDateFilter ? 'Tidak ada transaksi di rentang tanggal ini' : 'Belum ada transaksi'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateKeys.map(dateKey => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                </p>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {grouped[dateKey].length} transaksi
                </Badge>
              </div>
              <div className="space-y-2">
                {grouped[dateKey].map(tx => (
                  <Card
                    key={tx.id ?? tx.receiptNumber}
                    className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                    onClick={() => openDetail(tx)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <ReceiptIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-mono text-muted-foreground truncate">{tx.receiptNumber}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.date), 'HH:mm')}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">{rp(tx.total)}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {tx.items.map(it => it.productName).join(', ')}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Detail Transaksi</SheetTitle>
          </SheetHeader>
          {selectedTx && (
            <div className="mt-4 space-y-4 overflow-y-auto pb-6">
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">No. Struk</span>
                  <span className="font-mono font-medium">{selectedTx.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tanggal</span>
                  <span>{format(new Date(selectedTx.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}</span>
                </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">Pembayaran</span>
                   <span>{getPaymentName(selectedTx.paymentMethodId)}</span>
                 </div>
                 {selectedTx.remarks && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">Catatan</span>
                     <span className="text-right max-w-[60%]">{selectedTx.remarks}</span>
                   </div>
                 )}
               </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Item</p>
                {selectedTx.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start bg-muted/30 p-2.5 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} × {rp(item.price)}
                        {item.discountAmount > 0 && ` (diskon ${rp(item.discountAmount)})`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{rp(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1.5">
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bayar</span>
                  <span>{rp(selectedTx.paymentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kembali</span>
                  <span className="text-success font-medium">{rp(selectedTx.change)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit</span>
                  <span className="text-success font-medium">{rp(selectedTx.profit)}</span>
                </div>
              </div>

              <Button className="w-full h-11" onClick={openReceipt}>
                <ReceiptIcon className="w-4 h-4 mr-2" />
                Lihat & Cetak Struk
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
          storeSettings={storeSettings}
          paymentMethodName={getPaymentName(selectedTx.paymentMethodId)}
        />
      )}
    </div>
  );
}
