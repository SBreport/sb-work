/** 현재 월을 'YYYY-MM' 형식으로 반환 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 주어진 월에서 offset만큼 이동한 월을 반환 */
export function getAdjacentMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'N월' */
export function shortMonthLabel(month: string): string {
  const [, m] = month.split('-');
  return `${Number(m)}월`;
}
