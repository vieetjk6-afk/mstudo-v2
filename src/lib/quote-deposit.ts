/**
 * Compute a "clean" deposit amount in VND:
 *   - prefers a multiple of 500,000 VND
 *   - tries to land between 20% and 30% of the total
 *   - never less than 500,000 VND (the lower bound from the studio's policy)
 *
 * If no 500k multiple falls inside the 20–30% band (small totals), we pick the
 * smallest 500k multiple that is at least 20% of the total — even if it ends
 * up above 30%, because rounding cleanly trumps the upper bound for tiny jobs.
 */
export const DEPOSIT_STEP = 500_000;
export const DEPOSIT_MIN = 500_000;

export function computeRoundedDeposit(total: number): number {
  if (!total || total <= 0) return DEPOSIT_MIN;

  const min20 = total * 0.2;
  const max30 = total * 0.3;

  // Smallest 500k-multiple that is ≥ min20.
  const first = Math.ceil(min20 / DEPOSIT_STEP) * DEPOSIT_STEP;

  // If that already exceeds the 30% ceiling, total is too small for a clean
  // 500k step inside the band — fall back to the first 500k-multiple ≥ min20.
  if (first > max30) {
    return Math.max(DEPOSIT_MIN, first);
  }

  // Otherwise pick the 500k-multiple closest to 25% (mid-band), but still ≤ max30.
  const target = total * 0.25;
  let best = first;
  for (let v = first; v <= max30; v += DEPOSIT_STEP) {
    if (Math.abs(v - target) < Math.abs(best - target)) best = v;
  }
  return Math.max(DEPOSIT_MIN, best);
}

/** % cọc mặc định khi studio chưa tự đặt (profiles.contract_deposit_percent). */
export const DEFAULT_DEPOSIT_PERCENT = 25;

/**
 * Cọc hợp đồng theo % studio tự đặt ở "Chính sách studio": làm tròn tới bội
 * 500k gần nhất, tối thiểu 500k, không quá tổng. 0% = studio tắt cọc tự động
 * → trả 0. Màn tạo hợp đồng và màn chi tiết dùng CHUNG hàm này để hai nơi ra
 * cùng một số cọc.
 */
export function depositByPercent(total: number, percent: number = DEFAULT_DEPOSIT_PERCENT): number {
  if (!total || total <= 0 || !percent || percent <= 0) return 0;
  const rounded = Math.round((total * percent) / 100 / DEPOSIT_STEP) * DEPOSIT_STEP;
  return Math.min(total, Math.max(DEPOSIT_MIN, rounded));
}

/** Same value as a "real" percentage of the total — handy for the UI. */
export function depositRatio(total: number, deposit: number): number {
  if (!total) return 0;
  return (deposit / total) * 100;
}
