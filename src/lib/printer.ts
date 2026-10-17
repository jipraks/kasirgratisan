import { Capacitor } from '@capacitor/core';
import { format } from 'date-fns';
import type { Transaction, StoreSettings, TransactionItemRecord } from './db';
import { CURRENCY_SYMBOL, NUMBER_LOCALE } from '@/lib/currency';

declare global {
  interface Window {
    bluetoothSerial?: {
      isEnabled: (success: () => void, failure: (err: string) => void) => void;
      list: (success: (devices: Array<{ name: string; address: string; id: string }>) => void, failure: (err: string) => void) => void;
      connect: (address: string, success: () => void, failure: (err: string) => void) => void;
      write: (data: string | Uint8Array, success: () => void, failure: (err: string) => void) => void;
      disconnect: (success: () => void, failure: (err: string) => void) => void;
    };
  }
}

export interface BluetoothPrinter {
  name: string;
  address: string;
  id?: string;
}

interface PrintData {
  transaction: Transaction;
  items: TransactionItemRecord[];
  storeSettings: StoreSettings | undefined;
  paymentMethodName: string;
  cashierName?: string;
  language?: string;
}

const DEFAULT_PRINTER_KEY = 'kg_default_bluetooth_printer';

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getDefaultBluetoothPrinter = (): BluetoothPrinter | null => {
  try {
    const value = localStorage.getItem(DEFAULT_PRINTER_KEY);
    return value ? JSON.parse(value) as BluetoothPrinter : null;
  } catch {
    return null;
  }
};

export const setDefaultBluetoothPrinter = (printer: BluetoothPrinter | null): void => {
  try {
    if (printer) {
      localStorage.setItem(DEFAULT_PRINTER_KEY, JSON.stringify(printer));
    } else {
      localStorage.removeItem(DEFAULT_PRINTER_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const listPairedBluetoothDevices = async (): Promise<BluetoothPrinter[]> => {
  if (!window.bluetoothSerial) return [];

  return new Promise((resolve, reject) => {
    window.bluetoothSerial?.isEnabled(
      () => {
        window.bluetoothSerial?.list(
          devices => resolve(devices.map(device => ({
            name: device.name,
            address: device.address,
            id: device.id,
          }))),
          err => reject(new Error(err)),
        );
      },
      () => reject(new Error('Bluetooth tidak aktif')),
    );
  });
};

export const getESCPOSData = ({
  transaction,
  items,
  storeSettings,
  paymentMethodName,
  cashierName,
  language,
}: PrintData): string => {
  const lines: string[] = [];
  
  lines.push('\x1B\x61\x01'); // Center align
  lines.push(`${storeSettings?.storeName || 'Toko'}\n`);
  if (storeSettings?.address) lines.push(`${storeSettings.address}\n`);
  if (storeSettings?.phone) lines.push(`${storeSettings.phone}\n`);
  lines.push('--------------------------------\n');
  lines.push(`No: ${transaction.receiptNumber}\n`);
  lines.push(`${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
  if (cashierName) lines.push(`Kasir: ${cashierName}\n`);
  if (transaction.customerName) lines.push(`Pelanggan: ${transaction.customerName}\n`);
  if (transaction.tableNumber) lines.push(`Meja: ${transaction.tableNumber}\n`);
  if (transaction.remarks) lines.push(`Catatan: ${transaction.remarks}\n`);
  lines.push('--------------------------------\n');
  
  lines.push('\x1B\x61\x00'); // Left align
  const rp = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(NUMBER_LOCALE)}`;
  const formatRow = (left: string, right: string) => {
    const spaceCount = 32 - left.length - right.length;
    return `${left}${' '.repeat(Math.max(1, spaceCount))}${right}\n`;
  };

  for (const item of items) {
    lines.push(`${item.productName}\n`);
    if (item.notes) lines.push(`  ${item.notes}\n`);
    lines.push(formatRow(`  ${item.quantity} x ${rp(item.price)}`, rp(item.subtotal)));
  }
  
  lines.push('--------------------------------\n');
  lines.push(formatRow('Subtotal:', rp(transaction.subtotal)));
  if (transaction.discountAmount > 0) {
    lines.push(formatRow('Diskon:', `-${rp(transaction.discountAmount)}`));
  }
  lines.push(formatRow('TOTAL:', rp(transaction.total)));
  lines.push(formatRow('Bayar:', rp(transaction.paymentAmount)));
  if (transaction.debtAmount && transaction.debtAmount > 0) {
    lines.push(formatRow('Hutang:', rp(transaction.debtAmount)));
  } else {
    lines.push(formatRow('Kembali:', rp(transaction.change)));
  }
  lines.push('--------------------------------\n');
  lines.push('\x1B\x61\x01'); // Center
  lines.push(`${storeSettings?.receiptFooter || 'Terima kasih!'}\n`);
  
  const hideWatermark = !!storeSettings?.hideWatermark;
  if (!hideWatermark) {
    const lang = language || 'id';
    let line1 = 'Dicetak Dari Aplikasi';
    let line2 = 'FreeKasir.com';
    if (lang === 'en') {
      line1 = 'Printed From';
      line2 = 'FreeKasir.com App';
    } else if (lang === 'ms') {
      line1 = 'Dicetak Daripada Aplikasi';
      line2 = 'FreeKasir.com';
    }
    lines.push(`\n${line1}\n${line2}\n`);
  }
  lines.push('\n\n\n');

  return lines.join('');
};

export interface DailyReportPrintData {
  dateStr: string;
  periodStr: string;
  txCount: number;
  itemCount: number;
  grossSales: number;
  discount: number;
  netSales: number;
  paymentBreakdown: Array<{ name: string; amount: number; count: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  storeSettings: StoreSettings | undefined;
  cashierName?: string;
  includeExpenses?: boolean;
  expensesAmount?: number;
  netProfit?: number;
  language?: string;
}

export const getDailyReportESCPOSData = ({
  dateStr,
  periodStr,
  txCount,
  itemCount,
  grossSales,
  discount,
  netSales,
  paymentBreakdown,
  topProducts,
  storeSettings,
  cashierName,
  includeExpenses,
  expensesAmount = 0,
  netProfit = 0,
  language,
}: DailyReportPrintData): string => {
  const lines: string[] = [];
  const rp = (n: number) => `${CURRENCY_SYMBOL} ${n.toLocaleString(NUMBER_LOCALE)}`;

  const formatRow = (label: string, value: string) => {
    const spaceCount = 32 - label.length - value.length;
    return `${label}${' '.repeat(Math.max(1, spaceCount))}${value}\n`;
  };

  lines.push('\x1B\x61\x01'); // Center align
  lines.push(`${storeSettings?.storeName || 'Toko'}\n`);
  if (storeSettings?.address) lines.push(`${storeSettings.address}\n`);
  if (storeSettings?.phone) lines.push(`${storeSettings.phone}\n`);
  lines.push('================================\n');
  lines.push('       DAILY SALES REPORT       \n');
  lines.push(`           ${dateStr}           \n`);
  lines.push('================================\n\n');

  lines.push('\x1B\x61\x00'); // Left align
  lines.push(`Periode:\n`);
  lines.push(`${periodStr}\n\n`);

  lines.push(`Jumlah Transaksi : ${txCount}\n`);
  lines.push(`Jumlah Item      : ${itemCount}\n\n`);

  lines.push('--------------------------------\n');
  lines.push('PENJUALAN\n');
  lines.push('--------------------------------\n');
  lines.push(formatRow('Gross Sales', rp(grossSales)));
  if (discount > 0) {
    lines.push(formatRow('Discount', `-${rp(discount)}`));
  }
  lines.push(formatRow('Net Sales', rp(netSales)));
  lines.push('\n');

  if (includeExpenses && expensesAmount > 0) {
    lines.push('--------------------------------\n');
    lines.push('PENGELUARAN & LABA NETTO\n');
    lines.push('--------------------------------\n');
    lines.push(formatRow('Net Sales', rp(netSales)));
    lines.push(formatRow('Expenses', `-${rp(expensesAmount)}`));
    lines.push(formatRow('Net Profit', rp(netProfit)));
    lines.push('\n');
  }

  lines.push('--------------------------------\n');
  lines.push('PEMBAYARAN\n');
  lines.push('--------------------------------\n');
  if (paymentBreakdown.length === 0) {
    lines.push('Belum ada pembayaran\n');
  } else {
    paymentBreakdown.forEach(method => {
      lines.push(formatRow(method.name, rp(method.amount)));
    });
  }
  lines.push('\n');

  lines.push('--------------------------------\n');
  lines.push('PRODUK TERLARIS\n');
  lines.push('--------------------------------\n');
  if (topProducts.length === 0) {
    lines.push('Belum ada penjualan produk\n');
  } else {
    topProducts.forEach((p, idx) => {
      const num = `${idx + 1}. `;
      const qtyStr = `${p.qty}`;
      const maxNameLen = 32 - num.length - qtyStr.length - 2;
      const truncatedName = p.name.length > maxNameLen ? p.name.substring(0, maxNameLen) + '..' : p.name;
      const label = `${num}${truncatedName}`;
      lines.push(formatRow(label, qtyStr));
    });
  }
  lines.push('\n');

  lines.push('================================\n');
  lines.push('\x1B\x61\x01'); // Center
  lines.push('         END OF REPORT          \n');
  if (cashierName) lines.push(`Dicetak oleh: ${cashierName}\n`);
  
  const hideWatermark = !!storeSettings?.hideWatermark;
  if (!hideWatermark) {
    const lang = language || 'id';
    let line1 = 'Dicetak Dari Aplikasi';
    let line2 = 'FreeKasir.com';
    if (lang === 'en') {
      line1 = 'Printed From';
      line2 = 'FreeKasir.com App';
    } else if (lang === 'ms') {
      line1 = 'Dicetak Daripada Aplikasi';
      line2 = 'FreeKasir.com';
    }
    lines.push(`\n${line1}\n${line2}\n`);
  }
  
  lines.push('================================\n\n\n\n');

  return lines.join('');
};

export const convertBase64ToEscPosImage = (
  base64Str: string,
  targetWidth = 192
): Promise<Uint8Array | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Calculate height keeping aspect ratio
        const aspect = img.width / img.height;
        const targetHeight = Math.round(targetWidth / aspect);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw image onto canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const pixels = imgData.data;

        // Width in bytes (padded to 8 bits)
        const widthBytes = Math.ceil(targetWidth / 8);
        const escposData = new Uint8Array(8 + widthBytes * targetHeight);

        // ESC/POS header for raster bit image: GS v 0 m xL xH yL yH
        escposData[0] = 29;  // GS
        escposData[1] = 118; // v
        escposData[2] = 48;  // 0
        escposData[3] = 0;   // m = 0 (normal)
        escposData[4] = widthBytes % 256;
        escposData[5] = Math.floor(widthBytes / 256);
        escposData[6] = targetHeight % 256;
        escposData[7] = Math.floor(targetHeight / 256);

        let dataIdx = 8;
        for (let y = 0; y < targetHeight; y++) {
          for (let xByte = 0; xByte < widthBytes; xByte++) {
            let byteValue = 0;
            for (let bit = 0; bit < 8; bit++) {
              const xPixel = xByte * 8 + bit;
              if (xPixel < targetWidth) {
                const pixelIdx = (y * targetWidth + xPixel) * 4;
                const r = pixels[pixelIdx];
                const g = pixels[pixelIdx + 1];
                const b = pixels[pixelIdx + 2];
                const a = pixels[pixelIdx + 3];

                // Convert to grayscale
                const brightness = r * 0.299 + g * 0.587 + b * 0.114;
                // Thresholding: if alpha is low or pixel is bright, it is white (0).
                const isBlack = a > 50 && brightness < 128;

                if (isBlack) {
                  byteValue |= (1 << (7 - bit));
                }
              }
            }
            escposData[dataIdx++] = byteValue;
          }
        }
        resolve(escposData);
      } catch (err) {
        console.error('Error converting image to ESC/POS:', err);
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = base64Str;
  });
};

export const printRawNativeBluetooth = async (
  rawText: string | Uint8Array,
  toast: { info: (m: string) => void; success: (m: string) => void; error: (m: string) => void }
): Promise<boolean> => {
  if (!window.bluetoothSerial) {
    toast.error('Plugin Bluetooth tidak tersedia.');
    return false;
  }

  const defaultPrinter = getDefaultBluetoothPrinter();
  if (!defaultPrinter) {
    toast.error('Printer default belum dipilih. Silakan atur printer di menu Pengaturan terlebih dahulu.');
    return false;
  }

  return new Promise((resolve) => {
    window.bluetoothSerial?.isEnabled(
      () => {
        toast.info('Mencari printer Bluetooth berpasangan...');
        window.bluetoothSerial?.list(
          async (devices) => {
            if (devices.length === 0) {
              toast.error('Tidak ada printer Bluetooth yang dipasangkan (paired). Hubungkan di Pengaturan Android dulu.');
              resolve(false);
              return;
            }

            const printer = devices.find(d => d.address === defaultPrinter.address);
            if (!printer) {
              toast.error(`Printer "${defaultPrinter.name}" tidak terdeteksi. Pastikan printer menyala dan terhubung.`);
              resolve(false);
              return;
            }

            toast.info(`Menghubungkan ke ${printer.name}...`);
            window.bluetoothSerial?.connect(
              printer.address,
              () => {
                toast.info('Mencetak...');
                const data = typeof rawText === 'string'
                  ? new TextEncoder().encode(rawText)
                  : rawText;

                window.bluetoothSerial?.write(
                  data,
                  () => {
                    toast.success('Berhasil dicetak!');
                    window.bluetoothSerial?.disconnect(() => {}, () => {});
                    resolve(true);
                  },
                  (err) => {
                    toast.error(`Gagal mencetak: ${err}`);
                    window.bluetoothSerial?.disconnect(() => {}, () => {});
                    resolve(false);
                  }
                );
              },
              (err) => {
                toast.error(`Koneksi gagal: ${err}`);
                resolve(false);
              }
            );
          },
          (err) => {
            toast.error(`Gagal mendapatkan daftar printer: ${err}`);
            resolve(false);
          }
        );
      },
      () => {
        toast.error('Bluetooth tidak aktif. Silakan aktifkan Bluetooth.');
        resolve(false);
      }
    );
  });
};

export const printNativeBluetooth = async (
  printData: PrintData,
  toast: { info: (m: string) => void; success: (m: string) => void; error: (m: string) => void }
): Promise<boolean> => {
  const rawText = getESCPOSData(printData);
  const textBytes = new TextEncoder().encode(rawText);

  // Check if store logo printing is enabled and logo exists
  if (printData.storeSettings?.printLogo && printData.storeSettings?.logo) {
    try {
      const logoBytes = await convertBase64ToEscPosImage(printData.storeSettings.logo);
      if (logoBytes) {
        // Center alignment = [27, 97, 1] (ESC a 1), line feed = [10] (\n)
        const alignCenter = new Uint8Array([27, 97, 1]);
        const lineFeed = new Uint8Array([10]);

        const finalBytes = new Uint8Array(
          alignCenter.length + logoBytes.length + lineFeed.length + textBytes.length
        );
        finalBytes.set(alignCenter, 0);
        finalBytes.set(logoBytes, alignCenter.length);
        finalBytes.set(lineFeed, alignCenter.length + logoBytes.length);
        finalBytes.set(textBytes, alignCenter.length + logoBytes.length + lineFeed.length);

        return printRawNativeBluetooth(finalBytes, toast);
      }
    } catch (err) {
      console.error('Failed to convert and print logo:', err);
    }
  }

  return printRawNativeBluetooth(textBytes, toast);
};

export const getKitchenTicketESCPOSData = ({
  transaction,
  items,
  cashierName,
}: {
  transaction: Transaction;
  items: TransactionItemRecord[];
  cashierName?: string;
}): string => {
  const lines: string[] = [];
  
  lines.push('\x1B\x61\x01'); // Center align
  lines.push('\x1B\x21\x10'); // Double height text
  lines.push('KITCHEN TICKET\n');
  lines.push('\x1B\x21\x00'); // Reset text size
  lines.push('--------------------------------\n');
  lines.push(`No: ${transaction.receiptNumber}\n`);
  lines.push(`Waktu: ${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}\n`);
  if (cashierName) lines.push(`Kasir: ${cashierName}\n`);
  if (transaction.customerName) lines.push(`Pelanggan: ${transaction.customerName}\n`);
  if (transaction.tableNumber) lines.push(`Meja: ${transaction.tableNumber}\n`);
  if (transaction.remarks) lines.push(`Catatan: ${transaction.remarks}\n`);
  lines.push('--------------------------------\n');
  
  lines.push('\x1B\x61\x00'); // Left align
  for (const item of items) {
    const leftText = `${item.quantity}x ${item.productName}`;
    const padding = 32 - leftText.length - 4;
    if (padding > 0) {
      lines.push(`${leftText}${' '.repeat(padding)} [ ]\n`);
    } else {
      lines.push(`${leftText}  [ ]\n`);
    }
    if (item.notes) lines.push(`  * Catatan: ${item.notes}\n`);
  }
  
  lines.push('--------------------------------\n');
  lines.push('\n\n\n');
  return lines.join('');
};

export const printKitchenTicketBluetooth = async (
  printData: {
    transaction: Transaction;
    items: TransactionItemRecord[];
    cashierName?: string;
  },
  toast: { info: (m: string) => void; success: (m: string) => void; error: (m: string) => void }
): Promise<boolean> => {
  const rawText = getKitchenTicketESCPOSData(printData);
  const textBytes = new TextEncoder().encode(rawText);
  return printRawNativeBluetooth(textBytes, toast);
};

