import Dexie, { type Table } from 'dexie';

// === Permission keys (CR-multiuser) ===
export type PermissionKey =
  | 'create_transaction'
  | 'delete_transaction'
  | 'manage_products'
  | 'manage_categories_payments'
  | 'manage_stock_inout'
  | 'manage_supplier'
  | 'view_reports'
  | 'manage_backup'
  | 'manage_store_settings'
  | 'manage_expenses'
  | 'view_expenses';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'create_transaction',
  'delete_transaction',
  'manage_products',
  'manage_categories_payments',
  'manage_stock_inout',
  'manage_supplier',
  'view_reports',
  'manage_backup',
  'manage_store_settings',
  'manage_expenses',
  'view_expenses',
];

// === Interfaces ===

export interface User {
  id?: number;
  username: string;       // unique, lowercase
  pinHash: string;        // SHA-256 hex
  name: string;           // display name
  role: 'owner' | 'staff';
  permissions: PermissionKey[]; // owner ignores this (has all)
  isActive: number;       // 0/1 — IndexedDB can't index booleans
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted (IndexedDB can't index booleans)
  deletedAt: Date | null;
}

export interface Product {
  id?: number;
  name: string;
  sku: string;
  categoryId: number;
  price: number; // harga jual
  hpp: number; // harga pokok penjualan
  stock: number;
  unit: string; // satuan: pcs, kg, liter, dll
  description?: string; // deskripsi/catatan produk (opsional, multi-line)
  photo?: string; // base64 or blob URL
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
  createdBy?: number; // userId (optional — undefined for legacy/single-user mode)
  updatedBy?: number; // userId
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface StockIn {
  id?: number;
  productId: number;
  supplierId: number;
  quantity: number;
  buyPrice: number; // harga beli per unit
  totalPrice: number;
  date: Date;
  notes: string;
  createdBy?: number; // userId
}

export interface StockOut {
  id?: number;
  productId: number;
  quantity: number;
  reason: string; // rusak, hilang, retur, dll
  date: Date;
  notes: string;
  createdBy?: number; // userId
}

export interface HppHistory {
  id?: number;
  productId: number;
  oldHpp: number;
  newHpp: number;
  source: 'stock_in' | 'manual';
  date: Date;
}

export interface PaymentMethod {
  id?: number;
  name: string;
  category: string; // tunai, transfer, e-wallet, qris
  isDefault: boolean;
  createdAt: Date;
}

export interface Transaction {
  id?: number;
  subtotal: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethodId: number;
  paymentAmount: number;
  change: number;
  profit: number;
  date: Date;
  receiptNumber: string;
  status: 'open' | 'completed';
  orderNumber?: string;
  customerName?: string;
  tableNumber?: string;
  remarks?: string;
  openedAt?: Date;
  closedAt?: Date;
  createdBy?: number; // userId — kasir pembuat transaksi
}

export interface TransactionItemRecord {
  id?: number;
  transactionId: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  hpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
  notes?: string;
}

export interface Unit {
  id?: number;
  name: string; // satuan: pcs, kg, liter, dll
  isDefault: number; // 0 = user-added, 1 = seeded default
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface ExpenseCategory {
  id?: number;
  name: string;        // "Listrik", "Gaji", "Sewa", "Transport", dll
  color: string;       // hex
  icon: string;        // emoji
  isDefault: number;   // 0 = user-added, 1 = seeded default
  createdAt: Date;
  isDeleted: number;   // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface Expense {
  id?: number;
  title: string;                   // "Bayar listrik bulan Mei"
  categoryId: number;              // FK -> expenseCategories
  amount: number;
  paymentMethodId: number;         // FK -> paymentMethods
  date: Date;                      // tanggal kejadian (cashflow basis)
  notes?: string;
  createdAt: Date;
  createdBy?: number;              // userId
  isDeleted: number;               // 0 = active, 1 = deleted
  deletedAt: Date | null;
}

export interface StoreSettings {
  id?: number;
  storeName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  onboardingDone: boolean;
  lastBackupAt: Date | null;
  themeColor?: string; // HSL hue string e.g. "25" for orange
  logo?: string; // base64 JPEG compressed via compressImage()
  deviceId: string;
  multiUserEnabled?: boolean; // CR-multiuser: opt-in flag
  seenWhatsNewIds?: string[]; // IDs of "What's New" features the user has dismissed
}

// === Database ===

class PosDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;
  suppliers!: Table<Supplier>;
  stockIns!: Table<StockIn>;
  stockOuts!: Table<StockOut>;
  hppHistory!: Table<HppHistory>;
  paymentMethods!: Table<PaymentMethod>;
  transactions!: Table<Transaction>;
  transactionItems!: Table<TransactionItemRecord>;
  storeSettings!: Table<StoreSettings>;
  users!: Table<User>;
  units!: Table<Unit>;
  expenseCategories!: Table<ExpenseCategory>;
  expenses!: Table<Expense>;

  constructor() {
    super('kasirgratisan-db');

    // Version 1 — original schema (must remain for migration path)
    this.version(1).stores({
      categories: '++id, name',
      products: '++id, name, sku, categoryId, barcode',
      suppliers: '++id, name',
      stockIns: '++id, productId, supplierId, date',
      stockOuts: '++id, productId, date',
      hppHistory: '++id, productId, date',
      paymentMethods: '++id, name, category',
      transactions: '++id, date, receiptNumber, paymentMethodId',
      storeSettings: '++id',
    });

    // Version 2 — CR-1 to CR-5
    this.version(2).stores({
      categories: '++id, name, isDeleted',
      products: '++id, name, sku, categoryId, barcode, isDeleted',
      suppliers: '++id, name, isDeleted',
      stockIns: '++id, productId, supplierId, date',
      stockOuts: '++id, productId, date',
      hppHistory: '++id, productId, date',
      paymentMethods: '++id, name, category',
      transactions: '++id, date, &receiptNumber, paymentMethodId',
      transactionItems: '++id, transactionId, productId',
      storeSettings: '++id',
    }).upgrade(async (tx) => {
      // CR-2: Set soft delete defaults on existing records
      const catTable = tx.table('categories');
      await catTable.toCollection().modify((cat: any) => {
        cat.isDeleted = 0;
        cat.deletedAt = null;
      });

      const prodTable = tx.table('products');
      await prodTable.toCollection().modify((prod: any) => {
        prod.isDeleted = 0;
        prod.deletedAt = null;
      });

      const supTable = tx.table('suppliers');
      await supTable.toCollection().modify((sup: any) => {
        sup.isDeleted = 0;
        sup.deletedAt = null;
      });

      // CR-1: Generate deviceId for existing storeSettings
      const storeTable = tx.table('storeSettings');
      await storeTable.toCollection().modify((s: any) => {
        s.deviceId = crypto.randomUUID();
      });

      // CR-5: Migrate embedded items[] from transactions to transactionItems table
      const txTable = tx.table('transactions');
      const itemsTable = tx.table('transactionItems');
      const allTx = await txTable.toArray();

      for (const t of allTx) {
        const items = (t as any).items;
        if (Array.isArray(items) && items.length > 0) {
          const records = items.map((item: any) => ({
            transactionId: t.id!,
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
          await itemsTable.bulkAdd(records);
        }
        // Remove embedded items field
        delete (t as any).items;
        await txTable.put(t);
      }
    });

    // Version 3 — Open Bill: status, orderNumber, customer/table, item notes
    this.version(3).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    }).upgrade(async (tx) => {
      // Set all existing transactions to 'completed' status
      await tx.table('transactions').toCollection().modify((t: any) => {
        t.status = 'completed';
      });
    });

    // Version 4 — SKU unique constraint
    this.version(4).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
    }).upgrade(async (tx) => {
      // Deduplicate SKUs before applying unique constraint
      const prodTable = tx.table('products');
      const allProducts = await prodTable.toArray();
      const seenSku = new Map<string, number>(); // sku -> first occurrence index

      for (const p of allProducts) {
        const sku = (p as any).sku as string | undefined;
        if (!sku || sku.trim() === '') continue;

        if (seenSku.has(sku)) {
          // Duplicate SKU found — append suffix to make unique
          let counter = 1;
          let newSku = `${sku}_dup${counter}`;
          while (seenSku.has(newSku)) {
            counter++;
            newSku = `${sku}_dup${counter}`;
          }
          seenSku.set(newSku, (p as any).id);
          await prodTable.update((p as any).id!, { sku: newSku });
        } else {
          seenSku.set(sku, (p as any).id);
        }
      }
    });

    // Version 5 — Units master table (CRUD-able from Settings)
    this.version(5).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date',
      stockOuts:        '++id, productId, date',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
      units:            '++id, &name, isDeleted',
    }).upgrade(async (tx) => {
      // Seed default units + harvest unique units already used by products
      const unitsTable = tx.table('units');
      const prodTable = tx.table('products');
      const now = new Date();

      const defaults = ['pcs', 'kg', 'gram', 'liter', 'ml', 'porsi', 'cup', 'botol', 'bungkus'];
      const seen = new Set<string>();

      for (const name of defaults) {
        seen.add(name);
        await unitsTable.add({
          name,
          isDefault: 1,
          createdAt: now,
          isDeleted: 0,
          deletedAt: null,
        });
      }

      // Harvest custom units already used by existing products (e.g. 'mangkok', 'gelas')
      const allProducts = await prodTable.toArray();
      for (const p of allProducts) {
        const u = ((p as any).unit as string | undefined)?.trim();
        if (!u) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        try {
          await unitsTable.add({
            name: u,
            isDefault: 0,
            createdAt: now,
            isDeleted: 0,
            deletedAt: null,
          });
        } catch {
          // ignore unique-constraint races
        }
      }
    });

    // Version 6 — Multi-user (opt-in) + audit trail (createdBy/updatedBy)
    // Notes:
    //   * `users` is a NEW table; existing data is untouched.
    //   * No createdBy/updatedBy is back-filled — existing rows keep undefined,
    //     UI handles that as "—" (legacy).
    //   * `multiUserEnabled` defaults to false → app behaves exactly like before
    //     until owner activates the feature from Settings.
    this.version(6).stores({
      categories:       '++id, name, isDeleted',
      products:         '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
      suppliers:        '++id, name, isDeleted',
      stockIns:         '++id, productId, supplierId, date, createdBy',
      stockOuts:        '++id, productId, date, createdBy',
      hppHistory:       '++id, productId, date',
      paymentMethods:   '++id, name, category',
      transactions:     '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, createdBy',
      transactionItems: '++id, transactionId, productId',
      storeSettings:    '++id',
      units:            '++id, &name, isDeleted',
      users:            '++id, &username, role, isActive',
    }).upgrade(async (tx) => {
      // Default multiUserEnabled = false on existing storeSettings
      const storeTable = tx.table('storeSettings');
      await storeTable.toCollection().modify((s: Partial<StoreSettings>) => {
        if (s.multiUserEnabled === undefined) s.multiUserEnabled = false;
      });
    });

    // Version 7 — Expense tracking (separate from StockIn)
    // Notes:
    //   * Two new tables: `expenseCategories` and `expenses`.
    //   * Default categories are seeded in seedDefaultData() so users that
    //     already migrated past v7 still get them on first run.
    //   * Existing data is untouched.
    this.version(7).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
      suppliers:         '++id, name, isDeleted',
      stockIns:          '++id, productId, supplierId, date, createdBy',
      stockOuts:         '++id, productId, date, createdBy',
      hppHistory:        '++id, productId, date',
      paymentMethods:    '++id, name, category',
      transactions:      '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, createdBy',
      transactionItems:  '++id, transactionId, productId',
      storeSettings:     '++id',
      units:             '++id, &name, isDeleted',
      users:             '++id, &username, role, isActive',
      expenseCategories: '++id, name, isDeleted',
      expenses:          '++id, date, categoryId, paymentMethodId, createdBy, isDeleted',
    });

    // Version 8 — "What's New" tracking
    // Notes:
    //   * Pure data migration; schema (indexes) unchanged.
    //   * Default `seenWhatsNewIds = []` for existing rows so the announcement
    //     modal will show all current entries to existing users on first launch
    //     after upgrade — which is exactly what we want.
    this.version(8).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
      suppliers:         '++id, name, isDeleted',
      stockIns:          '++id, productId, supplierId, date, createdBy',
      stockOuts:         '++id, productId, date, createdBy',
      hppHistory:        '++id, productId, date',
      paymentMethods:    '++id, name, category',
      transactions:      '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, createdBy',
      transactionItems:  '++id, transactionId, productId',
      storeSettings:     '++id',
      units:             '++id, &name, isDeleted',
      users:             '++id, &username, role, isActive',
      expenseCategories: '++id, name, isDeleted',
      expenses:          '++id, date, categoryId, paymentMethodId, createdBy, isDeleted',
    }).upgrade(async (tx) => {
      const storeTable = tx.table('storeSettings');
      await storeTable.toCollection().modify((s: Partial<StoreSettings>) => {
        if (!Array.isArray(s.seenWhatsNewIds)) s.seenWhatsNewIds = [];
      });
    });
  }
}

export const db = new PosDatabase();

// Seed default data
export async function seedDefaultData() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd([
      { name: 'Makanan', color: '#FF6B35', icon: '🍕', createdAt: new Date(), isDeleted: 0, deletedAt: null },
      { name: 'Minuman', color: '#4ECDC4', icon: '🥤', createdAt: new Date(), isDeleted: 0, deletedAt: null },
      { name: 'Lainnya', color: '#95A5A6', icon: '📦', createdAt: new Date(), isDeleted: 0, deletedAt: null },
    ]);
  }

  const pmCount = await db.paymentMethods.count();
  if (pmCount === 0) {
    await db.paymentMethods.bulkAdd([
      { name: 'Tunai', category: 'tunai', isDefault: true, createdAt: new Date() },
      { name: 'Transfer Bank', category: 'transfer', isDefault: false, createdAt: new Date() },
      { name: 'QRIS', category: 'qris', isDefault: false, createdAt: new Date() },
    ]);
  }

  const unitCount = await db.units.count();
  if (unitCount === 0) {
    const now = new Date();
    await db.units.bulkAdd([
      { name: 'pcs',     isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'kg',      isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'gram',    isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'liter',   isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'ml',      isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'porsi',   isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'cup',     isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'botol',   isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'bungkus', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
    ]);
  }

  const storeCount = await db.storeSettings.count();
  if (storeCount === 0) {
    await db.storeSettings.add({
      storeName: 'Toko Saya',
      address: '',
      phone: '',
      receiptFooter: 'Terima kasih atas kunjungan Anda!',
      onboardingDone: false,
      lastBackupAt: null,
      deviceId: crypto.randomUUID(),
    });
  } else {
    // Fallback: if storeSettings exists but has no deviceId, generate one
    const settings = await db.storeSettings.toCollection().first();
    if (settings && !settings.deviceId) {
      await db.storeSettings.update(settings.id!, { deviceId: crypto.randomUUID() });
    }
  }

  // Seed default expense categories (idempotent — runs only when empty)
  const expenseCatCount = await db.expenseCategories.count();
  if (expenseCatCount === 0) {
    const now = new Date();
    await db.expenseCategories.bulkAdd([
      { name: 'Listrik & Air',  color: '#FBBF24', icon: '💡', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Sewa',           color: '#8B5CF6', icon: '🏠', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Gaji',           color: '#10B981', icon: '👤', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Transport',      color: '#3B82F6', icon: '🚚', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Operasional',    color: '#F97316', icon: '🧰', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Lainnya',        color: '#6B7280', icon: '📦', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
    ]);
  }
}
