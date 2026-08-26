import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlatform } from "./platforms";
import type { ConversationView, MessageRow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Đọc hộp thư cho GIAO DIỆN — nhận sẵn một SupabaseClient để dùng được cả ở
 * trang server (client theo phiên đăng nhập, RLS lọc đúng studio) lẫn ở route
 * API. Cố ý KHÔNG dùng service-role ở đây: đây là dữ liệu người dùng đọc, để
 * RLS làm hàng rào thay vì tự lọc bằng tay rồi sót một chỗ.
 */

/**
 * KHÔNG join sang `profiles` để lấy tên người phụ trách: RLS của bảng đó chỉ
 * cho mỗi người đọc dòng của CHÍNH MÌNH, nên join sẽ trả null cho mọi đồng
 * nghiệp — sai một cách im lặng, kiểu tệ nhất. Danh sách nhân viên lấy riêng
 * bằng service-role (xem `staffNames` bên dưới) rồi giao diện tự ghép tên.
 */
const CONVERSATION_SELECT = `
  id, status, ai_enabled, assignee_id, last_message, last_message_at,
  last_direction, last_inbound_at, unread,
  channel:inbox_channels(platform, name),
  contact:inbox_contacts(name, avatar_url, phone)
`;

function toView(row: any): ConversationView | null {
  const platform = row?.channel?.platform;
  if (!isPlatform(platform)) return null;
  return {
    id: row.id,
    platform,
    channelName: row.channel?.name ?? null,
    contactName: row.contact?.name || "Khách chưa cho tên",
    contactAvatar: row.contact?.avatar_url ?? null,
    contactPhone: row.contact?.phone ?? null,
    status: row.status,
    aiEnabled: !!row.ai_enabled,
    assigneeId: row.assignee_id ?? null,
    assigneeName: null, // giao diện ghép từ danh sách nhân viên (xem staffNames)
    lastMessage: row.last_message ?? null,
    lastMessageAt: row.last_message_at,
    lastDirection: row.last_direction ?? null,
    unread: row.unread ?? 0,
    lastInboundAt: row.last_inbound_at ?? null,
  };
}

export async function listConversations(
  db: SupabaseClient,
  ownerId: string,
  limit = 200
): Promise<ConversationView[]> {
  const { data } = await db
    .from("inbox_conversations")
    .select(CONVERSATION_SELECT)
    .eq("owner_id", ownerId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as any[]).map(toView).filter((c): c is ConversationView => c !== null);
}

export async function getConversation(
  db: SupabaseClient,
  conversationId: string
): Promise<ConversationView | null> {
  const { data } = await db
    .from("inbox_conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();
  return data ? toView(data) : null;
}

export async function listMessages(
  db: SupabaseClient,
  conversationId: string,
  limit = 200
): Promise<MessageRow[]> {
  const { data } = await db
    .from("inbox_messages")
    .select("id, conversation_id, direction, sender, sender_id, sender_name, body, attachments, status, error, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as MessageRow[];
}

/** Mở hội thoại = đã đọc. Không đụng tới ai_enabled — đọc không phải tiếp quản. */
export async function markRead(db: SupabaseClient, conversationId: string): Promise<void> {
  await db.from("inbox_conversations").update({ unread: 0 }).eq("id", conversationId);
}

/**
 * Bảng tra id → tên của chủ studio và toàn bộ nhân viên, để hiện "ai đang phụ
 * trách". Đi bằng service-role vì RLS của `profiles` chặn đọc dòng người khác;
 * phạm vi đã ghim theo `studio_owner_id = ownerId` nên không lộ ra ngoài studio.
 */
export async function staffNames(ownerId: string): Promise<Record<string, string>> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const [{ data: owner }, { data: staff }] = await Promise.all([
    db.from("profiles").select("id, full_name").eq("id", ownerId).maybeSingle(),
    db.from("profiles").select("id, full_name").eq("studio_owner_id", ownerId),
  ]);
  const out: Record<string, string> = {};
  const put = (r: { id: string; full_name: string | null } | null) => {
    if (r?.id) out[r.id] = r.full_name?.trim() || "Nhân viên";
  };
  put(owner as any);
  for (const r of (staff ?? []) as any[]) put(r);
  return out;
}
