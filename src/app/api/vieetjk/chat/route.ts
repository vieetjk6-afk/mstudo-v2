import { NextRequest } from "next/server";
import { buildSystemPrompt, MAX_TURNS, type ChatTurn } from "@/lib/vieetjk/assistant";
import { loadProviders, requestProvider, extractDelta, finishReason } from "@/lib/vieetjk/providers";
import { resolveVieetjkOwner } from "@/lib/vieetjk/data";
import { loadChatConfig } from "@/lib/vieetjk/chat-config";
import {
  looksLikeStatusQuery,
  extractClientPhone,
  lookupClientStatus,
  buildStatusContext,
  statusNeedsPhoneContext,
  statusRateLimitedContext,
} from "@/lib/vieetjk/lookup";
import { limitByIpDurable } from "@/lib/rate-limit";
import { CONTACT, type Lang } from "@/lib/vieetjk/content";
import { recordWebsiteAiReply, recordWebsiteIncoming } from "@/lib/inbox/website";
import { getFeatureFlags, inboxComingSoon } from "@/lib/feature-flags";

/**
 * Ký tự điều khiển đặt đầu tin "quá tải" để widget nhận biết → tự mở form để lại
 * SĐT. Widget strip ký tự này trước khi hiển thị (khách không thấy).
 */
const LEAD_MARKER = "\u0002";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trợ lý tư vấn tự động cho website vieetjk.com — hỗ trợ NHIỀU API.
 * Cấu hình qua CHAT_PROVIDERS (JSON) hoặc GEMINI_API_KEY (xem lib/vieetjk/providers).
 * Bot thử lần lượt từng provider; cái nào lỗi/hết quota/không có text thì tự
 * chuyển sang cái kế tiếp. Trả về text chạy dần (streaming) cho widget.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sanitize(turns: unknown): ChatTurn[] {
  if (!Array.isArray(turns)) return [];
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const role = (t as any)?.role;
    const content = typeof (t as any)?.content === "string" ? (t as any).content.trim() : "";
    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  const trimmed = out.slice(-MAX_TURNS);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}

/** Trả lời chào tùy chỉnh (nếu chủ studio đã đặt) cho widget hiển thị. */
export async function GET() {
  try {
    const { ownerId } = await resolveVieetjkOwner();
    const greeting = ownerId ? (await loadChatConfig(ownerId)).greeting : null;
    return Response.json({ greeting }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ greeting: null });
  }
}

export async function POST(req: NextRequest) {
  const providers = loadProviders();
  if (providers.length === 0) {
    return Response.json({ error: "assistant_unavailable" }, { status: 503 });
  }

  let body: { messages?: unknown; lang?: unknown; sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const lang: Lang = body.lang === "en" ? "en" : "vi";
  const messages = sanitize(body.messages);
  if (messages.length === 0) {
    return Response.json({ error: "empty" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : "";

  // Ghép hướng dẫn/kiến thức riêng chủ studio nhập trong dashboard (nếu có).
  let extra: string | null = null;
  let ownerId: string | null = null;
  try {
    const owner = await resolveVieetjkOwner();
    ownerId = owner.ownerId;
    if (ownerId) extra = (await loadChatConfig(ownerId)).instructions;
  } catch {
    /* không có cấu hình riêng → dùng mặc định */
  }

  // Đưa hội thoại website vào HỘP THƯ HỢP NHẤT: ghi tin khách vừa gõ, rồi hỏi
  // xem nhân viên đã tiếp quản phiên này chưa. Đã tiếp quản thì bot IM — trả
  // 202 để widget chuyển sang chờ người thật trả lời thay vì chen ngang.
  //
  // Khi hộp thư CHƯA BẬT (cờ tính năng), bỏ qua toàn bộ khối này: chatbox chạy
  // đúng như trước, không sinh một dòng dữ liệu nào. "Chưa bật" phải có nghĩa là
  // không chạy, chứ không phải chạy ngầm ở chỗ không ai nhìn thấy.
  let conversationId: string | null = null;
  const inboxLive = !inboxComingSoon(await getFeatureFlags());
  if (inboxLive && ownerId && sessionId) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const rec = lastUser ? await recordWebsiteIncoming(ownerId, sessionId, lastUser) : null;
    if (rec) {
      conversationId = rec.conversationId;
      if (!rec.aiEnabled) {
        return Response.json({ takenOver: true }, { status: 202 });
      }
    }
  }

  // Tra cứu trạng thái hợp đồng/album — CHỈ khi khách hỏi về hợp đồng/album VÀ đã
  // cung cấp đúng SĐT (bảo mật: SĐT là mật khẩu xem như cổng /c/[token], /album).
  let liveCtx: string | null = null;
  try {
    const userTurns = messages.filter((m) => m.role === "user");
    const lastUser = userTurns[userTurns.length - 1]?.content ?? "";
    // Ý định hỏi trạng thái tính trên vài lượt gần đây — để bắt được luồng khách
    // hỏi trước rồi mới nhắn SĐT ở lượt sau (tin chỉ có số sẽ không khớp từ khoá).
    const recentStatusIntent = userTurns.slice(-5).some((m) => looksLikeStatusQuery(m.content));
    const lastHasPhone = !!extractClientPhone(lastUser);
    const shouldLookup = looksLikeStatusQuery(lastUser) || (lastHasPhone && recentStatusIntent);

    if (ownerId && shouldLookup) {
      // Tìm SĐT trong toàn bộ lượt của khách (khách có thể đã nhắn số ở lượt trước).
      const userText = userTurns.map((m) => m.content).join("\n");
      const phone = extractClientPhone(userText);
      if (!phone) {
        liveCtx = statusNeedsPhoneContext(lang);
      } else if (await limitByIpDurable(req, "vjk-chat-lookup", 12, 60_000)) {
        // Vượt hạn mức tra cứu (chống dò SĐT) → không truy vấn DB.
        liveCtx = statusRateLimitedContext(lang);
      } else {
        const result = await lookupClientStatus(ownerId, phone);
        liveCtx = buildStatusContext(lang, result);
      }
    }
  } catch {
    /* lỗi tra cứu → bỏ qua, bot trả lời như bình thường */
  }

  const systemText = buildSystemPrompt(lang, extra, liveCtx);

  // Khi tất cả provider lỗi/hết hạn mức: mời khách để lại thông tin / liên hệ.
  // Ký tự LEAD_MARKER ở đầu để widget tự mở form "Để lại SĐT" (khách không thấy).
  const busyMsg =
    LEAD_MARKER +
    (lang === "en"
      ? `Our assistant is a bit busy right now 🙏 Please leave your name and phone below (or tap "📞 Leave your number"), book a session on the website, or contact us on Zalo/phone ${CONTACT.phone} — the studio will advise you directly.`
      : `Trợ lý đang hơi bận một chút 🙏 Bạn vui lòng để lại HỌ TÊN và SỐ ĐIỆN THOẠI bên dưới (hoặc bấm nút “📞 Để lại SĐT để được tư vấn”), đặt lịch trên website, hoặc liên hệ Zalo/điện thoại ${CONTACT.phone} để được studio tư vấn trực tiếp nhé!`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = false;
      const debug: string[] = [];
      // Gom nguyên câu trả lời để ghi vào hộp thư sau khi phát xong — nhân viên
      // mở hộp thư phải đọc được bot đã hứa gì với khách.
      let fullText = "";

      for (const p of providers) {
        // 1) Gửi yêu cầu tới provider hiện tại.
        let upstream: Response | null = null;
        try {
          upstream = await requestProvider(p, systemText, messages);
        } catch (e) {
          debug.push(`${p.label}: net ${(e as Error)?.message || ""}`);
          continue;
        }
        if (!upstream.ok || !upstream.body) {
          let d = "";
          try {
            const raw = await upstream.text();
            const j = raw ? JSON.parse(raw) : null;
            d = j?.error?.message || raw || "";
          } catch {
            /* bỏ qua */
          }
          debug.push(`${p.label}: ${upstream.status} ${String(d).slice(0, 160)}`);
          continue; // → thử provider kế tiếp
        }

        // 2) Đọc SSE, phát text chạy dần. Nếu có text → xong.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let emitted = false;
        let reason = "";
        try {
          for (;;) {
            const { done: rdone, value } = await reader.read();
            if (rdone) break;
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
                const text = extractDelta(p, json);
                if (text) {
                  emitted = true;
                  fullText += text;
                  controller.enqueue(encoder.encode(text));
                } else {
                  reason = finishReason(p, json) || reason;
                }
              } catch {
                /* chunk chưa trọn */
              }
            }
          }
        } catch (e) {
          debug.push(`${p.label}: stream ${(e as Error)?.message || ""}`);
        }

        if (emitted) {
          done = true;
          break;
        }
        debug.push(`${p.label}: empty${reason ? ` (${reason})` : ""}`);
        // → thử provider kế tiếp
      }

      if (!done) {
        // Ghi log server để chẩn đoán (khách KHÔNG thấy debug).
        console.error("[vieetjk/chat] all providers failed:", debug.join(" | "));
        controller.enqueue(encoder.encode(busyMsg));
        // Ghi cả câu "đang bận" vào hộp thư: nhân viên mở ra phải thấy ĐÚNG
        // những gì khách đã đọc, nếu không họ sẽ trả lời tiếp như chưa có gì.
        fullText = busyMsg.split(LEAD_MARKER).join("");
      }
      controller.close();

      // Ghi vào hộp thư SAU khi đã đóng luồng: khách không phải chờ thêm một
      // vòng ghi DB mới đọc được câu trả lời.
      if (ownerId && conversationId && fullText.trim()) {
        await recordWebsiteAiReply(ownerId, conversationId, fullText.trim());
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
