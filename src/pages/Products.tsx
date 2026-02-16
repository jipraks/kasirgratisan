import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type Category } from '@/lib/db';
import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Produk() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [barcode, setBarcode] = useState('');

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  const filtered = products?.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    return matchSearch && matchCategory;
  }) ?? [];

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name ?? '-';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color ?? '#999';

  const openAdd = () => {
    setEditProduct(null);
    setName(''); setSku(''); setCategoryId(categories?.[0]?.id?.toString() ?? ''); setPrice(''); setHpp(''); setStock(''); setUnit('pcs'); setBarcode('');
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setName(p.name); setSku(p.sku); setCategoryId(p.categoryId.toString()); setPrice(p.price.toString()); setHpp(p.hpp.toString()); setStock(p.stock.toString()); setUnit(p.unit); setBarcode(p.barcode ?? '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    const data = {
      name: name.trim(),
      sku: sku.trim(),
      categoryId: Number(categoryId),
      price: Number(price) || 0,
      hpp: Number(hpp) || 0,
      stock: Number(stock) || 0,
      unit: unit.trim() || 'pcs',
      barcode: barcode.trim() || undefined,
      updatedAt: new Date(),
    };

    if (editProduct?.id) {
      await db.products.update(editProduct.id, data);
    } else {
      await db.products.add({ ...data, createdAt: new Date(), isDeleted: false, deletedAt: null } as Product);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.products.update(deleteId, { isDeleted: true, deletedAt: new Date() });
      setDeleteId(null);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PackageIcon className="w-5 h-5 text-primary" />
          Produk
        </h1>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" />
          Tambah
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[120px] h-10">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            {categories?.map(c => (
              <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product count */}
      <p className="text-xs text-muted-foreground">{filtered.length} produk ditemukan</p>

      {/* Product List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <PackageIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada produk</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> Tambah Produk
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: getCategoryColor(p.categoryId), color: getCategoryColor(p.categoryId) }}>
                        {getCategoryName(p.categoryId)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku || '-'}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold text-primary">Rp {p.price.toLocaleString('id-ID')}</span>
                      <span className="text-xs text-muted-foreground">HPP: Rp {p.hpp.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', p.stock <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                        Stok: {p.stock} {p.unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id!)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Produk *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Nasi Goreng" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="NG001" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori *</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Harga Jual *</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15000" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>HPP</Label>
                <Input type="number" value={hpp} onChange={e => setHpp(e.target.value)} placeholder="10000" className="h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stok Awal</Label>
                <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'].map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Opsional" className="h-11" />
            </div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={!name.trim() || !categoryId}>
              {editProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>Produk yang dihapus tidak bisa dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
