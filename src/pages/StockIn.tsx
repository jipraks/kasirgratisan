import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged } from '@/lib/db';
import { useState } from 'react';
import { ArrowDownToLine, Plus, Search, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import ProductPicker from '@/components/ProductPicker';
import SearchableSelect from '@/components/SearchableSelect';
import NumberInput from '@/components/NumberInput';

export default function StockInPage() {
  const { currentUser, can } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');

  const stockIns = useLiveQuery(() => db.stockIns.orderBy('date').reverse().toArray());
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const suppliers = useLiveQuery(() => db.suppliers.where('isDeleted').equals(0).toArray());

  if (!can('manage_stock_inout')) {
    return <LockedPage title="Stock In" permissionLabel="Stock In / Stock Out" />;
  }

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
      createdBy: currentUser?.id,
    });

    // Calculate new weighted average HPP
    const oldStock = product.stock;
    const oldHpp = product.hpp;
    // Bulatkan ke 6 desimal untuk menghilangkan artefak floating-point.
    const newStock = Math.round((oldStock + qty) * 1e6) / 1e6;
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
    <div className="space-y-5 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ArrowDownToLine className="h-5 w-5 text-success" />
            Stock In
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-glow">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <SearchableSelect
        value={filterSupplier}
        onChange={setFilterSupplier}
        placeholder="Filter Supplier"
        searchPlaceholder="Cari supplier..."
        options={[
          { value: 'all', label: 'Semua Supplier' },
          ...(suppliers?.map(s => ({ value: s.id!.toString(), label: s.name })) ?? []),
        ]}
      />

      <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm font-semibold shadow-soft backdrop-blur-sm">
        {filtered.length} catatan stok masuk
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 px-6 py-12 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <ArrowDownToLine className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Belum ada data stock in</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(si => (
            <Card key={si.id} className="rounded-3xl border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{getProductName(si.productId)}</h3>
                    <p className="text-xs text-muted-foreground">dari {getSupplierName(si.supplierId)}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">+{si.quantity}</span>
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Tambah Stock In</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Produk *</Label>
              <ProductPicker
                products={products ?? []}
                value={productId}
                onChange={setProductId}
                filter={p => isStockManaged(p)}
                showHpp
              />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <SearchableSelect
                value={supplierId}
                onChange={setSupplierId}
                placeholder="Pilih supplier"
                searchPlaceholder="Cari supplier..."
                options={suppliers?.map(s => ({ value: s.id!.toString(), label: s.name })) ?? []}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jumlah *</Label>
                <NumberInput value={quantity} onChange={setQuantity} placeholder="10" className="h-11" decimal />
              </div>
              <div className="space-y-1.5">
                <Label>Harga Beli/Unit *</Label>
                <NumberInput value={buyPrice} onChange={setBuyPrice} placeholder="5000" className="h-11" decimal />
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
