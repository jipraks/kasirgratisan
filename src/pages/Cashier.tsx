import { useLiveQuery } from 'dexie-react-hooks';
import { db, isStockManaged, type Product, type Category, type Transaction, type TransactionItemRecord } from '@/lib/db';
import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, ShoppingCart, X, Percent, Tag, CreditCard, Banknote, Check, ScanBarcode, Package as PackageIcon, ClipboardList, Save, Pencil, User, Hash, Trash2, Barcode, Printer } from 'lucide-react';
import Receipt from '@/components/Receipt';
import KitchenTicket from '@/components/KitchenTicket';
import BarcodeScanner from '@/components/BarcodeScanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { id, enUS, ms } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import CustomerPicker from '@/components/CustomerPicker';
import LockedPage from '@/components/LockedPage';
import { useLocation, useNavigate } from 'react-router-dom';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';

interface CartItem {
  product: Product;
  qty: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
  notes?: string;
}



const LOCALES: Record<string, Locale> = {
  id,
  en: enUS,
  ms,
};

export default function Kasir() {
  const { currentUser, can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('settings');

  const lang = i18n.language?.split('-')[0] || 'id';
  const dateLocale = LOCALES[lang] || id;
  const numberLocale = NUMBER_LOCALE;
  const currencySymbol = CURRENCY_SYMBOL;
  const rp = (n: number) => `${currencySymbol} ${n.toLocaleString(numberLocale)}`;

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
  const [useDebt, setUseDebt] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [lastTxItems, setLastTxItems] = useState<TransactionItemRecord[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
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

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [kitchenTicketOpen, setKitchenTicketOpen] = useState(false);
  const [kitchenTicketTx, setKitchenTicketTx] = useState<Transaction | null>(null);
  const [kitchenTicketItems, setKitchenTicketItems] = useState<TransactionItemRecord[]>([]);

  // Cashier layout mode settings (default: 'grid')
  const [layoutMode] = useState<'grid' | 'rows'>(() => {
    try {
      return (localStorage.getItem('kg_cashier_layout_mode') as 'grid' | 'rows') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());
  const openBills = useLiveQuery(() => db.transactions.where('status').equals('open').reverse().sortBy('date'));
  const allUsers = useLiveQuery(() => db.users.toArray());
  const customers = useLiveQuery(() => db.customers.where('isDeleted').equals(0).toArray());

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
    setUseDebt(false);
    setCustomerName('');
    setCustomerId(undefined);
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
          toast.error(t('cashier.toast.stockLow'));
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
      if (isStockManaged(c.product) && newQty > c.product.stock) { toast.error(t('cashier.toast.stockLow')); return c; }
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
  const checkoutPaidAmount = useDebt ? Math.min(total, Math.max(0, paidAmount)) : paidAmount;
  const debtAmount = useDebt ? Math.max(0, total - checkoutPaidAmount) : 0;
  const change = useDebt ? 0 : paidAmount - total;
  const totalItemDiscount = cart.reduce((sum, item) => sum + getItemDiscountAmount(item), 0);
  const totalProfit = cart.reduce((sum, item) => sum + (item.product.price - item.product.hpp) * item.qty, 0) - totalItemDiscount - txDiscountAmount;

  // === Open Bill Operations ===

  const saveOpenBill = async (shouldPrintKitchen: boolean = false) => {
    if (cart.length === 0) { toast.error(t('cashier.toast.cartEmpty')); return; }

    const now = new Date();
    let savedTxObj: Transaction | null = null;
    let savedItemsObj: TransactionItemRecord[] = [];

    if (editingTxId) {
      // Update existing open bill
      const oldItems = await db.transactionItems.where('transactionId').equals(editingTxId).toArray();

      await db.transactions.update(editingTxId, {
        subtotal,
        discountType: txDiscountType,
        discountValue: Number(txDiscountValue) || 0,
        discountAmount: txDiscountAmount,
        total,
        customerId,
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
      toast.success(t('cashier.toast.billUpdated', { receiptNumber: updatedTx?.receiptNumber }));

      if (updatedTx) {
        savedTxObj = updatedTx;
        savedItemsObj = itemRecords;
      }
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
        customerId,
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

      toast.success(t('cashier.toast.billSaved', { receiptNumber }));

      savedTxObj = { ...txData, id: txId as number };
      savedItemsObj = itemRecords;
    }

    if (shouldPrintKitchen && savedTxObj) {
      setKitchenTicketTx(savedTxObj);
      setKitchenTicketItems(savedItemsObj);
      setKitchenTicketOpen(true);
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
      if (!product) throw new Error(t('cashier.toast.productNotFoundLoadBill', { name: item.productName }));
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
    setCustomerId(tx.customerId);
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
    toast.success(t('cashier.toast.billCancelled', { receiptNumber: tx.receiptNumber }));
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
    if (useDebt) {
      if (!storeSettings?.allowDebt) return;
      if (!customerId) {
        toast.error(t('cashier.toast.selectCustomerForDebt'));
        return;
      }
      if (paidAmount < 0 || paidAmount > total) {
        toast.error(t('cashier.toast.paymentAmountRange', { symbol: currencySymbol }));
        return;
      }
      if (checkoutPaidAmount > 0 && !paymentMethodId) {
        toast.error(t('cashier.toast.selectPaymentMethod'));
        return;
      }
    } else if (!paymentMethodId || paidAmount < total) {
      return;
    }

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
        paymentMethodId: checkoutPaidAmount > 0 ? Number(paymentMethodId) : 0,
        paymentAmount: checkoutPaidAmount,
        change,
        profit: totalProfit,
        customerId,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        closedAt: new Date(),
        debtAmount,
      });

      if (debtAmount > 0) {
        await db.debts.add({
          transactionId: editingTxId,
          customerId: customerId!,
          customerName: customerName.trim(),
          originalAmount: debtAmount,
          remainingAmount: debtAmount,
          status: checkoutPaidAmount > 0 ? 'partial' : 'unpaid',
          createdAt: new Date(),
          settledAt: null,
        });
      }

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
      toast.success(t('cashier.toast.transactionSuccess', { receiptNumber: updatedTx?.receiptNumber }));
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
        paymentMethodId: checkoutPaidAmount > 0 ? Number(paymentMethodId) : 0,
        paymentAmount: checkoutPaidAmount,
        change,
        profit: totalProfit,
        date: new Date(),
        receiptNumber,
        status: 'completed',
        customerId,
        customerName: customerName.trim() || undefined,
        tableNumber: tableNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
        createdBy: currentUser?.id,
        debtAmount,
      };

      const txId = await db.transactions.add(txData);

      if (debtAmount > 0) {
        await db.debts.add({
          transactionId: txId as number,
          customerId: customerId!,
          customerName: customerName.trim(),
          originalAmount: debtAmount,
          remainingAmount: debtAmount,
          status: checkoutPaidAmount > 0 ? 'partial' : 'unpaid',
          createdAt: new Date(),
          settledAt: null,
        });
      }

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

      toast.success(t('cashier.toast.transactionSuccess', { receiptNumber }));
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
        toast.error(t('cashier.toast.productOutOfStock', { name: product.name }));
        return;
      }
      addToCart(product);
      toast.success(t('cashier.toast.addedToCart', { name: product.name }));
    } else {
      toast.error(t('cashier.toast.productNotFound', { code: barcode }));
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      const code = scanInput.trim();
      setScanInput('');
      const product = products?.find(p => p.sku === code || p.barcode === code);
      if (product) {
        if (isStockManaged(product) && product.stock <= 0) {
          toast.error(t('cashier.toast.productOutOfStock', { name: product.name }));
          return;
        }
        addToCart(product);
        toast.success(t('cashier.toast.addedToCart', { name: product.name }));
      } else {
        toast.error(t('cashier.toast.productNotFound', { code }));
      }
    }
  };

  // Auto-focus scan input after it clears
  useEffect(() => {
    if (scanInput === '' && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanInput]);

  // Open the Open Bills sheet when navigated here from the dashboard
  useEffect(() => {
    if ((location.state as { openBills?: boolean } | null)?.openBills) {
      setOpenBillsOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  // After all hooks: if user can't create transactions, render the locked
  // placeholder instead of the kasir UI. Bottom nav stays visible.
  if (!allowed) {
    return <LockedPage title={t('cashier.locked.title')} permissionLabel={t('cashier.locked.permissionLabel')} />;
  }

  return (
    <div className="px-4 pt-6 pb-4 h-[calc(100vh-4rem)]">
      <div className="flex flex-col md:flex-row gap-0 md:gap-4 h-full">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          {t('cashier.title')}
          {editingTxId && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {t('cashier.editingBill')}
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
          {t('cashier.openBill')}{openBillsCount > 0 && ` (${openBillsCount})`}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-3 px-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('cashier.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setScannerOpen(true)}>
          <ScanBarcode className="w-5 h-5" />
        </Button>
      </div>

      {/* SKU / Barcode scan input */}
      <div className="flex gap-2 mb-3 px-1">
        <div className="relative flex-1">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={scanInputRef}
            placeholder={t('cashier.scanPlaceholder')}
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
          {t('cashier.categoryAll')}
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
                ? t('cashier.empty.outOfStock')
                : t('cashier.empty.noProducts')}
            </p>
          </div>
        ) : layoutMode === 'rows' ? (
          <div className="space-y-1.5 px-0.5 pb-2">
            {filtered.map(p => (
              <Card key={p.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => addToCart(p)}>
                <CardContent className="p-2 flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                    {p.photo ? (
                      <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-xs font-semibold truncate">{p.name}</h3>
                      <p className="text-xs font-bold text-primary shrink-0">{rp(p.price)}</p>
                    </div>
                    {p.description && (
                      <p className="text-[10px] text-muted-foreground truncate" title={p.description}>
                        {p.description}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      {isStockManaged(p) ? (
                        <p className="text-[10px] text-muted-foreground">{t('cashier.productCard.stock', { stock: p.stock, unit: p.unit })}</p>
                      ) : (
                        <p className="text-[10px] text-primary">{t('cashier.productCard.alwaysAvailable')}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                    <p className="text-sm font-bold text-primary mt-0.5">{rp(p.price)}</p>
                    {p.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={p.description}>
                        {p.description}
                      </p>
                    )}
                    {isStockManaged(p) ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('cashier.productCard.stock', { stock: p.stock, unit: p.unit })}</p>
                    ) : (
                      <p className="text-[10px] text-primary mt-0.5">{t('cashier.productCard.alwaysAvailable')}</p>
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
            {t('cashier.cart.title', { count: cartCount })}
            {editingTxId && <span className="text-xs font-normal text-muted-foreground">{t('cashier.cart.editLabel')}</span>}
          </h3>
        </div>
        {cart.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">{t('cashier.cart.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {cart.map(item => (
                <div key={item.product.id} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{rp(item.product.price)} × {item.qty}</p>
                      {item.discountType && getItemDiscountAmount(item) > 0 && (
                        <p className="text-[10px] text-destructive">
                          {t('cashier.cartDiscount.label')}: {item.discountType === 'percentage' ? `${item.discountValue}%` : rp(item.discountValue)} (-{rp(getItemDiscountAmount(item))})
                        </p>
                      )}
                      <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => item.qty === 1 ? removeFromCart(item.product.id!) : updateQty(item.product.id!, -1)}>
                        {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </Button>
                      <input
                        key={item.qty}
                        type="number"
                        inputMode="numeric"
                        defaultValue={item.qty}
                        onBlur={e => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) {
                            if (isStockManaged(item.product) && val > item.product.stock) {
                              toast.error(t('cashier.toast.stockLowWithMax', { max: item.product.stock }));
                              e.target.value = String(item.product.stock);
                              setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, qty: item.product.stock } : c));
                            } else {
                              setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, qty: val } : c));
                            }
                          } else {
                            e.target.value = String(item.qty);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-10 h-8 text-center text-sm font-bold bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
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
                        {t('cashier.itemNotes.add')}
                      </button>
                    )}
                    {item.discountType ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t('cashier.itemDiscount.change')}
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t('cashier.itemDiscount.add')}
                      </button>
                    )}
                  </div>
                  {editingItemNotes === item.product.id && (
                    <div className="flex gap-2 items-center">
                      <Input
                        autoFocus
                        value={tempItemNotes}
                        onChange={e => setTempItemNotes(e.target.value)}
                        placeholder={t('cashier.itemNotes.placeholder')}
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }
                          if (e.key === 'Escape') setEditingItemNotes(null);
                        }}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }}>{t('cashier.buttons.ok')}</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-4 mb-2">
              <CustomerPicker
                customers={customers ?? []}
                value={customerName}
                customerId={customerId}
                onChange={(name, id) => { setCustomerName(name); setCustomerId(id); }}
                className="flex-1 [&_input]:h-9 [&_input]:text-xs"
              />
              <div className="relative flex-[0.6]">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('cashier.checkout.table')}
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
                  {t('cashier.cartDiscount.label')}: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : rp(Number(txDiscountValue))}
                  <span className="text-[10px] underline ml-1">{t('cashier.cartDiscount.change')}</span>
                </button>
              ) : (
                <button
                  onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('cashier.cartDiscount.add')}</span>
                </button>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('cashier.cartDiscount.subtotal')}</span>
                <span className="font-medium">{rp(subtotal)}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>{t('cashier.cartDiscount.discount')}</span>
                  <span>-{rp(txDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>{t('cashier.cartDiscount.total')}</span>
                <span className="text-primary">{rp(total)}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => setSaveConfirmOpen(true)}
                  disabled={cart.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('cashier.buttons.saveBill')}
                </Button>
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => { setCheckoutOpen(true); setUseDebt(false); setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); setPaymentAmount(total.toString()); setIsQuickAdding(false); }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('cashier.buttons.pay')}
                </Button>
              </div>

              {editingTxId && can('delete_transaction') && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleCancelFromCart}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('cashier.buttons.cancelBill')}
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
          className="md:hidden fixed right-4 flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl active:scale-95 transition-transform z-40"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-sm">{t('cashier.cart.title', { count: cartCount })}</span>
          <span className="text-sm font-bold">• {rp(total)}</span>
        </button>
      )}

      {/* Cart Sheet (mobile only) */}
      <div className="md:hidden">
      <Sheet open={cartOpen} onOpenChange={(open) => { setCartOpen(open); if (!open) setEditingItemNotes(null); }}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left">
              {t('cashier.cart.title', { count: cartCount })}
              {editingTxId && <span className="text-xs font-normal text-muted-foreground ml-2">{t('cashier.cart.editOpenBillLabel')}</span>}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full mt-4">
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {cart.map(item => (
                <div key={item.product.id} className="bg-muted/50 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{rp(item.product.price)} × {item.qty}</p>
                      {item.discountType && getItemDiscountAmount(item) > 0 && (
                        <p className="text-[10px] text-destructive">
                          {t('cashier.cartDiscount.label')}: {item.discountType === 'percentage' ? `${item.discountValue}%` : rp(item.discountValue)} (-{rp(getItemDiscountAmount(item))})
                        </p>
                      )}
                      <p className="text-sm font-bold text-primary">{rp(getItemSubtotal(item))}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => item.qty === 1 ? removeFromCart(item.product.id!) : updateQty(item.product.id!, -1)}>
                        {item.qty === 1 ? <X className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </Button>
                      <input
                        key={item.qty}
                        type="number"
                        inputMode="numeric"
                        defaultValue={item.qty}
                        onBlur={e => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1) {
                            if (isStockManaged(item.product) && val > item.product.stock) {
                              toast.error(t('cashier.toast.stockLowWithMax', { max: item.product.stock }));
                              e.target.value = String(item.product.stock);
                              setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, qty: item.product.stock } : c));
                            } else {
                              setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, qty: val } : c));
                            }
                          } else {
                            e.target.value = String(item.qty);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-10 h-8 text-center text-sm font-bold bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
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
                        {t('cashier.itemNotes.add')}
                      </button>
                    )}
                    {item.discountType ? (
                      <button
                        className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t('cashier.itemDiscount.change')}
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => openItemDiscount(item)}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t('cashier.itemDiscount.add')}
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
                        placeholder={t('cashier.itemNotes.placeholder')}
                        className="h-8 text-xs"
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }
                          if (e.key === 'Escape') setEditingItemNotes(null);
                        }}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => { updateItemNotes(item.product.id!, tempItemNotes); setEditingItemNotes(null); }}>{t('cashier.buttons.ok')}</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Customer / Table quick inputs */}
            <div className="flex gap-2 mb-2">
              <CustomerPicker
                customers={customers ?? []}
                value={customerName}
                customerId={customerId}
                onChange={(name, id) => { setCustomerName(name); setCustomerId(id); }}
                className="flex-1 [&_input]:h-9 [&_input]:text-xs"
              />
              <div className="relative flex-[0.6]">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t('cashier.checkout.table')}
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
                  {t('cashier.cartDiscount.label')}: {txDiscountType === 'percentage' ? `${txDiscountValue}%` : rp(Number(txDiscountValue))}
                  <span className="text-[10px] underline ml-1">{t('cashier.cartDiscount.change')}</span>
                </button>
              ) : (
                <button
                  onClick={() => { setTempDiscountType('nominal'); setTempDiscountValue(''); setDiscountDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('cashier.cartDiscount.add')}</span>
                </button>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('cashier.cartDiscount.subtotal')}</span>
                <span className="font-medium">{rp(subtotal)}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>{t('cashier.cartDiscount.discount')}</span>
                  <span>-{rp(txDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>{t('cashier.cartDiscount.total')}</span>
                <span className="text-primary">{rp(total)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => setSaveConfirmOpen(true)}
                  disabled={cart.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('cashier.buttons.saveBill')}
                </Button>
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={() => { setCheckoutOpen(true); setUseDebt(false); setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); setPaymentAmount(total.toString()); setIsQuickAdding(false); }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('cashier.buttons.pay')}
                </Button>
              </div>

              {editingTxId && can('delete_transaction') && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={handleCancelFromCart}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {t('cashier.buttons.cancelBill')}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>{/* end mobile cart wrapper */}

      {/* Open Bills Sheet */}
      <Sheet open={openBillsOpen} onOpenChange={setOpenBillsOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl max-w-lg md:max-w-xl mx-auto flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-left flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              {t('cashier.openBillsSheet.title', { count: openBillsCount })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex-1 min-h-0 overflow-y-auto pb-6 space-y-2">
            {!openBills || openBills.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t('cashier.openBillsSheet.empty')}</p>
              </div>
            ) : (
              openBills.map(bill => (
                <Card key={bill.id} className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{bill.receiptNumber}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {bill.openedAt ? format(new Date(bill.openedAt), 'dd/MM HH:mm', { locale: dateLocale }) : ''}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">{rp(bill.total)}</span>
                    </div>
                    <div className="flex gap-1.5 text-[10px] text-muted-foreground mb-2">
                      {bill.customerName && <span>👤 {bill.customerName}</span>}
                      {bill.tableNumber && <span>🪑 {t('cashier.openBillsSheet.tablePrefix', { number: bill.tableNumber })}</span>}
                      {bill.remarks && <span className="truncate max-w-[120px]">📝 {bill.remarks}</span>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 text-xs flex-1" onClick={() => loadOpenBill(bill)}>
                          {t('cashier.openBillsSheet.continue')}
                        </Button>
                        {can('delete_transaction') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-destructive border-destructive/30"
                            onClick={() => handleCancelFromList(bill)}
                          >
                            {t('cashier.openBillsSheet.cancel')}
                          </Button>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center"
                        onClick={async () => {
                          const items = await db.transactionItems.where('transactionId').equals(bill.id!).toArray();
                          setKitchenTicketTx(bill);
                          setKitchenTicketItems(items);
                          setKitchenTicketOpen(true);
                        }}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" />
                        {t('cashier.buttons.printKitchen')}
                      </Button>
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
        <DialogContent className="max-w-[95vw] md:max-w-lg rounded-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>{t('cashier.checkout.title')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
            <div className="text-center py-3 bg-primary/5 rounded-xl">
              <p className="text-sm text-muted-foreground">{t('cashier.checkout.totalLabel')}</p>
              <p className="text-3xl font-bold text-primary">{rp(total)}</p>
            </div>

            {storeSettings?.allowDebt && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{t('cashier.checkout.debtLabel')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('cashier.checkout.debtDesc')}</p>
                </div>
                <Switch
                  checked={useDebt}
                  onCheckedChange={(checked) => {
                    setUseDebt(checked);
                    setPaymentAmount(checked ? '0' : total.toString());
                    setIsQuickAdding(false);
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('cashier.checkout.paymentMethod')}</p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods?.map(pm => (
                  <button key={pm.id} onClick={() => setPaymentMethodId(pm.id!.toString())} className={cn('p-3 rounded-xl text-xs font-semibold border-2 transition-colors', paymentMethodId === pm.id!.toString() ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}>
                    {pm.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{useDebt ? t('cashier.checkout.amountLabel.debt') : t('cashier.checkout.amountLabel.full')}</p>
              <Input
                type="number"
                inputMode="numeric"
                value={paymentAmount === '0' ? '' : paymentAmount}
                onChange={e => { setPaymentAmount(e.target.value || '0'); setIsQuickAdding(true); }}
                placeholder={t('cashier.checkout.amountPlaceholder')}
                className="h-12 text-lg font-bold text-center"
              />
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
                  {t('cashier.checkout.exactMoney')}
                </button>
              </div>
              <button
                onClick={() => { setPaymentAmount('0'); setIsQuickAdding(false); }}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                {t('cashier.checkout.reset')}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <CustomerPicker
                  customers={customers ?? []}
                  value={customerName}
                  customerId={customerId}
                  onChange={(name, id) => { setCustomerName(name); setCustomerId(id); }}
                  className="flex-1 [&_input]:h-10 [&_input]:text-sm"
                />
                <div className="relative flex-[0.7]">
                  <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t('cashier.checkout.table')}
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    className="pl-8 h-10 text-sm"
                  />
                </div>
              </div>
              <Input
                placeholder={t('cashier.checkout.notes')}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="h-10"
              />
            </div>

            {useDebt && debtAmount > 0 && (
              <div className="flex justify-between items-center bg-warning/10 p-3 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{t('cashier.checkout.remainingDebt')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('cashier.checkout.remainingDebtHint')}</p>
                </div>
                <span className="text-lg font-bold text-warning">{rp(debtAmount)}</span>
              </div>
            )}

            {paidAmount >= total && (
              <div className="flex justify-between items-center bg-success/10 p-3 rounded-xl">
                <span className="text-sm font-medium">{t('cashier.checkout.changeLabel')}</span>
                <span className="text-lg font-bold text-success">{rp(change)}</span>
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold shrink-0"
              onClick={handleCheckout}
              disabled={
                useDebt
                  ? !customerId || paidAmount < 0 || paidAmount > total || (checkoutPaidAmount > 0 && !paymentMethodId)
                  : !paymentMethodId || paidAmount < total
              }
            >
              <Check className="w-5 h-5 mr-2" />
              {t('cashier.checkout.confirmButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('cashier.discountDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t('cashier.discountDialog.typeLabel')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTempDiscountType('nominal')}
                  className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', tempDiscountType === 'nominal' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                >
                  {t('cashier.discountDialog.type.nominal', { symbol: currencySymbol })}
                </button>
                <button
                  onClick={() => setTempDiscountType('percentage')}
                  className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', tempDiscountType === 'percentage' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                >
                  {t('cashier.discountDialog.type.percentage')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{tempDiscountType === 'percentage' ? t('cashier.discountDialog.amountLabel.percentage') : t('cashier.discountDialog.amountLabel.nominal')}</p>
              <Input
                type="number"
                value={tempDiscountValue}
                onChange={e => setTempDiscountValue(e.target.value)}
                placeholder={tempDiscountType === 'percentage' ? t('cashier.discountDialog.placeholder.percentage') : t('cashier.discountDialog.placeholder.nominal')}
                className="h-12 text-lg font-bold text-center"
              />
              {tempDiscountType === 'percentage' && Number(tempDiscountValue) > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {t('cashier.discountDialog.percentPreview', { symbol: currencySymbol, amount: (subtotal * Number(tempDiscountValue) / 100).toLocaleString(numberLocale), subtotal: subtotal.toLocaleString(numberLocale) })}
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
                  {t('cashier.discountDialog.delete')}
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
                {t('cashier.discountDialog.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Discount Dialog */}
      <Dialog open={itemDiscountTargetId !== null} onOpenChange={(open) => { if (!open) setItemDiscountTargetId(null); }}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('cashier.itemDiscountDialog.title')}</DialogTitle>
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
                  <p className="text-xs text-muted-foreground">{t('cashier.itemDiscountDialog.itemLabel')}</p>
                  <p className="text-sm font-semibold">{target.product.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rp(target.product.price)} × {target.qty} = {rp(base)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t('cashier.itemDiscountDialog.typeLabel')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setItemDiscountType('nominal')}
                      className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', itemDiscountType === 'nominal' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                    >
                      {t('cashier.itemDiscountDialog.type.nominal', { symbol: currencySymbol })}
                    </button>
                    <button
                      onClick={() => setItemDiscountType('percentage')}
                      className={cn('p-3 rounded-xl text-sm font-semibold border-2 transition-colors', itemDiscountType === 'percentage' ? 'border-primary bg-primary/5 text-primary' : 'border-muted bg-muted/50 text-muted-foreground')}
                    >
                      {t('cashier.itemDiscountDialog.type.percentage')}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{itemDiscountType === 'percentage' ? t('cashier.itemDiscountDialog.amountLabel.percentage') : t('cashier.itemDiscountDialog.amountLabel.nominal')}</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={itemDiscountValue}
                    onChange={e => setItemDiscountValue(e.target.value)}
                    placeholder={itemDiscountType === 'percentage' ? t('cashier.itemDiscountDialog.placeholder.percentage') : t('cashier.itemDiscountDialog.placeholder.nominal')}
                    className="h-12 text-lg font-bold text-center"
                    autoFocus
                  />
                  {rawValue > 0 && (
                    <p className={cn('text-xs text-center', exceedsCap ? 'text-destructive' : 'text-muted-foreground')}>
                      {exceedsCap
                        ? t('cashier.itemDiscountDialog.cappedPreview.exceeds', { cap: itemDiscountType === 'percentage' ? '100%' : rp(base) })
                        : t('cashier.itemDiscountDialog.cappedPreview.normal', { amount: rp(previewAmount), subtotal: rp(Math.max(0, base - previewAmount)) })}
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
                      {t('cashier.itemDiscountDialog.delete')}
                    </Button>
                  )}
                  <Button className="flex-1 h-11 font-semibold" onClick={saveItemDiscount}>
                    {t('cashier.itemDiscountDialog.save')}
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
          paymentMethodName={
            lastTransaction.debtAmount
              ? (lastTransaction.paymentAmount > 0
                  ? `${paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || t('cashier.paymentMethod.initialPayment')} + ${t('cashier.paymentMethod.debt')}`
                  : t('cashier.paymentMethod.debt'))
              : paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || t('cashier.paymentMethod.cash')
          }
          cashierName={lastTransaction.createdBy ? allUsers?.find(u => u.id === lastTransaction.createdBy)?.name : undefined}
        />
      )}

      {/* Save Bill Confirm Dialog */}
      <Dialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle>{t('cashier.saveConfirmDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {t('cashier.saveConfirmDialog.description')}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full h-11 font-semibold"
                onClick={async () => {
                  setSaveConfirmOpen(false);
                  await saveOpenBill(true);
                }}
              >
                <Printer className="w-4 h-4 mr-2" />
                {t('cashier.buttons.saveAndPrintKitchen')}
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 font-semibold"
                onClick={async () => {
                  setSaveConfirmOpen(false);
                  await saveOpenBill(false);
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                {t('cashier.buttons.saveOnly')}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-11 text-muted-foreground"
                onClick={() => setSaveConfirmOpen(false)}
              >
                {t('cashier.buttons.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kitchen Ticket Dialog */}
      {kitchenTicketTx && (
        <KitchenTicket
          open={kitchenTicketOpen}
          onClose={() => setKitchenTicketOpen(false)}
          transaction={kitchenTicketTx}
          items={kitchenTicketItems}
          storeSettings={storeSettings}
          cashierName={kitchenTicketTx.createdBy ? allUsers?.find(u => u.id === kitchenTicketTx.createdBy)?.name : undefined}
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
            <AlertDialogTitle>{t('cashier.cancelDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cashier.cancelDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelTargetTx(null)}>{t('cashier.cancelDialog.no')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTargetTx && cancelOpenBill(cancelTargetTx)}
            >
              {t('cashier.cancelDialog.yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
