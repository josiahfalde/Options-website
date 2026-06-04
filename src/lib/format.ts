export const usd = (n: number, dp = 2): string =>
  (n < 0 ? "-" : "") +
  "$" +
  Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const usd0 = (n: number) => usd(n, 0);

export const pct = (n: number, dp = 1): string =>
  (n >= 0 ? "" : "-") + (Math.abs(n) * 100).toFixed(dp) + "%";

export const signed = (n: number, dp = 2): string =>
  (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");

export const posneg = (n: number) => (n >= 0 ? "pos" : "neg");

// "2026-06-03" -> "Jun 3, 2026"
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} '${String(y).slice(2)}`;
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
