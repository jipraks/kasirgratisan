# AGENTS.md - KasirGratisan POS UMKM Documentation

## Project Overview

**KasirGratisan** is a free, offline-first, mobile-first Point of Sale (POS) Progressive Web App (PWA) built for Indonesian Micro, Small, and Medium Enterprises (UMKM). All data is stored locally on the user's device using IndexedDB — there is **no backend, no server, no authentication**.

- **Language**: All UI is in **Bahasa Indonesia**
- **Target**: Smartphone users (UMKM owners)
- **Cost**: Completely free, no subscriptions
- **Data**: 100% local (IndexedDB via Dexie.js)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui components |
| Font | Plus Jakarta Sans (Google Fonts) |
| Database | IndexedDB via **Dexie.js** + **dexie-react-hooks** |
| Charts | Recharts |
| Routing | React Router DOM v6 |
| Icons | Lucide React |
| Notifications | Sonner (toasts) |
| PWA | vite-plugin-pwa (Workbox) with auto-update & offline caching |

---

## Project Structure

```
src/
├── App.tsx                    # Root with routes
├── main.tsx                   # Entry point
├── index.css                  # Design tokens (HSL CSS variables)
├── lib/
│   ├── utils.ts               # cn() utility
│   └── db.ts                  # ★ Dexie database schema + seed data
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # Main layout with bottom nav
│   │   └── BottomNav.tsx      # Bottom navigation (5 tabs, center CTA)
│   ├── Onboarding.tsx         # First-run tutorial + store setup
│   ├── BackupReminder.tsx     # Backup reminder + export utility
│   ├── Receipt.tsx            # Receipt component (struk)
│   ├── NavLink.tsx            # Navigation link component
│   ├── ThemeColorPicker.tsx   # Theme color customization picker
│   └── ui/                    # shadcn/ui components
├── pages/
│   ├── Dashboard.tsx          # Home: stats, quick actions, low stock
│   ├── Cashier.tsx            # ★ POS/cashier interface
│   ├── Products.tsx           # Product CRUD
│   ├── Reports.tsx            # Sales reports + charts
│   ├── Settings.tsx           # Settings hub (store, payments, categories, backup)
│   ├── Supplier.tsx           # Supplier CRUD
│   ├── StockIn.tsx            # Stock in + weighted avg HPP calculation
│   ├── StockOut.tsx           # Stock out (non-sales)
│   ├── TransactionHistory.tsx # Transaction history list
│   └── NotFound.tsx           # 404 page
├── hooks/
│   ├── use-mobile.tsx         # Mobile detection hook
│   ├── use-pwa-install.ts     # PWA install prompt hook
│   ├── use-theme-color.ts     # Theme color persistence hook
│   └── use-toast.ts           # Toast notification hook
└── test/
    ├── setup.ts               # Vitest setup
    └── example.test.ts        # Example test
```

---

## Database Schema (Dexie.js / IndexedDB)

Database name: `kasirgratisan-db`

### Tables & Indexes

| Table | Indexes | Description |
|-------|---------|-------------|
| `categories` | `++id, name` | Product categories (icon, color) |
| `products` | `++id, name, sku, categoryId, barcode` | Master products |
| `suppliers` | `++id, name` | Supplier contacts |
| `stockIns` | `++id, productId, supplierId, date` | Purchase/receiving records |
| `stockOuts` | `++id, productId, date` | Non-sales stock exits |
| `hppHistory` | `++id, productId, date` | HPP change audit trail |
| `paymentMethods` | `++id, name, category` | Custom payment methods |
| `transactions` | `++id, date, receiptNumber, paymentMethodId` | Completed sales |
| `storeSettings` | `++id` | Store info + app state |


### Key Interfaces

See `src/lib/db.ts` for full TypeScript interfaces. Key fields:

- **Product**: `name, sku, categoryId, price (sell), hpp (cost), stock, unit, barcode, photo`
- **Transaction**: `items[] (with per-item discounts), subtotal, discountType/Value/Amount, total, paymentMethodId, paymentAmount, change, profit, receiptNumber, remarks`
- **StoreSettings**: `storeName, address, phone, receiptFooter, onboardingDone, lastBackupAt, themeColor`

### HPP Calculation (Weighted Average)

When stock is received (`StockIn`), HPP is recalculated:

```
newHpp = ((oldStock × oldHpp) + (newQty × buyPrice)) / (oldStock + newQty)
```

This happens automatically in `src/pages/StockIn.tsx`. History is saved in `hppHistory` table.

---

## Features & Status

### ✅ Implemented

| Feature | File(s) | Notes |
|---------|---------|-------|
| Onboarding (tutorial + store setup) | `Onboarding.tsx` | 4 tutorial slides + store form; skipped if `onboardingDone=true` |
| Dashboard | `Dashboard.tsx` | Today's sales/profit, quick actions, low stock alerts |
| Master Produk (CRUD) | `Products.tsx` | Search, category filter, add/edit/delete with dialog |
| Kasir (POS) | `Cashier.tsx` | Product grid, cart, item/transaction discounts, payment, change calc |
| Supplier (CRUD) | `Supplier.tsx` | Name, phone, address, notes |
| Stock In | `StockIn.tsx` | From supplier, auto HPP recalc, history |
| Stock Out | `StockOut.tsx` | With reason (rusak, hilang, retur, etc.) |
| Laporan (Reports) | `Reports.tsx` | 7/30 day view, bar chart, top products |
| Pengaturan (Settings) | `Settings.tsx` | Store info, payment methods, categories, backup/restore |
| Transaction History | `TransactionHistory.tsx` | List of past transactions |
| Receipt | `Receipt.tsx` | Receipt/struk component |
| Backup & Restore | `BackupReminder.tsx` + `Settings.tsx` | JSON export/import, 24h reminder |
| Bottom Nav with CTA | `BottomNav.tsx` | Center Kasir button with prominent circle |
| Theme Customization | `ThemeColorPicker.tsx` + `use-theme-color.ts` | Custom accent color picker with persistence |
| Seed Data | `db.ts` | Default categories (Makanan, Minuman, Lainnya) + payment methods (Tunai, Transfer, QRIS) |
| Service Worker | `vite.config.ts` | PWA with Workbox, auto-update, offline caching for assets & Google Fonts |
| PWA Install Prompt | `use-pwa-install.ts` | Browser native install prompt (requires HTTPS + user engagement) |

### 🔲 Not Yet Implemented

| Feature | Priority | Notes |
|---------|----------|-------|
| Cetak Struk (Receipt Print) | High | Generate PDF/image, WhatsApp share, Bluetooth thermal print (Web Bluetooth API, Chrome Android only) |
| Barcode/QR Scanner | Medium | Camera-based scanning for product lookup |
| HPP Manual Adjustment | Low | UI exists in plan but not yet built |
| Stock Report | Low | Stock in vs out report in Reports |

---

## Design System

### Theme Colors (HSL in `src/index.css`)

| Token | Light Mode | Usage |
|-------|-----------|-------|
| `--primary` | `25 95% 53%` (Orange) | Brand color, CTA buttons, highlights |
| `--accent` | `172 66% 50%` (Teal) | Secondary accent |
| `--success` | `142 71% 45%` (Green) | Profit, stock in indicators |
| `--warning` | `38 92% 50%` (Amber) | Backup reminders, low stock |
| `--destructive` | `0 84% 60%` (Red) | Delete, stock out, errors |
| `--background` | `210 20% 98%` | Page background |
| `--foreground` | `215 25% 12%` | Text color |

Custom tokens `--success` and `--warning` are added to `tailwind.config.ts` as `success` and `warning` color groups.

### Typography

- Font: **Plus Jakarta Sans** (loaded via Google Fonts CDN in `index.css`)
- Weights: 400, 500, 600, 700, 800

### Layout

- **Max width**: `max-w-lg` (32rem/512px) centered
- **Bottom nav height**: `h-16` (4rem) + safe area
- **Content padding bottom**: `pb-20` (5rem) to avoid nav overlap
- **Mobile-first**: No desktop-specific layouts

---

## Routing

| Path | Component | Access |
|------|-----------|--------|
| `/` | Dashboard | Bottom nav "Beranda" |
| `/cashier` | Cashier | Bottom nav center CTA |
| `/products` | Products | Bottom nav "Produk" |
| `/reports` | Reports | Bottom nav "Laporan" |
| `/settings` | Settings | Bottom nav "Lainnya" |
| `/supplier` | SupplierPage | Via Settings → Manajemen Stok |
| `/stock-in` | StockInPage | Via Settings → Manajemen Stok |
| `/stock-out` | StockOutPage | Via Settings → Manajemen Stok |
| `/history` | TransactionHistory | Via Dashboard / Cashier |

All routes are wrapped in `AppLayout` which provides bottom navigation.

---

## Key Implementation Details

### Data Flow: Transaction

1. User adds products to cart in Cashier
2. Optional: per-item and/or transaction-level discounts
3. User selects payment method and enters payment amount
4. On confirm: transaction saved to `transactions` table
5. Stock automatically deducted from each product
6. Toast notification with receipt number

### Data Flow: Stock In → HPP

1. User selects product + supplier + quantity + buy price
2. Weighted average HPP calculated: `((oldStock × oldHpp) + (qty × buyPrice)) / newTotalStock`
3. HPP change saved to `hppHistory` (audit trail)
4. Product `stock` and `hpp` fields updated

### Backup Format

JSON file with structure:
```json
{
  "version": 1,
  "exportedAt": "ISO date",
  "categories": [...],
  "products": [...],
  "suppliers": [...],
  "stockIns": [...],
  "stockOuts": [...],
  "hppHistory": [...],
  "paymentMethods": [...],
  "transactions": [...],
  "storeSettings": [...]
}
```

Import clears all tables then bulk-inserts from file.

---

## Development Notes

- **No backend**: Everything runs client-side. No API calls, no auth, no server.
- **Dexie live queries**: `useLiveQuery()` from `dexie-react-hooks` provides reactive data binding — UI auto-updates when IndexedDB changes.
- **shadcn/ui**: Components are in `src/components/ui/`. They use Radix primitives + Tailwind.
- **All monetary values**: Stored as integers (Rupiah, no decimals). Formatted with `toLocaleString('id-ID')`.
- **Date handling**: Uses `date-fns` with Indonesian locale (`id`).
- **No testing framework in active use**: `vitest` is configured but only has an example test.

---

## Common Tasks for Future Development

### Adding a new page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx` inside the `<Route element={<AppLayout />}>` group
3. If navigable from Settings, add a link card there

### Adding a new DB table
1. Add interface in `src/lib/db.ts`
2. Add table property to `PosDatabase` class
3. **Increment version number** and add new store in `.stores()`
4. Optionally add seed data in `seedDefaultData()`
5. Add to backup export/import in `BackupReminder.tsx` and `Settings.tsx`

### Modifying the design system
1. Update CSS variables in `src/index.css` (both `:root` and `.dark`)
2. If new color group, add to `tailwind.config.ts` under `extend.colors`
3. Use semantic tokens in components: `bg-primary`, `text-success`, etc.