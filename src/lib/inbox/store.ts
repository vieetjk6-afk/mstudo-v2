import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewText, type Platform } from "./platforms";
import type { Attachment, ChannelRow, ContactRow, ConversationRow, IncomingMessage } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   GHI/ĐỌC HỘP THƯ — service-role, dùng bởi webhook và các route API.

   Webhook chạy KHÔNG có phiên đăng nhập (Facebook gọi tới, không phải người
   dùng), nên mọi thứ ở đây đi bằng service-role và tự kiểm tra quyền bằng cách
   tra ngược chủ studio từ kênh. Route nào có người dùng thật thì kiểm quyền ở
   route, rồi mới gọi xuống đây.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Tra kênh theo định danh nền tảng (webhook chỉ đưa page_id / oa_id). */
export async function findChannel(platform: Platform, externalId: string): Promise<ChannelRow | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("inbox_channels")
    .select("*")
    .eq("platform", platform)
    .eq("external_id", externalId)
    .maybeSingle();
  return (data as ChannelRow | null) ?? null;
}

/** Kênh của một studio theo nền tảng (dùng khi ta đã biết chủ studio). */
export async function findChannelForOwner(ownerId: string, platform: Platform): Promise<ChannelRow | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("inbox_channels")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("platform", platform)
    .maybeSingle();
  return (data as ChannelRow | null) ?? null;
}

/**
 * Kênh chatbox website của một studio — tạo nếu chưa có.
 *
 * Khác các kênh kia ở chỗ studio không phải "nối" gì: widget đã chạy sẵn trên
 * website của họ, nên lần đầu có khách nhắn thì kênh tự sinh ra. Nếu bắt studio
 * bấm nối trước thì tin đầu tiên của khách sẽ rơi mất, mà đó thường là tin quan
 * trọng nhất.
 */
export async function ensureWebsiteChannel(ownerId: string): Promise<ChannelRow> {
  const existing = await findChannelForOwner(ownerId, "website");
  if (existing) return existing;
  const db = createAdminClient();
  const { data, error } = await db
    .from("inbox_channels")
    .upsert(
      {
        owner_id: ownerId,
        platform: "website",
        external_id: ownerId, // widget của mỗi studio là một kênh riêng
        name: "Chatbox website",
        status: "connected",
      },
      { onConflict: "platform,external_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ChannelRow;
}

async function upsertContact(channel: ChannelRow, msg: IncomingMessage): Promise<ContactRow> {
  const db = createAdminClient();
  // Chỉ ghi đè tên/ảnh/SĐT khi webhook thực sự đưa giá trị mới: Facebook thường
  // gửi tin sau mà KHÔNG kèm hồ sơ, ghi đè vô điều kiện sẽ xoá mất tên đã có.
  const patch: Record<string, unknown> = {
    owner_id: channel.owner_id,
    channel_id: channel.id,
    external_user_id: msg.externalUserId,
    updated_at: new Date().toISOString(),
  };
  if (msg.name) patch.name = msg.name;
  if (msg.avatarUrl) patch.avatar_url = msg.avatarUrl;
  if (msg.phone) patch.phone = msg.phone;

  const { data, error } = await db
    .from("inbox_contacts")
    .upsert(patch, { onConflict: "channel_id,external_user_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContactRow;
}

async function ensureConversation(channel: ChannelRow, contact: ContactRow): Promise<ConversationRow> {
  const db = createAdminClient();
  const { data: found } = await db
    .from("inbox_conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .maybeSingle();
  if (found) return found as ConversationRow;

  // INSERT chứ không UPSERT: hai webhook tới cùng lúc thì cái thứ hai được phép
  // thua (23505) rồi đọc lại. Nếu dùng upsert, cái thứ hai sẽ GHI ĐÈ ai_enabled
  // về mặc định của kênh — tức là bật lại bot trên một hội thoại nhân viên vừa
  // tiếp quản. Lỗi đó hiếm, nhưng xảy ra đúng lúc đông khách nhất.
  const { data, error } = await db
    .from("inbox_conversations")
    .insert({
      owner_id: channel.owner_id,
      channel_id: channel.id,
      contact_id: contact.id,
      // Hội thoại mới thừa kế chế độ AI của kênh. Kênh tắt AI thì hội thoại
      // mới cũng tắt, không có chuyện bot bất ngờ trả lời sau khi studio đã
      // tắt bot cho cả trang.
      ai_enabled: channel.ai_mode === "auto",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const { data: raced } = await db
        .from("inbox_conversations")
        .select("*")
        .eq("contact_id", contact.id)
        .maybeSingle();
      if (raced) return raced as ConversationRow;
    }
    throw new Error(error.message);
  }
  return data as ConversationRow;
}

export interface IngestResult {
  channel: ChannelRow;
  contact: ContactRow;
  conversation: ConversationRow;
  messageId: string | null;
  /** true khi tin này webhook đã bắn trước đó rồi (bỏ qua, không gọi AI lại). */
  duplicate: boolean;
}

/**
 * Ghi một tin của KHÁCH vào hộp thư. Trả về hội thoại để phía gọi quyết định
 * có nhờ AI trả lời hay không.
 */
export async function ingestIncoming(channel: ChannelRow, msg: IncomingMessage): Promise<IngestResult> {
  const db = createAdminClient();
  const contact = await upsertContact(channel, msg);
  const conversation = await ensureConversation(channel, contact);
  const attachments = msg.attachments ?? [];
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("inbox_messages")
    .insert({
      owner_id: channel.owner_id,
      conversation_id: conversation.id,
      direction: "in",
      sender: "customer",
      sender_name: contact.name,
      body: msg.body ?? "",
      attachments,
      external_id: msg.externalId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // 23505 = đụng chỉ mục duy nhất (conversation_id, external_id) ⇒ webhook
    // bắn lại tin cũ. Đây là đường đi BÌNH THƯỜNG của Messenger khi ta trả lời
    // chậm, không phải sự cố — nuốt lỗi và báo trùng để đừng gọi AI lần hai.
    if ((error as { code?: string }).code === "23505") {
      return { channel, contact, conversation, messageId: null, duplicate: true };
    }
    throw new Error(error.message);
  }

  const { data: bumped } = await db
    .from("inbox_conversations")
    .update({
      last_message: previewText(msg.body ?? "", attachments.length),
      last_message_at: now,
      last_inbound_at: now,
      last_direction: "in",
      unread: (conversation.unread ?? 0) + 1,
      status: "open", // khách nhắn lại thì hội thoại đã đóng phải mở lại
      updated_at: now,
    })
    .eq("id", conversation.id)
    .select("*")
    .single();

  return {
    channel,
    contact,
    conversation: (bumped as ConversationRow) ?? conversation,
    messageId: (data as { id: string } | null)?.id ?? null,
    duplicate: false,
  };
}

export interface OutgoingInput {
  ownerId: string;
  conversationId: string;
  sender: "ai" | "staff" | "system";
  senderId?: string | null;
  senderName?: string | null;
  body: string;
  attachments?: Attachment[];
  status?: "sent" | "failed";
  error?: string | null;
}

/**
 * Ghi một tin GỬI ĐI vào lịch sử. Ghi cả tin gửi hỏng (status = 'failed') —
 * nhân viên phải thấy "tin này chưa tới khách" ngay trong khung chat, chứ
 * không phải tin biến mất rồi tưởng đã gửi.
 */
export async function appendOutgoing(input: OutgoingInput): Promise<string | null> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const attachments = input.attachments ?? [];

  const { data, error } = await db
    .from("inbox_messages")
    .insert({
      owner_id: input.ownerId,
      conversation_id: input.conversationId,
      direction: "out",
      sender: input.sender,
      sender_id: input.senderId ?? null,
      sender_name: input.senderName ?? null,
      body: input.body,
      attachments,
      status: input.status ?? "sent",
      error: input.error ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Tin hỏng KHÔNG được làm dòng xem trước — danh sách bên trái phải kể đúng
  // những gì khách thực sự đọc được.
  if ((input.status ?? "sent") === "sent") {
    await db
      .from("inbox_conversations")
      .update({
        last_message: previewText(input.body, attachments.length),
        last_message_at: now,
        last_direction: "out",
        updated_at: now,
      })
      .eq("id", input.conversationId);
  }

  return (data as { id: string }).id;
}

/** Vài lượt gần nhất, xếp cũ → mới, để dựng ngữ cảnh cho AI. */
export async function recentTurns(
  conversationId: string,
  limit = 20
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("inbox_messages")
    .select("direction, body, status")
    .eq("conversation_id", conversationId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = ((data ?? []) as { direction: "in" | "out"; body: string }[]).reverse();
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows) {
    const content = (r.body || "").trim();
    if (!content) continue;
    turns.push({ role: r.direction === "in" ? "user" : "assistant", content: content.slice(0, 4000) });
  }
  // Nhà cung cấp AI nào cũng đòi lượt ĐẦU là của người dùng.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
