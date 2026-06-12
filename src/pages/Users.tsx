import { useLiveQuery } from 'dexie-react-hooks';
import { db, type User, ALL_PERMISSIONS } from '@/lib/db';
import { useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, KeyRound, UserCircle2, ShieldCheck, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import {
  createUser,
  updateUserPin,
  hashPin,
  isValidPin,
  isValidUsername,
  PERMISSION_LABELS,
  DEFAULT_STAFF_PERMISSIONS,
  type PermissionKey,
} from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function UsersPage() {
  const navigate = useNavigate();
  const { currentUser, isOwner, multiUserEnabled, refresh } = useAuth();
  const users = useLiveQuery(() => db.users.toArray());

  // Add/edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [permissions, setPermissions] = useState<PermissionKey[]>(DEFAULT_STAFF_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  // Reset PIN dialog
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<User | null>(null);
  const [newPin, setNewPin] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  if (!multiUserEnabled) {
    return (
      <div className="px-4 pb-24 pt-6">
        <div className="flex items-center gap-3.5 mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <UsersIcon className="h-5 w-5 text-primary" />
            Karyawan & Akses
          </h1>
        </div>
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-sm font-semibold">Multi-user belum aktif</p>
            <p className="text-xs text-muted-foreground">
              Aktifkan dulu di halaman Pengaturan untuk mengelola karyawan dan akses.
            </p>
            <Button size="sm" className="mt-2" onClick={() => navigate('/settings')}>
              Buka Pengaturan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="px-4 pb-24 pt-6">
        <div className="flex items-center gap-3.5 mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <UsersIcon className="h-5 w-5 text-primary" />
            Karyawan & Akses
          </h1>
        </div>
        <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Hanya pemilik toko yang dapat mengelola karyawan.
          </CardContent>
        </Card>
      </div>
    );
  }

  const openAdd = () => {
    setEditing(null);
    setName('');
    setUsername('');
    setPin('');
    setPermissions(DEFAULT_STAFF_PERMISSIONS);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setName(user.name);
    setUsername(user.username);
    setPin('');
    setPermissions(user.role === 'owner' ? [...ALL_PERMISSIONS] : user.permissions);
    setDialogOpen(true);
  };

  const togglePermission = (key: PermissionKey, checked: boolean) => {
    setPermissions((prev) => (checked ? [...new Set([...prev, key])] : prev.filter((p) => p !== key)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        // Edit existing user (name + permissions only — username & PIN have separate flows)
        if (!name.trim()) {
          toast.error('Nama tidak boleh kosong');
          return;
        }
        await db.users.update(editing.id!, {
          name: name.trim(),
          permissions: editing.role === 'owner' ? [] : permissions,
        });
        toast.success('Data karyawan diperbarui');
        if (currentUser?.id === editing.id) await refresh();
      } else {
        // Create new staff
        if (!isValidUsername(username)) {
          toast.error('Username 3-20 karakter, hanya huruf/angka/underscore');
          return;
        }
        if (!isValidPin(pin)) {
          toast.error('PIN harus 4-6 digit angka');
          return;
        }
        if (!name.trim()) {
          toast.error('Nama tidak boleh kosong');
          return;
        }
        const result = await createUser({
          username,
          pin,
          name,
          role: 'staff',
          permissions,
        });
        if (!result.ok) {
          toast.error(result.error || 'Gagal menambah karyawan');
          return;
        }
        toast.success(`Karyawan "${name.trim()}" ditambahkan`);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openPinReset = (user: User) => {
    setPinTarget(user);
    setNewPin('');
    setPinDialogOpen(true);
  };

  const handlePinReset = async () => {
    if (!pinTarget?.id) return;
    if (!isValidPin(newPin)) {
      toast.error('PIN harus 4-6 digit angka');
      return;
    }
    const result = await updateUserPin(pinTarget.id, newPin);
    if (!result.ok) {
      toast.error(result.error || 'Gagal reset PIN');
      return;
    }
    toast.success(`PIN ${pinTarget.name} berhasil direset`);
    setPinDialogOpen(false);
  };

  const toggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('Tidak bisa menonaktifkan akun yang sedang login');
      return;
    }
    if (user.role === 'owner') {
      const otherOwners = (users ?? []).filter((u) => u.role === 'owner' && u.id !== user.id && u.isActive === 1);
      if (user.isActive === 1 && otherOwners.length === 0) {
        toast.error('Harus ada minimal 1 pemilik aktif');
        return;
      }
    }
    await db.users.update(user.id!, { isActive: user.isActive === 1 ? 0 : 1 });
    toast.success(user.isActive === 1 ? 'Akun dinonaktifkan' : 'Akun diaktifkan');
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    if (deleteTarget.id === currentUser?.id) {
      toast.error('Tidak bisa menghapus akun sendiri');
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget.role === 'owner') {
      const otherOwners = (users ?? []).filter((u) => u.role === 'owner' && u.id !== deleteTarget.id);
      if (otherOwners.length === 0) {
        toast.error('Harus ada minimal 1 pemilik');
        setDeleteTarget(null);
        return;
      }
    }
    await db.users.delete(deleteTarget.id);
    toast.success(`Akun "${deleteTarget.name}" dihapus`);
    setDeleteTarget(null);
  };

  const sortedUsers = (users ?? []).slice().sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <div className="flex items-center gap-3.5">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <UsersIcon className="h-5 w-5 text-primary" />
          Karyawan & Akses
        </h1>
      </div>

      <p className="text-xs text-muted-foreground">
        Atur siapa yang bisa mengakses apa di toko Anda. Pemilik selalu memiliki akses penuh.
      </p>

      <Button size="sm" className="w-full h-10 gap-1.5" onClick={openAdd}>
        <Plus className="h-4 w-4" />
        Tambah Karyawan
      </Button>

      <div className="space-y-2">
        {sortedUsers.map((user) => (
          <Card key={user.id} className="border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardContent className="p-3.5">
              <div className="flex items-start gap-3.5">
                <div
                  className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    user.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {user.role === 'owner' ? <ShieldCheck className="w-5 h-5" /> : <UserCircle2 className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{user.name}</p>
                    {user.role === 'owner' && (
                      <Badge variant="secondary" className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20">
                        Pemilik
                      </Badge>
                    )}
                    {user.id === currentUser?.id && (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        Anda
                      </Badge>
                    )}
                    {user.isActive === 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 bg-muted text-muted-foreground">
                        Nonaktif
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">@{user.username}</p>
                  {user.role !== 'owner' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {user.permissions.length === 0
                        ? 'Tidak ada akses'
                        : `${user.permissions.length} akses diberikan`}
                    </p>
                  )}
                  {user.lastLoginAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Login terakhir: {format(new Date(user.lastLoginAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)} title="Edit">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openPinReset(user)}
                    title="Reset PIN"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleActive(user)}
                    title={user.isActive === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {user.isActive === 1 ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                  {user.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(user)}
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Karyawan' : 'Tambah Karyawan'}</DialogTitle>
            <DialogDescription className="text-xs">
              {editing
                ? 'Ubah nama dan akses. Username tidak bisa diubah; gunakan tombol reset PIN untuk mengganti PIN.'
                : 'Karyawan akan login dengan username dan PIN.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nama Lengkap *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Budi Santoso" className="h-11" />
            </div>

            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>Username *</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    placeholder="Contoh: budi"
                    className="h-11 font-mono"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground">3-20 karakter, hanya huruf/angka/underscore</p>
                </div>
                <div className="space-y-1.5">
                  <Label>PIN *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="4-6 digit"
                    className="h-11 font-mono text-center tracking-widest"
                  />
                </div>
              </>
            )}

            {editing?.role === 'owner' ? (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 text-xs text-muted-foreground">
                Pemilik selalu memiliki akses penuh ke semua fitur.
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm">Hak Akses</Label>
                <div className="space-y-1.5">
                  {ALL_PERMISSIONS.map((key) => {
                    const meta = PERMISSION_LABELS[key];
                    const checked = permissions.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-3.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors ${
                          checked ? 'border-primary/50 bg-primary/5' : 'border-muted bg-muted/30'
                        }`}
                      >
                        <Switch
                          checked={checked}
                          onCheckedChange={(v) => togglePermission(key, v === true)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{meta.title}</p>
                          <p className="text-[10px] text-muted-foreground leading-snug">{meta.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Button className="h-11 w-full rounded-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN reset dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reset PIN {pinTarget?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan PIN baru. PIN lama akan langsung diganti dan {pinTarget?.name} harus login ulang dengan PIN baru.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-6 digit"
              className="h-12 font-mono text-center tracking-widest text-lg"
              autoFocus
            />
            <Button className="h-11 w-full rounded-full" onClick={handlePinReset} disabled={!isValidPin(newPin)}>
              Simpan PIN Baru
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun akan dihapus permanen. Riwayat transaksi yang dibuat oleh akun ini tidak akan terhapus, tapi nama
              kasir akan tampil sebagai "—".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
