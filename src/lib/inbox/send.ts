import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReply, replyBlockedReason } from "./platforms";
import { appendOutgoing } from "./store";
import { generateReply } from "./ai";
import { sendMetaText } from "./adapters/meta";
import { sendZaloOAText, sendZaloPersonal } from "./adapters/zalo";
import type { ChannelRow, ContactRow, ConversationRow } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   GỬI TIN RA — một cửa duy nhất cho cả nhân viên lẫn AI.

   Đường đi luôn là: kiểm cửa sổ trả lời → đẩy sang nền tảng → GHI LẠI kết quả
   (kể cả hỏng). Không có nhánh nào gửi thẳng mà bỏ qua bước ghi: nếu có, lịch
   sử hội thoại sẽ khác với những gì khách thật sự nhận được, và đó là loại sai
   không ai phát hiện ra cho tới lúc cãi nhau với khách.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DeliverInput {
  conversationId: string;
  text: string;
  sender: "ai" | "staff";
  senderId?: string | null;
  senderName?: string | null;
}

export interface DeliverResult {
  ok: boolean;
  error?: string;
  messageId?: string | null;
}

/** Nạp trọn bộ hội thoại + kênh + người nhắn trong một lượt. */
export async function loadConversationBundle(conversationId: string): Promise<{
  conversation: ConversationRow;
  channel: ChannelRow;
  contact: ContactRow;
} | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("inbox_conversations")
    .select("*, channel:inbox_channels(*), contact:inbox_contacts(*)")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) return null;
  const row = data as ConversationRow & { channel: ChannelRow | null; contact: ContactRow | null };
  if (!row.channel || !row.contact) return null;
  const { channel, contact, ...conversation } = row;
  return { conversation: conversation as ConversationRow, channel, contact };
}

async function dispatch(
  channel: ChannelRow,
  contact: ContactRow,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  switch (channel.platform) {
    case "website":
      // Không có nền tảng ngoài nào để gọi: widget tự lấy tin mới về. Dòng ghi
      // trong inbox_messages CHÍNH LÀ việc giao tin.
      return { ok: true };
    case "facebook":
    case "instagram":
      return sendMetaText(channel, contact.external_user_id, text);
    case "zalo_oa":
      return sendZaloOAText(channel, contact.external_user_id, text);
    case "zalo_personal":
      return sendZaloPersonal(channel, contact.external_user_id, text);
    default:
      return { ok: false, error: "unsupported_platform" };
  }
}

/**
 * Gửi một tin cho khách rồi ghi vào lịch sử.
 *
 * Gửi hỏng KHÔNG ném lỗi: ta vẫn ghi tin với status 'failed' kèm lý do, để
 * nhân viên nhìn thấy ngay trong khung chat và biết phải gọi điện.
 */
export async function deliver(input: DeliverInput): Promise<DeliverResult> {
  const text = (input.text || "").trim();
  if (!text) return { ok: false, error: "empty" };

  const bundle = await loadConversationBundle(input.conversationId);
  if (!bundle) return { ok: false, error: "not_found" };
  const { conversation, channel, contact } = bundle;

  if (!canReply(channel.platform, conversation.last_inbound_at)) {
    const reason = replyBlockedReason(channel.platform);
    await appendOutgoing({
      ownerId: conversation.owner_id,
      conversationId: conversation.id,
      sender: input.sender,
      senderId: input.senderId ?? null,
      senderName: input.senderName ?? null,
      body: text,
      status: "failed",
      error: reason || "reply_window_closed",
    });
    return { ok: false, error: reason || "reply_window_closed" };
  }

  const res = await dispatch(channel, contact, text);
  const messageId = await appendOutgoing({
    ownerId: conversation.owner_id,
    conversationId: conversation.id,
    sender: input.sender,
    senderId: input.senderId ?? null,
    senderName: input.senderName ?? null,
    body: text,
    status: res.ok ? "sent" : "failed",
    error: res.ok ? null : res.error ?? "send_failed",
  });

  return { ok: res.ok, error: res.error, messageId };
}

/**
 * AI trả lời một tin vừa tới — gọi ngay sau `ingestIncoming`.
 *
 * Ba cửa phải cùng mở thì bot mới nói: kênh để chế độ tự động, hội thoại chưa
 * bị nhân viên tiếp quản, và hội thoại đang mở. Đủ một cửa đóng là im — đó là
 * lời hứa "có người vào thì bot không chen ngang", và nó phải đúng ở TẦNG NÀY
 * chứ không phải ở giao diện.
 *
 * Mọi lỗi đều nuốt: khách không bao giờ được nhận một câu lỗi kỹ thuật, và một
 * webhook trả 500 chỉ khiến nền tảng bắn lại tin cũ.
 */
export async function maybeAutoReply(
  channel: ChannelRow,
  conversation: ConversationRow
): Promise<{ replied: boolean; reason?: string }> {
  if (channel.ai_mode !== "auto") return { replied: false, reason: "channel_ai_off" };
  if (!conversation.ai_enabled) return { replied: false, reason: "taken_over" };
  if (conversation.status !== "open") return { replied: false, reason: "closed" };

  try {
    const { text, debug } = await generateReply(conversation.owner_id, conversation.id, channel.platform);
    if (!text) {
      if (debug) console.error("[inbox/ai] không sinh được câu trả lời:", debug);
      return { replied: false, reason: "no_text" };
    }
    const res = await deliver({
      conversationId: conversation.id,
      text,
      sender: "ai",
      senderName: "Trợ lý AI",
    });
    return { replied: res.ok, reason: res.error };
  } catch (e) {
    console.error("[inbox/ai] lỗi khi trả lời tự động:", (e as Error)?.message);
    return { replied: false, reason: "error" };
  }
}
