import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged } from '@/lib/db';
import { useState, useMemo } from 'react';
import { ArrowUpFromLine, Plus, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as idLocale, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import ProductPicker from '@/components/ProductPicker';
import NumberInput from '@/components/NumberInput';
import { useTranslation } from 'react-i18next';
import { NUMBER_LOCALE } from '@/lib/currency';

const LOCALES: Record<string, Locale> = { id: idLocale, en: enUS, ms };

const REASON_VALUES = ['Rusak', 'Hilang', 'Kadaluarsa', 'Retur ke Supplier', 'Pemakaian Sendiri', 'Lainnya'];
const REASON_KEYS = ['damaged', 'lost', 'expired', 'returnSupplier', 'ownUse', 'other'];

export default function StockOutPage() {
  const { currentUser, can } = useAuth();
  const { t, i18n } = useTranslation('settings');
  const dateLocale = LOCALES[i18n.language] ?? idLocale;
  const numberLocale = NUMBER_LOCALE;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const stockOuts = useLiveQuery(() => db.stockOuts.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());

  const reasonMap = useMemo(() =>
    REASON_VALUES.map((value, i) => ({ value, label: t(`stockOut.reasons.${REASON_KEYS[i]}`) })),
    [t]
  );

  if (!can('manage_stock_inout')) {
    return <LockedPage title={t('stockOut.locked.title')} permissionLabel={t('stockOut.locked.permissionLabel')} />;
  }

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';
  const selectedProduct = products?.find(p => p.id === Number(productId));

  const openAdd = () => {
    setProductId(''); setQuantity(''); setReason(''); setNotes('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!productId || qty <= 0 || !reason) {
      toast.error(t('stockOut.toast.fillAll'));
      return;
    }

    const product = products?.find(p => p.id === Number(productId));
    if (!product) return;
    if (qty > product.stock) {
      toast.error(t('stockOut.toast.exceedsStock'));
      return;
    }

    await db.stockOuts.add({
      productId: Number(productId),
      quantity: qty,
      reason,
      date: new Date(),
      notes: notes.trim(),
      createdBy: currentUser?.id,
    });

    await db.products.update(product.id!, {
      stock: Math.round((product.stock - qty) * 1e6) / 1e6,
      updatedAt: new Date(),
    });

    toast.success(t('stockOut.toast.success', { product: product.name, qty }));
    setDialogOpen(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-destructive" />
            {t('stockOut.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> {t('stockOut.add')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('stockOut.count', { count: stockOuts?.length ?? 0 })}</p>

      {(!stockOuts || stockOuts.length === 0) ? (
        <div className="text-center py-12">
          <ArrowUpFromLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('stockOut.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stockOuts.map(so => (
            <Card key={so.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{getProductName(so.productId)}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded">{t('stockOut.item.quantity', { qty: so.quantity })}</span>
                      <span className="text-xs text-muted-foreground">{reasonMap.find(r => r.value === so.reason)?.label ?? so.reason}</span>
                    </div>
                    {so.notes && <p className="text-xs text-muted-foreground mt-1 italic">{so.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(so.date), 'dd MMM yy', { locale: dateLocale })}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{t('stockOut.dialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('stockOut.dialog.productLabel')}</Label>
              <ProductPicker
                products={products ?? []}
                value={productId}
                onChange={setProductId}
                filter={p => isStockManaged(p) && p.stock > 0}
                showHpp
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('stockOut.dialog.quantityLabel')}</Label>
                <NumberInput value={quantity} onChange={setQuantity} placeholder={t('stockOut.dialog.quantityPlaceholder')} className="h-11" decimal />
              </div>
              <div className="space-y-1.5">
                <Label>{t('stockOut.dialog.reasonLabel')}</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-11"><SelectValue placeholder={t('stockOut.dialog.reasonPlaceholder')} /></SelectTrigger>
                  <SelectContent>{reasonMap.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {selectedProduct && quantity && (
              <div className="bg-muted/50 p-3 rounded-xl text-sm">
                {t('stockOut.dialog.stockAfter', { stock: Math.round((selectedProduct.stock - Number(quantity)) * 1e6) / 1e6, unit: selectedProduct.unit })}
              </div>
            )}
            <div className="space-y-1.5"><Label>{t('stockOut.dialog.notesLabel')}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('stockOut.dialog.notesPlaceholder')} className="h-11" /></div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave}>{t('stockOut.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
