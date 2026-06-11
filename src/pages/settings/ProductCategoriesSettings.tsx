import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category } from '@/lib/db';
import { useState } from 'react';
import { Tag, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

const emojiOptions = ['📦', '🍕', '🥤', '🍜', '🧃', '🎽', '💊', '🧹', '📱', '🛒', '🎁', '✂️'];

export default function ProductCategoriesSettings() {
  const { can } = useAuth();
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());

  const [catDialog, setCatDialog] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#FF6B35');
  const [catEditId, setCatEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return <LockedPage title="Kategori Produk" permissionLabel="Kelola Kategori & Pembayaran" />;
  }

  const openCatAdd = () => { setCatEditId(null); setCatName(''); setCatIcon('📦'); setCatColor('#FF6B35'); setCatDialog(true); };
  const openCatEdit = (c: Category) => { setCatEditId(c.id!); setCatName(c.name); setCatIcon(c.icon); setCatColor(c.color); setCatDialog(true); };
  const saveCat = async () => {
    if (!catName.trim()) return;
    if (catEditId) await db.categories.update(catEditId, { name: catName.trim(), icon: catIcon, color: catColor });
    else await db.categories.add({ name: catName.trim(), icon: catIcon, color: catColor, createdAt: new Date(), isDeleted: 0, deletedAt: null });
    setCatDialog(false);
    toast.success('Kategori disimpan');
  };
  const deleteCat = async (id: number) => { await db.categories.update(id, { isDeleted: 1, deletedAt: new Date() }); toast.success('Dihapus'); };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Tag className="h-5 w-5 text-primary" />
            Kategori Produk
          </h1>
        </div>
        <Button size="sm" onClick={openCatAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-1 p-3.5.5">
          {categories && categories.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Belum ada kategori produk</p>
          )}
          {categories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openCatEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => deleteCat(c.id!)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{catEditId ? 'Edit' : 'Tambah'} Kategori</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Kategori</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Contoh: Snack" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(e => (
                  <button key={e} onClick={() => setCatIcon(e)} className={`h-10 w-10 rounded-2xl text-lg flex items-center justify-center border-2 transition-colors ${catIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="h-11 w-full rounded-full" onClick={saveCat} disabled={!catName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
