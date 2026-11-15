import type { MiniSession, MiniSlotLock } from "@/lib/mini-session";

/** Phần cọc của yêu cầu đặt lịch gắn với một khung (đọc từ studio_bookings). */
export type LockDeposit = {
  deposit_amount: number | null;
  deposit_status: "none" | "awaiting" | "paid" | "confirmed";
  deposit_code: string | null;
  deposit_proof_url: string | null;
};

export type DotChupProps = {
  sessions: MiniSession[];
  locks: MiniSlotLock[];
  /** booking_id → cọc. */
  deposits: Record<string, LockDeposit>;
  /** false = chưa chạy migration chup_theo_khung_gio.sql. */
  migrated: boolean;
  studioHost: string | null;
  /** YYYY-MM-DD theo giờ Việt Nam. */
  today: string;
  /** Tài khoản được phép dùng giao diện mới (để hiện nút chuyển ở bản cũ). */
  canSwitchUi: boolean;
  /** Đợt mở sẵn (?dot=<id> — link trong thông báo đẩy). */
  openId: string | null;
  defaults: { deposit: number; hasBank: boolean; location: string | null };
};
