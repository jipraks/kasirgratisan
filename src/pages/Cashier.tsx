import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product, type Category, type Transaction } from '@/lib/db';
import { useState } from 'react';
import { Search, Plus, Minus, ShoppingCart, X, Percent, Tag, CreditCard, Banknote, Check } from 'lucide-react';
import Receipt from '@/components/Receipt';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CartItem {
  product: Product;
  qty: number;
  discountType: 'percentage' | 'nominal' | null;
  discountValue: number;
}

export default function Kasir() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [txDiscountType, setTxDiscountType] = useState<'percentage' | 'nominal' | null>(null);
  const [txDiscountValue, setTxDiscountValue] = useState('');
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [tempDiscountValue, setTempDiscountValue] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [remarks, setRemarks] = useState('');

  const products = useLiveQuery(() => db.products.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const paymentMethods = useLiveQuery(() => db.paymentMethods.toArray());
  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  const filtered = products?.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || p.categoryId === Number(filterCategory);
    return matchSearch && matchCategory && p.stock > 0;
  }) ?? [];

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
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
      if (newQty > c.product.stock) { toast.error('Stok tidak cukup'); return c; }
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const getItemSubtotal = (item: CartItem) => {
    const base = item.product.price * item.qty;
    if (item.discountType === 'percentage') return base * (1 - item.discountValue / 100);
    if (item.discountType === 'nominal') return base - item.discountValue;
    return base;
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const txDiscountAmount = txDiscountType === 'percentage' ? subtotal * (Number(txDiscountValue) || 0) / 100 : txDiscountType === 'nominal' ? Number(txDiscountValue) || 0 : 0;
  const total = Math.max(0, subtotal - txDiscountAmount);
  const paidAmount = Number(paymentAmount) || 0;
  const change = paidAmount - total;
  const totalProfit = cart.reduce((sum, item) => sum + (item.product.price - item.product.hpp) * item.qty, 0) - txDiscountAmount;

  const handleCheckout = async () => {
    if (!paymentMethodId || paidAmount < total) return;

    const receiptNumber = `TX${Date.now()}`;

    const txData: Transaction = {
      items: cart.map(c => ({
        productId: c.product.id!,
        productName: c.product.name,
        quantity: c.qty,
        price: c.product.price,
        hpp: c.product.hpp,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountAmount: c.discountType === 'percentage' ? c.product.price * c.qty * c.discountValue / 100 : c.discountType === 'nominal' ? c.discountValue : 0,
        subtotal: getItemSubtotal(c),
      })),
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
      remarks: remarks.trim() || undefined,
    };

    await db.transactions.add(txData);

    // Update stock
    for (const item of cart) {
      await db.products.update(item.product.id!, { stock: item.product.stock - item.qty, updatedAt: new Date() });
    }

    toast.success(`Transaksi berhasil! ${receiptNumber}`);
    setLastTransaction(txData);
    setReceiptOpen(true);
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setTxDiscountType(null);
    setTxDiscountValue('');
    setPaymentMethodId('');
    setPaymentAmount('');
    setRemarks('');
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Kasir
        </h1>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
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
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(p => (
              <Card key={p.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => addToCart(p)}>
                <CardContent className="p-3">
                  <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                  <p className="text-base font-bold text-primary mt-1">Rp {p.price.toLocaleString('id-ID')}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock} {p.unit}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 right-4 max-w-lg flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-xl active:scale-95 transition-transform z-40"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-sm">{cartCount} item</span>
          <span className="text-sm font-bold">• Rp {total.toLocaleString('id-ID')}</span>
        </button>
      )}

      {/* Cart Sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-left">Keranjang ({cartCount} item)</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full mt-4">
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">Rp {item.product.price.toLocaleString('id-ID')} × {item.qty}</p>
                    <p className="text-sm font-bold text-primary">Rp {getItemSubtotal(item).toLocaleString('id-ID')}</p>
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
              ))}
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
                <span className="font-medium">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              {txDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Diskon</span>
                  <span>-Rp {txDiscountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
              </div>

              <Button className="w-full h-12 text-base font-semibold" onClick={() => { setCheckoutOpen(true); setPaymentMethodId(paymentMethods?.[0]?.id?.toString() ?? ''); setPaymentAmount(total.toString()); }}>
                <CreditCard className="w-5 h-5 mr-2" />
                Bayar
              </Button>
            </div>
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
              <p className="text-3xl font-bold text-primary">Rp {total.toLocaleString('id-ID')}</p>
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
                    onClick={() => setPaymentAmount(prev => String((Number(prev) || 0) + nom))}
                    className="flex-1 min-w-[calc(25%-6px)] h-9 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary active:scale-95 transition-all"
                  >
                    {nom >= 1000 ? `${(nom / 1000)}K` : nom}
                  </button>
                ))}
                <button
                  onClick={() => setPaymentAmount(total.toString())}
                  className="flex-1 min-w-[calc(25%-6px)] h-9 rounded-lg border border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/10 active:scale-95 transition-all"
                >
                  Uang Pas
                </button>
              </div>
              <button
                onClick={() => setPaymentAmount('0')}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                Reset
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></p>
              <Input placeholder="Contoh: meja 3, pesanan Bu Ani..." value={remarks} onChange={e => setRemarks(e.target.value)} className="h-10" />
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

      {/* Receipt Dialog */}
      {lastTransaction && (
        <Receipt
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          transaction={lastTransaction}
          storeSettings={storeSettings}
          paymentMethodName={paymentMethods?.find(pm => pm.id === lastTransaction.paymentMethodId)?.name || 'Tunai'}
        />
      )}
    </div>
  );
}
