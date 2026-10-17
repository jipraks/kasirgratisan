import { describe, it, expect } from 'vitest';
import { getESCPOSData } from '../lib/printer';
import type { Transaction, StoreSettings, TransactionItemRecord } from '../lib/db';

describe('getESCPOSData formatting', () => {
  it('should format item lines and totals to be exactly 32 characters wide, aligning numbers to the right', () => {
    const mockTransaction: Transaction = {
      subtotal: 65000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      total: 65000,
      paymentMethodId: 1,
      paymentAmount: 65000,
      change: 0,
      profit: 30000,
      date: new Date('2026-06-30T18:39:00Z'),
      receiptNumber: 'TX1782819574018',
      status: 'completed',
    };

    const mockItems: TransactionItemRecord[] = [
      {
        transactionId: 1,
        productId: 101,
        productName: 'Nasi Goreng Spesial',
        quantity: 1,
        price: 15000,
        hpp: 10000,
        discountType: null,
        discountValue: 0,
        discountAmount: 0,
        subtotal: 15000,
      }
    ];

    const mockStoreSettings: StoreSettings = {
      storeName: 'Toko Maju Jaya',
      address: 'Tangerang',
      phone: '081208120812',
      receiptFooter: 'Terima kasih atas kunjungan Anda!',
      onboardingDone: true,
      lastBackupAt: null,
      deviceId: 'test-device',
    };

    const output = getESCPOSData({
      transaction: mockTransaction,
      items: mockItems,
      storeSettings: mockStoreSettings,
      paymentMethodName: 'Tunai',
      cashierName: 'Joko',
    });

    const lines = output.split('\n');

    // Find the item quantity and subtotal line: "  1 x Rp 15.000        Rp 15.000"
    const itemLine = lines.find(line => line.includes('1 x Rp 15.000'));
    expect(itemLine).toBeDefined();
    expect(itemLine?.length).toBe(32); // Must be exactly 32 characters
    expect(itemLine?.endsWith('Rp 15.000')).toBe(true);

    // Find the Subtotal line: "Subtotal:              Rp 65.000"
    const subtotalLine = lines.find(line => line.startsWith('Subtotal:'));
    expect(subtotalLine).toBeDefined();
    expect(subtotalLine?.length).toBe(32);
    expect(subtotalLine?.endsWith('Rp 65.000')).toBe(true);

    // Find the TOTAL line: "TOTAL:                 Rp 65.000"
    const totalLine = lines.find(line => line.startsWith('TOTAL:'));
    expect(totalLine).toBeDefined();
    expect(totalLine?.length).toBe(32);
    expect(totalLine?.endsWith('Rp 65.000')).toBe(true);

    // Find the Bayar line: "Bayar:                 Rp 65.000"
    const bayarLine = lines.find(line => line.startsWith('Bayar:'));
    expect(bayarLine).toBeDefined();
    expect(bayarLine?.length).toBe(32);
    expect(bayarLine?.endsWith('Rp 65.000')).toBe(true);

    // Find the Kembali line: "Kembali:                    Rp 0"
    const kembaliLine = lines.find(line => line.startsWith('Kembali:'));
    expect(kembaliLine).toBeDefined();
    expect(kembaliLine?.length).toBe(32);
    expect(kembaliLine?.endsWith('Rp 0')).toBe(true);
  });

  const baseTransaction: Transaction = {
    subtotal: 10000,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    total: 10000,
    paymentMethodId: 1,
    paymentAmount: 10000,
    change: 0,
    profit: 5000,
    date: new Date('2026-06-30T18:39:00Z'),
    receiptNumber: 'TXTEST123',
    status: 'completed',
  };

  const baseItems: TransactionItemRecord[] = [
    {
      transactionId: 1,
      productId: 101,
      productName: 'Kopi',
      quantity: 1,
      price: 10000,
      hpp: 5000,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
      subtotal: 10000,
    }
  ];

  it('should print the watermark by default when hideWatermark is not set', () => {
    const mockStoreSettings: StoreSettings = {
      storeName: 'Toko Test',
      address: 'Alamat',
      phone: '123',
      receiptFooter: 'Terima kasih!',
      onboardingDone: true,
      lastBackupAt: null,
      deviceId: 'test-device',
    };

    const output = getESCPOSData({
      transaction: baseTransaction,
      items: baseItems,
      storeSettings: mockStoreSettings,
      paymentMethodName: 'Tunai',
    });

    expect(output).toContain('Dicetak Dari Aplikasi');
    expect(output).toContain('FreeKasir.com');
  });

  it('should hide the watermark when hideWatermark is true', () => {
    const mockStoreSettings: StoreSettings = {
      storeName: 'Toko Test',
      address: 'Alamat',
      phone: '123',
      receiptFooter: 'Terima kasih!',
      onboardingDone: true,
      lastBackupAt: null,
      deviceId: 'test-device',
      hideWatermark: true,
    };

    const output = getESCPOSData({
      transaction: baseTransaction,
      items: baseItems,
      storeSettings: mockStoreSettings,
      paymentMethodName: 'Tunai',
    });

    expect(output).not.toContain('Dicetak Dari Aplikasi');
    expect(output).not.toContain('FreeKasir.com');
  });

  it('should hide the watermark when hideWatermark is true without any cloud store', () => {
    const mockStoreSettings: StoreSettings = {
      storeName: 'Toko Test',
      address: 'Alamat',
      phone: '123',
      receiptFooter: 'Terima kasih!',
      onboardingDone: true,
      lastBackupAt: null,
      deviceId: 'test-device',
      cloudStoreId: null,
      hideWatermark: true,
    };

    const output = getESCPOSData({
      transaction: baseTransaction,
      items: baseItems,
      storeSettings: mockStoreSettings,
      paymentMethodName: 'Tunai',
    });

    expect(output).not.toContain('Dicetak Dari Aplikasi');
    expect(output).not.toContain('FreeKasir.com');
  });

});
