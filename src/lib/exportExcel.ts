import * as XLSX from "xlsx";
import type { QueueFile } from "../types/receipt";

export type ExportMode = "separate" | "merged";

type Row = Record<string, string | number | null>;

const COL_WIDTHS = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];

function safeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31) || "小票";
}

function buildReceiptRows(entry: QueueFile, index: number): Row[] {
  const result = entry.result!;
  const rows: Row[] = [];

  rows.push({ 店铺: result.storeName ?? "未知超市", 购物时间: result.date ?? "未知时间", 商品名称: "", 单价: "", 数量: "", 小计: "", 合计: "" });
  rows.push({ 店铺: "", 购物时间: "", 商品名称: "商品名称", 单价: "单价", 数量: "数量", 小计: "小计", 合计: "" });

  result.items.forEach((item) => {
    rows.push({ 店铺: "", 购物时间: "", 商品名称: item.name, 单价: item.price, 数量: item.quantity, 小计: item.subtotal, 合计: "" });
  });

  rows.push({ 店铺: "", 购物时间: "", 商品名称: "", 单价: "", 数量: "", 小计: "", 合计: result.total });

  // blank separator row (used by merged mode)
  rows.push({ 店铺: `__SEP__${index}`, 购物时间: "", 商品名称: "", 单价: "", 数量: "", 小计: "", 合计: "" });

  return rows;
}

function exportSeparate(files: QueueFile[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  files.forEach((entry, index) => {
    const rows = buildReceiptRows(entry, index).filter((r) => !String(r["店铺"]).startsWith("__SEP__"));
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws["!cols"] = COL_WIDTHS;
    const nameSource = `${entry.result!.storeName ?? "小票"}-${entry.result!.date ?? index + 1}`;
    XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(nameSource));
  });
  return workbook;
}

function exportMerged(files: QueueFile[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const allRows: Row[] = [];

  files.forEach((entry, index) => {
    const rows = buildReceiptRows(entry, index);
    // replace sentinel separator with a truly blank row
    rows[rows.length - 1] = { 店铺: "", 购物时间: "", 商品名称: "", 单价: "", 数量: "", 小计: "", 合计: "" };
    allRows.push(...rows);
  });

  const ws = XLSX.utils.json_to_sheet(allRows, { skipHeader: true });
  ws["!cols"] = COL_WIDTHS;
  XLSX.utils.book_append_sheet(workbook, ws, "汇总");
  return workbook;
}

export function exportReceiptsToExcel(files: QueueFile[], mode: ExportMode = "separate"): void {
  const successFiles = files.filter((item) => item.status === "success" && item.result);
  if (successFiles.length === 0) {
    throw new Error("暂无可导出的识别结果。");
  }

  const workbook = mode === "merged" ? exportMerged(successFiles) : exportSeparate(successFiles);
  XLSX.writeFile(workbook, `超市小票识别_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
