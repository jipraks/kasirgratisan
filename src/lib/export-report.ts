import { format, endOfDay, startOfDay } from 'date-fns';
import type * as ExcelJSTypes from 'exceljs';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db } from '@/lib/db';
import type { Transaction, TransactionItemRecord, Expense } from '@/lib/db';
import i18n, { resolveLanguage } from '@/i18n';

/**
 * Client-side Excel export for the Reports page.
 *
 * All data is read directly from IndexedDB (Dexie) and the workbook is built in
 * the browser — there is no backend. ExcelJS is imported dynamically so its
 * bundle is code-split and does not weigh on the app's initial load.
 *
 * Rules kept consistent with the Reports view:
 *  - only transactions with `status === 'completed'` (open bills are excluded),
 *  - only expenses with `isDeleted === 0`.
 */

const CURRENCY_FMT = '#,##0';

/** Translator for export labels (reports:excelExport.*), using the current UI language. */
const exportLabels = () => i18n.getFixedT(resolveLanguage(i18n.language), 'reports', 'excelExport');
type ExportT = ReturnType<typeof exportLabels>;

export interface ExportResult {
  fileName: string;
  txCount: number;
  itemCount: number;
  expenseCount: number;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000; // avoid "Maximum call stack" on large files
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Save / share the file. On web: download via an anchor. On native (Capacitor):
 * write to the cache, then open the Android Share dialog — following the backup pattern.
 */
async function saveFile(buffer: ArrayBuffer, fileName: string, t: ExportT): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: arrayBufferToBase64(buffer),
      directory: Directory.Cache,
    });
    await Share.share({
      title: t('shareTitle'),
      text: fileName,
      url: result.uri,
      dialogTitle: t('shareDialogTitle'),
    });
    return;
  }

  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeForFileName(name: string, fallback: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || fallback;
}

export async function exportReportToExcel(rangeStart: Date, rangeEnd: Date): Promise<ExportResult> {
  const t = exportLabels();

  // Normalize day boundaries so the range is inclusive (00:00:00 to 23:59:59.999).
  const start = startOfDay(rangeStart);
  const end = endOfDay(rangeEnd);

  // --- Load data ---
  const [allTx, expensesRaw, debtPayments, paymentMethods, expenseCategories, users, storeSettings] =
    await Promise.all([
      db.transactions.where('date').between(start, end, true, true).toArray(),
      db.expenses.where('date').between(start, end, true, true).toArray(),
      db.debtPayments.where('date').between(start, end, true, true).toArray(),
      db.paymentMethods.toArray(),
      db.expenseCategories.toArray(),
      db.users.toArray(),
      db.storeSettings.toCollection().first(),
    ]);

  const transactions = allTx
    .filter((t) => t.status === 'completed')
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const expenses = expensesRaw
    .filter((e) => e.isDeleted === 0)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const txIds = transactions.map((t) => t.id!).filter(Boolean);
  const items =
    txIds.length > 0
      ? await db.transactionItems.where('transactionId').anyOf(txIds).toArray()
      : [];

  // --- Lookup helpers ---
  const paymentName = (id?: number) =>
    paymentMethods.find((p) => p.id === id)?.name ?? t('noPaymentMethod');
  const categoryName = (id: number) =>
    expenseCategories.find((c) => c.id === id)?.name ?? t('noCategory');
  const cashierName = (id?: number) =>
    id != null ? users.find((u) => u.id === id)?.name ?? '-' : '-';
  const txById = new Map(transactions.map((t) => [t.id, t] as const));

  const storeName = storeSettings?.storeName?.trim() || t('defaultStoreName');

  // --- Aggregates for the Summary sheet ---
  const totalSales = transactions.reduce((s, t) => s + t.total, 0);
  const totalProfit = transactions.reduce((s, t) => s + t.profit, 0);
  const totalRevenue = transactions.reduce((s, t) => s + t.subtotal, 0);
  const totalDiscount = transactions.reduce((s, t) => s + t.discountAmount, 0);
  const totalHpp = items.reduce((s, i) => s + i.hpp * i.quantity, 0);
  const netSales = totalRevenue - totalDiscount;
  const grossProfit = netSales - totalHpp;
  const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalCashIn =
    transactions.reduce((sum, transaction) => sum + Math.min(transaction.paymentAmount, transaction.total), 0) +
    debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // Payment method breakdown (sales).
  const paymentSummary = new Map<string, { amount: number; count: number }>();
  for (const t of transactions) {
    if (t.paymentAmount <= 0) continue;
    const key = paymentName(t.paymentMethodId);
    const cur = paymentSummary.get(key) ?? { amount: 0, count: 0 };
    cur.amount += Math.min(t.paymentAmount, t.total);
    cur.count += 1;
    paymentSummary.set(key, cur);
  }
  for (const payment of debtPayments) {
    const key = paymentName(payment.paymentMethodId);
    const cur = paymentSummary.get(key) ?? { amount: 0, count: 0 };
    cur.amount += payment.amount;
    cur.count += 1;
    paymentSummary.set(key, cur);
  }

  // Expenses per category.
  const expenseSummary = new Map<string, number>();
  for (const e of expenses) {
    const key = categoryName(e.categoryId);
    expenseSummary.set(key, (expenseSummary.get(key) ?? 0) + e.amount);
  }

  // --- Build workbook ---
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;

  const wb = new ExcelJS.Workbook();
  wb.creator = storeName;
  wb.created = end;

  buildSummarySheet(wb, t, {
    storeName,
    start,
    end,
    txCount: transactions.length,
    totalSales,
    totalCashIn,
    totalProfit,
    totalRevenue,
    totalDiscount,
    netSales,
    totalHpp,
    grossProfit,
    grossMargin,
    totalExpenses,
    netProfit,
    netMargin,
    paymentSummary,
    expenseSummary,
  });
  buildTransactionsSheet(wb, t, transactions, { paymentName, cashierName });
  buildItemsSheet(wb, t, items, txById);
  buildExpensesSheet(wb, t, expenses, { paymentName, categoryName });

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `${t('fileNamePrefix')}${sanitizeForFileName(storeName, t('fileNameFallback'))}_${format(start, 'yyyy-MM-dd')}_${format(
    end,
    'yyyy-MM-dd',
  )}.xlsx`;
  await saveFile(buffer as ArrayBuffer, fileName, t);

  return {
    fileName,
    txCount: transactions.length,
    itemCount: items.length,
    expenseCount: expenses.length,
  };
}

type Workbook = ExcelJSTypes.Workbook;
type Worksheet = ExcelJSTypes.Worksheet;

interface SummaryData {
  storeName: string;
  start: Date;
  end: Date;
  txCount: number;
  totalSales: number;
  totalCashIn: number;
  totalProfit: number;
  totalRevenue: number;
  totalDiscount: number;
  netSales: number;
  totalHpp: number;
  grossProfit: number;
  grossMargin: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  paymentSummary: Map<string, { amount: number; count: number }>;
  expenseSummary: Map<string, number>;
}

function styleHeaderRow(row: ExcelJSTypes.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA7B0D' } };
    cell.alignment = { vertical: 'middle' };
  });
}

function buildSummarySheet(wb: Workbook, t: ExportT, d: SummaryData) {
  const ws = wb.addWorksheet(t('sheets.summary'));
  ws.columns = [{ width: 30 }, { width: 22 }];

  const titleRow = ws.addRow([t('summary.title', { store: d.storeName })]);
  titleRow.font = { bold: true, size: 14 };
  ws.addRow([
    t('summary.period'),
    `${format(d.start, 'dd/MM/yyyy')} – ${format(d.end, 'dd/MM/yyyy')}`,
  ]);
  ws.addRow([t('summary.generated'), format(d.end, 'dd/MM/yyyy HH:mm')]);
  ws.addRow([]);

  const moneyRow = (label: string, value: number, bold = false) => {
    const row = ws.addRow([label, value]);
    row.getCell(2).numFmt = CURRENCY_FMT;
    if (bold) row.font = { bold: true };
    return row;
  };
  const pctRow = (label: string, value: number) => {
    const row = ws.addRow([label, value / 100]);
    row.getCell(2).numFmt = '0.0%';
  };

  ws.addRow([t('summary.txCount'), d.txCount]);
  moneyRow(t('summary.totalSales'), d.totalSales);
  moneyRow(t('summary.cashIn'), d.totalCashIn);
  ws.addRow([]);
  moneyRow(t('summary.grossRevenue'), d.totalRevenue);
  moneyRow(t('summary.discount'), -d.totalDiscount);
  moneyRow(t('summary.netSales'), d.netSales, true);
  moneyRow(t('summary.cogs'), -d.totalHpp);
  moneyRow(t('summary.grossProfit'), d.grossProfit, true);
  pctRow(t('summary.grossMargin'), d.grossMargin);
  moneyRow(t('summary.totalExpenses'), -d.totalExpenses);
  moneyRow(t('summary.netProfit'), d.netProfit, true);
  pctRow(t('summary.netMargin'), d.netMargin);

  // Payment method breakdown
  ws.addRow([]);
  const payHeader = ws.addRow([t('summary.paymentMethod'), t('summary.amount'), t('summary.transactions')]);
  styleHeaderRow(payHeader);
  if (d.paymentSummary.size === 0) {
    ws.addRow(['—', 0, 0]);
  } else {
    for (const [name, v] of [...d.paymentSummary.entries()].sort((a, b) => b[1].amount - a[1].amount)) {
      const row = ws.addRow([name, v.amount, v.count]);
      row.getCell(2).numFmt = CURRENCY_FMT;
    }
  }

  // Expenses per category
  ws.addRow([]);
  const expHeader = ws.addRow([t('summary.expensesByCategory'), t('summary.amount')]);
  styleHeaderRow(expHeader);
  if (d.expenseSummary.size === 0) {
    ws.addRow(['—', 0]);
  } else {
    for (const [name, amount] of [...d.expenseSummary.entries()].sort((a, b) => b[1] - a[1])) {
      const row = ws.addRow([name, amount]);
      row.getCell(2).numFmt = CURRENCY_FMT;
    }
  }
}

function setupTable(
  ws: Worksheet,
  columns: { header: string; key: string; width: number; money?: boolean }[],
) {
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  const headerRow = ws.addRow(columns.map((c) => c.header));
  styleHeaderRow(headerRow);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return columns;
}

function buildTransactionsSheet(
  wb: Workbook,
  t: ExportT,
  transactions: Transaction[],
  helpers: { paymentName: (id?: number) => string; cashierName: (id?: number) => string },
) {
  const ws = wb.addWorksheet(t('sheets.transactions'));
  const columns = [
    { header: t('columns.no'), key: 'no', width: 6 },
    { header: t('columns.receiptNo'), key: 'receipt', width: 16 },
    { header: t('columns.date'), key: 'date', width: 12 },
    { header: t('columns.time'), key: 'time', width: 8 },
    { header: t('columns.customer'), key: 'customer', width: 20 },
    { header: t('columns.table'), key: 'table', width: 8 },
    { header: t('columns.paymentMethod'), key: 'payment', width: 16 },
    { header: t('columns.paid'), key: 'paid', width: 14, money: true },
    { header: t('columns.initialDebt'), key: 'debt', width: 14, money: true },
    { header: t('columns.cashier'), key: 'cashier', width: 16 },
    { header: t('columns.subtotal'), key: 'subtotal', width: 14, money: true },
    { header: t('columns.discount'), key: 'discount', width: 12, money: true },
    { header: t('columns.total'), key: 'total', width: 14, money: true },
    { header: t('columns.profit'), key: 'profit', width: 14, money: true },
  ];
  setupTable(ws, columns);
  const debtLabel = t('debt');

  transactions.forEach((t, i) => {
    ws.addRow({
      no: i + 1,
      receipt: t.receiptNumber,
      date: format(new Date(t.date), 'dd/MM/yyyy'),
      time: format(new Date(t.date), 'HH:mm'),
      customer: t.customerName ?? '-',
      table: t.tableNumber ?? '-',
      payment: t.debtAmount
        ? `${t.paymentAmount > 0 ? `${helpers.paymentName(t.paymentMethodId)} + ` : ''}${debtLabel}`
        : helpers.paymentName(t.paymentMethodId),
      paid: Math.min(t.paymentAmount, t.total),
      debt: t.debtAmount ?? 0,
      cashier: helpers.cashierName(t.createdBy),
      subtotal: t.subtotal,
      discount: t.discountAmount,
      total: t.total,
      profit: t.profit,
    });
  });

  addTotalsRow(ws, columns, transactions.length, t('totalRow'), {
    subtotal: transactions.reduce((s, t) => s + t.subtotal, 0),
    discount: transactions.reduce((s, t) => s + t.discountAmount, 0),
    total: transactions.reduce((s, t) => s + t.total, 0),
    paid: transactions.reduce((s, t) => s + Math.min(t.paymentAmount, t.total), 0),
    debt: transactions.reduce((s, t) => s + (t.debtAmount ?? 0), 0),
    profit: transactions.reduce((s, t) => s + t.profit, 0),
  });
  applyMoneyFormat(ws, columns);
}

function buildItemsSheet(
  wb: Workbook,
  t: ExportT,
  items: TransactionItemRecord[],
  txById: Map<number | undefined, Transaction>,
) {
  const ws = wb.addWorksheet(t('sheets.items'));
  const columns = [
    { header: t('columns.receiptNo'), key: 'receipt', width: 16 },
    { header: t('columns.date'), key: 'date', width: 12 },
    { header: t('columns.product'), key: 'product', width: 28 },
    { header: t('columns.qty'), key: 'qty', width: 8 },
    { header: t('columns.price'), key: 'price', width: 14, money: true },
    { header: t('columns.cost'), key: 'hpp', width: 14, money: true },
    { header: t('columns.discount'), key: 'discount', width: 12, money: true },
    { header: t('columns.subtotal'), key: 'subtotal', width: 14, money: true },
    { header: t('columns.profit'), key: 'profit', width: 14, money: true },
  ];
  setupTable(ws, columns);

  // Sort items by their transaction order (date).
  const sorted = [...items].sort((a, b) => {
    const ta = txById.get(a.transactionId);
    const tb = txById.get(b.transactionId);
    const da = ta ? +new Date(ta.date) : 0;
    const dbb = tb ? +new Date(tb.date) : 0;
    return da - dbb;
  });

  for (const item of sorted) {
    const tx = txById.get(item.transactionId);
    ws.addRow({
      receipt: tx?.receiptNumber ?? '-',
      date: tx ? format(new Date(tx.date), 'dd/MM/yyyy') : '-',
      product: item.productName,
      qty: item.quantity,
      price: item.price,
      hpp: item.hpp,
      discount: item.discountAmount,
      subtotal: item.subtotal,
      profit: (item.price - item.hpp) * item.quantity - item.discountAmount,
    });
  }

  addTotalsRow(ws, columns, items.length, t('totalRow'), {
    qty: items.reduce((s, i) => s + i.quantity, 0),
    discount: items.reduce((s, i) => s + i.discountAmount, 0),
    subtotal: items.reduce((s, i) => s + i.subtotal, 0),
    profit: items.reduce((s, i) => s + ((i.price - i.hpp) * i.quantity - i.discountAmount), 0),
  });
  applyMoneyFormat(ws, columns);
}

function buildExpensesSheet(
  wb: Workbook,
  t: ExportT,
  expenses: Expense[],
  helpers: { paymentName: (id?: number) => string; categoryName: (id: number) => string },
) {
  const ws = wb.addWorksheet(t('sheets.expenses'));
  const columns = [
    { header: t('columns.no'), key: 'no', width: 6 },
    { header: t('columns.date'), key: 'date', width: 12 },
    { header: t('columns.title'), key: 'title', width: 30 },
    { header: t('columns.category'), key: 'category', width: 18 },
    { header: t('columns.paymentMethod'), key: 'payment', width: 16 },
    { header: t('columns.amount'), key: 'amount', width: 14, money: true },
    { header: t('columns.notes'), key: 'notes', width: 30 },
  ];
  setupTable(ws, columns);

  expenses.forEach((e, i) => {
    ws.addRow({
      no: i + 1,
      date: format(new Date(e.date), 'dd/MM/yyyy'),
      title: e.title,
      category: helpers.categoryName(e.categoryId),
      payment: helpers.paymentName(e.paymentMethodId),
      amount: e.amount,
      notes: e.notes ?? '',
    });
  });

  addTotalsRow(ws, columns, expenses.length, t('totalRow'), {
    amount: expenses.reduce((s, e) => s + e.amount, 0),
  });
  applyMoneyFormat(ws, columns);
}

function addTotalsRow(
  ws: Worksheet,
  columns: { key: string; money?: boolean }[],
  count: number,
  label: string,
  totals: Record<string, number>,
) {
  if (count === 0) return;
  const firstKey = columns[0].key;
  const data: Record<string, string | number> = { [firstKey]: label, ...totals };
  const row = ws.addRow(data);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.border = { top: { style: 'thin' } };
  });
}

function applyMoneyFormat(ws: Worksheet, columns: { key: string; money?: boolean }[]) {
  for (const col of columns) {
    if (col.money) ws.getColumn(col.key).numFmt = CURRENCY_FMT;
  }
}
