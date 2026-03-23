import * as XLSX from "xlsx";
import type { QueueFile } from "../types/receipt";

export type ExportMode = "separate" | "merged";

type Row = Record<string, string | number | null>;

/** 与界面一致：仅 6 列；首行为表头；商品行左侧重复购物时间、超市名称 */
const COL_WIDTHS = [{ wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];

const HEADER_ROW: Row = {
  购物时间: "购物时间",
  超市名称: "超市名称",
  商品名称: "商品名称",
  数量: "数量",
  单价: "单价",
  小计: "小计"
};

function safeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31) || "小票";
}

function buildReceiptRows(entry: QueueFile, index: number): Row[] {
  const result = entry.result!;
  const rows: Row[] = [];
  const date = result.date ?? "未知时间";
  const store = result.storeName ?? "未知超市";

  rows.push({ ...HEADER_ROW });

  result.items.forEach((item) => {
    rows.push({
      购物时间: date,
      超市名称: store,
      商品名称: item.name,
      数量: item.quantity,
      单价: item.price,
      小计: item.subtotal
    });
  });

  rows.push({
    购物时间: date,
    超市名称: store,
    商品名称: "合计",
    数量: "",
    单价: "",
    小计: result.total
  });

  // blank separator row (used by merged mode)
  rows.push({ 购物时间: "", 超市名称: `__SEP__${index}`, 商品名称: "", 数量: "", 单价: "", 小计: "" });

  return rows;
}

function exportSeparate(files: QueueFile[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  files.forEach((entry, index) => {
    const rows = buildReceiptRows(entry, index).filter((r) => !String(r["超市名称"]).startsWith("__SEP__"));
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
    rows[rows.length - 1] = { 购物时间: "", 超市名称: "", 商品名称: "", 数量: "", 单价: "", 小计: "" };
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
