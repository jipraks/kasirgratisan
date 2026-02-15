import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
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

const REASONS = ['Rusak', 'Hilang', 'Kadaluarsa', 'Retur ke Supplier', 'Pemakaian Sendiri', 'Lainnya'];

export default function StockOutPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const stockOuts = useLiveQuery(() => db.stockOuts.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.toArray());

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
    });

    await db.products.update(product.id!, {
      stock: product.stock - qty,
      updatedAt: new Date(),
    });

    toast.success(`Stok ${product.name} berkurang ${qty}`);
    setDialogOpen(false);
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/pengaturan">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-destructive" />
            Stock Out
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{stockOuts?.length ?? 0} catatan</p>

      {(!stockOuts || stockOuts.length === 0) ? (
        <div className="text-center py-12">
          <ArrowUpFromLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada data stock out</p>
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
                      <span className="text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded">-{so.quantity}</span>
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
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Tambah Stock Out</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products?.filter(p => p.stock > 0).map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.name} (stok: {p.stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jumlah *</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1" className="h-11" max={selectedProduct?.stock} />
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
                <span className="font-bold">{selectedProduct.stock - Number(quantity)} {selectedProduct.unit}</span>
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
