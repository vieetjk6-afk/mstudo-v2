import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJSON, encryptJSON } from "./crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ZaloChannel = "oa" | "personal";
export type ZaloConnStatus = "disconnected" | "connected" | "expired" | "error";

/** Phiên đăng nhập Zalo cá nhân (zca-js) sau khi quét QR. */
export interface PersonalSession {
  cookie: any;
  imei: string;
  userAgent: string;
}

/** Cấu hình tự động gửi theo từng mốc vòng đời hợp đồng. */
export type AutoEventCfg = { client?: boolean; crew?: boolean; templateId?: string };
export type AutoEvents = Record<string, AutoEventCfg>;

export interface ZaloRow {
  owner_id: string;
  channel: ZaloChannel;
  display_name: string | null;
  status: ZaloConnStatus;
  oa_id: string | null;
  oa_access_token: string | null;
  oa_access_expires_at: string | null;
  oa_refresh_token: string | null;
  personal_session: string | null; // ciphertext
  personal_self: any;
  auto_events: AutoEvents;
  last_error: string | null;
  connected_at: string | null;
  updated_at: string;
}

/**
 * Các mốc vòng đời có thể bật tự động nhắn tin. `crew` = báo cho THỢ (chỉ vài
 * mốc có ý nghĩa với thợ, ví dụ nhắc lịch chụp).
 */
export const AUTO_EVENTS: { key: string; label: string; audiences: ("client" | "crew")[] }[] = [
  { key: "booking_confirm", label: "Xác nhận đặt lịch", audiences: ["client"] },
  { key: "deposit_confirm", label: "Xác nhận đã nhận cọc", audiences: ["client"] },
  { key: "crew_assigned", label: "Báo thợ khi được xếp lịch", audiences: ["crew"] },
  { key: "shoot_reminder", label: "Nhắc lịch chụp (trước 1 ngày)", audiences: ["client", "crew"] },
  { key: "payment_due", label: "Nhắc thanh toán tới hạn", audiences: ["client"] },
  { key: "select_ready", label: "Mời khách chọn ảnh", audiences: ["client"] },
  { key: "select_nudge", label: "Nhắc lại khi khách chưa chọn ảnh", audiences: ["client"] },
  { key: "quote_expiring", label: "Nhắc báo giá sắp hết hiệu lực", audiences: ["client"] },
  { key: "delivery_ready", label: "Báo đã giao ảnh", audiences: ["client"] },
];

export async function loadZalo(ownerId: string): Promise<ZaloRow | null> {
  const db = createAdminClient();
  const { data } = await db.from("studio_zalo").select("*").eq("owner_id", ownerId).maybeSingle();
  if (!data) return null;
  const row = data as ZaloRow;
  if (!row.auto_events) row.auto_events = {};
  return row;
}

export async function saveZalo(ownerId: string, patch: Partial<ZaloRow>): Promise<void> {
  const db = createAdminClient();
  await db
    .from("studio_zalo")
    .upsert(
      { owner_id: ownerId, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "owner_id" }
    );
}

/** Giải mã phiên cá nhân đã lưu (hoặc null). */
export function readPersonalSession(row: ZaloRow | null): PersonalSession | null {
  return decryptJSON<PersonalSession>(row?.personal_session ?? null);
}

/** Mã hoá phiên cá nhân để lưu. */
export function packPersonalSession(session: PersonalSession): string {
  return encryptJSON(session);
}

/**
 * Trạng thái an toàn để trả ra trình duyệt — KHÔNG kèm token/cookie.
 */
export function publicStatus(row: ZaloRow | null) {
  if (!row) return { connected: false, channel: null as ZaloChannel | null };
  return {
    connected: row.status === "connected",
    channel: row.channel,
    status: row.status,
    displayName: row.display_name,
    oaId: row.oa_id,
    self: row.personal_self ?? null,
    autoEvents: row.auto_events ?? {},
    connectedAt: row.connected_at,
    lastError: row.last_error,
  };
}
