/**
 * Bộ đếm hoạt động tài khoản — dùng cho màn Người dùng & studio của admin.
 *
 * Câu hỏi cần trả lời: studio này còn dùng mstudo hay đã bỏ? `created_at` chỉ
 * nói lúc họ đăng ký, `plan_expires_at` chỉ nói họ trả tiền tới bao giờ.
 *
 * Đơn vị đo là SỐ NGÀY có hoạt động, không phải số lượt mở: một người mở 50 lần
 * trong một ngày không gắn bó hơn người mở đúng một lần mỗi ngày suốt 50 ngày.
 */

/** Khoảng im lặng tối thiểu để lần mở tiếp theo được tính là một PHIÊN mới. */
export const SESSION_GAP_MINUTES = 15;

export type ActivityLevel = "never" | "active" | "idle" | "dormant" | "lost";

/**
 * Ngưỡng (ngày kể từ lần cuối mở app). Chọn theo nhịp làm việc của studio ảnh
 * cưới: một studio đang chạy sẽ mở app trong tuần; im quá một tháng gần như
 * chắc chắn đã quay về Excel/giấy.
 */
export const ACTIVITY_THRESHOLDS = { active: 7, idle: 30, dormant: 90 } as const;

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  never: "Chưa từng mở",
  active: "Đang dùng",
  idle: "Thưa dần",
  dormant: "Ngủ đông",
  lost: "Đã bỏ",
};

export const ACTIVITY_TONE: Record<ActivityLevel, { fg: string; bg: string }> = {
  never: { fg: "var(--tx3)", bg: "var(--sf2)" },
  active: { fg: "var(--gn)", bg: "var(--gnS)" },
  idle: { fg: "var(--am)", bg: "var(--amS)" },
  dormant: { fg: "var(--rd)", bg: "var(--rdS)" },
  lost: { fg: "var(--rd)", bg: "var(--rdS)" },
};

/** Số ngày trọn vẹn kể từ `iso` tới `now`. null khi chưa có mốc nào. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  // Âm (mốc ở tương lai, do lệch giờ máy chủ) thì kẹp về 0 — báo "-2 ngày trước"
  // ra màn admin trông như lỗi dữ liệu.
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** Xếp một tài khoản vào mức hoạt động theo lần cuối mở app. */
export function activityLevel(lastActiveAt: string | null | undefined, now: Date = new Date()): ActivityLevel {
  const d = daysSince(lastActiveAt, now);
  if (d === null) return "never";
  if (d <= ACTIVITY_THRESHOLDS.active) return "active";
  if (d <= ACTIVITY_THRESHOLDS.idle) return "idle";
  if (d <= ACTIVITY_THRESHOLDS.dormant) return "dormant";
  return "lost";
}

/** "Hôm nay" · "2 ngày trước" · "Chưa từng mở" — cho cột trong bảng admin. */
export function lastActiveLabel(lastActiveAt: string | null | undefined, now: Date = new Date()): string {
  const d = daysSince(lastActiveAt, now);
  if (d === null) return "Chưa từng mở";
  if (d === 0) return "Hôm nay";
  if (d === 1) return "Hôm qua";
  return `${d} ngày trước`;
}

/**
 * Ngày theo giờ VN (YYYY-MM-DD) của một mốc thời gian.
 *
 * Bộ đếm phải chốt ngày theo giờ VN chứ không theo UTC: studio làm việc tới
 * khuya, mà 23h VN vẫn là 16h UTC CÙNG ngày — nhưng 7h sáng VN lại là 0h UTC
 * cùng ngày. Nếu đếm theo UTC thì mọi hoạt động từ 0h đến 7h sáng VN bị gán
 * sang ngày hôm trước, làm số ngày hoạt động thiếu đi một cách hệ thống.
 */
export function vnDay(at: Date = new Date()): string {
  return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Tính bản ghi bộ đếm mới từ bản ghi cũ. Tách khỏi API để test được — đây là
 * chỗ dễ sai nhất: đếm nhầm một lần là số liệu hỏng vĩnh viễn, không dựng lại
 * được vì không lưu nhật ký từng lượt.
 *
 * Trả về `null` khi KHÔNG cần ghi gì (vẫn trong cùng một phiên) — để API bỏ hẳn
 * lượt ghi DB thay vì ghi đè cùng giá trị.
 */
export function nextActivity(
  prev: { last_active_at: string | null; last_active_day: string | null; active_days: number; visit_count: number },
  now: Date = new Date(),
): { last_active_at: string; last_active_day: string; active_days: number; visit_count: number } | null {
  const today = vnDay(now);
  const gapMs = SESSION_GAP_MINUTES * 60_000;
  const prevAt = prev.last_active_at ? new Date(prev.last_active_at).getTime() : null;
  const isNewSession = prevAt === null || !Number.isFinite(prevAt) || now.getTime() - prevAt >= gapMs;
  const isNewDay = prev.last_active_day !== today;

  // Cùng phiên, cùng ngày → không có gì mới để ghi.
  if (!isNewSession && !isNewDay) return null;

  return {
    last_active_at: now.toISOString(),
    last_active_day: today,
    // Ngày mới thì +1; cùng ngày mở lại nhiều lần vẫn chỉ tính MỘT ngày.
    active_days: prev.active_days + (isNewDay ? 1 : 0),
    visit_count: prev.visit_count + (isNewSession ? 1 : 0),
  };
}
