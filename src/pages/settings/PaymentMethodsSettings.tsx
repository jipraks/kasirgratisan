import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentMethod } from '@/lib/db';
import { useState } from 'react';
import { CreditCard, Plus, Trash2, Edit2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

export default function PaymentMethodsSettings() {
  const { can } = useAuth();
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());

  const [pmDialog, setPmDialog] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmCategory, setPmCategory] = useState('tunai');
  const [pmEditId, setPmEditId] = useState<number | null>(null);

  if (!can('manage_categories_payments')) {
    return <LockedPage title="Metode Pembayaran" permissionLabel="Kelola Kategori & Pembayaran" />;
  }

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

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <CreditCard className="h-5 w-5 text-primary" />
            Metode Pembayaran
          </h1>
        </div>
        <Button size="sm" onClick={openPmAdd} className="h-10 gap-1.5 rounded-full px-4 shadow-soft"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-1 p-3.5.5">
          {paymentMethods && paymentMethods.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Belum ada metode pembayaran</p>
          )}
          {paymentMethods?.map(pm => (
            <div key={pm.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{pm.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{pm.category}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openPmEdit(pm)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => deletePm(pm.id!)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{pmEditId ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nama</Label><Input value={pmName} onChange={e => setPmName(e.target.value)} placeholder="Contoh: Transfer BCA" className="h-11" /></div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <div className="grid grid-cols-4 gap-2">
                {['tunai', 'transfer', 'e-wallet', 'qris'].map(c => (
                  <button key={c} onClick={() => setPmCategory(c)} className={`rounded-2xl p-2 text-xs font-semibold border-2 capitalize transition-colors ${pmCategory === c ? 'border-primary bg-primary/5 text-primary' : 'border-muted text-muted-foreground'}`}>{c}</button>
                ))}
              </div>
            </div>
            <Button className="h-11 w-full rounded-full" onClick={savePm} disabled={!pmName.trim()}>Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
