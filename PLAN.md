# PLAN.md — KasirGratisan Database Improvement & Feature Plan

## Dokumen Ini

Dokumen ini adalah Change Request / BRD (Business Requirements Document) untuk perbaikan database dan fitur baru KasirGratisan POS. Ditujukan untuk dikerjakan oleh AI Agent atau developer lain.

---

## Konteks

KasirGratisan adalah aplikasi POS offline-first berbasis PWA untuk UMKM Indonesia. Semua data disimpan di IndexedDB via Dexie.js. Tidak ada backend. Saat ini database masih version 1 dan ada beberapa kelemahan yang perlu diperbaiki sebelum production.

---

## Daftar Perubahan

### CR-1: Tambah Device ID di Store Settings

**Tujuan:** Menyediakan identifier unik anonim per device untuk keperluan analytics dan version check.

**Detail:**
- Tambahkan field `deviceId` (string, UUID v4) di interface `StoreSettings` pada `src/lib/db.ts`
- Nilai di-generate otomatis menggunakan `crypto.randomUUID()` saat:
  - Seed data pertama kali (di `seedDefaultData()`)
  - Migration dari DB version 1 ke 2 (untuk user existing)
- Tambahkan fallback: jika `seedDefaultData()` menemukan storeSettings yang sudah ada tapi belum punya `deviceId`, generate dan update
- Tidak ada UI untuk edit deviceId — ini purely internal

**File terdampak:** `src/lib/db.ts`

---

### CR-2: Soft Delete untuk Products, Categories, dan Suppliers

**Tujuan:** Mencegah data transaksi lama kehilangan referensi saat user menghapus produk/kategori/supplier.

**Detail:**
- Tambahkan 2 field baru di interface `Product`, `Category`, dan `Supplier`:
  - `isDeleted: boolean` (default: `false`)
  - `deletedAt: Date | null` (default: `null`)
- Saat user "hapus" entity, JANGAN hard delete. Ganti jadi update `isDeleted = true` dan `deletedAt = new Date()`
- Semua query yang menampilkan list produk/kategori/supplier harus filter `isDeleted === false` atau `!isDeleted`
- Tambahkan `isDeleted` sebagai index di Dexie stores untuk `products`, `categories`, `suppliers` (agar bisa query efisien)
- Migration DB v1→v2: set `isDeleted = false` dan `deletedAt = null` untuk semua record existing

**Tempat yang perlu filter soft delete:**

| File | Apa yang difilter |
|------|-------------------|
| `src/pages/Products.tsx` | List produk, ganti `db.products.delete()` jadi soft delete |
| `src/pages/Cashier.tsx` | List produk yang bisa dipilih, list kategori di filter chips |
| `src/pages/Settings.tsx` | List kategori, ganti `deleteCat()` jadi soft delete |
| `src/pages/Supplier.tsx` | List supplier, ganti delete jadi soft delete |
| `src/pages/StockIn.tsx` | Dropdown pilih produk |
| `src/pages/StockOut.tsx` | Dropdown pilih produk |
| `src/pages/Dashboard.tsx` | Low stock products alert |

**Catatan:** Payment methods TIDAK perlu soft delete karena di transaksi hanya disimpan `paymentMethodId` dan nama payment method bisa di-resolve saat display. Kalau payment method dihapus, cukup tampilkan fallback "Tunai" atau "-".

**File terdampak:** `src/lib/db.ts`, dan semua file di tabel di atas.

---

### CR-3: Unique Index untuk Receipt Number

**Tujuan:** Mencegah duplikasi nomor struk.

**Detail:**
- Ubah index `receiptNumber` di tabel `transactions` dari biasa menjadi unique
- Di Dexie, ini dilakukan dengan prefix `&` → `&receiptNumber`
- Perubahan ini masuk di DB version 2 stores definition
- Tidak ada perubahan UI — ini murni constraint di level database
- Jika terjadi duplikasi saat insert, Dexie akan throw error yang perlu di-handle gracefully

**File terdampak:** `src/lib/db.ts`

---

### CR-4: Database Migration Version 1 → 2

**Tujuan:** Menerapkan semua perubahan schema secara aman untuk user existing.

**Detail:**
- Tambahkan `this.version(2).stores({...}).upgrade(async tx => {...})` di constructor `PosDatabase`
- Version 1 stores definition HARUS tetap ada (Dexie butuh untuk migration path)
- Upgrade function harus melakukan:
  1. Set `isDeleted = false`, `deletedAt = null` di semua record `categories`, `products`, `suppliers`
  2. Generate `deviceId` (UUID v4) di semua record `storeSettings`
  3. Migrate embedded `items[]` dari setiap `Transaction` ke tabel baru `transactionItems` (lihat CR-5)
  4. Hapus field `items` dari record `transactions` yang sudah di-migrate (opsional, karena IndexedDB schemaless, tapi recommended untuk hemat storage)
- Stores definition version 2 harus mencakup:
  - Index baru `isDeleted` di `categories`, `products`, `suppliers`
  - Unique index `&receiptNumber` di `transactions`
  - Tabel baru `transactionItems` dengan index `++id, transactionId, productId`

**File terdampak:** `src/lib/db.ts`

---

### CR-5: Pisah TransactionItem ke Tabel Sendiri

**Tujuan:** Memungkinkan query per-item yang efisien (misal: produk terlaris, HPP calculation) tanpa harus load semua transaksi.

**Detail:**

**Interface baru `TransactionItemRecord`:**
- `id` (auto-increment)
- `transactionId` (FK ke transactions)
- `productId`
- `productName` (snapshot nama saat transaksi)
- `quantity`
- `price` (harga jual saat transaksi)
- `hpp` (HPP saat transaksi)
- `discountType` ('percentage' | 'nominal' | null)
- `discountValue`
- `discountAmount`
- `subtotal`

**Perubahan di Transaction interface:**
- Hapus field `items: TransactionItem[]` — items sekarang di tabel terpisah

**Tabel baru di Dexie stores:**
- `transactionItems: '++id, transactionId, productId'`

**Tempat yang perlu diubah karena sebelumnya akses `transaction.items`:**

| File | Perubahan |
|------|-----------|
| `src/pages/Cashier.tsx` | Saat checkout: simpan transaction dulu (dapat `txId`), lalu bulk insert items ke `transactionItems` dengan `transactionId = txId`. Untuk receipt setelah checkout, simpan items di local state. |
| `src/components/Receipt.tsx` | Tambah prop `items: TransactionItemRecord[]` di ReceiptProps. Ganti semua akses `transaction.items` ke prop `items`. |
| `src/pages/TransactionHistory.tsx` | Query `transactionItems` dan buat lookup map by `transactionId`. Ganti semua `tx.items` ke lookup dari map. Ini berlaku untuk: search filter, display nama produk di list, detail sheet, dan receipt dialog. |
| `src/pages/Reports.tsx` | Query `transactionItems` berdasarkan transaction IDs yang sudah difilter by date. Ganti HPP calculation dan top products aggregation untuk pakai data dari tabel items langsung. |
| `src/pages/Dashboard.tsx` | Recent transactions display: query items untuk 5 transaksi terakhir, buat lookup map, ganti `tx.items.map(...)` ke lookup. |
| `src/components/BackupReminder.tsx` | Export function: tambahkan `transactionItems: await db.transactionItems.toArray()` di backup data. |
| `src/pages/Settings.tsx` | Import function: tambahkan clear + bulkAdd untuk tabel `transactionItems`. |

**Migration data lama:** Ditangani di CR-4 (upgrade function).

**File terdampak:** `src/lib/db.ts` + semua file di tabel di atas.

---

### CR-6: Analytics / Version Check saat App Dibuka

**Tujuan:** Mengirim ping ke API setiap kali app dibuka untuk keperluan analytics (active users, version distribution) dan version check.

**Detail:**

**File baru: `src/lib/version-check.ts`**
- Buat fungsi `checkVersion()` yang:
  1. Ambil `deviceId` dari `storeSettings`
  2. Ambil `currentVersion` dari `package.json` (via `import.meta.env` atau hardcode constant)
  3. Kirim `GET` atau `POST` request ke configurable API URL dengan payload `{ deviceId, currentVersion }`
  4. API URL disimpan sebagai constant di file ini (mudah diganti nanti saat n8n endpoint ready)
  5. Request harus fire-and-forget — JANGAN block app loading, JANGAN tampilkan error ke user kalau gagal
  6. Gunakan `fetch()` dengan timeout pendek (5 detik) dan wrap dalam try-catch yang silent
  7. Tidak perlu handle response untuk sekarang (nanti bisa ditambah logic "ada update baru" kalau API sudah ready)

**Integrasi:**
- Panggil `checkVersion()` di `src/App.tsx` saat component mount (dalam `useEffect` dengan empty deps)
- Atau alternatif: panggil di `src/pages/Dashboard.tsx` karena itu halaman pertama yang dibuka user setelah onboarding

**Tidak perlu:**
- Throttle / rate limit — hit setiap kali buka app
- Simpan response di DB
- UI indicator apapun

**File terdampak:** `src/lib/version-check.ts` (baru), `src/App.tsx` atau `src/pages/Dashboard.tsx`

---

### CR-7: Backup/Restore Safety

**Tujuan:** Mencegah kehilangan data jika proses import/restore gagal di tengah jalan.

**Detail:**

**Perubahan di `src/pages/Settings.tsx` fungsi `handleImport()`:**

Saat ini flow import:
1. Clear semua tabel
2. BulkAdd dari file
3. Kalau gagal di step 2, data sudah hilang ❌

Flow baru yang aman:
1. Parse dan validasi file JSON terlebih dahulu (cek `version` field, cek struktur data)
2. Export/snapshot semua data existing ke memory (sama seperti `exportBackupData()` tapi simpan di variable, bukan download)
3. Clear semua tabel
4. BulkAdd dari file import
5. Jika step 4 gagal (catch error):
   - Clear semua tabel lagi
   - Restore dari snapshot di step 2
   - Tampilkan toast error "Import gagal, data dikembalikan"
6. Jika berhasil, tampilkan toast success

**Tambahan validasi:**
- Cek apakah file punya field `version` (sudah ada)
- Cek apakah minimal ada 1 tabel yang punya data
- Jangan import file yang size-nya 0 atau corrupt JSON

**Perubahan di `src/components/BackupReminder.tsx` fungsi `exportBackupData()`:**
- Tambahkan tabel `transactionItems` di export data (karena CR-5)
- Update `version` di backup format dari `1` ke `2`

**Backward compatibility:**
- Import harus tetap bisa handle backup format version 1 (yang masih punya `items[]` embedded di transactions)
- Jika import file version 1: setelah bulkAdd transactions, jalankan migration yang sama seperti CR-4 untuk extract items ke tabel `transactionItems`

**File terdampak:** `src/pages/Settings.tsx`, `src/components/BackupReminder.tsx`

---

### CR-8: Limit dan Compress Foto Produk

**Tujuan:** Mencegah database membengkak karena foto produk berukuran besar.

**Detail:**

**File baru: `src/lib/image-utils.ts`**
- Buat fungsi `compressImage(file: File, maxSizeKB?: number): Promise<string>` yang:
  1. Terima File object dari input
  2. Load ke Image element
  3. Resize: jika dimensi lebih dari 800px (width atau height), resize proportionally agar sisi terpanjang = 800px
  4. Compress: convert ke JPEG dengan quality mulai dari 0.8, turunkan bertahap sampai ukuran ≤ `maxSizeKB` (default: 200KB)
  5. Return sebagai base64 data URL string
  6. Gunakan Canvas API (native browser, tidak perlu library tambahan)

**Integrasi di `src/pages/Products.tsx`:**
- Saat ini field `photo` di Product interface ada tapi belum ada UI untuk upload foto
- Jika/saat UI upload foto ditambahkan, pastikan memanggil `compressImage()` sebelum simpan ke DB
- Jika sudah ada input foto di form produk, intercept file selection dan compress sebelum set ke state

**Catatan:** Saat ini di `Products.tsx` belum ada UI upload foto (field `photo` di interface ada tapi form tidak punya input file). Fungsi `compressImage()` tetap dibuat sebagai utility yang siap pakai. Dokumentasikan di AGENTS.md bahwa setiap upload foto produk HARUS melalui fungsi ini.

**File terdampak:** `src/lib/image-utils.ts` (baru), `src/pages/Products.tsx` (jika ada upload foto)

---

### CR-9: Info Storage Usage di Settings

**Tujuan:** Memberikan informasi ke user berapa storage yang terpakai oleh app.

**Detail:**

**Perubahan di `src/pages/Settings.tsx`:**
- Tambahkan section baru di halaman Settings, di bawah card "Backup & Restore" atau di card "About"
- Gunakan `navigator.storage.estimate()` untuk mendapatkan:
  - `usage`: bytes yang terpakai
  - `quota`: total bytes yang tersedia
- Tampilkan dalam format yang mudah dibaca:
  - "Penyimpanan: 2.3 MB / 1.2 GB terpakai"
  - Atau dengan progress bar visual
- `navigator.storage.estimate()` return Promise, jadi panggil di `useEffect` dan simpan di state
- Jika API tidak tersedia (browser lama), tampilkan "Tidak tersedia" atau sembunyikan section ini
- Format bytes ke human readable (KB, MB, GB) dengan helper function

**UI:**
- Bisa berupa text sederhana di dalam card About yang sudah ada
- Atau card terpisah kecil dengan icon HardDrive/Database
- Bahasa Indonesia: "Penyimpanan Terpakai"

**File terdampak:** `src/pages/Settings.tsx`

---

## Urutan Eksekusi yang Disarankan

| Urutan | Task | Alasan |
|--------|------|--------|
| 1 | CR-1, CR-2, CR-3, CR-4 | Semua perubahan schema DB harus dilakukan bersamaan dalam satu migration v1→v2 |
| 2 | CR-5 | Pisah TransactionItem — ini yang paling banyak file terdampak, kerjakan setelah schema stable |
| 3 | CR-7 | Backup/restore safety — update setelah tabel baru sudah ada |
| 4 | CR-6 | Version check — independent, bisa kapan saja |
| 5 | CR-8 | Image compress — independent utility |
| 6 | CR-9 | Storage info — independent UI addition |

---

## Testing Checklist

Setelah semua CR diimplementasi, pastikan:

- [x] App bisa dibuka fresh (DB baru) tanpa error
- [x] App bisa dibuka dengan DB v1 existing dan migration berjalan (data lama tidak hilang)
- [x] Soft delete: produk yang dihapus tidak muncul di list tapi transaksi lama tetap tampil benar
- [x] Transaksi baru tersimpan dengan items di tabel terpisah
- [x] Receipt/struk menampilkan items dengan benar (dari tabel baru)
- [x] Reports menghitung HPP dan top products dengan benar dari tabel items
- [x] TransactionHistory search by product name masih berfungsi
- [x] Export backup menghasilkan JSON dengan tabel `transactionItems`
- [x] Import backup v1 (format lama) tetap bisa di-restore dan items ter-migrate
- [x] Import backup v2 (format baru) berfungsi normal
- [x] Import yang gagal di tengah jalan me-rollback data ke kondisi sebelumnya
- [x] `deviceId` ter-generate dan persistent setelah app restart
- [x] Version check fire-and-forget tanpa block UI
- [x] `compressImage()` menghasilkan output ≤ 200KB
- [x] Storage info tampil di Settings dengan angka yang masuk akal

---

## Update AGENTS.md

Setelah semua CR selesai, update `AGENTS.md` untuk mencerminkan:
- DB version sekarang 2
- Tabel baru `transactionItems` beserta indexes
- Field baru di interfaces (`isDeleted`, `deletedAt`, `deviceId`)
- File baru (`image-utils.ts`, `version-check.ts`)
- Aturan: setiap upload foto HARUS melalui `compressImage()`
- Aturan: delete produk/kategori/supplier HARUS soft delete
- Backup format version 2 structure