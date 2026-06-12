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
      .filter((id): id is number => typeof id === 'number'),
  );

  const totalSales = transactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalCashSales = transactions.reduce(
    (sum, tx) => sum + (cashPaymentIds.has(tx.paymentMethodId) ? tx.total : 0),
    0,
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
