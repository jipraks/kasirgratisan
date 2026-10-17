import Dexie, { type Table } from 'dexie';

// === Permission keys (CR-multiuser) ===
export type PermissionKey =
  | 'create_transaction'
  | 'delete_transaction'
  | 'manage_products'
  | 'manage_categories_payments'
  | 'manage_stock_inout'
  | 'manage_supplier'
  | 'manage_customers'
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
  'manage_customers',
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
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted (IndexedDB can't index booleans)
  deletedAt: Date | null;
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface Product {
  id?: number;
  name: string;
  sku: string;
  categoryId: number;
  price: number; // harga jual
  hpp: number; // harga pokok penjualan
  stock: number;
  trackStock?: boolean; // true/undefined = stok dikelola (default lama), false = stok tidak dikelola (selalu tersedia)
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
  syncedAt?: Date | null;
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
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: Date;
  isDeleted: number; // 0 = active, 1 = deleted
  deletedAt: Date | null;
  updatedAt?: Date;
  syncedAt?: Date | null;
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
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface StockOut {
  id?: number;
  productId: number;
  quantity: number;
  reason: string; // rusak, hilang, retur, opname, dll
  date: Date;
  notes: string;
  createdBy?: number; // userId
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface StockOpname {
  id?: number;
  date: Date;
  status: 'draft' | 'completed';
  notes?: string;
  createdBy?: number; // userId
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface StockOpnameItem {
  id?: number;
  opnameId: number;
  productId: number;
  systemStock: number;
  realStock: number;
  difference: number;
}

export interface HppHistory {
  id?: number;
  productId: number;
  oldHpp: number;
  newHpp: number;
  source: 'stock_in' | 'manual';
  date: Date;
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface PaymentMethod {
  id?: number;
  name: string;
  category: string; // tunai, transfer, e-wallet, qris
  isDefault: boolean;
  createdAt: Date;
  updatedAt?: Date;
  syncedAt?: Date | null;
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
  customerId?: number; // relasi ke master pelanggan (opsional)
  customerName?: string; // snapshot nama saat transaksi (tahan terhadap edit/hapus master)
  tableNumber?: string;
  remarks?: string;
  openedAt?: Date;
  closedAt?: Date;
  createdBy?: number; // userId — kasir pembuat transaksi
  debtAmount?: number; // snapshot hutang awal; 0/undefined = lunas saat checkout
  updatedAt?: Date;
  syncedAt?: Date | null;
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
  updatedAt?: Date;
  syncedAt?: Date | null;
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
  updatedAt?: Date;
  syncedAt?: Date | null;
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
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface Debt {
  id?: number;
  transactionId: number;
  customerId: number;
  customerName: string;
  originalAmount: number;
  remainingAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  createdAt: Date;
  settledAt: Date | null;
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface DebtPayment {
  id?: number;
  debtId: number;
  amount: number;
  paymentMethodId: number;
  date: Date;
  notes?: string;
  createdBy?: number;
  updatedAt?: Date;
  syncedAt?: Date | null;
}

export interface DeletedRecord {
  id?: number;
  tableName: string;
  recordId: number | string;
  deletedAt: Date;
  syncedAt: Date | null;
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
  cloudAutoBackupInterval?: 'off' | 'hourly' | 'daily' | 'weekly'; // auto cloud backup cadence (default off)
  cloudAutoBackupHours?: number; // interval jam bila cloudAutoBackupInterval === 'hourly'
  lastCloudBackupAt?: Date | null; // last successful upload to cloud
  allowDebt?: boolean; // opt-in pembayaran sebagian/seluruhnya sebagai hutang
  cloudStoreId?: string | null; // cloud store ID yang di-bind ke device ini untuk sync
  printLogo?: boolean; // toggle to print store logo on ESC/POS receipt
  hideWatermark?: boolean; // toggle to hide FreeKasir.com credit/watermark on ESC/POS receipt
}

// === Database ===

class PosDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;
  suppliers!: Table<Supplier>;
  customers!: Table<Customer>;
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
  debts!: Table<Debt>;
  debtPayments!: Table<DebtPayment>;
  stockOpnames!: Table<StockOpname>;
  stockOpnameItems!: Table<StockOpnameItem>;
  deletedRecords!: Table<DeletedRecord>;

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

    // Version 9 — Produk tanpa stok ("Unmanaged Stock")
    // Notes:
    //   * `trackStock` ditambahkan ke setiap produk lama dengan nilai `true`
    //     sehingga perilaku persis sama seperti sebelumnya (stok dikelola).
    //   * Schema (indexes) tidak berubah; ini murni back-fill data.
    //   * Pembacaan di UI memakai pola `trackStock !== false` agar produk yang
    //     entah kenapa belum ter-migrasi (undefined) tetap dianggap "managed".
    this.version(9).stores({
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
      const prodTable = tx.table('products');
      await prodTable.toCollection().modify((p: Partial<Product>) => {
        if (p.trackStock === undefined) p.trackStock = true;
      });
    });

    // Version 10 — Master Pelanggan (Customers)
    // Notes:
    //   * Tabel `customers` BARU; data lama tidak disentuh.
    //   * `customerId` ditambahkan ke transactions (opsional) — tidak di-index
    //     karena query pelanggan-per-transaksi belum diperlukan. `customerName`
    //     snapshot yang sudah ada tetap dipertahankan.
    //   * Tidak ada back-fill: transaksi lama tetap punya customerId undefined.
    this.version(10).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
      suppliers:         '++id, name, isDeleted',
      customers:         '++id, name, isDeleted',
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

    // Version 11 - Customer debt and immutable installment payments.
    this.version(11).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
      suppliers:         '++id, name, isDeleted',
      customers:         '++id, name, isDeleted',
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
      debts:             '++id, &transactionId, customerId, status, createdAt',
      debtPayments:      '++id, debtId, date, paymentMethodId, createdBy',
    }).upgrade(async (tx) => {
      await tx.table('storeSettings').toCollection().modify((s: Partial<StoreSettings>) => {
        if (s.allowDebt === undefined) s.allowDebt = false;
      });
    });

    // Version 12 - Add unit index to products table for units management renaming/deletion checks.
    this.version(12).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy, unit',
      suppliers:         '++id, name, isDeleted',
      customers:         '++id, name, isDeleted',
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
      debts:             '++id, &transactionId, customerId, status, createdAt',
      debtPayments:      '++id, debtId, date, paymentMethodId, createdBy',
    });

    // Version 13 - Add StockOpname tables.
    this.version(13).stores({
      categories:        '++id, name, isDeleted',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy, unit',
      suppliers:         '++id, name, isDeleted',
      customers:         '++id, name, isDeleted',
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
      debts:             '++id, &transactionId, customerId, status, createdAt',
      debtPayments:      '++id, debtId, date, paymentMethodId, createdBy',
      stockOpnames:      '++id, date, status, createdBy',
      stockOpnameItems:  '++id, opnameId, productId, [opnameId+productId]',
    });

    // Version 14 - Add sync audit columns (updatedAt, syncedAt) & deletedRecords table
    this.version(14).stores({
      categories:        '++id, name, isDeleted, updatedAt, syncedAt',
      products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy, unit, updatedAt, syncedAt',
      suppliers:         '++id, name, isDeleted, updatedAt, syncedAt',
      customers:         '++id, name, isDeleted, updatedAt, syncedAt',
      stockIns:          '++id, productId, supplierId, date, createdBy, updatedAt, syncedAt',
      stockOuts:         '++id, productId, date, createdBy, updatedAt, syncedAt',
      hppHistory:        '++id, productId, date, syncedAt',
      paymentMethods:    '++id, name, category, updatedAt, syncedAt',
      transactions:      '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, createdBy, updatedAt, syncedAt',
      transactionItems:  '++id, transactionId, productId',
      storeSettings:     '++id',
      units:             '++id, &name, isDeleted, updatedAt, syncedAt',
      users:             '++id, &username, role, isActive, updatedAt, syncedAt',
      expenseCategories: '++id, name, isDeleted, updatedAt, syncedAt',
      expenses:          '++id, date, categoryId, paymentMethodId, createdBy, isDeleted, updatedAt, syncedAt',
      debts:             '++id, &transactionId, customerId, status, createdAt, updatedAt, syncedAt',
      debtPayments:      '++id, debtId, date, paymentMethodId, createdBy, updatedAt, syncedAt',
      stockOpnames:      '++id, date, status, createdBy, updatedAt, syncedAt',
      stockOpnameItems:  '++id, opnameId, productId, [opnameId+productId]',
      deletedRecords:    '++id, tableName, recordId, deletedAt, syncedAt',
    }).upgrade(async (tx) => {
      const now = new Date();
      const backfillTable = async (tableName: string, dateFields: string[]) => {
        const table = tx.table(tableName);
        await table.toCollection().modify((record: any) => {
          if (!record.updatedAt) {
            let baseDate = now;
            for (const field of dateFields) {
              if (record[field]) {
                const parsed = new Date(record[field]);
                if (!isNaN(parsed.getTime())) {
                  baseDate = parsed;
                  break;
                }
              }
            }
            record.updatedAt = baseDate;
          }
          if (record.syncedAt === undefined) {
            record.syncedAt = null;
          }
        });
      };

      await backfillTable('categories', ['createdAt']);
      await backfillTable('products', ['updatedAt', 'createdAt']);
      await backfillTable('suppliers', ['createdAt']);
      await backfillTable('customers', ['createdAt']);
      await backfillTable('stockIns', ['date']);
      await backfillTable('stockOuts', ['date']);
      
      await tx.table('hppHistory').toCollection().modify((record: any) => {
        if (record.syncedAt === undefined) record.syncedAt = null;
      });

      await backfillTable('paymentMethods', ['createdAt']);
      await backfillTable('transactions', ['date', 'openedAt', 'closedAt']);
      await backfillTable('units', ['createdAt']);
      await backfillTable('users', ['createdAt']);
      await backfillTable('expenseCategories', ['createdAt']);
      await backfillTable('expenses', ['date', 'createdAt']);
      await backfillTable('debts', ['createdAt']);
      await backfillTable('debtPayments', ['date']);
      await backfillTable('stockOpnames', ['date']);
    });
  }
}

export const db = new PosDatabase();
setupTimestampHooks(db);

// Apakah stok produk dikelola? `undefined`/`true` = dikelola (perilaku lama),
// `false` = tidak dikelola (produk selalu tersedia, stok diabaikan).
export function isStockManaged(product: Pick<Product, 'trackStock'>): boolean {
  return product.trackStock !== false;
}

async function sanitizeTableDates(table: any, dateFields: string[]) {
  try {
    await table.toCollection().modify((record: any) => {
      let changed = false;
      for (const field of dateFields) {
        if (record[field] !== undefined && record[field] !== null && typeof record[field] === 'string') {
          const parsed = new Date(record[field]);
          if (!isNaN(parsed.getTime())) {
            record[field] = parsed;
            changed = true;
          }
        }
      }
    });
  } catch (err) {
    console.error(`Failed to sanitize table ${table.name || 'unknown'} dates:`, err);
  }
}

export async function sanitizeDatabaseDates() {
  await sanitizeTableDates(db.categories, ['createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.products, ['createdAt', 'updatedAt', 'deletedAt', 'syncedAt']);
  await sanitizeTableDates(db.suppliers, ['createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.customers, ['createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.stockIns, ['date', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.stockOuts, ['date', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.hppHistory, ['date', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.paymentMethods, ['createdAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.transactions, ['date', 'openedAt', 'closedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.users, ['createdAt', 'lastLoginAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.units, ['createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.expenseCategories, ['createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.expenses, ['date', 'createdAt', 'deletedAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.debts, ['createdAt', 'settledAt', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.debtPayments, ['date', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.stockOpnames, ['date', 'updatedAt', 'syncedAt']);
  await sanitizeTableDates(db.deletedRecords, ['deletedAt', 'syncedAt']);
  await sanitizeTableDates(db.storeSettings, ['lastBackupAt', 'lastCloudBackupAt']);
}

export function setupTimestampHooks(db: PosDatabase) {
  const timestampedTables = [
    'categories',
    'products',
    'suppliers',
    'customers',
    'units',
    'paymentMethods',
    'users',
    'expenseCategories',
    'expenses',
    'transactions',
    'stockIns',
    'stockOuts',
    'hppHistory',
    'debts',
    'debtPayments',
    'stockOpnames'
  ];

  timestampedTables.forEach((tableName) => {
    const table = db.table(tableName);

    table.hook('creating', (_primKey, obj) => {
      if (!obj.updatedAt) {
        obj.updatedAt = new Date();
      }
    });

    table.hook('updating', (mods) => {
      if ((mods as { updatedAt?: unknown }).updatedAt !== undefined) {
        return;
      }
      return { ...mods, updatedAt: new Date() };
    });
  });
}

// Seed default data
export async function seedDefaultData() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd([
      { name: 'Comidas', color: '#FF6B35', icon: '🍕', createdAt: new Date(), isDeleted: 0, deletedAt: null },
      { name: 'Bebidas', color: '#4ECDC4', icon: '🥤', createdAt: new Date(), isDeleted: 0, deletedAt: null },
      { name: 'Otros', color: '#95A5A6', icon: '📦', createdAt: new Date(), isDeleted: 0, deletedAt: null },
    ]);
  }

  const pmCount = await db.paymentMethods.count();
  if (pmCount === 0) {
    await db.paymentMethods.bulkAdd([
      { name: 'Efectivo', category: 'tunai', isDefault: true, createdAt: new Date() },
      { name: 'Transferencia bancaria', category: 'transfer', isDefault: false, createdAt: new Date() },
      { name: 'QR', category: 'qris', isDefault: false, createdAt: new Date() },
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
      { name: 'porción', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'vaso',    isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'botella', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'paquete', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
    ]);
  }

  const storeCount = await db.storeSettings.count();
  if (storeCount === 0) {
    await db.storeSettings.add({
      storeName: 'Mi tienda',
      address: '',
      phone: '',
      receiptFooter: '¡Gracias por su visita!',
      printLogo: false,
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
      { name: 'Luz y agua',     color: '#FBBF24', icon: '💡', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Arriendo',       color: '#8B5CF6', icon: '🏠', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Salarios',       color: '#10B981', icon: '👤', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Transporte',     color: '#3B82F6', icon: '🚚', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Operación',      color: '#F97316', icon: '🧰', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
      { name: 'Otros',          color: '#6B7280', icon: '📦', isDefault: 1, createdAt: now, isDeleted: 0, deletedAt: null },
    ]);
  }

  // Sanitize any dates stored as string (e.g. from restored backup)
  await sanitizeDatabaseDates();
}
