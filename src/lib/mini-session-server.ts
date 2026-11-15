import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { MiniSession, MiniSlotLock } from "@/lib/mini-session";

/* Phần MÁY CHỦ của "Chụp theo khung giờ": đọc đợt + khoá, nhả khung hết hạn.
   Luật thuần nằm ở @/lib/mini-session; SQL ở migrations/chup_theo_khung_gio.sql. */

type Db = ReturnType<typeof createAdminClient>;

export const SESSION_COLS =
  "id, owner_id, token, title, session_date, start_min, end_min, slot_minutes, gap_minutes, price, deposit, location, note, is_open, created_at";
export const LOCK_COLS =
  "id, session_id, start_min, booking_id, customer_name, customer_phone, note, hold_expires_at, source, created_at";

/** Vai trò được quản lý đợt chụp — cùng nhóm với mục "Đặt lịch khách" (MANAGER_OK). */
export const MINI_ROLES = ["owner", "admin", "manager", "branch_manager"];

/**
 * Nhả các khung đã hết hạn giữ (xoá khoá → dòng lịch làm việc biến mất theo).
 * Không có cron riêng: gọi mỗi khi ai đó mở trang đợt (studio hoặc khách) và
 * ngay trong hàm đặt khung. Lỗi thì nuốt — phía đọc vẫn tự coi khoá hết hạn là
 * trống (lockLive), nên hỏng ở đây không làm sai lưới.
 */
export async function releaseExpired(db: Db, sessionId: string | null): Promise<void> {
  try {
    await db.rpc("mini_release_expired", { p_session: sessionId });
  } catch {
    /* bỏ qua */
  }
}

export async function sessionByToken(db: Db, token: string): Promise<MiniSession | null> {
  if (!token || token.length > 80) return null;
  const { data } = await db.from("studio_mini_sessions").select(SESSION_COLS).eq("token", token).maybeSingle();
  return (data as unknown as MiniSession | null) ?? null;
}

export async function locksOf(db: Db, sessionId: string): Promise<MiniSlotLock[]> {
  const { data } = await db.from("studio_mini_slots").select(LOCK_COLS).eq("session_id", sessionId);
  return (data ?? []) as unknown as MiniSlotLock[];
}

/** Giờ hiện tại ở Việt Nam, tính bằng phút từ 00:00. */
export function nowMinVN(): number {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Token của link công khai — dài, ngẫu nhiên. */
export function newSessionToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}
