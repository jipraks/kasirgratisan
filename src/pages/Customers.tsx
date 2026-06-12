import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer } from '@/lib/db';
import { useState } from 'react';
import { Users as UsersIcon, Plus, Edit2, Trash2, Phone, MapPin, Mail, Search, Eye, Receipt as ReceiptIcon, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

export default function CustomersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const customers = useLiveQuery(() => db.customers.where('isDeleted').equals(0).toArray());

  // Transaksi pelanggan yang sedang dilihat, terbaru dulu.
  // customerId tidak di-index, jadi pakai filter (dataset transaksi UMKM kecil).
  const customerTx = useLiveQuery(
    async () => {
      if (!viewCustomer?.id) return [];
      const all = await db.transactions
        .filter((t) => t.customerId === viewCustomer.id)
        .toArray();
      return all.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    },
    [viewCustomer?.id],
  );

  if (!can('manage_customers')) {
    return <LockedPage title="Pelanggan" permissionLabel="Kelola Pelanggan" />;
  }

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const openAdd = () => {
    setEditCustomer(null);
    setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setName(c.name); setPhone(c.phone); setEmail(c.email); setAddress(c.address); setNotes(c.notes);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };
    if (editCustomer?.id) {
      await db.customers.update(editCustomer.id, data);
      toast.success('Pelanggan diperbarui');
    } else {
      await db.customers.add({ ...data, createdAt: new Date(), isDeleted: 0, deletedAt: null });
      trackEvent('create_customer');
      toast.success('Pelanggan ditambahkan');
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await db.customers.update(deleteId, { isDeleted: 1, deletedAt: new Date() });
      setDeleteId(null);
      toast.success('Pelanggan dihapus');
    }
  };

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <UsersIcon className="h-5 w-5 text-primary" />
          Pelanggan
        </h1>
        <Button size="sm" onClick={openAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cari pelanggan..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-2xl border-border/70 bg-card/80 pl-9 shadow-soft" />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} pelanggan</p>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 py-12 text-center">
          <UsersIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Belum ada pelanggan</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Tambah Pelanggan
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {c.email}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {c.address}
                      </p>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setViewCustomer(c)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive" onClick={() => setDeleteId(c.id!)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editCustomer ? 'Edit' : 'Tambah'} Pelanggan</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama Pelanggan *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Budi Santoso" className="h-11" /></div>
            <div className="space-y-1.5"><Label>Nomor HP</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="08123456789" className="h-11" type="tel" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" className="h-11" type="email" /></div>
            <div className="space-y-1.5"><Label>Alamat</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Alamat pelanggan" className="h-11" /></div>
            <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan" rows={2} /></div>
            <Button className="h-11 w-full rounded-full" onClick={handleSave} disabled={!name.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pelanggan?</AlertDialogTitle>
            <AlertDialogDescription>Data pelanggan yang dihapus tidak bisa dikembalikan. Transaksi lama tetap menyimpan nama pelanggan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View customer + transaction history */}
      <Dialog open={!!viewCustomer} onOpenChange={(open) => { if (!open) setViewCustomer(null); }}>
        <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" />
              {viewCustomer?.name}
            </DialogTitle>
          </DialogHeader>

          {viewCustomer && (
            <div className="space-y-4 mt-1">
              {/* Contact info */}
              <div className="space-y-1.5">
                {viewCustomer.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {viewCustomer.phone}</p>
                )}
                {viewCustomer.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {viewCustomer.email}</p>
                )}
                {viewCustomer.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {viewCustomer.address}</p>
                )}
                {viewCustomer.notes && (
                  <p className="text-sm text-muted-foreground italic">{viewCustomer.notes}</p>
                )}
              </div>

              {/* Summary */}
              {(() => {
                const txs = customerTx ?? [];
                const completed = txs.filter(t => t.status !== 'open');
                const totalSpent = completed.reduce((s, t) => s + t.total, 0);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-muted/50 p-3.5">
                      <p className="text-[10px] text-muted-foreground">Total Transaksi</p>
                      <p className="text-lg font-bold">{completed.length}</p>
                    </div>
                    <div className="rounded-2xl bg-primary/5 p-3.5">
                      <p className="text-[10px] text-muted-foreground">Total Belanja</p>
                      <p className="text-lg font-bold text-primary">Rp {totalSpent.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                );
              })()}

              {/* History */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ReceiptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">Riwayat Transaksi</p>
                </div>

                {customerTx === undefined ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Memuat...</p>
                ) : customerTx.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">Belum ada transaksi</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerTx.map(tx => (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => navigate(`/history?txId=${tx.id}`)}
                        className="w-full text-left rounded-2xl border border-border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="secondary" className="text-[10px] shrink-0">{tx.receiptNumber}</Badge>
                            {tx.status === 'open' && (
                              <Badge className="text-[9px] bg-warning/15 text-warning shrink-0">Open Bill</Badge>
                            )}
                          </div>
                          <span className="text-sm font-bold text-primary shrink-0">Rp {tx.total.toLocaleString('id-ID')}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(tx.date), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
