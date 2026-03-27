/**
 * 将识别或编辑中的日期时间统一为展示格式：YYYY/M/D HH:mm:ss（月日不补零，时分秒两位）
 * 例：2026/1/24 12:38:12
 */
export function formatShoppingDateTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const pad2 = (n: number) => n.toString().padStart(2, "0");

  const m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = m[4] != null ? Number(m[4]) : 0;
    const mi = m[5] != null ? Number(m[5]) : 0;
    const sec = m[6] != null ? Number(m[6]) : 0;
    return `${y}/${mo}/${d} ${pad2(h)}:${pad2(mi)}:${pad2(sec)}`;
  }

  const t = Date.parse(s.replace(/\//g, "-"));
  if (!Number.isNaN(t)) {
    const x = new Date(t);
    return `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()} ${pad2(x.getHours())}:${pad2(x.getMinutes())}:${pad2(x.getSeconds())}`;
  }

  return s;
}
