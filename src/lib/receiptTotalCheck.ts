import type { Receipt } from "../types/receipt";

/** 金额比较容差（元），避免浮点误差误判 */
const CURRENCY_EPS = 0.02;

/**
 * 识别结果中各行「小计」之和是否与「合计」一致。
 * 无有效合计时返回 false（不做高亮，避免误报）。
 */
export function receiptHasSubtotalTotalMismatch(receipt: Receipt): boolean {
  const total = receipt.total;
  if (total == null || !Number.isFinite(total)) return false;

  let sum = 0;
  for (const item of receipt.items) {
    const st = item.subtotal;
    if (st != null && Number.isFinite(st)) sum += st;
  }

  return Math.abs(sum - total) > CURRENCY_EPS;
}
