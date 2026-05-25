import { Wallet, AlertTriangle, type LucideIcon } from 'lucide-react';
import { db } from './db';

/**
 * Static catalog of "What's New" announcements.
 *
 * IMPORTANT:
 *  - Each `id` MUST be unique and MUST NEVER change once shipped — once a user
 *    dismisses an entry, that id is recorded in their storeSettings. Renaming
 *    the id will cause the entry to reappear.
 *  - Order this array newest-first so the modal slideshow starts with the
 *    most recent entry.
 *  - Date prefix in `id` (YYYY-MM-...) keeps things human-sortable in the DB.
 */

export interface WhatsNewFeature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind class pair, e.g. "text-warning bg-warning/10" */
  iconColor: string;
  publishedAt: string; // ISO date (YYYY-MM-DD), display only
  cta?: {
    label: string;
    to: string; // internal route
  };
}

export const FEATURES: WhatsNewFeature[] = [
  {
    id: '2026-05-expense-tracking',
    title: 'Pencatatan Pengeluaran',
    description:
      'Catat biaya operasional toko (listrik, gaji, sewa, dll) dan lihat laba bersih sesungguhnya di laporan. Cashflow toko jadi lengkap dalam satu app.',
    icon: Wallet,
    iconColor: 'text-warning bg-warning/10',
    publishedAt: '2026-05-25',
    cta: { label: 'Coba Sekarang', to: '/expenses' },
  },
  {
    id: '2026-05-error-boundary',
    title: 'Pesan Error yang Lebih Jelas',
    description:
      'Kalau aplikasi mengalami error, sekarang muncul pesan dan detail yang bisa kamu salin untuk dilaporkan ke developer. Tidak ada lagi blank screen tanpa info.',
    icon: AlertTriangle,
    iconColor: 'text-destructive bg-destructive/10',
    publishedAt: '2026-05-24',
  },
];

/** All feature ids currently shipped — useful for "mark all seen" flows. */
export const ALL_FEATURE_IDS: string[] = FEATURES.map((f) => f.id);

/** Returns the FEATURES the user has not dismissed yet, ordered newest-first. */
export function getUnseenFeatures(seenIds: string[] | undefined): WhatsNewFeature[] {
  const seen = new Set(seenIds ?? []);
  return FEATURES.filter((f) => !seen.has(f.id));
}

/** Persist all current ids as seen. Idempotent. */
export async function markAllFeaturesSeen(): Promise<void> {
  const settings = await db.storeSettings.toCollection().first();
  if (!settings?.id) return;
  const seen = new Set(settings.seenWhatsNewIds ?? []);
  for (const id of ALL_FEATURE_IDS) seen.add(id);
  await db.storeSettings.update(settings.id, { seenWhatsNewIds: Array.from(seen) });
}

/** Persist specific ids as seen. Used after the modal is dismissed. */
export async function markFeaturesSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const settings = await db.storeSettings.toCollection().first();
  if (!settings?.id) return;
  const seen = new Set(settings.seenWhatsNewIds ?? []);
  for (const id of ids) seen.add(id);
  await db.storeSettings.update(settings.id, { seenWhatsNewIds: Array.from(seen) });
}
