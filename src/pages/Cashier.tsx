import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged, type Product, type Category, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, ShoppingCart, X, Percent, Tag, CreditCard, Banknote, Check, ScanBarcode, Package as PackageIcon, ClipboardList, Save, Pencil, User, Hash, Trash2, Barcode } from 'lucide-react';
import Receipt from '@/components/Receipt';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';

interface CartItem {
  product: Product;
  qty: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  notes?: string;
}

export default function Kasir() {
  const { currentUser, can } = useAuth();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [txDiscountType, setTxDiscountType] = useState<'percentage' | 'nominal' | null>(null);
  const [txDiscountValue, setTxDiscountValue] = useState('');
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [tempDiscountValue, setTempDiscountValue] = useState('');
  // Item-level discount dialog state
  const [itemDiscountTargetId, setItemDiscountTargetId] = useState<number | null>(null);
  const [itemDiscountType, setItemDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [itemDiscountValue, setItemDiscountValue] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastTxItems, setLastTxItems] = useState<TransactionItemRecord[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [openBillsOpen, setOpenBillsOpen] = useState(false);
  const [editingItemNotes, setEditingItemNotes] = useState<number | null>(null);
  const [tempItemNotes, setTempItemNotes] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetTx, setCancelTargetTx] = useState<Transaction | null>(null);
  const [scanInput, setScanInput] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const openBills = useLiveQuery(() => db.transactions.where('status').equals('open').reverse().sortBy('date'));
  const allUsers = useLiveQuery(() => db.users.toArray());

  // Permission gate — kept render-side (not redirect) so the bottom nav stays
  // intact. All hooks above run unconditionally; we just swap the rendered tree.
  const allowed = can('create_transaction');

  const cartProductIds = new Set(cart.map(c => c.product.id));

  const filtered = products?.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    const available = !isStockManaged(p) || p.stock > 0 || cartProductIds.has(p.id!);
    return matchSearch && matchCategory && available;
  }) ?? [];

  const doFullReset = () => {
    setCart([]);
    setEditingTxId(null);
    setTxDiscountType(null);
    setTxDiscountValue('');
    setPaymentMethodId('');
    setPaymentAmount('');
    setCustomerName('');
    setTableNumber('');
    setRemarks('');
    setIsQuickAdding(false);
  };

  // === Cart Operations ===

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (isStockManaged(product) && existing.qty >= product.stock) {
          toast.error('Stok tidak cukup');
          return prev;
        }
        return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1, discountType: null, discountValue: 0 }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.qty + delta;
      if (newQty <= 0) return c;
      if (isStockManaged(c.product) && newQty > c.product.stock) { toast.error('Stok tidak cukup'); return c; }
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const updateItemNotes = (productId: number, notes: string) => {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, notes: notes.trim() || undefined } : c));
  };

  const openItemDiscount = (item: CartItem) => {
    setItemDiscountTargetId(item.product.id!);
    if (item.discountType) {
      setItemDiscountType(item.discountType);
      setItemDiscountValue(String(item.discountValue));
    } else {
      setItemDiscountType('nominal');
      setItemDiscountValue('');
    }
  };

  const saveItemDiscount = () => {
    if (itemDiscountTargetId == null) return;
    const raw = Number(itemDiscountValue) || 0;
    setCart(prev => prev.map(c => {
      if (c.product.id !== itemDiscountTargetId) return c;
      if (raw <= 0) {
        return { ...c, discountType: null, discountValue: 0 };
      }
      const base = c.product.price * c.qty;
      const clamped = itemDiscountType === 'percentage'
        ? Math.min(100, raw)
        : Math.min(base, raw);
      return { ...c, discountType: itemDiscountType, discountValue: clamped };
    }));
    setItemDiscountTargetId(null);
  };

  const clearItemDiscount = () => {
    if (itemDiscountTargetId == null) return;
    setCart(prev => prev.map(c =>
      c.product.id === itemDiscountTargetId
        ? { ...c, discountType: null, discountValue: 0 }
        : c
    ));
    setItemDiscountTargetId(null);
  };

  const getItemDiscountAmount = (item: CartItem) => {
    const base = item.product.price * item.qty;
    if (item.discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, item.discountValue));
      return base * pct / 100;
    }
    if (item.discountType === 'nominal') {
      return Math.min(base, Math.max(0, item.discountValue));
    }
    return 0;
  };

  const getItemSubtotal = (item: CartItem) => {
    const base = item.product.price * item.qty;
    return Math.max(0, base - getItemDiscountAmount(item));
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const txDiscountAmount = txDiscountType === 'percentage'
    ? subtotal * Math.min(100, Math.max(0, Number(txDiscountValue) || 0)) / 100
    : txDiscountType === 'nominal'
      ? Math.min(subtotal, Math.max(0, Number(txDiscountValue) || 0))
      : 0;
  const total = Math.max(0, subtotal - txDiscountAmount);
  const paidAmount = Number(paymentAmount) || 0;
  const change = paidAmount - total;
  const totalItemDiscount = cart.reduce((sum, item) => sum + getItemDiscountAmount(item), 0);
  const totalProfit = cart.reduce((sum, item) => sum + (item.product.price - item.product.hpp) * item.qty, 0) - totalItemDiscount - txDiscountAmount;

  // === Open Bill Operations ===

  const saveOpenBill = async () => {
    if (cart.length === 0) { toast.error('Keranjang kosong'); return; }

    const now = new Date();

    if (editingTxId) {
      // Update existing open bill
      const oldItems = await db.transactionItems.where('transactionId').equals(editingTxId).toArray();

      await db.transactions.update(editingTxId, {
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        date: now,
      });
      await db.transactionItems.where('transactionId').equals(editingTxId).delete();
      const itemRecords: TransactionItemRecord[] = cart.map(c => ({
        transactionId: editingTxId,
        productId: c.product.id!,
        productName: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount: getItemDiscountAmount(c),
        subtotal: getItemSubtotal(c),
        notes: c.notes,
      }));
      await db.transactionItems.bulkAdd(itemRecords);

      // Adjust stock deltas
      for (const cartItem of cart) {
        if (!isStockManaged(cartItem.product)) continue;
        const oldItem = oldItems.find(oi => oi.productId === cartItem.product.id);
        const oldQty = oldItem?.quantity ?? 0;
        const newQty = cartItem.qty;
        const delta = newQty - oldQty;
        if (delta !== 0) {
          await db.products.update(cartItem.product.id!, { stock: cartItem.product.stock - delta, updatedAt: new Date() });
        }
      }
      // Restore stock for removed items that were in old bill
      for (const oldItem of oldItems) {
        const stillInCart = cart.find(c => c.product.id === oldItem.productId);
        if (!stillInCart) {
          const product = await db.products.get(oldItem.productId);
          if (product && isStockManaged(product)) {
            await db.products.update(oldItem.productId, { stock: product.stock + oldItem.quantity });
          }
        }
      }

      const updatedTx = await db.transactions.get(editingTxId);
      toast.success(`Bill ${updatedTx?.receiptNumber} diperbarui!`);
    } else {
      const receiptNumber = `TX${Date.now()}`;

      const txData: Transaction = {
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        paymentMethodId: 0,
        paymentAmount: 0,
        change: 0,
        profit: 0,
        date: now,
        receiptNumber,
        status: 'open',
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        openedAt: now,
        createdBy: currentUser?.id,
      };

      const txId = await db.transactions.add(txData);

      const itemRecords: TransactionItemRecord[] = cart.map(c => ({
        transactionId: txId as number,
        productId: c.product.id!,
        productName: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount: getItemDiscountAmount(c),
        subtotal: getItemSubtotal(c),
        notes: c.notes,
      }));
      await db.transactionItems.bulkAdd(itemRecords);

      for (const item of cart) {
        if (!isStockManaged(item.product)) continue;
        await db.products.update(item.product.id!, { stock: item.product.stock - item.qty, updatedAt: new Date() });
      }

      toast.success(`Bill ${receiptNumber} disimpan!`);
    }

    doFullReset();
    setCartOpen(false);
  };

  const loadOpenBill = async (tx: Transaction) => {
    if (!tx.id) return;
    const items = await db.transactionItems.where('transactionId').equals(tx.id).toArray();
    const allProducts = await db.products.where('isDeleted').equals(0).toArray();

    const cartItems: CartItem[] = items.map(item => {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) throw new Error(`Produk "${item.productName}" tidak ditemukan`);
      return {
        product,
        qty: item.quantity,
        discountType: item.discountType as 'percentage' | 'nominal' | null,
        discountValue: item.discountValue,
        notes: item.notes,
      };
    });

    setCart(cartItems);
    setEditingTxId(tx.id);
    setTxDiscountType(tx.discountType);
    setTxDiscountValue(tx.discountType ? String(tx.discountValue) : '');
    setCustomerName(tx.customerName || '');
    setTableNumber(tx.tableNumber || '');
    setRemarks(tx.remarks || '');
    setOpenBillsOpen(false);
    setCartOpen(true);
  };

  const cancelOpenBill = async (tx: Transaction) => {
    if (!tx.id) return;
    const items = await db.transactionItems.where('transactionId').equals(tx.id).toArray();
    for (const item of items) {
      const product = await db.products.get(item.productId);
      if (product && isStockManaged(product)) {
        await db.products.update(item.productId, { stock: product.stock + item.quantity });
      }
    }
    await db.transactionItems.where('transactionId').equals(tx.id).delete();
    await db.transactions.delete(tx.id);
    toast.success(`Bill ${tx.receiptNumber} dibatalkan`);
    setCancelDialogOpen(false);
    setCancelTargetTx(null);
    if (editingTxId === tx.id) {
      doFullReset();
      setCartOpen(false);
    }
  };

  const handleCancelFromCart = () => {
    const tx = openBills?.find(b => b.id === editingTxId);
    if (tx) {
      setCancelTargetTx(tx);
      setCancelDialogOpen(true);
    }
  };

  const handleCancelFromList = (bill: Transaction) => {
    setCancelTargetTx(bill);
    setCancelDialogOpen(true);
  };

  // === Checkout ===

  const handleCheckout = async () => {
    if (!paymentMethodId || paidAmount < total) return;

    if (editingTxId) {
      // Update existing open bill → paid
      const oldItems = await db.transactionItems.where('transactionId').equals(editingTxId).toArray();

      await db.transactions.update(editingTxId, {
        status: 'completed',
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        paymentMethodId: Number(paymentMethodId),
        paymentAmount: paidAmount,
        change,
        profit: totalProfit,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        closedAt: new Date(),
      });

      await db.transactionItems.where('transactionId').equals(editingTxId).delete();
      const itemRecords: TransactionItemRecord[] = cart.map(c => ({
        transactionId: editingTxId,
        productId: c.product.id!,
        productName: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount: getItemDiscountAmount(c),
        subtotal: getItemSubtotal(c),
        notes: c.notes,
      }));
      await db.transactionItems.bulkAdd(itemRecords);

      // Adjust stock deltas (same as saveOpenBill)
      for (const cartItem of cart) {
        if (!isStockManaged(cartItem.product)) continue;
        const oldItem = oldItems.find(oi => oi.productId === cartItem.product.id);
        const oldQty = oldItem?.quantity ?? 0;
        const newQty = cartItem.qty;
        const delta = newQty - oldQty;
        if (delta !== 0) {
          await db.products.update(cartItem.product.id!, { stock: cartItem.product.stock - delta, updatedAt: new Date() });
        }
      }
      for (const oldItem of oldItems) {
        const stillInCart = cart.find(c => c.product.id === oldItem.productId);
        if (!stillInCart) {
          const product = await db.products.get(oldItem.productId);
          if (product && isStockManaged(product)) {
            await db.products.update(oldItem.productId, { stock: product.stock + oldItem.quantity });
          }
        }
      }

      const updatedTx = await db.transactions.get(editingTxId);
      toast.success(`Transaksi berhasil! ${updatedTx?.receiptNumber}`);
      setLastTransaction(updatedTx || null);
      setLastTxItems(itemRecords);
      setReceiptOpen(true);
    } else {
      const receiptNumber = `TX${Date.now()}`;

      const txData: Transaction = {
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        paymentMethodId: Number(paymentMethodId),
        paymentAmount: paidAmount,
        change,
        profit: totalProfit,
        date: new Date(),
        receiptNumber,
        status: 'completed',
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        createdBy: currentUser?.id,
      };

      const txId = await db.transactions.add(txData);

      const itemRecords: TransactionItemRecord[] = cart.map(c => ({
        transactionId: txId as number,
        productId: c.product.id!,
        productName: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount: getItemDiscountAmount(c),
        subtotal: getItemSubtotal(c),
        notes: c.notes,
      }));
      await db.transactionItems.bulkAdd(itemRecords);

      for (const item of cart) {
        if (!isStockManaged(item.product)) continue;
        await db.products.update(item.product.id!, { stock: item.product.stock - item.qty, updatedAt: new Date() });
      }

      toast.success(`Transaksi berhasil! ${receiptNumber}`);
      setLastTransaction({ ...txData, id: txId as number });
      setLastTxItems(itemRecords);
      setReceiptOpen(true);
    }

    doFullReset();
    setCheckoutOpen(false);
    setCartOpen(false);
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const openBillsCount = openBills?.length ?? 0;

  const handleScan = (barcode: string) => {
    setScannerOpen(false);
    const product = products?.find(p => p.sku === barcode || p.barcode === barcode);
    if (product) {
      if (isStockManaged(product) && product.stock <= 0) {
        toast.error(`Stok ${product.name} habis`);
        return;
      }
      addToCart(product);
      toast.success(`Ditambahkan: ${product.name}`);
    } else {
      toast.error(`Produk dengan SKU/Barcode "${barcode}" tidak ditemukan`);
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      const code = scanInput.trim();
      setScanInput('');
      const product = products?.find(p => p.sku === code || p.barcode === code);
      if (product) {
        if (isStockManaged(product) && product.stock <= 0) {
          toast.error(`Stok ${product.name} habis`);
          return;
        }
        addToCart(product);
        toast.success(`Ditambahkan: ${product.name}`);
      } else {
        toast.error(`Produk dengan SKU/Barcode "${code}" tidak ditemukan`);
      }
    }
  };

  // Auto-focus scan input after it clears
  useEffect(() => {
    if (scanInput === '' && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanInput]);

  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  // After all hooks: if user can't create transactions, render the locked
  // placeholder instead of the kasir UI. Bottom nav stays visible.
  if (!allowed) {
    return <LockedPage title="Kasir" permissionLabel="Buat Transaksi" />;
  }

  return (
    <div className="px-4 pt-6 pb-4 h-[calc(100vh-4rem)]">
      <div className="flex flex-col md:flex-row gap-0 md:gap-4 h-full">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Kasir
          {editingTxId && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              Editing Bill
            </Badge>
          )}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-xs relative"
          onClick={() => setOpenBillsOpen(true)}
        >
          <ClipboardList className="w-4 h-4" />
          Open Bill
          {openBillsCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] px-1 bg-destructive text-destructive-foreground">
              {openBillsCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="w-5 h-5" />
        </Button>
      </div>

      {/* SKU / Barcode scan input */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={scanInputRef}
            placeholder="Scan / ketik SKU atau Barcode lalu Enter..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleScanKeyDown}
            className="pl-9 h-10 text-sm"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3 pb-1 pr-4" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>
        <button onClick={() => setFilterCategory('all')} className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors', filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          Semua
        </button>
        {categories?.map(c => (
          <button key={c.id} onClick={() => setFilterCategory(c.id!.toString())} className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors', filterCategory === c.id!.toString() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {products && products.length > 0
                ? 'Semua produk stoknya habis. Tambah stok dulu di menu Stok Masuk.'
                : 'Belum ada produk. Tambah produk dulu di menu Produk.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map(p => (
              <Card key={p.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => addToCart(p)}>
                <CardContent className="p-0">
                  <div className="w-full aspect-square bg-muted rounded-t-lg overflow-hidden flex items-center justify-center">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-semibold truncate">{p.name}</h3>
                    <p className="text-sm font-bold text-primary mt-0.5">Rp {p.price.toLocaleString('id-ID')}</p>
                    {p.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={p.description}>
                        {p.description}
                      </p>
                    )}
                    {isStockManaged(p) ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock} {p.unit}</p>
                    ) : (
                      <p className="text-[10px] text-primary mt-0.5">Selalu tersedia</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Desktop Cart Panel */}
      <div className="hidden md:flex md:w-80 lg:w-96 flex-col overflow-hidden bg-card rounded-xl border border-border shrink-0">
        <div className="p-4 border-b border-border shrink-0">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Keranjang ({cartCount} item)
            {editingTxId && <span className="text-xs font-normal text-muted-foreground">— edit</span>}
          </h3>
        </div>
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Keranjang kosong</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {cart.map(item => (
                <div key={item.product.id} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">Rp {item.product.price.toLocaleString('id-ID')} × {item.qty}</p>
                      {item.discountType && getItemDiscountAmount(item) > 0 && (
                        <p className="text-[10px] text-destructive">
                          Diskon: {item.discountType === 'percentage' ? `${item.discountValue}%` : rp(item.discountValue)} (-{rp(getItemDiscountAmount(item))})
                        </p>
                      )}
                      <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => item.qty === 1 ? removeFromCart(item.product.id!) : updateQty(item.product.id!, -1)}>
                        {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQty(item.product.id!, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.notes ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full"
                        onClick={() => { setEditingItemNotes(item.product.id!); setTempItemNotes(item.notes || ''); }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        {item.notes}
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => { setEditingItemNotes(item.product.id!); setTempItemNotes(''); }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        Tambah catatan
                      </button>
                    )}
                    {item.discountType ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Ubah diskon
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Tambah diskon
                      </button>
                    )}
                  </div>
                  {editingItemNotes === item.product.id && (
                    <div className="flex gap-2 items-center">
                      <Input
                        autoFocus
                        value={tempItemNotes}
                        onChange={e => setTempItemNotes(e.target.value)}
                        placeholder="Contoh: less sugar..."
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }
                          if (e.key === 'Escape') setEditingItemNotes(null);
                        }}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }}>OK</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-4 mb-2">
              <div className="relative flex-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nama pelanggan"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <div className="relative flex-[0.6]">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Meja"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3 px-4 pb-4">
              {txDiscountAmount > 0 ? (
                <button
                  onClick={() => { setTempDiscountType(txDiscountType!); setTempDiscountValue(txDiscountValue); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-destructive font-medium"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Diskon: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : `Rp ${Number(txDiscountValue).toLocaleString('id-ID')}`}
                  <span className="text-[10px] underline ml-1">Ubah</span>
                </button>
              ) : (
                <button
                  onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tambah Diskon</span>
                </button>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{rp(subtotal)}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Diskon</span>
                  <span>-{rp(txDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{rp(total)}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={saveOpenBill}
                  disabled={cart.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Bill
                </Button>
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => { setCheckoutOpen(true); setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); setPaymentAmount(total.toString()); setIsQuickAdding(false); }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Bayar
                </Button>
              </div>

              {editingTxId && can('delete_transaction') && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleCancelFromCart}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Batalkan Bill Ini
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      </div>{/* end flex row */}

      {/* Cart FAB (mobile only) */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-24 right-4 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl active:scale-95 transition-transform z-40"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-sm">{cartCount} item</span>
          <span className="text-sm font-bold">• Rp {total.toLocaleString('id-ID')}</span>
        </button>
      )}

      {/* Cart Sheet (mobile only) */}
      <div className="md:hidden">
      <Sheet open={cartOpen} onOpenChange={(open) => { setCartOpen(open); if (!open) setEditingItemNotes(null); }}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left">
              Keranjang ({cartCount} item)
              {editingTxId && <span className="text-xs font-normal text-muted-foreground ml-2">— edit open bill</span>}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full mt-4">
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {cart.map(item => (
                <div key={item.product.id} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">Rp {item.product.price.toLocaleString('id-ID')} × {item.qty}</p>
                      {item.discountType && getItemDiscountAmount(item) > 0 && (
                        <p className="text-[10px] text-destructive">
                          Diskon: {item.discountType === 'percentage' ? `${item.discountValue}%` : rp(item.discountValue)} (-{rp(getItemDiscountAmount(item))})
                        </p>
                      )}
                      <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => item.qty === 1 ? removeFromCart(item.product.id!) : updateQty(item.product.id!, -1)}>
                        {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </Button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => updateQty(item.product.id!, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {/* Item notes & discount row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.notes ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full"
                        onClick={() => { setEditingItemNotes(item.product.id!); setTempItemNotes(item.notes || ''); }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        {item.notes}
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => { setEditingItemNotes(item.product.id!); setTempItemNotes(''); }}
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        Tambah catatan
                      </button>
                    )}
                    {item.discountType ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Ubah diskon
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Tambah diskon
                      </button>
                    )}
                  </div>
                  {/* Inline notes editor */}
                  {editingItemNotes === item.product.id && (
                    <div className="flex gap-2 items-center">
                      <Input
                        autoFocus
                        value={tempItemNotes}
                        onChange={e => setTempItemNotes(e.target.value)}
                        placeholder="Contoh: less sugar..."
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }
                          if (e.key === 'Escape') setEditingItemNotes(null);
                        }}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }}>OK</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Customer / Table quick inputs */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nama pelanggan"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <div className="relative flex-[0.6]">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Meja"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4 space-y-3 pb-6">
              {txDiscountAmount > 0 ? (
                <button
                  onClick={() => { setTempDiscountType(txDiscountType!); setTempDiscountValue(txDiscountValue); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-destructive font-medium"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Diskon: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : `Rp ${Number(txDiscountValue).toLocaleString('id-ID')}`}
                  <span className="text-[10px] underline ml-1">Ubah</span>
                </button>
              ) : (
                <button
                  onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Tambah Diskon</span>
                </button>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{rp(subtotal)}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Diskon</span>
                  <span>-{rp(txDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{rp(total)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={saveOpenBill}
                  disabled={cart.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Bill
                </Button>
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => { setCheckoutOpen(true); setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); setPaymentAmount(total.toString()); setIsQuickAdding(false); }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Bayar
                </Button>
              </div>

              {editingTxId && can('delete_transaction') && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleCancelFromCart}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Batalkan Bill Ini
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>{/* end mobile cart wrapper */}

      {/* Open Bills Sheet */}
      <Sheet open={openBillsOpen} onOpenChange={setOpenBillsOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Open Bills ({openBillsCount})
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto pb-6 space-y-2">
            {!openBills || openBills.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Tidak ada open bill</p>
              </div>
            ) : (
              openBills.map(bill => (
                <Card key={bill.id} className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{bill.receiptNumber}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {bill.openedAt ? format(new Date(bill.openedAt), 'dd/MM HH:mm', { locale: localeId }) : ''}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">{rp(bill.total)}</span>
                    </div>
                    <div className="flex gap-1.5 text-[10px] text-muted-foreground mb-2">
                      {bill.customerName && <span>👤 {bill.customerName}</span>}
                      {bill.tableNumber && <span>🪑 Meja {bill.tableNumber}</span>}
                      {bill.remarks && <span className="truncate max-w-[120px]">📝 {bill.remarks}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs flex-1" onClick={() => loadOpenBill(bill)}>
                        Lanjutkan
                      </Button>
                      {can('delete_transaction') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-destructive border-destructive/30"
                          onClick={() => handleCancelFromList(bill)}
                        >
                          Batal
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="text-center py-3 bg-primary/5 rounded-xl">
              <p className="text-sm text-muted-foreground">Total Bayar</p>
              <p className="text-3xl font-bold text-primary">{rp(total)}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Metode Pembayaran</p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods?.map(pm => (
                  <button key={pm.id} onClick={() => setPaymentMethodId(pm.id!.toString())} className={cn('p-3 rounded-xl text-xs font-semibold border-2 transition-colors', paymentMethodId === pm.id!.toString() ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}>
                    {pm.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Jumlah Bayar</p>
              <div className="h-12 flex items-center justify-center rounded-md border border-input bg-background text-lg font-bold text-center px-3">
                {paidAmount > 0 ? `Rp ${paidAmount.toLocaleString('id-ID')}` : 'Rp 0'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1000, 2000, 5000, 10000, 20000, 50000, 100000].map(nom => (
                  <button
                    key={nom}
                    onClick={() => {
                      if (!isQuickAdding) {
                        setPaymentAmount(String(nom));
                        setIsQuickAdding(true);
                      } else {
                        setPaymentAmount(prev => String((Number(prev) || 0) + nom));
                      }
                    }}
                    className="flex-1 min-w-[calc(25%-6px)] h-9 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary active:scale-95 transition-all"
                  >
                    {nom >= 1000 ? `${(nom / 1000)}K` : nom}
                  </button>
                ))}
                <button
                  onClick={() => { setPaymentAmount(total.toString()); setIsQuickAdding(false); }}
                  className="flex-1 min-w-[calc(25%-6px)] h-9 rounded-lg border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all"
                >
                  Uang Pas
                </button>
              </div>
              <button
                onClick={() => { setPaymentAmount('0'); setIsQuickAdding(false); }}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                Reset
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Nama pelanggan"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="pl-8 h-10 text-sm"
                  />
                </div>
                <div className="relative flex-[0.7]">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Meja"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="pl-8 h-10 text-sm"
                  />
                </div>
              </div>
              <Input
                placeholder="Catatan tambahan (opsional)"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="h-10"
              />
            </div>

            {paidAmount >= total && (
              <div className="flex justify-between items-center bg-success/10 p-3 rounded-xl">
                <span className="text-sm font-medium">Kembalian</span>
                <span className="text-lg font-bold text-success">Rp {change.toLocaleString('id-ID')}</span>
              </div>
            )}

            <Button className="w-full h-12 text-base font-semibold" onClick={handleCheckout} disabled={!paymentMethodId || paidAmount < total}>
              <Check className="w-5 h-5 mr-2" />
              Konfirmasi Transaksi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Diskon Transaksi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Jenis Diskon</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTempDiscountType('nominal')}
                  className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', tempDiscountType === 'nominal' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                >
                  Nominal (Rp)
                </button>
                <button
                  onClick={() => setTempDiscountType('percentage')}
                  className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', tempDiscountType === 'percentage' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                >
                  Persen (%)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{tempDiscountType === 'percentage' ? 'Persentase Diskon' : 'Jumlah Diskon'}</p>
              <Input
                type="number"
                value={tempDiscountValue}
                onChange={e => setTempDiscountValue(e.target.value)}
                placeholder={tempDiscountType === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}
                className="h-12 text-lg font-bold text-center"
              />
              {tempDiscountType === 'percentage' && Number(tempDiscountValue) > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  = Rp {(subtotal * Number(tempDiscountValue) / 100).toLocaleString('id-ID')} dari Rp {subtotal.toLocaleString('id-ID')}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {txDiscountType && (
                <Button variant="outline" className="h-11 text-destructive border-destructive/30" onClick={() => {
                  setTxDiscountType(null);
                  setTxDiscountValue('');
                  setDiscountDialogOpen(false);
                }}>
                  Hapus
                </Button>
              )}
              <Button className="flex-1 h-11 font-semibold" onClick={() => {
                if (Number(tempDiscountValue) > 0) {
                  setTxDiscountType(tempDiscountType);
                  setTxDiscountValue(tempDiscountValue);
                } else {
                  setTxDiscountType(null);
                  setTxDiscountValue('');
                }
                setDiscountDialogOpen(false);
              }}>
                Simpan Diskon
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Discount Dialog */}
      <Dialog open={itemDiscountTargetId !== null} onOpenChange={(open) => { if (!open) setItemDiscountTargetId(null); }}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>Diskon Item</DialogTitle>
          </DialogHeader>
          {(() => {
            const target = cart.find(c => c.product.id === itemDiscountTargetId);
            if (!target) return null;
            const base = target.product.price * target.qty;
            const rawValue = Number(itemDiscountValue) || 0;
            const previewAmount = itemDiscountType === 'percentage'
              ? base * Math.min(100, Math.max(0, rawValue)) / 100
              : Math.min(base, Math.max(0, rawValue));
            const exceedsCap = itemDiscountType === 'percentage' ? rawValue > 100 : rawValue > base;
            return (
              <div className="space-y-4 mt-2">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Item</p>
                  <p className="text-sm font-semibold">{target.product.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rp {target.product.price.toLocaleString('id-ID')} × {target.qty} = {rp(base)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Jenis Diskon</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setItemDiscountType('nominal')}
                      className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', itemDiscountType === 'nominal' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                    >
                      Nominal (Rp)
                    </button>
                    <button
                      onClick={() => setItemDiscountType('percentage')}
                      className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', itemDiscountType === 'percentage' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                    >
                      Persen (%)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{itemDiscountType === 'percentage' ? 'Persentase Diskon' : 'Jumlah Diskon'}</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={itemDiscountValue}
                    onChange={e => setItemDiscountValue(e.target.value)}
                    placeholder={itemDiscountType === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}
                    className="h-12 text-lg font-bold text-center"
                    autoFocus
                  />
                  {rawValue > 0 && (
                    <p className={cn('text-xs text-center', exceedsCap ? 'text-destructive' : 'text-muted-foreground')}>
                      {exceedsCap
                        ? `Dibatasi otomatis ke ${itemDiscountType === 'percentage' ? '100%' : rp(base)}`
                        : `Diskon: -${rp(previewAmount)} → subtotal ${rp(Math.max(0, base - previewAmount))}`}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {target.discountType && (
                    <Button
                      variant="outline"
                      className="h-11 text-destructive border-destructive/30"
                      onClick={clearItemDiscount}
                    >
                      Hapus
                    </Button>
                  )}
                  <Button className="flex-1 h-11 font-semibold" onClick={saveItemDiscount}>
                    Simpan Diskon
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      {lastTransaction && (
        <Receipt
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={lastTransaction}
          items={lastTxItems}
          storeSettings={storeSettings}
          paymentMethodName={paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || 'Tunai'}
          cashierName={lastTransaction.createdBy ? allUsers?.find(u => u.id === lastTransaction.createdBy)?.name : undefined}
        />
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* Cancel Open Bill Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              Bill ini akan dihapus dan stok produk akan dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelTargetTx(null)}>Tidak</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTargetTx && cancelOpenBill(cancelTargetTx)}
            >
              Batalkan Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
