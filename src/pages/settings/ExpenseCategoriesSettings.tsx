import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ExpenseCategory } from '@/lib/db';
import { useState } from 'react';
import { Wallet, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

const expenseEmojiOptions = ['💡', '🏠', '👤', '🚚', '🧰', '📦', '💧', '📞', '🌐', '☕', '🧾', '💼'];

export default function ExpenseCategoriesSettings() {
  const { can } = useAuth();
  const expenseCategories = useLiveQuery(() =>
    db.expenseCategories.where('isDeleted').equals(0).toArray(),
  );

  const [expCatDialog, setExpCatDialog] = useState(false);
  const [expCatName, setExpCatName] = useState('');
  const [expCatIcon, setExpCatIcon] = useState('📦');
  const [expCatColor, setExpCatColor] = useState('#FBBF24');
  const [expCatEditId, setExpCatEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return <LockedPage title="Kategori Pengeluaran" permissionLabel="Kelola Kategori & Pembayaran" />;
  }

  const openExpCatAdd = () => { setExpCatEditId(null); setExpCatName(''); setExpCatIcon('📦'); setExpCatColor('#FBBF24'); setExpCatDialog(true); };
  const openExpCatEdit = (c: ExpenseCategory) => { setExpCatEditId(c.id!); setExpCatName(c.name); setExpCatIcon(c.icon); setExpCatColor(c.color); setExpCatDialog(true); };
  const saveExpCat = async () => {
    const name = expCatName.trim();
    if (!name) return;
    if (expCatEditId) {
      await db.expenseCategories.update(expCatEditId, { name, icon: expCatIcon, color: expCatColor });
    } else {
      await db.expenseCategories.add({
        name,
        icon: expCatIcon,
        color: expCatColor,
        isDefault: 0,
        createdAt: new Date(),
        isDeleted: 0,
        deletedAt: null,
      });
    }
    setExpCatDialog(false);
    toast.success('Kategori pengeluaran disimpan');
  };
  const deleteExpCat = async (cat: ExpenseCategory) => {
    if (!cat.id) return;
    const usage = await db.expenses.where('categoryId').equals(cat.id).filter(e => e.isDeleted === 0).count();
    if (usage > 0) {
      toast.error(`Tidak bisa dihapus: dipakai oleh ${usage} pengeluaran`);
      return;
    }
    await db.expenseCategories.update(cat.id, { isDeleted: 1, deletedAt: new Date() });
    toast.success('Kategori pengeluaran dihapus');
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Wallet className="h-5 w-5 text-warning" />
            Kategori Pengeluaran
          </h1>
        </div>
        <Button size="sm" onClick={openExpCatAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-1 p-3.5.5">
          {expenseCategories && expenseCategories.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Belum ada kategori pengeluaran</p>
          )}
          {expenseCategories?.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl text-sm" style={{ backgroundColor: c.color + '20' }}>{c.icon}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openExpCatEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => deleteExpCat(c)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={expCatDialog} onOpenChange={setExpCatDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{expCatEditId ? 'Edit' : 'Tambah'} Kategori Pengeluaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Kategori</Label>
              <Input
                value={expCatName}
                onChange={e => setExpCatName(e.target.value)}
                placeholder="Contoh: Internet, Marketing"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ikon</Label>
              <div className="flex flex-wrap gap-2">
                {expenseEmojiOptions.map(e => (
                  <button
                    key={e}
                    onClick={() => setExpCatIcon(e)}
                    className={`h-10 w-10 rounded-2xl text-lg flex items-center justify-center border-2 transition-colors ${expCatIcon === e ? 'border-primary bg-primary/5' : 'border-muted'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Input type="color" value={expCatColor} onChange={e => setExpCatColor(e.target.value)} className="h-11 w-20" />
            </div>
            <Button className="h-11 w-full rounded-full" onClick={saveExpCat} disabled={!expCatName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
