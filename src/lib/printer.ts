import { Capacitor } from '@capacitor/core';
import { format } from 'date-fns';
import type { Transaction, StoreSettings, TransactionItemRecord } from './db';

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
  const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  for (const item of items) {
    lines.push(`${item.productName}\n`);
    if (item.notes) lines.push(`  ${item.notes}\n`);
    lines.push(`  ${item.quantity} x ${rp(item.price)}  ${rp(item.subtotal)}\n`);
  }
  
  lines.push('--------------------------------\n');
  lines.push(`Subtotal:  ${rp(transaction.subtotal)}\n`);
  if (transaction.discountAmount > 0) {
    lines.push(`Diskon:   -${rp(transaction.discountAmount)}\n`);
  }
  lines.push(`TOTAL:     ${rp(transaction.total)}\n`);
  lines.push(`Bayar:     ${rp(transaction.paymentAmount)}\n`);
  lines.push(`Kembali:   ${rp(transaction.change)}\n`);
  lines.push('--------------------------------\n');
  lines.push('\x1B\x61\x01'); // Center
  lines.push(`${storeSettings?.receiptFooter || 'Terima kasih!'}\n\n\n`);

  return lines.join('');
};

export const printNativeBluetooth = async (printData: PrintData, toast: { info: (m: string) => void; success: (m: string) => void; error: (m: string) => void }): Promise<boolean> => {
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
                toast.info('Mencetak struk...');
                const encoder = new TextEncoder();
                const rawText = getESCPOSData(printData);
                const data = encoder.encode(rawText);

                window.bluetoothSerial?.write(
                  data,
                  () => {
                    toast.success('Struk berhasil dicetak!');
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
