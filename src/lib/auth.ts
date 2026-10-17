import { db, type User, type PermissionKey, ALL_PERMISSIONS } from './db';
import i18n from '@/i18n';

const authError = (key: string) => i18n.t(`authErrors.${key}`, { ns: 'common' }) as string;

// === PIN hashing (SHA-256, hex) ===
// Note: client-only PWA — this is *obfuscation*, not military-grade security.
// Anyone with device access could open IndexedDB. The goal is to prevent a
// nosy employee from seeing each other's PIN, not protect against a forensic
// attacker. We salt with a per-store deviceId to avoid rainbow lookups.
export async function hashPin(pin: string, deviceId: string): Promise<string> {
  const data = new TextEncoder().encode(`${deviceId}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function isValidUsername(username: string): boolean {
  // 3-20 chars, alphanumeric + underscore + dot, no spaces
  return /^[a-zA-Z0-9_.]{3,20}$/.test(username);
}

// === Permissions ===
export { ALL_PERMISSIONS };
export type { PermissionKey };

// Default permission set for new staff: create transaction only.
export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = ['create_transaction'];

// Owner implicitly has every permission. This helper centralizes the check.
export function hasPermission(user: User | null, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.permissions.includes(key);
}

// Owner-only: managing other users.
export function canManageUsers(user: User | null): boolean {
  return user?.role === 'owner';
}

// === Login ===

export interface LoginResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export async function login(username: string, pin: string): Promise<LoginResult> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed || !pin) return { ok: false, error: authError('credentialsRequired') };

  const settings = await db.storeSettings.toCollection().first();
  if (!settings?.deviceId) return { ok: false, error: authError('storeNotReady') };

  const user = await db.users.where('username').equals(trimmed).first();
  if (!user) return { ok: false, error: authError('invalidCredentials') };
  if (!user.isActive) return { ok: false, error: authError('accountDisabled') };

  const hash = await hashPin(pin, settings.deviceId);
  if (hash !== user.pinHash) return { ok: false, error: authError('invalidCredentials') };

  // Update lastLoginAt (best-effort, non-blocking semantics OK)
  await db.users.update(user.id!, { lastLoginAt: new Date() });

  return { ok: true, user: { ...user, lastLoginAt: new Date() } };
}

// === Session persistence (localStorage) ===

const SESSION_KEY = 'kasirgratisan_session_v1';

interface StoredSession {
  userId: number;
  deviceId: string; // bind session to device — invalidate if storage moved
}

export function saveSession(userId: number, deviceId: string): void {
  const data: StoredSession = { userId, deviceId };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or disabled — silent failure, user re-logs next time
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function restoreSession(): Promise<User | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (!data?.userId || !data?.deviceId) return null;

    const settings = await db.storeSettings.toCollection().first();
    if (!settings?.deviceId || settings.deviceId !== data.deviceId) {
      // Device changed (e.g. import/restore from backup) — force re-login
      clearSession();
      return null;
    }

    const user = await db.users.get(data.userId);
    if (!user || !user.isActive) {
      clearSession();
      return null;
    }
    return user;
  } catch {
    clearSession();
    return null;
  }
}

// === User CRUD helpers ===

export async function createUser(input: {
  username: string;
  pin: string;
  name: string;
  role: 'owner' | 'staff';
  permissions: PermissionKey[];
}): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const username = input.username.trim().toLowerCase();
  if (!isValidUsername(username)) {
    return { ok: false, error: authError('usernameInvalid') };
  }
  if (!isValidPin(input.pin)) {
    return { ok: false, error: authError('pinInvalid') };
  }
  if (!input.name.trim()) {
    return { ok: false, error: authError('nameRequired') };
  }

  const settings = await db.storeSettings.toCollection().first();
  if (!settings?.deviceId) return { ok: false, error: authError('storeNotReady') };

  const existing = await db.users.where('username').equals(username).first();
  if (existing) return { ok: false, error: i18n.t('authErrors.usernameTaken', { ns: 'common', username }) as string };

  const pinHash = await hashPin(input.pin, settings.deviceId);
  const userId = await db.users.add({
    username,
    pinHash,
    name: input.name.trim(),
    role: input.role,
    permissions: input.role === 'owner' ? [] : input.permissions,
    isActive: 1,
    createdAt: new Date(),
    lastLoginAt: null,
  });

  return { ok: true, userId: userId as number };
}

export async function updateUserPin(userId: number, newPin: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPin(newPin)) return { ok: false, error: authError('pinInvalid') };
  const settings = await db.storeSettings.toCollection().first();
  if (!settings?.deviceId) return { ok: false, error: authError('storeNotReady') };
  const pinHash = await hashPin(newPin, settings.deviceId);
  await db.users.update(userId, { pinHash });
  return { ok: true };
}
