import { effectivePlan, type Plan } from "./plans";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM AI — phần mềm thiết kế album & slide ảnh bằng AI (albumai.mstudo.com).

   Chủ studio gói Studio được TẶNG 1 NĂM bản quyền. Bản quyền gắn với EMAIL chứ
   không gắn với máy: chủ studio cài Album AI rồi đăng nhập bằng đúng email tài
   khoản mstudo, máy chủ Album AI hỏi `POST /api/albumai/license` (docs/album-ai.md).
   Lần hỏi ĐẦU TIÊN của một tài khoản đủ điều kiện là lúc bản quyền được kích
   hoạt và bắt đầu đếm 1 năm — tặng từ lúc người dùng thật sự bắt đầu dùng, không
   phải từ ngày ra mắt chương trình.

   File này KHÔNG import gì phía server (chỉ ./plans, nhập bằng đường dẫn TƯƠNG
   ĐỐI) để dùng chung được cho component client, route API và test chạy thẳng
   bằng node (desktop/test/albumai.mjs).
   ═══════════════════════════════════════════════════════════════════════════ */

export const ALBUMAI_URL = process.env.NEXT_PUBLIC_ALBUMAI_URL || "https://albumai.mstudo.com";

/** Tên miền hiển thị trên giao diện (không kèm https://). */
export const ALBUMAI_HOST_LABEL = ALBUMAI_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");

/** Số năm bản quyền tặng kèm gói Studio. */
export const ALBUMAI_GIFT_YEARS = 1;

/**
 * Cookie "đã ẩn thẻ giới thiệu Album AI" ở trang Tổng quan. Cookie chứ không
 * localStorage: trang Tổng quan dựng ở máy chủ, đọc được cookie thì thẻ đã ẩn
 * không loé lên rồi mới biến mất ở mỗi lần mở.
 */
export const ALBUMAI_HIDE_COOKIE = "mstudo_albumai_hide";

export type AlbumAiInput = {
  /** Gói ĐANG HIỆU LỰC (đã qua effectivePlan — gói hết hạn tính là free). */
  plan: Plan;
  /** 'month' | 'year' | 'trial' | null. */
  planCycle: string | null;
  isAdmin: boolean;
  /** Tài khoản nhân viên của một studio (profiles.studio_owner_id khác null). */
  isStaff: boolean;
  /** Mốc hết hạn bản quyền đã kích hoạt (profiles.albumai_expires_at). */
  expiresAt: string | null;
};

/**
 * Trạng thái bản quyền Album AI của một tài khoản:
 *   active  — đã kích hoạt, còn hạn
 *   expired — đã kích hoạt, hết 1 năm tặng
 *   ready   — đủ điều kiện, chưa kích hoạt: đăng nhập Album AI là kích hoạt
 *   trial   — đang DÙNG THỬ Studio: chưa tặng (7 ngày dùng thử không đổi được 1 năm bản quyền)
 *   staff   — tài khoản nhân viên: bản quyền gắn với email CHỦ studio
 *   upgrade — gói khác: phải nâng cấp Studio
 */
export type AlbumAiStatus =
  | { state: "active"; expiresAt: string }
  | { state: "expired"; expiresAt: string }
  | { state: "ready" }
  | { state: "trial" }
  | { state: "staff" }
  | { state: "upgrade" };

export function albumAiStatus(i: AlbumAiInput, now: Date = new Date()): AlbumAiStatus {
  if (i.isStaff) return { state: "staff" };
  // Đã kích hoạt thì giữ đúng mốc đã tặng, kể cả khi sau đó đổi gói: quà đã
  // trao thì không thu lại giữa chừng.
  if (i.expiresAt) {
    const t = new Date(i.expiresAt).getTime();
    if (Number.isFinite(t)) return t > now.getTime() ? { state: "active", expiresAt: i.expiresAt } : { state: "expired", expiresAt: i.expiresAt };
  }
  if (i.isAdmin) return { state: "ready" };
  if (i.plan === "studio") return i.planCycle === "trial" ? { state: "trial" } : { state: "ready" };
  return { state: "upgrade" };
}

/** Mốc hết hạn khi kích hoạt bản quyền tặng tại thời điểm `from`. */
export function albumAiGiftExpiry(from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setFullYear(d.getFullYear() + ALBUMAI_GIFT_YEARS);
  return d.toISOString();
}

/**
 * Trạng thái từ một dòng `profiles` (đọc bằng select("*")). Database chưa chạy
 * migrations/albumai_license.sql thì không có cột albumai_expires_at — coi như
 * chưa kích hoạt, trang vẫn chạy bình thường.
 *
 * `isStaff`: với tài khoản nhân viên, requireStudio() trả về hồ sơ của CHỦ
 * studio, nên không suy được từ chính dòng đó — người gọi phải truyền vào.
 */
export function albumAiStatusOf(
  p: { role?: string | null; plan?: Plan | null; plan_cycle?: string | null; plan_expires_at?: string | null; albumai_expires_at?: string | null },
  isStaff: boolean,
  now: Date = new Date(),
): AlbumAiStatus {
  return albumAiStatus(
    {
      plan: effectivePlan(p.plan, p.plan_expires_at),
      planCycle: p.plan_cycle ?? null,
      isAdmin: p.role === "admin",
      isStaff,
      expiresAt: p.albumai_expires_at ?? null,
    },
    now,
  );
}
