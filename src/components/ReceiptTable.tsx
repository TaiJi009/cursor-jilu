import type { Receipt, ReceiptItem } from "../types/receipt";

interface ReceiptTableProps {
  receipt: Receipt;
  onChange: (next: Receipt) => void;
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function ReceiptTable({ receipt, onChange }: ReceiptTableProps) {
  const updateItem = (index: number, key: keyof ReceiptItem, value: string) => {
    const items = receipt.items.map((item, currentIndex) => {
      if (currentIndex !== index) return item;
      if (key === "name") {
        return { ...item, name: value };
      }
      return { ...item, [key]: toNumber(value) };
    });
    onChange({ ...receipt, items });
  };

  const inputCls =
    "min-h-10 min-w-[5rem] w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm md:min-h-0 md:py-1 dark:border-gray-600 dark:bg-gray-900";
  const metaInputCls =
    "min-h-10 min-w-0 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm md:min-w-[10rem] md:py-1 dark:border-gray-600 dark:bg-gray-900";

  const thHiddenMd = "hidden whitespace-nowrap px-2 py-2 md:table-cell md:px-3";
  const thVisible = "whitespace-nowrap px-2 py-2 md:px-3";
  const tdHiddenMd = "hidden align-top px-2 py-2 md:table-cell md:px-3";
  const tdCell = "px-2 py-2 md:px-3";

  return (
    <section className="card overflow-hidden p-3 sm:p-4 md:p-5">
      <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">校对与编辑</h2>
      <p className="mb-3 text-[11px] text-gray-500 md:hidden dark:text-gray-400">
        小屏下「时间 / 超市」在下方；商品表可左右滑动查看全部列。
      </p>

      {/* 移动端：时间与超市单独一块（上图下表 / 避免六列表格过窄） */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:hidden">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
          购物时间
          <input
            value={receipt.date ?? ""}
            onChange={(event) => onChange({ ...receipt, date: event.target.value })}
            className={metaInputCls}
            placeholder="YYYY-MM-DD HH:mm"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
          超市名称
          <input
            value={receipt.storeName ?? ""}
            onChange={(event) => onChange({ ...receipt, storeName: event.target.value })}
            className={metaInputCls}
            placeholder="超市名称"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-1 sm:mx-0 sm:px-0">
        <table className="min-w-[min(100%,36rem)] w-full text-xs sm:min-w-0 sm:text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
              <th className={thHiddenMd}>购物时间</th>
              <th className={thHiddenMd}>超市名称</th>
              <th className={thVisible}>商品名称</th>
              <th className={thVisible}>数量</th>
              <th className={thVisible}>单价</th>
              <th className={thVisible}>小计</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.length === 0 ? (
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className={`${tdHiddenMd} align-top`}>
                  <input
                    value={receipt.date ?? ""}
                    onChange={(event) => onChange({ ...receipt, date: event.target.value })}
                    className={metaInputCls}
                    placeholder="YYYY-MM-DD HH:mm"
                  />
                </td>
                <td className={`${tdHiddenMd} align-top`}>
                  <input
                    value={receipt.storeName ?? ""}
                    onChange={(event) => onChange({ ...receipt, storeName: event.target.value })}
                    className={metaInputCls}
                    placeholder="超市名称"
                  />
                </td>
                <td colSpan={4} className={`${tdCell} py-4 text-center text-gray-400 dark:text-gray-500`}>
                  暂无商品
                </td>
              </tr>
            ) : (
              receipt.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                  <td className={`${tdHiddenMd} align-top`}>
                    <input
                      value={receipt.date ?? ""}
                      onChange={(event) => onChange({ ...receipt, date: event.target.value })}
                      className={metaInputCls}
                      placeholder="YYYY-MM-DD HH:mm"
                    />
                  </td>
                  <td className={`${tdHiddenMd} align-top`}>
                    <input
                      value={receipt.storeName ?? ""}
                      onChange={(event) => onChange({ ...receipt, storeName: event.target.value })}
                      className={metaInputCls}
                      placeholder="超市名称"
                    />
                  </td>
                  <td className={tdCell}>
                    <input
                      value={item.name}
                      onChange={(event) => updateItem(index, "name", event.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className={tdCell}>
                    <input
                      inputMode="decimal"
                      value={item.quantity ?? ""}
                      onChange={(event) => updateItem(index, "quantity", event.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className={tdCell}>
                    <input
                      inputMode="decimal"
                      value={item.price ?? ""}
                      onChange={(event) => updateItem(index, "price", event.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className={tdCell}>
                    <input
                      inputMode="decimal"
                      value={item.subtotal ?? ""}
                      onChange={(event) => updateItem(index, "subtotal", event.target.value)}
                      className={inputCls}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 text-sm font-semibold text-gray-800 sm:mt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-2 dark:border-gray-700 dark:text-gray-200">
        <span className="shrink-0">合计</span>
        <input
          inputMode="decimal"
          value={receipt.total ?? ""}
          onChange={(event) => onChange({ ...receipt, total: toNumber(event.target.value) })}
          className="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right sm:min-h-0 sm:w-40 dark:border-gray-600 dark:bg-gray-900"
        />
      </div>
    </section>
  );
}
