import Dexie, { type Table } from 'dexie';

// === Interfaces ===

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
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
  photo?: string; // base64 or blob URL
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: Date;
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
}

export interface StockOut {
  id?: number;
  productId: number;
  quantity: number;
  reason: string; // rusak, hilang, retur, dll
  date: Date;
  notes: string;
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
  items: TransactionItem[];
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
  remarks?: string;
}

export interface TransactionItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  hpp: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  discountAmount: number;
  subtotal: number;
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
  storeSettings!: Table<StoreSettings>;

  constructor() {
    super('kasirgratisan-db');

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
  }
}

export const db = new PosDatabase();

// Seed default data
export async function seedDefaultData() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd([
      { name: 'Makanan', color: '#FF6B35', icon: '🍕', createdAt: new Date() },
      { name: 'Minuman', color: '#4ECDC4', icon: '🥤', createdAt: new Date() },
      { name: 'Lainnya', color: '#95A5A6', icon: '📦', createdAt: new Date() },
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

  const storeCount = await db.storeSettings.count();
  if (storeCount === 0) {
    await db.storeSettings.add({
      storeName: 'Toko Saya',
      address: '',
      phone: '',
      receiptFooter: 'Terima kasih atas kunjungan Anda!',
      onboardingDone: false,
      lastBackupAt: null,
    });
  }
}
