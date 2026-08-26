import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadZalo } from "@/lib/zalo/config";
import type { Platform } from "./platforms";
import type { ChannelPublic, ChannelRow } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   QUẢN LÝ KÊNH ĐÃ NỐI.

   Bảng `inbox_channels` chứa Page Access Token nên trình duyệt KHÔNG đọc thẳng
   được (đã revoke). Mọi thứ dashboard thấy đều đi qua `toPublic()` ở đây — một
   cửa duy nhất, để thêm cột bí mật mới sau này không vô tình rò ra giao diện.
   ═══════════════════════════════════════════════════════════════════════════ */

export function toPublic(row: ChannelRow): ChannelPublic {
  return {
    id: row.id,
    platform: row.platform,
    externalId: row.external_id,
    name: row.name,
    status: row.status,
    aiMode: row.ai_mode,
    lastError: row.last_error,
    connectedAt: row.connected_at,
  };
}

export async function listChannels(ownerId: string): Promise<ChannelRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("inbox_channels")
    .select("*")
    .eq("owner_id", ownerId)
    .order("platform");
  return (data ?? []) as ChannelRow[];
}

export interface UpsertChannelInput {
  ownerId: string;
  platform: Platform;
  externalId: string;
  name?: string | null;
  /** Ciphertext đã đóng gói (packMetaSecret). Không truyền = giữ nguyên. */
  secret?: string | null;
  aiMode?: "auto" | "off";
}

/**
 * Nối (hoặc cập nhật) một kênh.
 *
 * Trả lỗi `taken` khi page/OA đó đã thuộc studio khác — chỉ mục duy nhất
 * `(platform, external_id)` chặn ở tầng DB, ở đây dịch ra câu tiếng Việt để
 * người dùng hiểu chuyện gì xảy ra thay vì nhìn mã lỗi Postgres.
 */
export async function upsertChannel(
  input: UpsertChannelInput
): Promise<{ ok: true; channel: ChannelRow } | { ok: false; error: string }> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from("inbox_channels")
    .select("owner_id")
    .eq("platform", input.platform)
    .eq("external_id", input.externalId)
    .maybeSingle();
  if (existing && (existing as { owner_id: string }).owner_id !== input.ownerId) {
    return { ok: false, error: "taken" };
  }

  const patch: Record<string, unknown> = {
    owner_id: input.ownerId,
    platform: input.platform,
    external_id: input.externalId,
    status: "connected",
    last_error: null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.secret !== undefined && input.secret !== null) patch.secret = input.secret;
  if (input.aiMode) patch.ai_mode = input.aiMode;

  const { data, error } = await db
    .from("inbox_channels")
    .upsert(patch, { onConflict: "platform,external_id" })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, channel: data as ChannelRow };
}

/** Đổi chế độ AI của một kênh (không đụng tới công tắc của từng hội thoại). */
export async function setChannelAiMode(ownerId: string, channelId: string, aiMode: "auto" | "off"): Promise<boolean> {
  const db = createAdminClient();
  const { error } = await db
    .from("inbox_channels")
    .update({ ai_mode: aiMode, updated_at: new Date().toISOString() })
    .eq("id", channelId)
    .eq("owner_id", ownerId);
  return !error;
}

/**
 * Ngắt kênh. KHÔNG xoá dòng — xoá sẽ kéo theo toàn bộ hội thoại và tin nhắn
 * (khoá ngoại on delete cascade). Studio ngắt nhầm rồi nối lại phải thấy lịch
 * sử tư vấn còn nguyên, nên chỉ đổi trạng thái và xoá token.
 */
export async function disconnectChannel(ownerId: string, channelId: string): Promise<boolean> {
  const db = createAdminClient();
  const { error } = await db
    .from("inbox_channels")
    .update({ status: "disconnected", secret: null, updated_at: new Date().toISOString() })
    .eq("id", channelId)
    .eq("owner_id", ownerId);
  return !error;
}

/**
 * Nối kênh Zalo theo cấu hình studio ĐÃ CÓ trong `studio_zalo`.
 *
 * Studio đã quét QR / cấp quyền OA cho tính năng nhắc lịch tự động rồi; bắt họ
 * làm lại lần nữa cho hộp thư là thừa. Hàm này chỉ dựng dòng kênh trỏ vào cấu
 * hình sẵn có đó.
 */
export async function linkZaloChannels(
  ownerId: string
): Promise<{ linked: Platform[]; error?: string }> {
  const row = await loadZalo(ownerId);
  if (!row || row.status !== "connected") return { linked: [], error: "zalo_not_connected" };

  const linked: Platform[] = [];
  if (row.channel === "oa" && row.oa_id) {
    const res = await upsertChannel({
      ownerId,
      platform: "zalo_oa",
      externalId: row.oa_id,
      name: row.display_name || "Zalo OA",
    });
    if (res.ok) linked.push("zalo_oa");
    else return { linked, error: res.error };
  }
  if (row.channel === "personal") {
    const selfId = (row.personal_self as { id?: string } | null)?.id;
    if (!selfId) return { linked, error: "zalo_personal_no_self" };
    const res = await upsertChannel({
      ownerId,
      platform: "zalo_personal",
      externalId: String(selfId),
      name: row.display_name || (row.personal_self as { name?: string } | null)?.name || "Zalo cá nhân",
    });
    if (res.ok) linked.push("zalo_personal");
    else return { linked, error: res.error };
  }
  return { linked };
}
