# Shift Transaction History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users audit transactions by cashier shift without removing the existing all-transactions history view.

**Architecture:** Reuse `transactions.shiftId` and the `shifts` table. `TransactionHistory` reads optional `?shiftId=` query param, exposes a shift filter, and displays shift badges. `Shifts` links each shift to `/history?shiftId=<id>`.

**Tech Stack:** React, TypeScript, React Router, Dexie live queries, shadcn/ui.

---

## Tasks

### Task 1: Transaction History Shift Filter

**Files:**
- Modify: `src/pages/TransactionHistory.tsx`

Steps:
- Add `useSearchParams` and read `shiftId`.
- Load recent shifts with `useLiveQuery`.
- Add a select filter: `Semua Shift`, `Shift Aktif`, each shift code, `Tanpa Shift`.
- Filter transactions by selected shift.
- Show a small shift badge on transaction cards.
- Keep existing history behavior when no query param is present.

### Task 2: Shift Page Link to History

**Files:**
- Modify: `src/pages/Shifts.tsx`

Steps:
- Add button `Lihat Transaksi` on each shift history card.
- Link to `/history?shiftId=<shift.id>`.
- Keep `Cetak Laporan` for closed shifts.

### Task 3: Verification

Run:

```bash
npx eslint src/pages/TransactionHistory.tsx src/pages/Shifts.tsx
npm run build
```

Reset `version.json` after build auto-bump.
