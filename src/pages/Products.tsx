import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged, type Product, type Category } from '@/lib/db';
import { useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Package as PackageIcon, Camera, X, Copy, Infinity as InfinityIcon, ScanLine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-utils';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function Produk() {
  const { currentUser, can } = useAuth();
  const canManage = can('manage_products');

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  // Field tujuan hasil scan kamera: SKU atau Barcode.
  const [scanTarget, setScanTarget] = useState<'sku' | 'barcode' | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState('');
  const [hpp, setHpp] = useState('');
  const [stock, setStock] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [unit, setUnit] = useState('pcs');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const units = useLiveQuery(() => db.units.where('isDeleted').equals(0).toArray());

  // Compose dropdown options: active master units + current product's unit if it has been deleted/renamed
  const unitOptions = (() => {
    const names = (units ?? []).map(u => u.name);
    if (unit && !names.includes(unit)) names.push(unit);
    return names;
  })();

  const filtered = products?.filter(p => {
    const q = search.toLowerCase();
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false);
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    return matchSearch && matchCategory;
  }) ?? [];

  const getCategoryName = (catId: number) => categories?.find(c => c.id === catId)?.name ?? '-';
  const getCategoryColor = (catId: number) => categories?.find(c => c.id === catId)?.color ?? '#999';

  const openAdd = () => {
    if (!categories || categories.length === 0) {
      toast.error('Buat kategori terlebih dahulu sebelum menambah produk');
      return;
    }
    setEditProduct(null);
    setName(''); setSku(''); setCategoryId(categories[0]?.id?.toString() ?? ''); setPrice(''); setHpp(''); setStock(''); setTrackStock(true); setUnit('pcs'); setBarcode(''); setDescription(''); setPhoto(undefined);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setName(p.name); setSku(p.sku); setCategoryId(p.categoryId.toString()); setPrice(p.price.toString()); setHpp(p.hpp.toString()); setStock(p.stock.toString()); setTrackStock(isStockManaged(p)); setUnit(p.unit); setBarcode(p.barcode ?? ''); setDescription(p.description ?? ''); setPhoto(p.photo);
    setDialogOpen(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch {
      toast.error('Gagal memproses gambar');
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId || !sku.trim()) return;

    // Check SKU uniqueness
    const existing = await db.products
      .where('sku')
      .equals(sku.trim())
      .filter(p => p.isDeleted === 0)
      .first();
    if (existing && existing.id !== editProduct?.id) {
      toast.error(`SKU "${sku.trim()}" sudah digunakan oleh produk "${existing.name}"`);
      return;
    }

    const data = {
      name: name.trim(),
      sku: sku.trim(),
      categoryId: Number(categoryId),
      price: Number(price) || 0,
      hpp: Number(hpp) || 0,
      stock: Number(stock) || 0,
      trackStock,
      unit: unit.trim() || 'pcs',
      description: description.trim() || undefined,
      barcode: barcode.trim() || undefined,
      photo: photo || undefined,
      updatedAt: new Date(),
      updatedBy: currentUser?.id,
    };

    if (editProduct?.id) {
      await db.products.update(editProduct.id, data);
      trackEvent('edit_product');
    } else {
      await db.products.add({
        ...data,
        createdAt: new Date(),
        createdBy: currentUser?.id,
        isDeleted: 0,
        deletedAt: null,
      } as Product);
      trackEvent('create_product');
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.products.update(deleteId, {
        isDeleted: 1,
        deletedAt: new Date(),
        updatedBy: currentUser?.id,
      });
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-5 px-4 pb-24 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <PackageIcon className="h-5 w-5 text-primary" />
            Produk
          </h1>
        </div>
        {canManage && (
          <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-glow">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        )}
      </div>

      {/* Search & Filter */}
      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="flex gap-2 p-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="product-search"
              autoComplete="off"
              placeholder="Cari nama, SKU, atau deskripsi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 border-transparent bg-background/70 pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-10 w-[124px] border-transparent bg-background/70">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {categories?.map(c => (
                <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Product count */}
      <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-soft backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PackageIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold">{filtered.length} produk</p>
            <p className="text-xs text-muted-foreground">Ditemukan sesuai filter</p>
          </div>
        </div>
      </div>

      {/* Product List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/60 px-6 py-12 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PackageIcon className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Belum ada produk</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
              <Plus className="w-4 h-4 mr-1" /> Tambah Produk
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(p => (
            <Card key={p.id} className="overflow-hidden rounded-3xl border-border/70 bg-card/80 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-card">
              <CardContent className="p-3.5">
                <div className="flex items-start gap-3">
                  {/* Product thumbnail */}
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/70 shadow-soft">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} width={56} height={56} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <PackageIcon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: getCategoryColor(p.categoryId), color: getCategoryColor(p.categoryId) }}>
                        {getCategoryName(p.categoryId)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku || '-'}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-line">
                        {p.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold text-primary">Rp {p.price.toLocaleString('id-ID')}</span>
                      <span className="text-xs text-muted-foreground">HPP: Rp {p.hpp.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {isStockManaged(p) ? (
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', p.stock <= 5 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                          Stok: {p.stock} {p.unit}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                          <InfinityIcon className="w-3 h-3" />
                          Stok tidak dikelola
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {canManage ? (
                      <>
                        <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Hapus ${p.name}`} className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(p.id!)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/70 px-5 py-4 text-left">
            <DialogTitle className="text-xl font-extrabold tracking-tight">{editProduct ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle>
            <p className="text-sm text-muted-foreground">Lengkapi informasi produk agar kasir lebih cepat saat transaksi.</p>
          </DialogHeader>
          <div className="space-y-4 p-5">
            {/* Photo picker */}
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <Label>Foto Produk</Label>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-background transition-colors hover:border-primary/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photo ? (
                    <img src={photo} alt="Preview foto produk" width={80} height={80} className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {photo ? 'Ganti Foto' : 'Pilih Foto'}
                  </Button>
                  {photo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive gap-1.5"
                      onClick={() => setPhoto(undefined)}
                    >
                      <X className="w-3.5 h-3.5" />
                      Hapus Foto
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nama Produk *</Label>
              <Input name="product-name" autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Nasi Goreng" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label>SKU *</Label>
              <div className="flex gap-2">
                <Input name="product-sku" autoComplete="off" value={sku} onChange={e => setSku(e.target.value)} placeholder="Wajib diisi, contoh: NG001" className="h-11 flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  title="Scan dengan kamera"
                  onClick={() => setScanTarget('sku')}
                >
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Kategori *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {(categories && categories.length > 0) ? categories.map(c => (
                    <SelectItem key={c.id} value={c.id!.toString()}>{c.icon} {c.name}</SelectItem>
                  )) : (
                    <SelectItem value="__empty" disabled>Belum ada kategori</SelectItem>
                  )}
                </SelectContent>
              </Select>
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
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="space-y-0.5 pr-3">
                <Label className="text-sm">Kelola Stok</Label>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {trackStock
                    ? 'Stok dihitung otomatis & dibatasi saat jualan.'
                    : 'Produk selalu tersedia, stok tidak dihitung (mis. jasa, makanan dadakan).'}
                </p>
              </div>
              <Switch checked={trackStock} onCheckedChange={setTrackStock} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {trackStock && (
                <div className="space-y-1.5">
                  <Label>Stok Awal</Label>
                  <Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className="h-11" />
                </div>
              )}
              <div className={cn('space-y-1.5', !trackStock && 'col-span-2')}>
                <Label>Satuan</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.length === 0 ? (
                      <SelectItem value="pcs">pcs</SelectItem>
                    ) : (
                      unitOptions.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <div className="flex gap-2">
                <Input name="product-barcode" autoComplete="off" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Opsional" className="h-11 flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  title="Salin dari SKU"
                  onClick={() => setBarcode(sku.trim())}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  title="Scan dengan kamera"
                  onClick={() => setScanTarget('barcode')}
                >
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Catatan/info tambahan, mis: isi 5 pcs, level pedas, supplier"
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground text-right">{description.length}/500</p>
            </div>
            <Button className="w-full h-12 text-base font-semibold" onClick={handleSave} disabled={!name.trim() || !categoryId || !sku.trim()}>
              {editProduct ? 'Simpan Perubahan' : 'Tambah Produk'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-xl sm:max-w-sm">
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

      {/* Scanner kamera untuk SKU / Barcode */}
      <BarcodeScanner
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onScan={(value) => {
          const v = value.trim();
          if (scanTarget === 'sku') setSku(v);
          else if (scanTarget === 'barcode') setBarcode(v);
          setScanTarget(null);
        }}
      />
    </div>
  );
}
