import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type StockOpname, type StockOpnameItem, type Product } from '@/lib/db';
import { ClipboardCheck, ChevronLeft, Plus, Download, Upload, Search, Trash2, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import LockedPage from '@/components/LockedPage';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { downloadOrShareFile } from '@/lib/file-utils';
import { getDateLocale } from '@/i18n';

interface DraftItem {
  productId: number;
  productName: string;
  sku: string;
  barcode: string;
  systemStock: number;
  realStock: number;
  unit: string;
}

export default function StockOpnamePage() {
  const { t, i18n } = useTranslation('settings');
  const { can, currentUser } = useAuth();
  const navigate = useNavigate();
  const dateLocale = getDateLocale(i18n.language);

  // Active Draft state
  const [activeOpname, setActiveOpname] = useState<StockOpname | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<StockOpname | null>(null);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<(StockOpnameItem & { productName: string; sku: string; unit: string })[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data from DB
  const products = useLiveQuery(() => db.products.where('isDeleted').equals(0).toArray());
  const opnameHistory = useLiveQuery(() => db.stockOpnames.orderBy('date').reverse().toArray());

  // Fetch active draft opname on mount
  useEffect(() => {
    const loadActiveDraft = async () => {
      const draft = await db.stockOpnames.where('status').equals('draft').first();
      if (draft) {
        setActiveOpname(draft);
        setNotes(draft.notes ?? '');
        // Load its items
        const items = await db.stockOpnameItems.where('opnameId').equals(draft.id!).toArray();
        const prodList = await db.products.toArray();
        const prodMap = new Map(prodList.map(p => [p.id, p]));

        const loadedDraftItems = items.map(item => {
          const p = prodMap.get(item.productId);
          return {
            productId: item.productId,
            productName: p?.name ?? t('stockOpname.deletedProduct'),
            sku: p?.sku ?? '',
            barcode: p?.barcode ?? '',
            systemStock: item.systemStock,
            realStock: item.realStock,
            unit: p?.unit ?? 'pcs'
          };
        });
        setDraftItems(loadedDraftItems);
      } else {
        setActiveOpname(null);
        setDraftItems([]);
      }
    };
    loadActiveDraft();
  }, [products, t]);

  if (!can('manage_stock_inout')) {
    return <LockedPage title={t('stockOpname.title')} permissionLabel={t('masterData.theme.permissionLabel')} />;
  }

  // Filtered draft items for display
  const filteredDraft = draftItems.filter(item =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode.includes(searchQuery)
  );

  // Start new opname session
  const handleStartOpname = async () => {
    if (!products) return;

    try {
      const activeProducts = products.filter(p => p.trackStock !== false);
      if (activeProducts.length === 0) {
        toast.error(t('stockOpname.emptyDraft'));
        return;
      }

      // Create main draft record
      const opnameId = await db.stockOpnames.add({
        date: new Date(),
        status: 'draft',
        notes: '',
        createdBy: currentUser?.id
      });

      // Map products to opname items
      const itemsToAdd = activeProducts.map(p => ({
        opnameId,
        productId: p.id!,
        systemStock: p.stock,
        realStock: p.stock, // initialize physical stock to system stock
        difference: 0
      }));

      await db.stockOpnameItems.bulkAdd(itemsToAdd);

      setActiveOpname({ id: opnameId, date: new Date(), status: 'draft', notes: '' });
      setNotes('');
      setDraftItems(activeProducts.map(p => ({
        productId: p.id!,
        productName: p.name,
        sku: p.sku,
        barcode: p.barcode ?? '',
        systemStock: p.stock,
        realStock: p.stock,
        unit: p.unit
      })));

      toast.success(t('stockOpname.toast.draftStarted'));
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.toast.startFailed'));
    }
  };

  // Handle manual input of real stock
  const handleRealStockChange = async (productId: number, value: string) => {
    const numericVal = value === '' ? 0 : Number(value);
    if (isNaN(numericVal) || numericVal < 0) return;

    // Update state
    setDraftItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, realStock: numericVal };
      }
      return item;
    }));

    // Update IndexedDB
    if (activeOpname?.id) {
      const item = await db.stockOpnameItems
        .where('[opnameId+productId]')
        .equals([activeOpname.id, productId])
        .first();

      if (item?.id) {
        await db.stockOpnameItems.update(item.id, {
          realStock: numericVal,
          difference: numericVal - item.systemStock
        });
      }
    }
  };

  // Export Excel Template
  const handleExportTemplate = async () => {
    if (draftItems.length === 0) return;

    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(t('stockOpname.excel.sheetName'));

      // Title & Instructions
      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = t('stockOpname.excel.templateTitle');
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
      titleCell.alignment = { horizontal: 'center' };

      ws.mergeCells('A2:F2');
      const instructionCell = ws.getCell('A2');
      instructionCell.value = t('stockOpname.excel.instruction');
      instructionCell.font = { name: 'Arial', size: 10, italic: true };
      instructionCell.alignment = { horizontal: 'center' };

      // Headers (labels only; import reads values by row/column index, not by header text)
      const headers = [
        t('stockOpname.excel.headerProductId'),
        t('stockOpname.excel.headerProductName'),
        t('stockOpname.excel.headerSku'),
        t('stockOpname.excel.headerBarcode'),
        t('stockOpname.excel.headerSystemStock'),
        t('stockOpname.excel.headerPhysicalStock'),
      ];
      ws.getRow(4).values = headers;
      ws.getRow(4).font = { bold: true };
      ws.getRow(4).eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        };
      });

      // Populate data
      draftItems.forEach((item, index) => {
        const rowNum = 5 + index;
        const row = ws.getRow(rowNum);
        row.getCell(1).value = item.productId;
        row.getCell(2).value = item.productName;
        row.getCell(3).value = item.sku;
        row.getCell(4).value = item.barcode;
        row.getCell(5).value = item.systemStock;
        row.getCell(6).value = item.realStock;

        // format columns
        row.getCell(1).numFmt = '@';
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';

        row.eachCell(c => {
          c.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Set column widths
      ws.getColumn(1).width = 12;
      ws.getColumn(2).width = 30;
      ws.getColumn(3).width = 15;
      ws.getColumn(4).width = 15;
      ws.getColumn(5).width = 15;
      ws.getColumn(6).width = 25;

      const buffer = await wb.xlsx.writeBuffer();
      const fileName = `${t('stockOpname.excel.fileNamePrefix')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
      await downloadOrShareFile(buffer as ArrayBuffer, {
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: t('stockOpname.excel.dialogTitle'),
        shareTitle: t('stockOpname.excel.shareTitle'),
      });
      toast.success(t('stockOpname.excel.downloadSuccess'));
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.excel.downloadError'));
    }
  };

  // Import Excel Worksheet
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = (ExcelJSModule as unknown as { default?: typeof ExcelJSModule }).default ?? ExcelJSModule;
      const arrayBuffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer);
      const ws = wb.worksheets[0];

      let updatedCount = 0;
      const updatedDraftItems = [...draftItems];

      // Read rows starting from row 5 by column index (1 = product ID, 6 = physical stock),
      // so templates generated in any language (including older Indonesian ones) stay importable
      ws.eachRow((row, rowNum) => {
        if (rowNum >= 5) {
          const productId = Number(row.getCell(1).value);
          const realStockVal = row.getCell(6).value;
          const realStock = realStockVal !== null && realStockVal !== undefined ? Number(realStockVal) : null;

          if (!isNaN(productId) && realStock !== null && !isNaN(realStock) && realStock >= 0) {
            const index = updatedDraftItems.findIndex(item => item.productId === productId);
            if (index !== -1) {
              updatedDraftItems[index].realStock = realStock;
              updatedCount++;
            }
          }
        }
      });

      if (updatedCount > 0) {
        setDraftItems(updatedDraftItems);
        // Persist all imported values back to Dexie
        if (activeOpname?.id) {
          await db.transaction('rw', [db.stockOpnameItems], async () => {
            for (const item of updatedDraftItems) {
              const opnameItem = await db.stockOpnameItems
                .where('[opnameId+productId]')
                .equals([activeOpname.id!, item.productId])
                .first();
              if (opnameItem?.id) {
                await db.stockOpnameItems.update(opnameItem.id, {
                  realStock: item.realStock,
                  difference: item.realStock - item.systemStock
                });
              }
            }
          });
        }
        toast.success(t('stockOpname.excel.uploadSuccess', { count: updatedCount }));
      } else {
        toast.error(t('stockOpname.excel.uploadError'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.excel.uploadError'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Cancel Opname draft
  const handleCancelOpname = async () => {
    if (!activeOpname?.id) return;
    if (confirm(t('stockOpname.cancelConfirm'))) {
      try {
        await db.transaction('rw', [db.stockOpnames, db.stockOpnameItems], async () => {
          await db.stockOpnameItems.where('opnameId').equals(activeOpname.id!).delete();
          await db.stockOpnames.delete(activeOpname.id!);
        });
        setActiveOpname(null);
        setDraftItems([]);
        toast.info(t('stockOpname.toast.cancelled'));
      } catch (err) {
        console.error(err);
        toast.error(t('stockOpname.toast.cancelFailed'));
      }
    }
  };

  // Complete/Submit Opname
  const handleSubmitOpname = async () => {
    if (!activeOpname?.id || draftItems.length === 0) return;
    setSubmitting(true);

    try {
      const now = new Date();

      await db.transaction('rw', [db.products, db.stockOpnames, db.stockOpnameItems, db.stockIns, db.stockOuts], async () => {
        // 1. Update main opname status
        await db.stockOpnames.update(activeOpname.id!, {
          status: 'completed',
          date: now,
          notes: notes.trim() || undefined
        });

        // 2. Adjust stocks in products table & insert into stock movements
        for (const item of draftItems) {
          const diff = item.realStock - item.systemStock;

          // Update product stock
          await db.products.update(item.productId, {
            stock: item.realStock,
            updatedAt: now
          });

          // Insert stock movements if difference is non-zero
          if (diff > 0) {
            // positive adjustment = Stock In
            const prod = await db.products.get(item.productId);
            await db.stockIns.add({
              productId: item.productId,
              supplierId: 0, // 0 = adjustment / no supplier
              quantity: diff,
              buyPrice: prod?.hpp ?? 0,
              totalPrice: (prod?.hpp ?? 0) * diff,
              date: now,
              notes: t('stockOpname.adjustmentNote', { id: activeOpname.id }),
              createdBy: currentUser?.id
            });
          } else if (diff < 0) {
            // negative adjustment = Stock Out
            await db.stockOuts.add({
              productId: item.productId,
              quantity: Math.abs(diff),
              reason: 'opname',
              date: now,
              notes: t('stockOpname.adjustmentNote', { id: activeOpname.id }),
              createdBy: currentUser?.id
            });
          }
        }
      });

      toast.success(t('stockOpname.toast.saved'));
      setActiveOpname(null);
      setDraftItems([]);
      setConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.toast.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open history detail
  const handleOpenHistoryDetail = async (opname: StockOpname) => {
    try {
      setSelectedHistory(opname);
      const items = await db.stockOpnameItems.where('opnameId').equals(opname.id!).toArray();
      const prodList = await db.products.toArray();
      const prodMap = new Map(prodList.map(p => [p.id, p]));

      const mapped = items.map(item => {
        const p = prodMap.get(item.productId);
        return {
          ...item,
          productName: p?.name ?? t('stockOpname.deletedProduct'),
          sku: p?.sku ?? '',
          unit: p?.unit ?? 'pcs'
        };
      });

      setSelectedHistoryItems(mapped);
      setHistoryDetailOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(t('stockOpname.toast.historyLoadFailed'));
    }
  };

  return (
    <div className="px-4 pt-6 pb-20 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          {t('stockOpname.title')}
        </h1>
      </div>

      {activeOpname ? (
        // DRAFT SESSION PANEL
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold">
                  {t('stockOpname.activeSession', { date: format(new Date(activeOpname.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale }) })}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t('stockOpname.activeSessionHint')}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelOpname}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Import / Export actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExportTemplate}>
                  <Download className="w-4 h-4" />
                  {t('stockOpname.excel.templateButton')}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  {t('stockOpname.excel.uploadExcel')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleImportExcel}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="opname-notes" className="text-xs">{t('stockOpname.sessionNotes')}</Label>
                <Input
                  id="opname-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('stockOpname.toast.notesPlaceholder')}
                  className="h-9 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Search bar & Draft List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('stockOpname.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredDraft.map(item => {
                const diff = item.realStock - item.systemStock;
                return (
                  <Card key={item.productId} className="border border-border/70 shadow-none">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">SKU: {item.sku || '-'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {t('stockOpname.systemStockText')}: {item.systemStock} {item.unit}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            diff > 0 ? 'bg-success/10 text-success' :
                            diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </div>
                      </div>

                      <div className="w-24 shrink-0 flex flex-col gap-1 items-end">
                        <Label className="text-[9px] text-muted-foreground">{t('stockOpname.realStockText')}</Label>
                        <Input
                          type="number"
                          value={item.realStock}
                          onChange={(e) => handleRealStockChange(item.productId, e.target.value)}
                          className="h-8 text-center text-xs px-1 font-bold"
                          min={0}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredDraft.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  {t('stockOpname.emptyDraft')}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <Button className="w-full h-11 font-bold mt-2" onClick={() => setConfirmOpen(true)}>
            <Check className="w-5 h-5 mr-1.5" />
            {t('stockOpname.completeButton')}
          </Button>
        </div>
      ) : (
        // HISTORY & START SCREEN
        <div className="space-y-4">
          <Button className="w-full h-12 gap-2 text-sm font-bold" onClick={handleStartOpname}>
            <Plus className="w-5 h-5" />
            {t('stockOpname.initButton')}
          </Button>

          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              {t('stockOpname.historyTitle')}
            </h2>

            <div className="space-y-2">
              {opnameHistory?.map(opname => (
                <Card
                  key={opname.id}
                  className="border border-border/70 hover:border-primary/30 shadow-none cursor-pointer transition-colors"
                  onClick={() => handleOpenHistoryDetail(opname)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold">
                        {format(new Date(opname.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale })}
                      </p>
                      {opname.notes && <p className="text-[10px] text-muted-foreground italic truncate max-w-[280px]">{opname.notes}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      opname.status === 'completed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                    }`}>
                      {t(`stockOpname.status.${opname.status}`)}
                    </span>
                  </CardContent>
                </Card>
              ))}

              {opnameHistory?.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border/60 rounded-xl text-xs text-muted-foreground">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  {t('stockOpname.noHistory')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-warning" />
              {t('stockOpname.dialog.submitTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1.5">
              {t('stockOpname.dialog.submitDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 justify-end mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t('stockOpname.dialog.submitCancel')}
            </Button>
            <Button size="sm" onClick={handleSubmitOpname} disabled={submitting}>
              {submitting ? t('stockOpname.processing') : t('stockOpname.dialog.submitConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HISTORY DETAIL SHEET/DIALOG */}
      <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
        <DialogContent className="max-w-[95vw] rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {t('stockOpname.detail.title', { id: selectedHistory?.id })}
            </DialogTitle>
            <DialogDescription className="text-[10px] pt-1">
              {selectedHistory && t('stockOpname.detail.date', { date: format(new Date(selectedHistory.date), 'dd MMMM yyyy HH:mm', { locale: dateLocale }) })}
              {selectedHistory?.notes && <span className="block mt-1 italic">{t('stockOpname.detail.notes', { notes: selectedHistory.notes })}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {selectedHistoryItems.map(item => {
              const diff = item.realStock - item.systemStock;
              return (
                <div key={item.id} className="p-2 border border-border/60 rounded-lg flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.productName}</p>
                    <p className="text-[9px] text-muted-foreground">SKU: {item.sku || '-'}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5 ml-2">
                    <p className="font-bold">{t('stockOpname.detail.physical', { qty: item.realStock, unit: item.unit })}</p>
                    <p className="text-[9px] text-muted-foreground">{t('stockOpname.detail.system', { qty: item.systemStock })}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block ${
                      diff > 0 ? 'bg-success/10 text-success' :
                      diff < 0 ? 'bg-destructive/10 text-destructive' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-4">
            <Button className="w-full" onClick={() => setHistoryDetailOpen(false)}>
              {t('stockOpname.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
