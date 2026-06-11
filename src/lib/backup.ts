import { db, type Product } from '@/lib/db';

/**
 * Shared backup/restore core, dipakai oleh:
 *  - export/import file lokal (Settings → Backup & Restore),
 *  - cloud backup (upload/download).
 *
 * Dipisah dari komponen UI supaya logika yang sama tidak terduplikasi.
 */

export const BACKUP_VERSION = 6;

// Bentuk longgar — file backup bisa berasal dari versi lama (v1–v5).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BackupData = Record<string, any> & { version?: number };

/** Kumpulkan seluruh isi database menjadi satu objek backup. */
export async function buildBackupData() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    suppliers: await db.suppliers.toArray(),
    customers: await db.customers.toArray(),
    stockIns: await db.stockIns.toArray(),
    stockOuts: await db.stockOuts.toArray(),
    hppHistory: await db.hppHistory.toArray(),
    paymentMethods: await db.paymentMethods.toArray(),
    transactions: await db.transactions.toArray(),
    transactionItems: await db.transactionItems.toArray(),
    storeSettings: await db.storeSettings.toArray(),
    users: await db.users.toArray(),
    units: await db.units.toArray(),
    expenseCategories: await db.expenseCategories.toArray(),
    expenses: await db.expenses.toArray(),
    shifts: await db.shifts.toArray(),
  };
}

/** Nama file backup standar, mis. freekasir-backup-2026-06-11.json */
export function backupFileName(date = new Date()): string {
  return `freekasir-backup-${date.toISOString().slice(0, 10)}.json`;
}

/** Bangun JSON string siap simpan/upload. */
export async function buildBackupJsonString(): Promise<string> {
  return JSON.stringify(await buildBackupData(), null, 2);
}

/**
 * Validasi isi file backup. Lempar Error dengan pesan siap-tampil bila tidak valid.
 */
export function validateBackupData(data: unknown): asserts data is BackupData {
  if (!data || typeof data !== 'object') throw new Error('File tidak valid');
  const d = data as BackupData;
  if (!d.version) throw new Error('File tidak valid');
  const hasSomeData = ['categories', 'products', 'suppliers', 'transactions', 'paymentMethods'].some(
    (key) => Array.isArray(d[key]) && d[key].length > 0,
  );
  if (!hasSomeData) throw new Error('File backup tidak berisi data');
}

async function clearAllTables(includeConditional: BackupData) {
  await db.categories.clear();
  await db.products.clear();
  await db.suppliers.clear();
  await db.stockIns.clear();
  await db.stockOuts.clear();
  await db.hppHistory.clear();
  await db.paymentMethods.clear();
  await db.transactions.clear();
  await db.transactionItems.clear();
  await db.storeSettings.clear();
  // Preserve user accounts when restoring older backups (v1–v3) tanpa tabel users.
  if (Array.isArray(includeConditional.users)) await db.users.clear();
  await db.units.clear();
  if (Array.isArray(includeConditional.expenseCategories) || Array.isArray(includeConditional.expenses)) {
    await db.expenseCategories.clear();
    await db.expenses.clear();
  }
  if (Array.isArray(includeConditional.customers)) await db.customers.clear();
  if (Array.isArray(includeConditional.shifts)) await db.shifts.clear();
}

/**
 * Restore database dari objek backup. Membuat snapshot dulu, dan otomatis
 * rollback bila terjadi error di tengah jalan. Lempar Error bila gagal total.
 */
export async function restoreFromBackupData(data: unknown): Promise<void> {
  validateBackupData(data);

  // Snapshot untuk rollback.
  const snapshot = {
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    suppliers: await db.suppliers.toArray(),
    customers: await db.customers.toArray(),
    stockIns: await db.stockIns.toArray(),
    stockOuts: await db.stockOuts.toArray(),
    hppHistory: await db.hppHistory.toArray(),
    paymentMethods: await db.paymentMethods.toArray(),
    transactions: await db.transactions.toArray(),
    transactionItems: await db.transactionItems.toArray(),
    storeSettings: await db.storeSettings.toArray(),
    users: await db.users.toArray(),
    units: await db.units.toArray(),
    expenseCategories: await db.expenseCategories.toArray(),
    expenses: await db.expenses.toArray(),
    shifts: await db.shifts.toArray(),
  };

  try {
    await clearAllTables(data);

    if (data.categories?.length) await db.categories.bulkAdd(data.categories);
    if (data.products?.length) {
      const normalizedProducts = (data.products as Product[]).map((p) =>
        p && p.trackStock === undefined ? { ...p, trackStock: true } : p,
      );
      await db.products.bulkAdd(normalizedProducts);
    }
    if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
    if (data.customers?.length) await db.customers.bulkAdd(data.customers);
    if (data.stockIns?.length) await db.stockIns.bulkAdd(data.stockIns);
    if (data.stockOuts?.length) await db.stockOuts.bulkAdd(data.stockOuts);
    if (data.hppHistory?.length) await db.hppHistory.bulkAdd(data.hppHistory);
    if (data.paymentMethods?.length) await db.paymentMethods.bulkAdd(data.paymentMethods);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
    if (data.storeSettings?.length) await db.storeSettings.bulkAdd(data.storeSettings);
    if (data.users?.length) await db.users.bulkAdd(data.users);
    if (data.expenseCategories?.length) await db.expenseCategories.bulkAdd(data.expenseCategories);
    if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses);
    if (data.shifts?.length) await db.shifts.bulkAdd(data.shifts);

    // Units (v3+ backup) atau diturunkan dari produk (backup v1/v2).
    if (Array.isArray(data.units) && data.units.length > 0) {
      await db.units.bulkAdd(data.units);
    } else {
      const now = new Date();
      const defaults = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
      const seen = new Set<string>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toAdd: any[] = [];
      for (const name of defaults) {
        seen.add(name);
        toAdd.push({ name, isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null });
      }
      if (Array.isArray(data.products)) {
        for (const p of data.products) {
          const u = (p?.unit as string | undefined)?.trim();
          if (!u || seen.has(u)) continue;
          seen.add(u);
          toAdd.push({ name: u, isDefault: 0, createdAt: now, isDeleted: 0, deletedAt: null });
        }
      }
      if (toAdd.length) await db.units.bulkAdd(toAdd);
    }

    // transactionItems (v2+) atau migrasi dari items[] embedded (v1).
    if (data.transactionItems?.length) {
      await db.transactionItems.bulkAdd(data.transactionItems);
    } else if (data.version === 1 && data.transactions?.length) {
      for (const t of data.transactions) {
        if (Array.isArray(t.items) && t.items.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const records = t.items.map((item: any) => ({
            transactionId: t.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            hpp: item.hpp,
            discountType: item.discountType,
            discountValue: item.discountValue,
            discountAmount: item.discountAmount,
            subtotal: item.subtotal,
          }));
          await db.transactionItems.bulkAdd(records);
        }
      }
    }
  } catch (importErr) {
    // Rollback ke snapshot.
    try {
      await db.categories.clear(); await db.products.clear(); await db.suppliers.clear();
      await db.stockIns.clear(); await db.stockOuts.clear(); await db.hppHistory.clear();
      await db.paymentMethods.clear(); await db.transactions.clear(); await db.transactionItems.clear();
      await db.storeSettings.clear();
      await db.users.clear();
      await db.units.clear();
      await db.expenseCategories.clear();
      await db.expenses.clear();
      await db.customers.clear();
      await db.shifts.clear();

      if (snapshot.categories.length) await db.categories.bulkAdd(snapshot.categories);
      if (snapshot.products.length) await db.products.bulkAdd(snapshot.products);
      if (snapshot.suppliers.length) await db.suppliers.bulkAdd(snapshot.suppliers);
      if (snapshot.customers.length) await db.customers.bulkAdd(snapshot.customers);
      if (snapshot.stockIns.length) await db.stockIns.bulkAdd(snapshot.stockIns);
      if (snapshot.stockOuts.length) await db.stockOuts.bulkAdd(snapshot.stockOuts);
      if (snapshot.hppHistory.length) await db.hppHistory.bulkAdd(snapshot.hppHistory);
      if (snapshot.paymentMethods.length) await db.paymentMethods.bulkAdd(snapshot.paymentMethods);
      if (snapshot.transactions.length) await db.transactions.bulkAdd(snapshot.transactions);
      if (snapshot.transactionItems.length) await db.transactionItems.bulkAdd(snapshot.transactionItems);
      if (snapshot.storeSettings.length) await db.storeSettings.bulkAdd(snapshot.storeSettings);
      if (snapshot.users.length) await db.users.bulkAdd(snapshot.users);
      if (snapshot.units.length) await db.units.bulkAdd(snapshot.units);
      if (snapshot.expenseCategories.length) await db.expenseCategories.bulkAdd(snapshot.expenseCategories);
      if (snapshot.expenses.length) await db.expenses.bulkAdd(snapshot.expenses);
      if (snapshot.shifts.length) await db.shifts.bulkAdd(snapshot.shifts);
    } catch {
      throw new Error('Import gagal dan rollback gagal. Coba restore dari file backup.');
    }
    throw new Error('Import gagal, data dikembalikan');
  }
}
