import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudioBrand } from "@/lib/studio-brand";
import { loadChatConfig } from "@/lib/vieetjk/chat-config";
import { loadProviders, requestProvider, extractDelta, finishReason } from "@/lib/vieetjk/providers";
import { platformLabel } from "./platforms";
import { recentTurns } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   AI TRẢ LỜI KHÁCH TRONG HỘP THƯ.

   Khác chatbox website ở hai điểm, và cả hai đều quan trọng:

   1. KHÔNG streaming. Ở website khách đang nhìn màn hình nên chữ chạy dần là
      hay; ở Zalo/Messenger thì tin chỉ gửi được MỘT LẦN, nên phải gom hết câu
      trả lời rồi mới gửi.

   2. AI ở đây biết mình đang nói chuyện qua Messenger/Zalo, và biết rằng bất cứ
      lúc nào cũng có thể bị người thật cắt ngang. Nên nó được dặn viết ngắn,
      không hứa chắc về giá/lịch, và chủ động mời nhân viên vào khi vượt tầm.

   Dùng lại đúng bộ provider của chatbox website (CHAT_PROVIDERS) — studio đã
   cấu hình một lần thì cả hai nơi cùng chạy, và cùng được cơ chế tự chuyển nhà
   cung cấp khi một cái hết hạn mức.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Số lượt hội thoại lấy làm ngữ cảnh cho AI. */
const CONTEXT_TURNS = 20;

function buildSystemPrompt(studioName: string, platform: string, instructions: string | null): string {
  const lines = [
    `Bạn là trợ lý tư vấn của "${studioName}" — một studio chụp ảnh tại Việt Nam.`,
    `Bạn đang nhắn tin với khách qua ${platformLabel(platform)}.`,
    "",
    "CÁCH VIẾT",
    "- Tiếng Việt, xưng “mình”, gọi khách là “bạn” hoặc “anh/chị” nếu khách tự xưng vậy.",
    "- NGẮN: 1–3 câu, như người thật nhắn tin. Không gạch đầu dòng dài, không markdown.",
    "- Thân thiện, không rập khuôn. Mỗi lần chỉ hỏi MỘT câu.",
    "",
    "LUẬT BẮT BUỘC",
    "- Chỉ nói những gì được cho biết bên dưới. KHÔNG bịa giá, khuyến mãi, lịch trống hay cam kết ngày giao ảnh.",
    "- Chưa chắc chắn → nói thật là mình sẽ nhờ studio xác nhận lại, đừng đoán.",
    "- Cố gắng xin HỌ TÊN và SỐ ĐIỆN THOẠI của khách một cách tự nhiên để studio liên hệ lại.",
    "- Khách hỏi việc cần quyết định (chốt giá, giữ ngày, đổi lịch, khiếu nại) → trả lời rằng bạn đang mời nhân viên studio vào trả lời trực tiếp.",
    "- Không bao giờ nhận mình là AI trừ khi khách hỏi thẳng; nếu khách hỏi thì trả lời thật.",
  ];
  if (instructions) {
    lines.push(
      "",
      "KIẾN THỨC & QUY ĐỊNH RIÊNG CỦA STUDIO (ưu tiên cao nhất, đè lên mọi thứ ở trên):",
      instructions
    );
  }
  return lines.join("\n");
}

/** Gom toàn bộ SSE của một provider thành một chuỗi. */
async function collect(res: Response, p: Parameters<typeof extractDelta>[0]): Promise<{ text: string; reason: string }> {
  if (!res.body) return { text: "", reason: "no_body" };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let reason = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = extractDelta(p, json);
        if (delta) text += delta;
        else reason = finishReason(p, json) || reason;
      } catch {
        /* chunk chưa trọn */
      }
    }
  }
  return { text: text.trim(), reason };
}

export interface AiReplyResult {
  text: string | null;
  /** Vì sao không có câu trả lời — ghi log máy chủ, KHÔNG gửi cho khách. */
  debug?: string;
}

/**
 * Sinh câu trả lời cho một hội thoại. Trả `text: null` khi mọi nhà cung cấp đều
 * hỏng — phía gọi phải im lặng và để hội thoại đó cho người, tuyệt đối không
 * gửi cho khách một câu xin lỗi máy móc trên Messenger.
 */
export async function generateReply(
  ownerId: string,
  conversationId: string,
  platform: string
): Promise<AiReplyResult> {
  const providers = loadProviders();
  if (providers.length === 0) return { text: null, debug: "no_provider" };

  const turns = await recentTurns(conversationId, CONTEXT_TURNS);
  if (turns.length === 0) return { text: null, debug: "no_turns" };

  const db = createAdminClient();
  const [brand, config] = await Promise.all([getStudioBrand(db, ownerId), loadChatConfig(ownerId)]);
  const systemText = buildSystemPrompt(brand.name, platform, config.instructions);

  const debug: string[] = [];
  for (const p of providers) {
    try {
      const res = await requestProvider(p, systemText, turns);
      if (!res.ok) {
        debug.push(`${p.label}: ${res.status}`);
        continue;
      }
      const { text, reason } = await collect(res, p);
      if (text) return { text };
      debug.push(`${p.label}: empty${reason ? ` (${reason})` : ""}`);
    } catch (e) {
      debug.push(`${p.label}: ${(e as Error)?.message || "net"}`);
    }
  }
  return { text: null, debug: debug.join(" | ") };
}
