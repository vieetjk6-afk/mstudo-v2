import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendOutgoing, ensureWebsiteChannel, ingestIncoming } from "./store";
import type { MessageRow } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   CHATBOX WEBSITE ↔ HỘP THƯ.

   Kênh website khác ba kênh kia ở một điểm căn bản: KHÔNG có nền tảng ngoài
   nào để gửi tin tới. Widget của khách tự hỏi lại máy chủ, nên "gửi" chỉ là ghi
   một dòng vào inbox_messages rồi widget nhặt về ở lần hỏi kế tiếp.

   Nhờ vậy nhân viên tiếp quản được cả hội thoại đang diễn ra trên website —
   trước đây bot nói xong là hết, khách muốn gặp người thì phải gọi điện.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Mỗi phiên chat trên website = một "người nhắn" định danh bằng sessionId. */
export interface WebsiteTurnResult {
  conversationId: string;
  ownerId: string;
  /** false = nhân viên đang tiếp quản ⇒ ĐỪNG gọi AI. */
  aiEnabled: boolean;
}

/**
 * Ghi tin khách vừa gõ trên website vào hộp thư.
 *
 * Trả `null` khi ghi hỏng — phía gọi phải coi đó là chuyện phụ và vẫn trả lời
 * khách như thường. Chatbox hỏng vì lỗi ghi hộp thư là đánh đổi tệ.
 */
export async function recordWebsiteIncoming(
  ownerId: string,
  sessionId: string,
  text: string
): Promise<WebsiteTurnResult | null> {
  try {
    const channel = await ensureWebsiteChannel(ownerId);
    const result = await ingestIncoming(channel, {
      externalUserId: sessionId,
      body: text,
      name: null,
    });
    return {
      conversationId: result.conversation.id,
      ownerId,
      aiEnabled: channel.ai_mode === "auto" && result.conversation.ai_enabled,
    };
  } catch (e) {
    console.error("[inbox/website] không ghi được tin khách:", (e as Error)?.message);
    return null;
  }
}

/** Ghi lại câu bot vừa trả lời, để nhân viên đọc được bot đã hứa gì. */
export async function recordWebsiteAiReply(
  ownerId: string,
  conversationId: string,
  text: string
): Promise<void> {
  try {
    await appendOutgoing({
      ownerId,
      conversationId,
      sender: "ai",
      senderName: "Trợ lý AI",
      body: text,
    });
  } catch (e) {
    console.error("[inbox/website] không ghi được câu trả lời của AI:", (e as Error)?.message);
  }
}

/**
 * Tin do NHÂN VIÊN gửi cho một phiên chat website, kể từ mốc `after`.
 *
 * Cố tình bỏ qua tin của AI: câu bot trả lời đã chạy dần trên màn hình khách
 * rồi, trả về lần nữa sẽ thành hiện hai lần.
 */
export async function websiteStaffMessages(
  ownerId: string,
  sessionId: string,
  after: string | null
): Promise<{ messages: Pick<MessageRow, "id" | "body" | "created_at">[]; takenOver: boolean }> {
  const db = createAdminClient();

  // Ghim theo studio: sessionId do trình duyệt khách sinh ra, về lý thuyết hai
  // studio có thể trùng. Không ghim thì `maybeSingle` sẽ văng lỗi đúng vào lúc
  // trùng — mà lúc đó không ai hiểu vì sao.
  const { data: contact } = await db
    .from("inbox_contacts")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("external_user_id", sessionId)
    .maybeSingle();
  if (!contact) return { messages: [], takenOver: false };

  const { data: conv } = await db
    .from("inbox_conversations")
    .select("id, ai_enabled")
    .eq("contact_id", (contact as { id: string }).id)
    .maybeSingle();
  if (!conv) return { messages: [], takenOver: false };

  const row = conv as { id: string; ai_enabled: boolean };
  let q = db
    .from("inbox_messages")
    .select("id, body, created_at")
    .eq("conversation_id", row.id)
    .eq("direction", "out")
    .eq("sender", "staff")
    .eq("status", "sent")
    .order("created_at", { ascending: true })
    .limit(20);
  if (after) q = q.gt("created_at", after);

  const { data } = await q;
  return {
    messages: (data ?? []) as Pick<MessageRow, "id" | "body" | "created_at">[],
    takenOver: !row.ai_enabled,
  };
}
