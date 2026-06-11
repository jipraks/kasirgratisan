# Shift Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a complete cashier shift system into the current POS: open shift, require active shift for cashier, attach transactions to shifts, close shift with cash reconciliation, print shift report, and include shifts in backup/restore.

**Architecture:** Add a Dexie `shifts` table and optional `shiftId` on transactions. Keep shift business rules in `src/lib/shifts.ts`, UI in `src/pages/Shifts.tsx`, and print output in `src/components/ShiftReportReceipt.tsx`. Cashier only needs to query the active shift and write `shiftId` when saving/opening/completing transactions.

**Tech Stack:** Vite, React, TypeScript, Dexie, dexie-react-hooks, shadcn/ui, Vitest, date-fns, lucide-react.

---

## File Structure

- Modify `src/lib/db.ts`
  - Add `manage_shifts` permission.
  - Add `Shift` interface.
  - Add `shiftId?: number` to `Transaction`.
  - Add Dexie table `shifts` and schema version 11.
- Modify `src/lib/auth.ts`
  - Add Indonesian label for `manage_shifts`.
- Create `src/lib/shifts.ts`
  - All shift calculations and mutations.
- Create `src/lib/shifts.test.ts`
  - Unit/integration tests for opening and closing shifts.
- Create `src/components/ShiftReportReceipt.tsx`
  - Printable shift report dialog.
- Create `src/pages/Shifts.tsx`
  - Open/active/close/history UI.
- Modify `src/App.tsx`
  - Add `/shifts` route.
- Modify `src/pages/Settings.tsx`
  - Add shortcut to Shift Kasir.
- Modify `src/pages/Cashier.tsx`
  - Require active shift and write `shiftId`.
- Modify `src/lib/backup.ts`
  - Include shifts in export/restore/snapshot rollback.

---

### Task 1: Database, Permission, and Backup Schema

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/backup.ts`

- [ ] **Step 1: Add database types**

In `src/lib/db.ts`, add `manage_shifts` to `PermissionKey` and `ALL_PERMISSIONS`, add `shiftId?: number` to `Transaction`, create `Shift`, and add `shifts!: Table<Shift>;`.

Expected `Shift` type:

```ts
export interface Shift {
  id?: number;
  code: string;
  status: 'open' | 'closed';
  openedAt: Date;
  closedAt: Date | null;
  openedBy?: number;
  closedBy?: number;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalTransactions: number;
  totalProfit: number;
  notes?: string;
}
```

- [ ] **Step 2: Add Dexie version 11**

Append version 11 after version 10 in `src/lib/db.ts`:

```ts
this.version(11).stores({
  categories:        '++id, name, isDeleted',
  products:          '++id, name, &sku, categoryId, barcode, isDeleted, createdBy, updatedBy',
  suppliers:         '++id, name, isDeleted',
  customers:         '++id, name, isDeleted',
  stockIns:          '++id, productId, supplierId, date, createdBy',
  stockOuts:         '++id, productId, date, createdBy',
  hppHistory:        '++id, productId, date',
  paymentMethods:    '++id, name, category',
  transactions:      '++id, date, &receiptNumber, paymentMethodId, status, orderNumber, createdBy, shiftId',
  transactionItems:  '++id, transactionId, productId',
  storeSettings:     '++id',
  units:             '++id, &name, isDeleted',
  users:             '++id, &username, role, isActive',
  expenseCategories: '++id, name, isDeleted',
  expenses:          '++id, date, categoryId, paymentMethodId, createdBy, isDeleted',
  shifts:            '++id, status, openedAt, closedAt, openedBy, closedBy',
});
```

- [ ] **Step 3: Add permission label**

In `src/lib/auth.ts`, add:

```ts
manage_shifts: {
  title: 'Kelola Shift Kasir',
  desc: 'Buka, tutup, dan cetak laporan shift kasir',
},
```

- [ ] **Step 4: Include shifts in backup**

In `src/lib/backup.ts`, add `shifts: await db.shifts.toArray()` to export and rollback snapshots, clear `db.shifts`, and restore `data.shifts` with `bulkAdd`.

- [ ] **Step 5: Verify TypeScript compiles for schema changes**

Run:

```bash
npx eslint src/lib/db.ts src/lib/auth.ts src/lib/backup.ts
```

Expected: no errors.

---

### Task 2: Shift Business Logic and Tests

**Files:**
- Create: `src/lib/shifts.ts`
- Create: `src/lib/shifts.test.ts`

- [ ] **Step 1: Write tests**

Create tests that reset tables, seed payment methods, create completed transactions with `shiftId`, and assert:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { calculateShiftSummary, closeShift, getActiveShift, openShift } from './shifts';

describe('shift business logic', () => {
  beforeEach(async () => {
    await db.transaction('rw', db.shifts, db.transactions, db.paymentMethods, async () => {
      await db.shifts.clear();
      await db.transactions.clear();
      await db.paymentMethods.clear();
      await db.paymentMethods.bulkAdd([
        { id: 1, name: 'Tunai', category: 'tunai', isDefault: true, createdAt: new Date() },
        { id: 2, name: 'QRIS', category: 'qris', isDefault: false, createdAt: new Date() },
      ]);
    });
  });

  it('opens one active shift only', async () => {
    const first = await openShift({ openingCash: 100000, openedBy: 1, notes: 'Pagi' });
    expect(first.status).toBe('open');
    await expect(openShift({ openingCash: 0, openedBy: 1 })).rejects.toThrow('Masih ada shift aktif');
    await expect(getActiveShift()).resolves.toMatchObject({ id: first.id, status: 'open' });
  });

  it('summarizes completed shift transactions only', async () => {
    const shift = await openShift({ openingCash: 50000, openedBy: 1 });
    await db.transactions.bulkAdd([
      completedTx({ receiptNumber: 'R-1', total: 100000, paymentMethodId: 1, profit: 30000, shiftId: shift.id }),
      completedTx({ receiptNumber: 'R-2', total: 75000, paymentMethodId: 2, profit: 20000, shiftId: shift.id }),
      completedTx({ receiptNumber: 'R-3', total: 999999, paymentMethodId: 1, profit: 1, shiftId: undefined }),
    ]);

    const summary = await calculateShiftSummary(shift.id!);
    expect(summary.totalTransactions).toBe(2);
    expect(summary.totalSales).toBe(175000);
    expect(summary.totalCashSales).toBe(100000);
    expect(summary.totalNonCashSales).toBe(75000);
    expect(summary.totalProfit).toBe(50000);
    expect(summary.expectedCash).toBe(150000);
  });

  it('closes shift with cash reconciliation', async () => {
    const shift = await openShift({ openingCash: 50000, openedBy: 1 });
    await db.transactions.add(completedTx({ receiptNumber: 'R-1', total: 100000, paymentMethodId: 1, profit: 30000, shiftId: shift.id }));

    const closed = await closeShift({ shiftId: shift.id!, closingCash: 140000, closedBy: 2, notes: 'Minus 10rb' });
    expect(closed.status).toBe('closed');
    expect(closed.expectedCash).toBe(150000);
    expect(closed.cashDifference).toBe(-10000);
    expect(closed.totalTransactions).toBe(1);
  });
});

function completedTx(input: { receiptNumber: string; total: number; paymentMethodId: number; profit: number; shiftId?: number }) {
  return {
    subtotal: input.total,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    total: input.total,
    paymentMethodId: input.paymentMethodId,
    paymentAmount: input.total,
    change: 0,
    profit: input.profit,
    date: new Date(),
    receiptNumber: input.receiptNumber,
    status: 'completed' as const,
    createdBy: 1,
    shiftId: input.shiftId,
  };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/lib/shifts.test.ts
```

Expected: fails because `src/lib/shifts.ts` does not exist.

- [ ] **Step 3: Implement `src/lib/shifts.ts`**

Implement:

```ts
import { db, type Shift, type Transaction } from './db';

export interface ShiftSummary {
  totalSales: number;
  totalCashSales: number;
  totalNonCashSales: number;
  totalTransactions: number;
  totalProfit: number;
  expectedCash: number;
}

export async function getActiveShift(): Promise<Shift | undefined> {
  return db.shifts.where('status').equals('open').first();
}

export function formatShiftCode(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `SHIFT-${yyyy}${mm}${dd}-${hh}${min}`;
}

export async function getShiftTransactions(shiftId: number): Promise<Transaction[]> {
  return db.transactions
    .where('shiftId')
    .equals(shiftId)
    .and((tx) => tx.status === 'completed')
    .toArray();
}

export async function calculateShiftSummary(shiftId: number): Promise<ShiftSummary> {
  const shift = await db.shifts.get(shiftId);
  if (!shift) throw new Error('Shift tidak ditemukan');

  const transactions = await getShiftTransactions(shiftId);
  const paymentMethods = await db.paymentMethods.toArray();
  const cashPaymentIds = new Set(
    paymentMethods
      .filter((method) => method.category.toLowerCase() === 'tunai' || method.name.toLowerCase().includes('tunai'))
      .map((method) => method.id)
      .filter((id): id is number => typeof id === 'number')
  );

  const totalSales = transactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalCashSales = transactions.reduce(
    (sum, tx) => sum + (cashPaymentIds.has(tx.paymentMethodId) ? tx.total : 0),
    0
  );
  const totalNonCashSales = totalSales - totalCashSales;
  const totalProfit = transactions.reduce((sum, tx) => sum + tx.profit, 0);

  return {
    totalSales,
    totalCashSales,
    totalNonCashSales,
    totalTransactions: transactions.length,
    totalProfit,
    expectedCash: shift.openingCash + totalCashSales,
  };
}

export async function openShift(input: { openingCash: number; openedBy?: number; notes?: string }): Promise<Shift> {
  if (input.openingCash < 0) throw new Error('Kas awal tidak boleh negatif');
  const activeShift = await getActiveShift();
  if (activeShift) throw new Error('Masih ada shift aktif');

  const now = new Date();
  const shift: Shift = {
    code: formatShiftCode(now),
    status: 'open',
    openedAt: now,
    closedAt: null,
    openedBy: input.openedBy,
    openingCash: input.openingCash,
    totalSales: 0,
    totalCashSales: 0,
    totalNonCashSales: 0,
    totalTransactions: 0,
    totalProfit: 0,
    notes: input.notes?.trim() || undefined,
  };

  const id = await db.shifts.add(shift);
  return { ...shift, id: id as number };
}

export async function closeShift(input: { shiftId: number; closingCash: number; closedBy?: number; notes?: string }): Promise<Shift> {
  if (input.closingCash < 0) throw new Error('Kas akhir tidak boleh negatif');
  const shift = await db.shifts.get(input.shiftId);
  if (!shift) throw new Error('Shift tidak ditemukan');
  if (shift.status !== 'open') throw new Error('Shift sudah ditutup');

  const summary = await calculateShiftSummary(input.shiftId);
  const updated: Partial<Shift> = {
    status: 'closed',
    closedAt: new Date(),
    closedBy: input.closedBy,
    closingCash: input.closingCash,
    expectedCash: summary.expectedCash,
    cashDifference: input.closingCash - summary.expectedCash,
    totalSales: summary.totalSales,
    totalCashSales: summary.totalCashSales,
    totalNonCashSales: summary.totalNonCashSales,
    totalTransactions: summary.totalTransactions,
    totalProfit: summary.totalProfit,
    notes: input.notes?.trim() || shift.notes,
  };

  await db.shifts.update(input.shiftId, updated);
  const closed = await db.shifts.get(input.shiftId);
  if (!closed) throw new Error('Shift tidak ditemukan setelah ditutup');
  return closed;
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npx vitest run src/lib/shifts.test.ts
```

Expected: pass.

---

### Task 3: Shift Page and Print Report

**Files:**
- Create: `src/components/ShiftReportReceipt.tsx`
- Create: `src/pages/Shifts.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Create print component**

Create `ShiftReportReceipt.tsx` that accepts `open`, `onClose`, `shift`, `storeSettings`, `openedByName`, `closedByName`, and renders a dialog with a print button calling `window.print()`.

- [ ] **Step 2: Create `/shifts` page**

Create `Shifts.tsx` with:
- permission gate `can('manage_shifts')`
- live active shift query
- live recent shifts query
- open shift form
- close shift form
- recent shift cards
- report print dialog for closed shifts

- [ ] **Step 3: Add route**

In `src/App.tsx`, import `ShiftsPage` and add route:

```tsx
<Route
  path="/shifts"
  element={
    <ErrorBoundary>
      <ShiftsPage />
    </ErrorBoundary>
  }
/>
```

- [ ] **Step 4: Add settings shortcut**

In `src/pages/Settings.tsx`, add a `manage_shifts` gated shortcut linking to `/shifts`.

- [ ] **Step 5: Verify route and page lint**

Run:

```bash
npx eslint src/components/ShiftReportReceipt.tsx src/pages/Shifts.tsx src/App.tsx src/pages/Settings.tsx
```

Expected: no errors.

---

### Task 4: Cashier Integration

**Files:**
- Modify: `src/pages/Cashier.tsx`

- [ ] **Step 1: Query active shift**

Add `activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first())` after existing live queries.

- [ ] **Step 2: Require active shift**

After permission gate, render a cashier locked state if no active shift exists. It should explain `Shift belum dibuka` and include a button to `navigate('/shifts')`.

- [ ] **Step 3: Attach shiftId on open bill create**

When creating a new open bill, add:

```ts
shiftId: activeShift.id,
```

- [ ] **Step 4: Attach shiftId on checkout**

When updating an open bill to completed, set `shiftId: existing.shiftId ?? activeShift.id`. When creating a completed transaction, set `shiftId: activeShift.id`.

- [ ] **Step 5: Guard mutation functions**

At the top of `saveOpenBill` and `handleCheckout`, if `!activeShift?.id`, show `toast.error('Buka shift terlebih dahulu')` and return.

- [ ] **Step 6: Verify cashier lint**

Run:

```bash
npx eslint src/pages/Cashier.tsx
```

Expected: no errors.

---

### Task 5: Final Verification

**Files:**
- All files from previous tasks.

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run src/lib/shifts.test.ts
```

Expected: pass.

- [ ] **Step 2: Run targeted lint**

```bash
npx eslint src/lib/db.ts src/lib/auth.ts src/lib/backup.ts src/lib/shifts.ts src/lib/shifts.test.ts src/components/ShiftReportReceipt.tsx src/pages/Shifts.tsx src/pages/Cashier.tsx src/pages/Settings.tsx src/App.tsx
```

Expected: pass.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: pass. If `version.json` changes because build bumps version, reset it unless the user asked for a version bump.

- [ ] **Step 4: Review git diff**

```bash
git diff --stat
git diff -- src/lib/db.ts src/pages/Cashier.tsx src/pages/Shifts.tsx
```

Expected: only shift-related changes.

---

## Plan Self-Review

- Spec coverage: database, permission, business logic, cashier integration, shift UI, print report, settings shortcut, backup/restore, and verification are covered.
- Placeholder scan: no TBD/TODO/fill-in-later instructions remain; UI tasks describe concrete required behavior while allowing style reuse from current polished pages.
- Type consistency: `Shift`, `shiftId`, `manage_shifts`, `calculateShiftSummary`, `openShift`, and `closeShift` names are consistent across tasks.
