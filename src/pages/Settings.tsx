import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod, type Category } from '@/lib/db';
import { useState, useEffect } from 'react';
import { Settings, Store, CreditCard, Tag, Download, Upload, Plus, Trash2, Edit2, Info, Truck, ArrowDownToLine, ArrowUpFromLine, ChevronRight, Receipt, Palette, HardDrive } from 'lucide-react';
import ThemeColorPicker from '@/components/ThemeColorPicker';
import { setThemeColor } from '@/hooks/use-theme-color';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { exportBackupData } from '@/components/BackupReminder';

export default function Pengaturan() {
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  // Store edit
  const [storeDialog, setStoreDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddr, setStoreAddr] = useState('');
  const [storePhone, setStorePhone] = useState('');

  // Payment method
  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);

  // Category
  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);

  // Storage info (CR-9)
  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageUsage({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      });
    }
  }, []);

  const openStoreEdit = () => {
    setStoreName(storeSettings?.storeName ?? '');
    setStoreAddr(storeSettings?.address ?? '');
    setStorePhone(storeSettings?.phone ?? '');
    setStoreDialog(true);
  };

  const saveStore = async () => {
    if (storeSettings?.id) {
      await db.storeSettings.update(storeSettings.id, { storeName: storeName.trim(), address: storeAddr.trim(), phone: storePhone.trim() });
      toast.success('Info toko disimpan');
      setStoreDialog(false);
    }
  };

  const openPmAdd = () => { setPmEditId(null); setPmName(''); setPmCategory('tunai'); setPmDialog(true); };
  const openPmEdit = (pm: PaymentMethod) => { setPmEditId(pm.id!); setPmName(pm.name); setPmCategory(pm.category); setPmDialog(true); };
  const savePm = async () => {
    if (!pmName.trim()) return;
    if (pmEditId) await db.paymentMethods.update(pmEditId, { name: pmName.trim(), category: pmCategory });
    else await db.paymentMethods.add({ name: pmName.trim(), category: pmCategory, isDefault: false, createdAt: new Date() });
    setPmDialog(false);
    toast.success('Metode pembayaran disimpan');
  };
  const deletePm = async (id: number) => { await db.paymentMethods.delete(id); toast.success('Dihapus'); };

  const openCatAdd = () => { setCatEditId(null); setCatName(''); setCatIcon('📦'); setCatColor('#FF6B35'); setCatDialog(true); };
  const openCatEdit = (c: Category) => { setCatEditId(c.id!); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDialog(true); };
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (catEditId) await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
    else await db.categories.add({ name: catName.trim(), icon: catIcon, color: catColor, createdAt: new Date(), isDeleted: false, deletedAt: null });
    setCatDialog(false);
    toast.success('Kategori disimpan');
  };
  const deleteCat = async (id: number) => { await db.categories.update(id, { isDeleted: true, deletedAt: new Date() }); toast.success('Dihapus'); };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (!text.trim()) { toast.error('File kosong'); return; }
        const data = JSON.parse(text);
        if (!data.version) { toast.error('File tidak valid'); return; }

        // Validate at least 1 table has data
        const hasSomeData = ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(
          key => Array.isArray(data[key]) && data[key].length > 0
        );
        if (!hasSomeData) { toast.error('File backup tidak berisi data'); return; }

        // CR-7: Snapshot existing data before clearing
        const snapshot = {
          categories: await db.categories.toArray(),
          products: await db.products.toArray(),
          suppliers: await db.suppliers.toArray(),
          stockIns: await db.stockIns.toArray(),
          stockOuts: await db.stockOuts.toArray(),
          hppHistory: await db.hppHistory.toArray(),
          paymentMethods: await db.paymentMethods.toArray(),
          transactions: await db.transactions.toArray(),
          transactionItems: await db.transactionItems.toArray(),
          storeSettings: await db.storeSettings.toArray(),
        };

        try {
          // Clear all tables
          await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
          await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
          await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
          await db.storeSettings.clear();

          // BulkAdd from file
          if (data.categories?.length) await db.categories.bulkAdd(data.categories);
          if (data.products?.length) await db.products.bulkAdd(data.products);
          if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
          if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
          if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
          if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
          if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
          if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
          if (data.storeSettings?.length) await db.storeSettings.bulkAdd(data.storeSettings);

          // Handle transactionItems
          if (data.transactionItems?.length) {
            // v2 format: items already in separate table
            await db.transactionItems.bulkAdd(data.transactionItems);
          } else if (data.version === 1 && data.transactions?.length) {
            // v1 format: migrate embedded items[] to transactionItems
            for (const t of data.transactions) {
              if (Array.isArray(t.items) && t.items.length > 0) {
                const records = t.items.map((item: any) => ({
                  transactionId: t.id,
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                  hpp: item.hpp,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  discountAmount: item.discountAmount,
                  subtotal: item.subtotal,
                }));
                await db.transactionItems.bulkAdd(records);
              }
            }
          }

          toast.success('Data berhasil di-restore!');
        } catch (importErr) {
          // CR-7: Rollback — restore from snapshot
          try {
            await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
            await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
            await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
            await db.storeSettings.clear();

            if (snapshot.categories.length) await db.categories.bulkAdd(snapshot.categories);
            if (snapshot.products.length) await db.products.bulkAdd(snapshot.products);
            if (snapshot.suppliers.length) await db.suppliers.bulkAdd(snapshot.suppliers);
            if (snapshot.stockIns.length) await db.stockIns.bulkAdd(snapshot.stockIns);
            if (snapshot.stockOuts.length) await db.stockOuts.bulkAdd(snapshot.stockOuts);
            if (snapshot.hppHistory.length) await db.hppHistory.bulkAdd(snapshot.hppHistory);
            if (snapshot.paymentMethods.length) await db.paymentMethods.bulkAdd(snapshot.paymentMethods);
            if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions);
            if (snapshot.transactionItems.length) await db.transactionItems.bulkAdd(snapshot.transactionItems);
            if (snapshot.storeSettings.length) await db.storeSettings.bulkAdd(snapshot.storeSettings);

            toast.error('Import gagal, data dikembalikan');
          } catch {
            toast.error('Import gagal dan rollback gagal. Coba restore dari file backup.');
          }
        }
      } catch { toast.error('Gagal membaca file'); }
    };
    input.click();
  };

  const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        Pengaturan
      </h1>

      {/* Store Info */}
      <Card className="border-0 shadow-sm cursor-pointer" onClick={openStoreEdit}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{storeSettings?.storeName || 'Toko Saya'}</p>
            <p className="text-xs text-muted-foreground">{storeSettings?.address || 'Belum diatur'}</p>
          </div>
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Transaksi & Stok */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Transaksi & Stok</h2>
        <Link to="/history">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Receipt className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Riwayat Transaksi</p><p className="text-[10px] text-muted-foreground">Lihat semua transaksi & cetak ulang struk</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/supplier">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><Truck className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Supplier</p><p className="text-[10px] text-muted-foreground">Kelola data supplier</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/stock-in">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mb-2">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><ArrowDownToLine className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Stock In</p><p className="text-[10px] text-muted-foreground">Catat barang masuk & HPP otomatis</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/stock-out">
          <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center"><ArrowUpFromLine className="w-4 h-4" /></div>
              <div className="flex-1"><p className="text-sm font-semibold">Stock Out</p><p className="text-[10px] text-muted-foreground">Catat barang keluar non-penjualan</p></div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Payment Methods */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Metode Pembayaran</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openPmAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {paymentMethods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pm.category}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPmEdit(pm)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePm(pm.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Tag className="w-4 h-4" /> Kategori Produk</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={openCatAdd}><Plus className="w-3 h-3" />Tambah</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {categories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded flex items-center justify-center text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCatEdit(c)}><Edit2 className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCat(c.id!)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Theme Color */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Palette className="w-4 h-4" /> Warna Tema</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeColorPicker
            value={storeSettings?.themeColor ?? '25'}
            onChange={hue => setThemeColor(hue)}
          />
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={exportBackupData}>
            <Download className="w-4 h-4" /> Export Backup (JSON)
          </Button>
          <Button variant="outline" className="w-full h-10 text-sm gap-2" onClick={handleImport}>
            <Upload className="w-4 h-4" /> Import / Restore Data
          </Button>
          {storeSettings?.lastBackupAt && (
            <p className="text-[10px] text-muted-foreground text-center">Terakhir backup: {new Date(storeSettings.lastBackupAt).toLocaleString('id-ID')}</p>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center space-y-2">
           <p className="text-sm font-bold">KasirGratisan</p>
           <p className="text-xs text-muted-foreground">POS Gratis untuk UMKM Indonesia 🇮🇩</p>
           <p className="text-[10px] text-muted-foreground">v1.0 • Data tersimpan di perangkat</p>
           {storageUsage && (
             <div className="pt-2 border-t">
               <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                 <HardDrive className="w-3.5 h-3.5" />
                 <span>Penyimpanan Terpakai</span>
               </div>
               <p className="text-xs font-semibold">
                 {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
               </p>
               <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                 <div
                   className="h-full bg-primary rounded-full transition-all"
                   style={{ width: `${Math.min(100, (storageUsage.usage / storageUsage.quota) * 100)}%` }}
                 />
               </div>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Store Dialog */}
      <Dialog open={storeDialog} onOpenChange={setStoreDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>Info Toko</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Toko</Label><Input value={storeName} onChange={e => setStoreName(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Alamat</Label><Input value={storeAddr} onChange={e => setStoreAddr(e.target.value)} className="h-11" /></div>
            <div className="space-y-1.5"><Label>Telepon</Label><Input value={storePhone} onChange={e => setStorePhone(e.target.value)} className="h-11" type="tel" /></div>
            <Button className="w-full h-11" onClick={saveStore}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Dialog */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama</Label><Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder="Contoh: Transfer BCA" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button key={c} onClick={() => setPmCategory(c)} className={`p-2 rounded-lg text-xs font-semibold border-2 capitalize transition-colors ${pmCategory === c ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <Button className="w-full h-11" onClick={savePm} disabled={!pmName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{catEditId ? 'Edit' : 'Tambah'} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Kategori</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Contoh: Snack" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button key={e} onClick={() => setCatIcon(e)} className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${catIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="w-full h-11" onClick={saveCat} disabled={!catName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
