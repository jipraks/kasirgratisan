import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer } from '@/lib/db';
import { useState } from 'react';
import { Users as UsersIcon, Plus, Edit2, Trash2, Phone, MapPin, Mail, Search, Eye, Receipt as ReceiptIcon, ShoppingBag, HandCoins, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { useTranslation } from 'react-i18next';

const LOCALES: Record<string, Locale> = { id, en: enUS, ms };
const CURRENCY_SYMBOL: Record<string, string> = { id: 'Rp', en: 'Rp', ms: 'Rp' };
const NUMBER_LOCALES: Record<string, string> = { id: 'id-ID', en: 'en-US', ms: 'ms-MY' };

export default function CustomersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('settings');
  const dateLocale = LOCALES[i18n.language] ?? id;
  const numberLocale = NUMBER_LOCALES[i18n.language] ?? 'id-ID';
  const currencySymbol = CURRENCY_SYMBOL[i18n.language] ?? 'Rp';

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const customers = useLiveQuery(() => db.customers.where('isDeleted').equals(0).toArray());
  const debts = useLiveQuery(() => db.debts.toArray());

  // Transaksi pelanggan yang sedang dilihat, terbaru dulu.
  // customerId tidak di-index, jadi pakai filter (dataset transaksi UMKM kecil).
  const customerTx = useLiveQuery(
    async () => {
      if (!viewCustomer?.id) return [];
      const all = await db.transactions
        .filter((t) => t.customerId === viewCustomer.id)
        .toArray();
      return all.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    },
    [viewCustomer?.id],
  );

  if (!can('manage_customers')) {
    return <LockedPage title={t('customers.locked.title')} permissionLabel={t('customers.locked.permissionLabel')} />;
  }

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const openAdd = () => {
    setEditCustomer(null);
    setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setName(c.name); setPhone(c.phone); setEmail(c.email); setAddress(c.address); setNotes(c.notes);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };
    if (editCustomer?.id) {
      await db.customers.update(editCustomer.id, data);
      toast.success(t('customers.toast.updated'));
    } else {
      await db.customers.add({ ...data, createdAt: new Date(), isDeleted: 0, deletedAt: null });
      toast.success(t('customers.toast.added'));
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.customers.update(deleteId, { isDeleted: 1, deletedAt: new Date() });
      setDeleteId(null);
      toast.success(t('customers.toast.deleted'));
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            {t('customers.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> {t('customers.add')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('customers.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      <p className="text-xs text-muted-foreground">{t('customers.count', { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('customers.empty.title')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> {t('customers.empty.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {c.email}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {c.address}
                      </p>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewCustomer(c)}><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id!)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{editCustomer ? t('customers.dialog.editTitle') : t('customers.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>{t('customers.dialog.nameLabel')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('customers.dialog.namePlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('customers.dialog.phoneLabel')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('customers.dialog.phonePlaceholder')} className="h-11" type="tel" /></div>
            <div className="space-y-1.5"><Label>{t('customers.dialog.emailLabel')}</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('customers.dialog.emailPlaceholder')} className="h-11" type="email" /></div>
            <div className="space-y-1.5"><Label>{t('customers.dialog.addressLabel')}</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('customers.dialog.addressPlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('customers.dialog.notesLabel')}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('customers.dialog.notesPlaceholder')} rows={2} /></div>
            <Button className="w-full h-11" onClick={handleSave} disabled={!name.trim()}>{t('customers.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customers.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('customers.deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('customers.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('customers.deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View customer + transaction history */}
      <Dialog open={!!viewCustomer} onOpenChange={(open) => { if (!open) setViewCustomer(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-primary" />
              {viewCustomer?.name}
            </DialogTitle>
          </DialogHeader>

          {viewCustomer && (
            <div className="space-y-4 mt-1">
              {/* Contact info */}
              <div className="space-y-1.5">
                {viewCustomer.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {viewCustomer.phone}</p>
                )}
                {viewCustomer.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {viewCustomer.email}</p>
                )}
                {viewCustomer.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {viewCustomer.address}</p>
                )}
                {viewCustomer.notes && (
                  <p className="text-sm text-muted-foreground italic">{viewCustomer.notes}</p>
                )}
              </div>

              {/* Summary */}
              {(() => {
                const txs = customerTx ?? [];
                const completed = txs.filter(t => t.status !== 'open');
                const totalSpent = completed.reduce((s, t) => s + t.total, 0);
                const customerDebts = debts?.filter((debt) => debt.customerId === viewCustomer.id) ?? [];
                const remainingDebt = customerDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-[10px] text-muted-foreground">{t('customers.viewDialog.summary.totalTransactions')}</p>
                      <p className="text-lg font-bold">{completed.length}</p>
                    </div>
                    <div className="rounded-xl bg-primary/5 p-3">
                      <p className="text-[10px] text-muted-foreground">{t('customers.viewDialog.summary.totalSpent')}</p>
                      <p className="text-sm font-bold text-primary">{currencySymbol} {totalSpent.toLocaleString(numberLocale)}</p>
                    </div>
                    <div className="rounded-xl bg-warning/10 p-3">
                      <p className="text-[10px] text-muted-foreground">{t('customers.viewDialog.summary.remainingDebt')}</p>
                      <p className="text-sm font-bold text-warning">{currencySymbol} {remainingDebt.toLocaleString(numberLocale)}</p>
                    </div>
                  </div>
                );
              })()}

              {(debts?.some((debt) => debt.customerId === viewCustomer.id) ?? false) && (
                <Button variant="outline" className="w-full" onClick={() => navigate('/debts')}>
                  <HandCoins className="w-4 h-4 mr-2" />
                  {t('customers.viewDialog.openDebts')}
                </Button>
              )}

              {/* History */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ReceiptIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">{t('customers.viewDialog.historyTitle')}</p>
                </div>

                {customerTx === undefined ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t('customers.viewDialog.loading')}</p>
                ) : customerTx.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">{t('customers.viewDialog.empty')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTx.map(tx => (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => navigate(`/history?txId=${tx.id}`)}
                        className="w-full text-left rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="secondary" className="text-[10px] shrink-0">{tx.receiptNumber}</Badge>
                            {tx.status === 'open' && (
                              <Badge className="text-[9px] bg-warning/15 text-warning shrink-0">{t('transactionHistory.badges.open')}</Badge>
                            )}
                            {debts?.some((debt) => debt.transactionId === tx.id && debt.status !== 'paid') && (
                              <Badge className="text-[9px] bg-warning/15 text-warning shrink-0">{t('transactionHistory.badges.debt')}</Badge>
                            )}
                          </div>
                          <span className="text-sm font-bold text-primary shrink-0">{currencySymbol} {tx.total.toLocaleString(numberLocale)}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(tx.date), 'dd MMM yyyy, HH:mm', { locale: dateLocale })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
