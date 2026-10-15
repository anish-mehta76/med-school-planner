/** Display formatting helpers. Presentation only: inputs stay ISO strings and numbers. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** "2027-01-04" → "Jan 4, 2027". Returns the input unchanged if it isn't an ISO date. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2027-01-04" → "Jan 4" in the current year, otherwise "Jan 4, 2027". */
export function formatDateShort(iso: string | undefined, today = new Date()): string {
  if (!iso) return '';
  const { y, m, d } = parts(iso);
  if (!y || !m || !d) return iso;
  return y === today.getFullYear() ? `${MONTHS[m - 1]} ${d}` : `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-01-15" or "2026-01" → "Jan 2026". */
export function formatMonth(iso: string | undefined): string {
  if (!iso) return '';
  const { y, m } = parts(iso);
  if (!y || !m) return iso;
  return `${MONTHS[m - 1]} ${y}`;
}

/** 1240 → "1,240"; keeps one decimal for fractional values. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** 1240 → "1,240 hrs", 1 → "1 hr". */
export function formatHours(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'hr' : 'hrs'}`;
}

/** Capitalizes the first letter only ("endometrial study" → "Endometrial study"). */
export function sentenceCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
