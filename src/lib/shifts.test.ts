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
