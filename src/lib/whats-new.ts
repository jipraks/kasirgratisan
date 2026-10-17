import { Wallet, AlertTriangle, Infinity as InfinityIcon, Users as UsersIcon, FileSpreadsheet, PackageSearch, Sparkles, Printer, HandCoins, Receipt, ClipboardCheck, LayoutGrid, type LucideIcon } from 'lucide-react';
import { db } from './db';

/**
 * Static catalog of "What's New" announcements.
 * All texts (titles, descriptions, and CTA labels) are localized in translation files
 * under the `whatsNewFeatures.[id]` key path.
 *
 * IMPORTANT:
 *  - Each `id` MUST be unique and MUST NEVER change once shipped.
 *  - Order this array newest-first so the modal slideshow starts with the most recent entry.
 */

export interface WhatsNewFeature {
  id: string;
  icon: LucideIcon;
  /** Tailwind class pair, e.g. "text-warning bg-warning/10" */
  iconColor: string;
  publishedAt: string; // ISO date (YYYY-MM-DD), display only
  cta?: {
    to: string; // internal route
  };
}

export const FEATURES: WhatsNewFeature[] = [
  {
    id: '2026-06-kitchen-ticket',
    icon: Printer,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-30',
    cta: { to: '/cashier' },
  },
  {
    id: '2026-06-cashier-layout',
    icon: LayoutGrid,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-21',
    cta: { to: '/settings' },
  },
  {
    id: '2026-06-import-excel',
    icon: FileSpreadsheet,
    iconColor: 'text-success bg-success/10',
    publishedAt: '2026-06-20',
    cta: { to: '/products' },
  },
  {
    id: '2026-06-stock-opname',
    icon: ClipboardCheck,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-18',
    cta: { to: '/settings/stock-opname' },
  },
  {
    id: '2026-06-receipt-footer',
    icon: Receipt,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-18',
    cta: { to: '/settings/receipt' },
  },
  {
    id: '2026-06-customer-debts',
    icon: HandCoins,
    iconColor: 'text-warning bg-warning/10',
    publishedAt: '2026-06-15',
    cta: { to: '/debts' },
  },
  {
    id: '2026-06-print-daily-closing',
    icon: Printer,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-15',
    cta: { to: '/reports' },
  },
  {
    id: '2026-06-rebrand-freekasir',
    icon: Sparkles,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-06-11',
    cta: { to: '/settings/theme' },
  },
  {
    id: '2026-06-stock-search-scan',
    icon: PackageSearch,
    iconColor: 'text-success bg-success/10',
    publishedAt: '2026-06-10',
    cta: { to: '/stock-in' },
  },
  {
    id: '2026-06-export-excel',
    icon: FileSpreadsheet,
    iconColor: 'text-success bg-success/10',
    publishedAt: '2026-06-09',
    cta: { to: '/reports' },
  },
  {
    id: '2026-05-customers',
    icon: UsersIcon,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-05-30',
    cta: { to: '/customers' },
  },
  {
    id: '2026-05-unmanaged-stock',
    icon: InfinityIcon,
    iconColor: 'text-primary bg-primary/10',
    publishedAt: '2026-05-29',
    cta: { to: '/products' },
  },
  {
    id: '2026-05-expense-tracking',
    icon: Wallet,
    iconColor: 'text-warning bg-warning/10',
    publishedAt: '2026-05-25',
    cta: { to: '/expenses' },
  },
  {
    id: '2026-05-error-boundary',
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
