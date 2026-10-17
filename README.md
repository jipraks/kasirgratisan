# 🧾 FreeKasir

A free, offline-first, open source Point of Sale (POS) Progressive Web App built for Indonesian Micro, Small, and Medium Enterprises (UMKM). All data is stored locally on the user's device — no server, no registration, no cost.

---

## ✨ Features

- **POS / Cashier** — Full cashier interface with cart, per-item & per-transaction discounts, payment method selection, and automatic change calculation
- **Open Bill** — Save transactions as open bills for later checkout, with customer name, table number, per-item notes, and remarks (also shown on the receipt)
- **Multi-User Mode** — Optional opt-in mode with owner + staff roles and granular per-staff permissions (e.g. manage products, view reports, do refunds). Staff log in with username + 4-6 digit PIN
- **Multi-Language** — Spanish (default) and English translations via i18next. Language can be switched from Settings or during onboarding
- **Responsive Layout** — Mobile-first phone UI with landscape/tablet mode featuring side-by-side cashier (products + cart) and adaptive grid columns
- **Barcode Scanning** — Scan product barcodes via camera (supports EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, ITF, Code-93, QR) with robust permission handling for installed PWAs, or manual keyboard entry
- **Product Management** — Complete CRUD with categories, SKU (unique & required), units, optional descriptions (searchable, previewable in cashier), photos, and barcode support
- **Master Data Satuan (Units)** — Manage units of measurement with CRUD; safe deletion blocked when in use by products
- **Stock Management** — Stock in (from suppliers) and stock out (damaged, lost, returned, etc.)
- **Automatic COGS (HPP)** — Cost of Goods Sold is automatically calculated using the weighted average method on each stock-in
- **Sales Reports** — 7/30 day sales charts, top products, total revenue & profit
- **Transaction History** — Browse completed transactions with open bill filter tabs; delete transactions with optional stock restore
- **Supplier Management** — Manage supplier contacts and details
- **Backup & Restore** — Export/import all data as JSON, with automatic backup reminders
- **PWA** — Installable to home screen, fully offline with Service Worker (Workbox), supports any orientation. Install button is also available from Settings with adaptive instructions for iOS Safari and Chrome/Edge
- **Android APK** — Ships as a native Android app via Capacitor from the same codebase, running in parallel with the PWA. Includes app icon, splash screen, and native status bar handling
- **Bluetooth Thermal Printing** — Print receipts to ESC/POS thermal printers. PWA uses Web Bluetooth (Chrome on Android); the Android APK uses Classic Bluetooth, with a configurable default printer selection (APK-only setting)
- **Onboarding** — Interactive tutorial for first-time users (the PWA install step is automatically skipped in the APK)
- **Dark Mode** — Full dark theme support
- **Theme Customization** — Pick your preferred accent color

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Theming | next-themes (dark mode) |
| Database | IndexedDB via Dexie.js |
| Charts | Recharts |
| Routing | React Router DOM v6 |
| Forms & Validation | React Hook Form + Zod |
| State | @tanstack/react-query |
| Icons | Lucide React |
| i18n | i18next + react-i18next |
| Date | date-fns (id, en-US, ms locales) |
| PWA | vite-plugin-pwa (Workbox) |
| Barcode | html5-qrcode (camera scanner + manual input) |
| Receipt | html2canvas (to PNG), Web Bluetooth Print (PWA), Bluetooth Classic (Android APK via Capacitor) |
| Font | Plus Jakarta Sans |
| Native Wrapper | Capacitor 8 (Android) |

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js](https://nodejs.org/) v18+ (via [nvm](https://github.com/nvm-sh/nvm))
- npm, yarn, or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/user/kasirgratisan.git
cd kasirgratisan

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be running at `http://localhost:8080`.

### Production Build (PWA/Web)

```bash
npm run build
npm run preview
```

### Android Build (Capacitor)

This project can also run as a native Android app using Capacitor while keeping the PWA/web version working from the same codebase.

Requirements:

- Android Studio installed
- Android SDK configured
- JDK 21 (Android Studio bundled JBR works)

#### Set JAVA_HOME

**macOS / Linux:**

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

**Windows (PowerShell):**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

> Adjust the path if your Android Studio is installed elsewhere.

#### Build debug APK

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Build release AAB (for Play Store)

```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

> The release AAB must be signed before uploading to Google Play. See [Android signing docs](https://developer.android.com/studio/publish/app-signing).

#### Useful scripts

```bash
npm run cap:sync      # build web bundle and sync Capacitor
npm run cap:android   # build, sync, then open Android Studio
npm run cap:run       # build, sync, then run on connected Android device/emulator
```

---

## 📁 Project Structure

```
src/
├── App.tsx                  # Root component & routing
├── main.tsx                 # Entry point
├── index.css                # Design tokens (HSL CSS variables)
├── lib/
│   ├── db.ts                # Dexie database schema, interfaces, seed data
│   ├── auth.ts              # Multi-user auth helpers (PIN hashing, sessions, validation)
│   ├── utils.ts             # Utility functions (cn, etc.)
│   ├── image-utils.ts       # Image compression utility
│   └── version-check.ts     # Version check webhook
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx    # Main layout (responsive: max-w-lg mobile, max-w-6xl tablet/landscape)
│   │   └── BottomNav.tsx    # Bottom nav (5 tabs, center cashier CTA)
│   ├── Onboarding.tsx       # First-run tutorial & store setup
│   ├── LoginScreen.tsx      # Multi-user login (username + PIN)
│   ├── LockedPage.tsx       # Permission-gated route fallback
│   ├── NavLink.tsx          # Permission-aware nav link
│   ├── BackupReminder.tsx   # Backup reminder & export utility
│   ├── Receipt.tsx          # Receipt component (view, download, share, Bluetooth print)
│   ├── BarcodeScanner.tsx   # Barcode/QR scanner with PWA-aware permission handling
│   ├── ThemeColorPicker.tsx # Accent color picker (8 presets)
│   ├── LanguageSwitcher.tsx # Language picker (ID, EN, MS)
│   └── ui/                  # shadcn/ui components (40+)
├── i18n/
│   ├── index.ts             # i18next initialization
│   └── locales/
│       ├── es/               # Spanish (default and fallback)
│       └── en/               # English
├── pages/
│   ├── Dashboard.tsx        # Home: stats, quick actions, low stock alerts
│   ├── Cashier.tsx          # POS / cashier (barcode scan input, camera scanner, side-by-side cart on landscape)
│   ├── Products.tsx         # Product CRUD (with description, SKU, units, photos)
│   ├── Reports.tsx          # Sales reports & charts
│   ├── Settings.tsx         # Settings (store, payments, categories, units, theme, backup, install PWA)
│   ├── Users.tsx            # Multi-user management (owner only)
│   ├── Supplier.tsx         # Supplier CRUD
│   ├── StockIn.tsx          # Stock in + COGS calculation
│   ├── StockOut.tsx         # Stock out
│   ├── StockReport.tsx      # Stock movement reports
│   ├── TransactionHistory.tsx # Transaction history with open bill filter tabs
│   └── NotFound.tsx         # 404 page
└── hooks/
    ├── use-auth.tsx         # Multi-user auth context (current user, permissions, login/logout)
    ├── use-pwa-install.ts   # PWA install prompt + standalone detection (incl. iOS)
    ├── use-theme-color.ts   # Accent color persistence
    ├── use-mobile.tsx       # Mobile breakpoint detection
    └── use-toast.ts         # Toast helper
```

---

## 💾 Database

All data is stored locally in the browser using IndexedDB (via Dexie.js). No data is ever sent to any server.

### Tables

| Table | Description |
|-------|-------------|
| `users` | Multi-user accounts (owner/staff role, hashed PIN, granular permissions) |
| `categories` | Product categories (name, color, icon) |
| `products` | Master products (name, SKU, sell price, COGS, stock, unit, description) |
| `units` | Master units of measurement |
| `suppliers` | Supplier data |
| `stockIns` | Stock-in records |
| `stockOuts` | Stock-out records |
| `hppHistory` | COGS change audit trail |
| `paymentMethods` | Payment methods (Cash, Bank Transfer, QRIS, etc.) |
| `transactions` | Sales transactions (status: open/completed, customer name, table number, remarks) |
| `transactionItems` | Individual items within each transaction (per-item notes & discount) |
| `storeSettings` | Store settings & app state (incl. multi-user toggle) |

### COGS Calculation (Weighted Average)

When stock is received, COGS is automatically recalculated:

```
New COGS = ((Old Stock × Old COGS) + (New Qty × Buy Price)) / (Old Stock + New Qty)
```

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

### Guidelines

- UI text uses **i18next** — add new strings to `src/i18n/locales/{id,en,ms}/` JSON files inside the appropriate namespace (`common`, `settings`, `products`, `reports`, `dashboard`, `onboarding`)
- Use `useTranslation('namespace')` hook and `t('key')` in components
- Currency and number formatting should be locale-aware using `i18n.language` and `NUMBER_LOCALES` / `CURRENCY_SYMBOL` maps
- Date formatting should use `date-fns` with locale from `LOCALES` map
- Use existing `shadcn/ui` components from `src/components/ui/`
- All monetary values are stored as integer Colombian pesos (COP, no decimals)
- Format numbers using `toLocaleString('id-ID')`
- New features must work fully offline (no API calls)
- Use `useLiveQuery()` from `dexie-react-hooks` for reactive data binding
- Gate sensitive UI/actions with the `can()` helper from `useAuth()` when multi-user is enabled

---

## 📄 License

[MIT License](LICENSE)

---

## 🙏 Credits

Built with ❤️ for Indonesian small businesses.

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Dexie.js](https://dexie.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [Recharts](https://recharts.org/)
