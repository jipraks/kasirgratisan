import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useState } from 'react';
import { ArrowDownToLine, Plus, Search, ChevronLeft } from 'lucide-react';
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

export default function StockInPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');

  const stockIns = useLiveQuery(() => db.stockIns.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());

  const filtered = stockIns?.filter(si =>
    filterSupplier === 'all' || si.supplierId === Number(filterSupplier)
  ) ?? [];

  const getProductName = (pid: number) => products?.find(p => p.id === pid)?.name ?? '-';
  const getSupplierName = (sid: number) => suppliers?.find(s => s.id === sid)?.name ?? '-';

  const openAdd = () => {
    setProductId(''); setSupplierId(''); setQuantity(''); setBuyPrice(''); setNotes('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const qty = Number(quantity);
    const price = Number(buyPrice);
    if (!productId || !supplierId || qty <= 0 || price <= 0) {
      toast.error('Lengkapi semua field');
      return;
    }

    const product = products?.find(p => p.id === Number(productId));
    if (!product) return;

    // Save stock in record
    await db.stockIns.add({
      productId: Number(productId),
      supplierId: Number(supplierId),
      quantity: qty,
      buyPrice: price,
      totalPrice: qty * price,
      date: new Date(),
      notes: notes.trim(),
    });

    // Calculate new weighted average HPP
    const oldStock = product.stock;
    const oldHpp = product.hpp;
    const newStock = oldStock + qty;
    const newHpp = newStock > 0 ? ((oldStock * oldHpp) + (qty * price)) / newStock : price;

    // Save HPP history
    await db.hppHistory.add({
      productId: product.id!,
      oldHpp,
      newHpp,
      source: 'stock_in',
      date: new Date(),
    });

    // Update product stock and HPP
    await db.products.update(product.id!, {
      stock: newStock,
      hpp: Math.round(newHpp),
      updatedAt: new Date(),
    });

    toast.success(`Stok ${product.name} bertambah ${qty}. HPP: Rp ${Math.round(newHpp).toLocaleString('id-ID')}`);
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
            <ArrowDownToLine className="w-5 h-5 text-success" />
            Stock In
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> Tambah
        </Button>
      </div>

      <Select value={filterSupplier} onValueChange={setFilterSupplier}>
        <SelectTrigger className="h-10"><SelectValue placeholder="Filter Supplier" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua Supplier</SelectItem>
          {suppliers?.map(s => <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">{filtered.length} catatan</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <ArrowDownToLine className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada data stock in</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(si => (
            <Card key={si.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{getProductName(si.productId)}</h3>
                    <p className="text-xs text-muted-foreground">dari {getSupplierName(si.supplierId)}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded">+{si.quantity}</span>
                      <span className="text-xs text-muted-foreground">@ Rp {si.buyPrice.toLocaleString('id-ID')}</span>
                    </div>
                    {si.notes && <p className="text-xs text-muted-foreground mt-1 italic">{si.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{format(new Date(si.date), 'dd MMM yy', { locale: id })}</p>
                    <p className="text-sm font-bold mt-1">Rp {si.totalPrice.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Tambah Stock In</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products?.map(p => <SelectItem key={p.id} value={p.id!.toString()}>{p.name} (stok: {p.stock})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id!.toString()}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jumlah *</Label>
                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="10" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Harga Beli/Unit *</Label>
                <Input type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="5000" className="h-11" />
              </div>
            </div>
            {quantity && buyPrice && (
              <div className="bg-muted/50 p-3 rounded-xl text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">Rp {(Number(quantity) * Number(buyPrice)).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" className="h-11" /></div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave}>Simpan Stock In</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
