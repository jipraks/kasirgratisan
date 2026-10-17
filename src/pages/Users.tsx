import { useLiveQuery } from 'dexie-react-hooks';
import { db, type User, ALL_PERMISSIONS } from '@/lib/db';
import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
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
  DEFAULT_STAFF_PERMISSIONS,
  type PermissionKey,
} from '@/lib/auth';
import { toast } from 'sonner';
import { getDateLocale } from '@/i18n';

export default function UsersPage() {
  const navigate = useNavigate();
  const { currentUser, isOwner, multiUserEnabled, refresh } = useAuth();
  const { t, i18n } = useTranslation('settings');
  const dateLocale = getDateLocale(i18n.language);
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
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            {t('users.title')}
          </h1>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-sm font-semibold">{t('users.notEnabled.title')}</p>
            <p className="text-xs text-muted-foreground">{t('users.notEnabled.description')}</p>
            <Button size="sm" className="mt-2" onClick={() => navigate('/settings')}>
              {t('users.notEnabled.button')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            {t('users.title')}
          </h1>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t('users.notOwner')}
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
          toast.error(t('users.toast.nameRequired'));
          return;
        }
        await db.users.update(editing.id!, {
          name: name.trim(),
          permissions: editing.role === 'owner' ? [] : permissions,
        });
        toast.success(t('users.toast.staffUpdated'));
        if (currentUser?.id === editing.id) await refresh();
      } else {
        // Create new staff
        if (!isValidUsername(username)) {
          toast.error(t('users.toast.usernameInvalid'));
          return;
        }
        if (!isValidPin(pin)) {
          toast.error(t('users.toast.pinInvalid'));
          return;
        }
        if (!name.trim()) {
          toast.error(t('users.toast.nameRequired'));
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
          toast.error(result.error || t('users.toast.createFailed'));
          return;
        }
        toast.success(t('users.toast.staffCreated', { name: name.trim() }));
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
      toast.error(t('users.toast.pinInvalid'));
      return;
    }
    const result = await updateUserPin(pinTarget.id, newPin);
    if (!result.ok) {
      toast.error(result.error || t('users.toast.pinResetFailed'));
      return;
    }
    toast.success(t('users.toast.pinReset', { name: pinTarget.name }));
    setPinDialogOpen(false);
  };

  const toggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error(t('users.toast.cannotSelfDisable'));
      return;
    }
    if (user.role === 'owner') {
      const otherOwners = (users ?? []).filter((u) => u.role === 'owner' && u.id !== user.id && u.isActive === 1);
      if (user.isActive === 1 && otherOwners.length === 0) {
        toast.error(t('users.toast.ownerMinRequired'));
        return;
      }
    }
    await db.users.update(user.id!, { isActive: user.isActive === 1 ? 0 : 1 });
    toast.success(user.isActive === 1 ? t('users.toast.accountDisabled') : t('users.toast.accountEnabled'));
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    if (deleteTarget.id === currentUser?.id) {
      toast.error(t('users.toast.cannotSelfDelete'));
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget.role === 'owner') {
      const otherOwners = (users ?? []).filter((u) => u.role === 'owner' && u.id !== deleteTarget.id);
      if (otherOwners.length === 0) {
        toast.error(t('users.toast.ownerMinRequired'));
        setDeleteTarget(null);
        return;
      }
    }
    await db.users.delete(deleteTarget.id);
    toast.success(t('users.toast.accountDeleted', { name: deleteTarget.name }));
    setDeleteTarget(null);
  };

  const sortedUsers = (users ?? []).slice().sort((a, b) => {
    if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-primary" />
          {t('users.title')}
        </h1>
      </div>

      <p className="text-xs text-muted-foreground">{t('users.desc')}</p>

      <Button size="sm" className="w-full h-10 gap-1.5" onClick={openAdd}>
        <Plus className="w-4 h-4" />
        {t('users.addButton')}
      </Button>

      <div className="space-y-2">
        {sortedUsers.map((user) => (
          <Card key={user.id} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    user.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {user.role === 'owner' ? <ShieldCheck className="w-5 h-5" /> : <UserCircle2 className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{user.name}</p>
                    {user.role === 'owner' && (
                      <Badge variant="secondary" className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20">
                        {t('users.card.owner')}
                      </Badge>
                    )}
                    {user.id === currentUser?.id && (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        {t('users.card.you')}
                      </Badge>
                    )}
                    {user.isActive === 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 bg-muted text-muted-foreground">
                        {t('users.card.inactive')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">@{user.username}</p>
                  {user.role !== 'owner' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {user.permissions.length === 0
                        ? t('users.card.noAccess')
                        : t('users.card.accessCount', { count: user.permissions.length })}
                    </p>
                  )}
                  {user.lastLoginAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t('users.card.lastLogin', {
                        time: format(new Date(user.lastLoginAt), 'dd MMM yyyy HH:mm', { locale: dateLocale }),
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(user)} title={t('users.card.edit')}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openPinReset(user)}
                    title={t('users.card.resetPin')}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleActive(user)}
                    title={user.isActive === 1 ? t('users.card.deactivate') : t('users.card.activate')}
                  >
                    {user.isActive === 1 ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  {user.id !== currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteTarget(user)}
                      title={t('users.card.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('users.dialog.editTitle') : t('users.dialog.addTitle')}</DialogTitle>
            <DialogDescription className="text-xs">
              {editing ? t('users.dialog.descEdit') : t('users.dialog.descAdd')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t('users.dialog.nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('users.dialog.namePlaceholder')} className="h-11" />
            </div>

            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>{t('users.dialog.usernameLabel')}</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    placeholder={t('users.dialog.usernamePlaceholder')}
                    className="h-11 font-mono"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground">{t('users.dialog.usernameHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('users.dialog.pinLabel')}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('users.dialog.pinPlaceholder')}
                    className="h-11 font-mono text-center tracking-widest"
                  />
                </div>
              </>
            )}

            {editing?.role === 'owner' ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
                {t('users.dialog.ownerNotice')}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm">{t('users.dialog.accessLabel')}</Label>
                <div className="space-y-1.5">
                  {ALL_PERMISSIONS.map((key) => {
                    const checked = permissions.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          checked ? 'border-primary/50 bg-primary/5' : 'border-muted bg-muted/30'
                        }`}
                      >
                        <Switch
                          checked={checked}
                          onCheckedChange={(v) => togglePermission(key, v === true)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{t(`common:permissions.${key}.title`)}</p>
                          <p className="text-[10px] text-muted-foreground leading-snug">{t(`common:permissions.${key}.desc`)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <Button className="w-full h-11" onClick={handleSave} disabled={saving}>
              {saving ? t('users.dialog.saving') : editing ? t('users.dialog.saveEdit') : t('users.dialog.saveAdd')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN reset dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-[90vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('users.pinReset.title', { name: pinTarget?.name ?? '' })}</DialogTitle>
            <DialogDescription className="text-xs">
              {t('users.pinReset.desc', { name: pinTarget?.name ?? '' })}
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
              placeholder={t('users.pinReset.placeholder')}
              className="h-12 font-mono text-center tracking-widest text-lg"
              autoFocus
            />
            <Button className="w-full h-11" onClick={handlePinReset} disabled={!isValidPin(newPin)}>
              {t('users.pinReset.button')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.deleteDialog.title', { name: deleteTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('users.deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('users.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('users.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
