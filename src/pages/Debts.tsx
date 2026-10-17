import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { id, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { ArrowLeft, Banknote, CheckCircle2, ChevronRight, CreditCard, Receipt, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { db, type Debt } from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from 'react-i18next';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';

const LOCALES: Record<string, Locale> = { id, en: enUS, ms };

type DebtFilter = 'active' | 'paid' | 'all';

export default function DebtsPage() {
  const navigate = useNavigate();
  const { can, currentUser } = useAuth();
  const { t, i18n } = useTranslation('settings');
  const dateLocale = LOCALES[i18n.language] ?? id;
  const numberLocale = NUMBER_LOCALE;
  const currencySymbol = CURRENCY_SYMBOL;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DebtFilter>('active');
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const debts = useLiveQuery(() => db.debts.orderBy('createdAt').reverse().toArray());
  const payments = useLiveQuery(() => db.debtPayments.orderBy('date').reverse().toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  const txById = useMemo(
    () => new Map((transactions ?? []).map((tx) => [tx.id, tx])),
    [transactions],
  );
  const paymentsByDebt = useMemo(() => {
    const map = new Map<number, typeof payments>();
    for (const payment of payments ?? []) {
      const list = map.get(payment.debtId) ?? [];
      list.push(payment);
      map.set(payment.debtId, list);
    }
    return map;
  }, [payments]);

  if (!can('manage_customers')) {
    return <LockedPage title={t('debts.locked.title')} permissionLabel={t('debts.locked.permissionLabel')} />;
  }

  const activeDebts = debts?.filter((debt) => debt.status !== 'paid') ?? [];
  const totalReceivable = activeDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const filteredDebts = (debts ?? []).filter((debt) => {
    if (filter === 'active' && debt.status === 'paid') return false;
    if (filter === 'paid' && debt.status !== 'paid') return false;
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const tx = txById.get(debt.transactionId);
    return debt.customerName.toLowerCase().includes(query) ||
      (tx?.receiptNumber?.toLowerCase() ?? '').includes(query);
  });

  const rp = (value: number) => `${currencySymbol} ${value.toLocaleString(numberLocale)}`;
  const getPaymentName = (id: number) =>
    paymentMethods?.find((method) => method.id === id)?.name ?? t('debts.deletedMethodFallback');

  const openPayment = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount(String(debt.remainingAmount));
    setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? '');
    setPaymentNotes('');
    setPaymentOpen(true);
  };

  const savePayment = async () => {
    if (!selectedDebt?.id) return;
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0 || amount > selectedDebt.remainingAmount) {
      toast.error(t('debts.toast.invalidAmount'));
      return;
    }
    if (!paymentMethodId) {
      toast.error(t('debts.toast.selectMethod'));
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const remainingAmount = selectedDebt.remainingAmount - amount;
      await db.transaction('rw', db.debts, db.debtPayments, async () => {
        await db.debtPayments.add({
          debtId: selectedDebt.id!,
          amount,
          paymentMethodId: Number(paymentMethodId),
          date: now,
          notes: paymentNotes.trim() || undefined,
          createdBy: currentUser?.id,
        });
        await db.debts.update(selectedDebt.id!, {
          remainingAmount,
          status: remainingAmount === 0 ? 'paid' : 'partial',
          settledAt: remainingAmount === 0 ? now : null,
        });
      });
      setSelectedDebt({ ...selectedDebt, remainingAmount, status: remainingAmount === 0 ? 'paid' : 'partial', settledAt: remainingAmount === 0 ? now : null });
      setPaymentOpen(false);
      toast.success(remainingAmount === 0 ? t('debts.toast.paidOff') : t('debts.toast.recorded'));
    } catch {
      toast.error(t('debts.toast.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          {t('debts.title')}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-warning/10 p-3 rounded-lg">
          <p className="text-[10px] text-muted-foreground">{t('debts.summary.totalReceivable')}</p>
          <p className="text-lg font-bold text-warning">{rp(totalReceivable)}</p>
        </div>
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-[10px] text-muted-foreground">{t('debts.summary.activeDebts')}</p>
          <p className="text-lg font-bold">{activeDebts.length}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('debts.searchPlaceholder')}
          className="pl-9 h-10"
        />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {([
          ['active', t('debts.filters.active')],
          ['paid', t('debts.filters.paid')],
          ['all', t('debts.filters.all')],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`h-9 rounded-md text-xs font-semibold transition-colors ${filter === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredDebts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('debts.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDebts.map((debt) => {
            const tx = txById.get(debt.transactionId);
            const paid = debt.originalAmount - debt.remainingAmount;
            return (
              <Card key={debt.id} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <button type="button" className="w-full text-left" onClick={() => setSelectedDebt(debt)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{debt.customerName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {tx?.receiptNumber ?? '-'} · {format(new Date(debt.createdAt), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div>
                        <p className="text-[9px] text-muted-foreground">{t('debts.labels.originalAmount')}</p>
                        <p className="text-xs font-semibold">{rp(debt.originalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">{t('debts.labels.paid')}</p>
                        <p className="text-xs font-semibold text-success">{rp(paid)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground">{t('debts.labels.remaining')}</p>
                        <p className={`text-xs font-bold ${debt.status === 'paid' ? 'text-success' : 'text-warning'}`}>{rp(debt.remainingAmount)}</p>
                      </div>
                    </div>
                  </button>
                  {debt.status !== 'paid' && (
                    <Button className="w-full h-9 mt-3" onClick={() => openPayment(debt)}>
                      <Banknote className="w-4 h-4 mr-2" />
                      {t('debts.recordPayment')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!selectedDebt && !paymentOpen} onOpenChange={(open) => { if (!open) setSelectedDebt(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl overflow-y-auto">
          {selectedDebt && (() => {
            const tx = txById.get(selectedDebt.transactionId);
            const debtPayments = paymentsByDebt.get(selectedDebt.id!) ?? [];
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{t('debts.detail.title')}</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold"><UserRound className="w-4 h-4" />{selectedDebt.customerName}</span>
                      <Badge variant={selectedDebt.status === 'paid' ? 'secondary' : 'default'}>
                        {selectedDebt.status === 'paid' ? t('debts.detail.status.paid') : selectedDebt.status === 'partial' ? t('debts.detail.status.partial') : t('debts.detail.status.unpaid')}
                      </Badge>
                    </div>
                    <button type="button" className="flex items-center gap-2 text-xs text-primary" onClick={() => navigate(`/history?txId=${selectedDebt.transactionId}`)}>
                      <Receipt className="w-3.5 h-3.5" />
                      {tx?.receiptNumber ?? t('debts.detail.viewTransaction')}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground">{t('debts.labels.originalAmount')}</p>
                      <p className="text-base font-bold">{rp(selectedDebt.originalAmount)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground">{t('debts.labels.remaining')}</p>
                      <p className="text-base font-bold text-warning">{rp(selectedDebt.remainingAmount)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{t('debts.detail.paymentHistory')}</p>
                    {debtPayments.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">{t('debts.detail.noInstallments')}</p>
                    ) : debtPayments.map((payment) => (
                      <div key={payment.id} className="rounded-lg border p-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold">{getPaymentName(payment.paymentMethodId)}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(payment.date), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}</p>
                          </div>
                          <p className="text-sm font-bold text-success">{rp(payment.amount)}</p>
                        </div>
                        {payment.notes && <p className="text-xs text-muted-foreground mt-2">{payment.notes}</p>}
                      </div>
                    ))}
                  </div>

                  {selectedDebt.status !== 'paid' && (
                    <Button className="w-full h-11" onClick={() => openPayment(selectedDebt)}>
                      <Banknote className="w-4 h-4 mr-2" />
                      {t('debts.recordPayment')}
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('debts.paymentDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-warning/10 p-3 flex justify-between items-center">
              <span className="text-sm">{t('debts.paymentDialog.remainingDebt')}</span>
              <span className="font-bold text-warning">{rp(selectedDebt?.remainingAmount ?? 0)}</span>
            </div>
            <div className="space-y-1.5">
              <Label>{t('debts.paymentDialog.amountLabel')}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                className="h-11 text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('debts.paymentDialog.methodLabel')}</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger className="h-11"><SelectValue placeholder={t('debts.paymentDialog.methodPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((method) => (
                    <SelectItem key={method.id} value={String(method.id)}>{method.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('debts.paymentDialog.notesLabel')}</Label>
              <Textarea
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder={t('debts.paymentDialog.notesPlaceholder')}
                rows={3}
              />
            </div>
            <Button className="w-full h-11" onClick={savePayment} disabled={saving || !paymentMethodId || Number(paymentAmount) <= 0}>
              {saving ? t('debts.paymentDialog.saving') : t('debts.paymentDialog.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
