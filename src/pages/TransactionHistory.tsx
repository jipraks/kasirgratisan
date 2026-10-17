import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as idLocale, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
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
import { useTranslation } from 'react-i18next';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';

const LOCALES: Record<string, Locale> = { id: idLocale, en: enUS, ms };

export default function TransactionHistory() {
  const { t, i18n } = useTranslation('settings');
  const dateLocale = LOCALES[i18n.language] ?? idLocale;
  const numberLocale = NUMBER_LOCALE;

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
  const debts = useLiveQuery(() => db.debts.toArray());

  const userById = (uid?: number) => (uid ? users?.find((u) => u.id === uid) : undefined);
  const cashierName = (uid?: number) => userById(uid)?.name ?? '—';

  const getPaymentName = (pmId: number) =>
    paymentMethods?.find(pm => pm.id === pmId)?.name || t('transactionHistory.cashFallback');

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

  const getDebt = (txId?: number) => txId ? debts?.find((debt) => debt.transactionId === txId) : undefined;

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
      const debt = getDebt(selectedTx.id);
      if (debt?.id) {
        const installmentCount = await db.debtPayments.where('debtId').equals(debt.id).count();
        if (installmentCount > 0) {
          toast.error(t('transactionHistory.toast.hasDebtPayments'));
          setDeleteDialogOpen(false);
          return;
        }
        await db.debts.delete(debt.id);
      }
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
      toast.success(t('transactionHistory.toast.deleteSuccess'));
    } catch {
      toast.error(t('transactionHistory.toast.deleteFailed'));
    }
  };

  const rp = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(numberLocale)}`;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ReceiptIcon className="w-5 h-5 text-primary" />
          {t('transactionHistory.title')}
        </h1>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('transactionHistory.searchPlaceholder')}
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
              {dateFrom ? format(dateFrom, 'dd MMM yyyy', { locale: dateLocale }) : t('transactionHistory.dateFrom')}
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
              {dateTo ? format(dateTo, 'dd MMM yyyy', { locale: dateLocale }) : t('transactionHistory.dateTo')}
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

      {/* Status filter tabs */}
      <div className="flex gap-1.5 mb-4">
        {([
          { value: 'all', label: t('transactionHistory.status.all') },
          { value: 'open', label: t('transactionHistory.status.open') },
          { value: 'completed', label: t('transactionHistory.status.completed') },
        ] as const).map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              filterStatus === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cashier filter (only when multi-user is on) */}
      {multiUserEnabled && users && users.length > 0 && (
        <div className="mb-4">
          <Select value={filterCashier} onValueChange={setFilterCashier}>
            <SelectTrigger className="h-9 text-xs">
              <div className="flex items-center gap-1.5">
                <UserCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder={t('transactionHistory.cashierFilter.placeholder')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('transactionHistory.cashierFilter.all')}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {t('transactionHistory.cashierFilter.cashierLabel', { name: u.name, username: u.username })}
                </SelectItem>
              ))}
              <SelectItem value="unknown">{t('transactionHistory.cashierFilter.unknown')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">{t('transactionHistory.summary.totalTransactions')}</p>
              <p className="text-lg font-bold text-primary">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">{t('transactionHistory.summary.totalSales')}</p>
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
            {hasDateFilter ? t('transactionHistory.empty.withDateFilter') : t('transactionHistory.empty.noDateFilter')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateKeys.map(dateKey => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">
                  {t('transactionHistory.groupHeader_other', { date: format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: dateLocale }), count: grouped[dateKey].length })}
                </p>
              </div>
              <div className="space-y-2">
                {grouped[dateKey].map(tx => (
                  <Card
                    key={tx.id ?? tx.receiptNumber}
                    className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                    onClick={() => openDetail(tx)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tx.status === 'open' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary')}>
                        {tx.status === 'open' ? <ShoppingCart className="w-4 h-4" /> : <ReceiptIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-mono text-muted-foreground truncate">{tx.receiptNumber}</p>
                            {tx.status === 'open' ? (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-warning/20 text-warning border-warning/30">{t('transactionHistory.badges.open')}</Badge>
                            ) : getDebt(tx.id)?.status !== undefined && getDebt(tx.id)?.status !== 'paid' ? (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-warning/20 text-warning border-warning/30">{t('transactionHistory.badges.debt')}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-success/20 text-success border-success/30">{t('transactionHistory.badges.paid')}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.date), 'HH:mm')}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">{rp(tx.total)}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground truncate">
                          {multiUserEnabled && (
                            <span className="flex items-center gap-0.5">
                              <UserCircle2 className="w-3 h-3" />
                              {cashierName(tx.createdBy)}
                            </span>
                          )}
                          {tx.customerName && <span>👤 {tx.customerName}</span>}
                          {tx.tableNumber && <span>{t('transactionHistory.detail.table', { number: tx.tableNumber })}</span>}
                          {tx.remarks && <span>📝 {tx.remarks}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {getTxItems(tx.id).map(it => it.productName).join(', ')}
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
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-left">{t('transactionHistory.detail.title')}</SheetTitle>
          </SheetHeader>
          {selectedTx && (
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 pb-6">
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('transactionHistory.detail.status.label')}</span>
                  <span className={cn('font-semibold', selectedTx.status === 'open' ? 'text-warning' : 'text-success')}>
                    {selectedTx.status === 'open' ? t('transactionHistory.detail.status.open') : t('transactionHistory.detail.status.paid')}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('transactionHistory.detail.receiptNumber')}</span>
                  <span className="font-mono font-medium">{selectedTx.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('transactionHistory.detail.date')}</span>
                  <span>{format(new Date(selectedTx.date), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}</span>
                </div>
                 <div className="flex justify-between text-xs">
                   <span className="text-muted-foreground">{t('transactionHistory.detail.payment')}</span>
                   <span>
                     {selectedTx.status === 'open'
                       ? '-'
                       : getDebt(selectedTx.id)
                         ? `${selectedTx.paymentAmount > 0 ? `${getPaymentName(selectedTx.paymentMethodId)} + ` : ''}${t('transactionHistory.badges.debt')}`
                         : getPaymentName(selectedTx.paymentMethodId)}
                   </span>
                 </div>
                 {multiUserEnabled && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">{t('transactionHistory.detail.cashier')}</span>
                     <span className="flex items-center gap-1">
                       <UserCircle2 className="w-3 h-3" />
                       {cashierName(selectedTx.createdBy)}
                     </span>
                   </div>
                 )}
                 {selectedTx.customerName && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">{t('transactionHistory.detail.customer')}</span>
                     <span>👤 {selectedTx.customerName}</span>
                   </div>
                 )}
                 {selectedTx.tableNumber && (
                   <div className="flex justify-between text-xs">
                     <span className="text-muted-foreground">{t('transactionHistory.detail.table', { number: selectedTx.tableNumber })}</span>
                     <span />
                   </div>
                 )}
                  {selectedTx.remarks && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('transactionHistory.detail.notes')}</span>
                      <span className="text-right max-w-[60%]">{selectedTx.remarks}</span>
                    </div>
                  )}
                </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{t('transactionHistory.detail.items')}</p>
                {getTxItems(selectedTx.id).map((item, i) => (
                  <div key={i} className="flex justify-between items-start bg-muted/30 p-2.5 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('transactionHistory.detail.quantityFormat', { qty: item.quantity, price: rp(item.price) })}
                        {item.discountAmount > 0 && ` (${t('transactionHistory.detail.discount', { amount: rp(item.discountAmount) })})`}
                      </p>
                      {item.notes && (
                        <p className="text-[10px] text-accent mt-0.5">📝 {item.notes}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{rp(item.subtotal)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('transactionHistory.detail.subtotal')}</span>
                  <span>{rp(selectedTx.subtotal)}</span>
                </div>
                {selectedTx.discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>{t('transactionHistory.detail.discountAmount')}</span>
                    <span>-{rp(selectedTx.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <span>{t('transactionHistory.detail.total')}</span>
                  <span className="text-primary">{rp(selectedTx.total)}</span>
                </div>
                {getDebt(selectedTx.id) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('transactionHistory.detail.remainingDebt')}</span>
                    <span className={getDebt(selectedTx.id)?.status === 'paid' ? 'text-success font-medium' : 'text-warning font-medium'}>
                      {rp(getDebt(selectedTx.id)?.remainingAmount ?? 0)}
                    </span>
                  </div>
                )}
                {selectedTx.status !== 'open' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('transactionHistory.detail.paid')}</span>
                      <span>{rp(selectedTx.paymentAmount)}</span>
                    </div>
                    {!getDebt(selectedTx.id) && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('transactionHistory.detail.change')}</span>
                        <span className="text-success font-medium">{rp(selectedTx.change)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('transactionHistory.detail.profit')}</span>
                      <span className="text-success font-medium">{rp(selectedTx.profit)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-warning italic">{t('transactionHistory.detail.unpaidBill')}</p>
                )}
              </div>

              {selectedTx.status === 'open' ? (
                <Button className="w-full h-11" onClick={() => { setDetailOpen(false); navigate('/cashier'); }}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('transactionHistory.detail.continueInCashier')}
                </Button>
              ) : (
                <Button className="w-full h-11" onClick={openReceipt}>
                  <ReceiptIcon className="w-4 h-4 mr-2" />
                  {t('transactionHistory.detail.viewReceipt')}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full h-11 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { setRestoreStock(true); setDeleteDialogOpen(true); }}
                disabled={!can('delete_transaction')}
                title={!can('delete_transaction') ? t('transactionHistory.detail.noDeletePermission') : undefined}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('transactionHistory.detail.delete')}
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
          paymentMethodName={
            getDebt(selectedTx.id)
              ? `${selectedTx.paymentAmount > 0 ? `${getPaymentName(selectedTx.paymentMethodId)} + ` : ''}${t('transactionHistory.badges.debt')}`
              : getPaymentName(selectedTx.paymentMethodId)
          }
          cashierName={selectedTx.createdBy ? cashierName(selectedTx.createdBy) : undefined}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactionHistory.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>{t('transactionHistory.deleteDialog.description', { receiptNumber: selectedTx?.receiptNumber, amount: rp(selectedTx?.total ?? 0) })}</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="restore-stock"
                    checked={restoreStock}
                    onCheckedChange={(checked) => setRestoreStock(checked === true)}
                  />
                  <label htmlFor="restore-stock" className="text-sm cursor-pointer">
                    {t('transactionHistory.deleteDialog.restoreStock')}
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('transactionHistory.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('transactionHistory.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
