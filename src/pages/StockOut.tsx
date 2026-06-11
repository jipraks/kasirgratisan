import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged } from '@/lib/db';
import { useState } from 'react';
import { ArrowUpFromLine, Plus, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import ProductPicker from '@/components/ProductPicker';
import NumberInput from '@/components/NumberInput';

const REASONS = ['Rusak', 'Hilang', 'Kadaluarsa', 'Retur ke Supplier', 'Pemakaian Sendiri', 'Lainnya'];

export default function StockOutPage() {
  const { currentUser, can } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const stockOuts = useLiveQuery(() => db.stockOuts.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());

  if (!can('manage_stock_inout')) {
    return <LockedPage title="Stock Out" permissionLabel="Stock In / Stock Out" />;
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
      toast.error('Lengkapi semua field');
      return;
    }

    const product = products?.find(p => p.id === Number(productId));
    if (!product) return;
    if (qty > product.stock) {
      toast.error('Jumlah melebihi stok yang tersedia');
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
      // Bulatkan ke 6 desimal untuk menghilangkan artefak floating-point.
      stock: Math.round((product.stock - qty) * 1e6) / 1e6,
      updatedAt: new Date(),
    });

    toast.success(`Stok ${product.name} berkurang ${qty}`);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-5 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ArrowUpFromLine className="h-5 w-5 text-destructive" />
            Stock Out
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-glow">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm font-semibold shadow-soft backdrop-blur-sm">
        {stockOuts?.length ?? 0} catatan stok keluar
      </div>

      {(!stockOuts || stockOuts.length === 0) ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 px-6 py-12 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ArrowUpFromLine className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Belum ada data stock out</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {stockOuts.map(so => (
            <Card key={so.id} className="rounded-3xl border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{getProductName(so.productId)}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">-{so.quantity}</span>
                      <span className="text-xs text-muted-foreground">{so.reason}</span>
                    </div>
                    {so.notes && <p className="text-xs text-muted-foreground mt-1 italic">{so.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(so.date), 'dd MMM yy', { locale: id })}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Tambah Stock Out</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
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
                <Label>Jumlah *</Label>
                <NumberInput value={quantity} onChange={setQuantity} placeholder="1" className="h-11" decimal />
              </div>
              <div className="space-y-1.5">
                <Label>Alasan *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {selectedProduct && quantity && (
              <div className="bg-muted/50 p-3 rounded-xl text-sm">
                <span className="text-muted-foreground">Stok setelah: </span>
                <span className="font-bold">{Math.round((selectedProduct.stock - Number(quantity)) * 1e6) / 1e6} {selectedProduct.unit}</span>
              </div>
            )}
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" className="h-11" /></div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave}>Simpan Stock Out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
