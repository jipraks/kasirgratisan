import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Supplier } from '@/lib/db';
import { useState } from 'react';
import { Truck, Plus, Edit2, Trash2, Phone, MapPin, Search, ArrowLeft } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';


export default function SupplierPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { t } = useTranslation('settings');

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
    return <LockedPage title={t('supplier.locked.title')} permissionLabel={t('supplier.locked.permissionLabel')} />;
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
      toast.success(t('supplier.toast.updated'));
    } else {
      await db.suppliers.add({ ...data, createdAt: new Date(), isDeleted: 0, deletedAt: null });
      toast.success(t('supplier.toast.added'));
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) { await db.suppliers.update(deleteId, { isDeleted: 1, deletedAt: new Date() }); setDeleteId(null); toast.success(t('supplier.toast.deleted')); }
  };

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {t('supplier.title')}
          </h1>
        </div>
        <Button size="sm" onClick={openAdd} className="h-9 gap-1.5">
          <Plus className="w-4 h-4" /> {t('supplier.add')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('supplier.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      <p className="text-xs text-muted-foreground">{t('supplier.count', { count: filtered.length })}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t('supplier.empty.title')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" /> {t('supplier.empty.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card key={s.id} className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    {s.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </p>
                    )}
                    {s.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {s.address}
                      </p>
                    )}
                    {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id!)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader><DialogTitle>{editSupplier ? t('supplier.dialog.editTitle') : t('supplier.dialog.addTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>{t('supplier.dialog.nameLabel')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t('supplier.dialog.namePlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('supplier.dialog.phoneLabel')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('supplier.dialog.phonePlaceholder')} className="h-11" type="tel" /></div>
            <div className="space-y-1.5"><Label>{t('supplier.dialog.addressLabel')}</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('supplier.dialog.addressPlaceholder')} className="h-11" /></div>
            <div className="space-y-1.5"><Label>{t('supplier.dialog.notesLabel')}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('supplier.dialog.notesPlaceholder')} rows={2} /></div>
            <Button className="w-full h-11" onClick={handleSave} disabled={!name.trim()}>{t('supplier.dialog.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('supplier.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('supplier.deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('supplier.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('supplier.deleteDialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
