import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Supplier } from '@/lib/db';
import { useState } from 'react';
import { Truck, Plus, Edit2, Trash2, Phone, MapPin, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

export default function SupplierPage() {
  const { can } = useAuth();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const suppliers = useLiveQuery(() => db.suppliers.where('isDeleted').equals(0).toArray());

  if (!can('manage_supplier')) {
    return <LockedPage title="Supplier" permissionLabel="Kelola Supplier" />;
  }

  const filtered = suppliers?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  ) ?? [];

  const openAdd = () => {
    setEditSupplier(null);
    setName(''); setPhone(''); setAddress(''); setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setName(s.name); setPhone(s.phone); setAddress(s.address); setNotes(s.notes);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() };
    if (editSupplier?.id) {
      await db.suppliers.update(editSupplier.id, data);
      toast.success('Supplier diperbarui');
    } else {
      await db.suppliers.add({ ...data, createdAt: new Date(), isDeleted: 0, deletedAt: null });
      toast.success('Supplier ditambahkan');
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await db.suppliers.update(deleteId, { isDeleted: 1, deletedAt: new Date() }); setDeleteId(null); toast.success('Supplier dihapus'); }
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Truck className="h-5 w-5 text-primary" />
          Supplier
        </h1>
        <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari supplier..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-2xl border-border/70 bg-card/80 pl-9 shadow-soft" />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} supplier</p>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 py-12 text-center">
          <Truck className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Belum ada supplier</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Tambah Supplier
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    {s.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </p>
                    )}
                    {s.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {s.address}
                      </p>
                    )}
                    {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => openEdit(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive" onClick={() => setDeleteId(s.id!)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editSupplier ? 'Edit' : 'Tambah'} Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Supplier *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: PT Sumber Jaya" className="h-11" /></div>
            <div className="space-y-1.5"><Label>Telepon</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08123456789" className="h-11" type="tel" /></div>
            <div className="space-y-1.5"><Label>Alamat</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Alamat supplier" className="h-11" /></div>
            <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan" rows={2} /></div>
            <Button className="h-11 w-full rounded-full" onClick={handleSave} disabled={!name.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Supplier?</AlertDialogTitle>
            <AlertDialogDescription>Data supplier yang dihapus tidak bisa dikembalikan.</AlertDialogDescription>
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
