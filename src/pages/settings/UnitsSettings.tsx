import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Unit } from '@/lib/db';
import { useState } from 'react';
import { Ruler, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function UnitsSettings() {
  const units = useLiveQuery(() => db.units.where('isDeleted').equals(0).toArray());

  const [unitDialog, setUnitDialog] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitEditId, setUnitEditId] = useState<number | null>(null);
  const [unitOriginalName, setUnitOriginalName] = useState('');
  const [unitDeleteTarget, setUnitDeleteTarget] = useState<Unit | null>(null);
  const [unitDeleteUsage, setUnitDeleteUsage] = useState(0);

  const openUnitAdd = () => {
    setUnitEditId(null);
    setUnitName('');
    setUnitOriginalName('');
    setUnitDialog(true);
  };
  const openUnitEdit = (u: Unit) => {
    setUnitEditId(u.id!);
    setUnitName(u.name);
    setUnitOriginalName(u.name);
    setUnitDialog(true);
  };
  const saveUnit = async () => {
    const name = unitName.trim();
    if (!name) return;

    // Uniqueness check (active units only — soft-deleted records still occupy &name index,
    // but we want to surface a clearer message on conflict)
    const existing = await db.units.where('name').equals(name).first();
    if (existing && existing.id !== unitEditId) {
      if (existing.isDeleted === 1) {
        toast.error(`Satuan "${name}" pernah dihapus. Pakai nama lain atau pulihkan via backup.`);
      } else {
        toast.error(`Satuan "${name}" sudah ada`);
      }
      return;
    }

    try {
      if (unitEditId) {
        await db.units.update(unitEditId, { name });
        // Cascade rename to all products using the old name so the dropdown stays consistent
        if (unitOriginalName && unitOriginalName !== name) {
          await db.products.where('unit').equals(unitOriginalName).modify({ unit: name, updatedAt: new Date() });
        }
      } else {
        await db.units.add({
          name,
          isDefault: 0,
          createdAt: new Date(),
          isDeleted: 0,
          deletedAt: null,
        });
      }
      setUnitDialog(false);
      toast.success('Satuan disimpan');
    } catch {
      toast.error('Gagal menyimpan satuan');
    }
  };
  const requestDeleteUnit = async (u: Unit) => {
    const usage = await db.products.where('unit').equals(u.name).filter(p => p.isDeleted === 0).count();
    setUnitDeleteUsage(usage);
    setUnitDeleteTarget(u);
  };
  const confirmDeleteUnit = async () => {
    if (!unitDeleteTarget?.id) return;
    await db.units.update(unitDeleteTarget.id, { isDeleted: 1, deletedAt: new Date() });
    setUnitDeleteTarget(null);
    toast.success('Satuan dihapus');
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Ruler className="h-5 w-5 text-primary" />
            Satuan
          </h1>
        </div>
        <Button size="sm" onClick={openUnitAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-1 p-3.5.5">
          {units && units.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Belum ada satuan</p>
          )}
          {units?.map(u => (
            <div key={u.id} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">{u.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openUnitEdit(u)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => requestDeleteUnit(u)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{unitEditId ? 'Edit' : 'Tambah'} Satuan</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Satuan</Label>
              <Input
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                placeholder="Contoh: pak, lusin, mangkok"
                className="h-11"
              />
              {unitEditId && unitOriginalName && unitName.trim() && unitName.trim() !== unitOriginalName && (
                <p className="text-[11px] text-muted-foreground">
                  Semua produk yang memakai "{unitOriginalName}" akan otomatis di-rename ke "{unitName.trim()}".
                </p>
              )}
            </div>
            <Button className="h-11 w-full rounded-full" onClick={saveUnit} disabled={!unitName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!unitDeleteTarget} onOpenChange={(o) => { if (!o) setUnitDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Satuan "{unitDeleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {unitDeleteUsage > 0
                ? `Saat ini dipakai oleh ${unitDeleteUsage} produk. Produk yang sudah ada tetap menyimpan satuan "${unitDeleteTarget?.name}", tapi satuan ini tidak akan muncul lagi di pilihan saat tambah/edit produk baru.`
                : 'Satuan ini tidak dipakai oleh produk manapun. Aman untuk dihapus.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnit} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
