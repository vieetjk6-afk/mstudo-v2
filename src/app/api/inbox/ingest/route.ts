import crypto from "crypto";
import { NextRequest } from "next/server";
import { findChannel, ingestIncoming } from "@/lib/inbox/store";
import { maybeAutoReply } from "@/lib/inbox/send";
import { isPlatform } from "@/lib/inbox/platforms";
import type { Attachment } from "@/lib/inbox/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CỬA NHẬN TIN CHO TIẾN TRÌNH NGOÀI — hiện dùng cho kênh Zalo CÁ NHÂN.
 *
 * Vì sao phải có: Zalo cá nhân không có webhook. Muốn NHẬN tin phải giữ một
 * websocket sống, mà Vercel serverless thì hết hàm là tắt. Nên phần lắng nghe
 * chạy ở tiến trình riêng (scripts/zalo-inbox-worker.mjs, đặt trên máy studio
 * hoặc một VPS nhỏ), bắt được tin nào thì POST vào đây.
 *
 * Xác thực bằng bí mật dùng chung `INBOX_INGEST_SECRET`. Endpoint này ghi thẳng
 * vào hộp thư của studio nên bí mật yếu = ai cũng nhét được tin giả; so sánh
 * bằng timingSafeEqual và từ chối hẳn khi biến môi trường chưa khai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECRET = process.env.INBOX_INGEST_SECRET || "";

function authorized(req: NextRequest): boolean {
  if (!SECRET) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(SECRET);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const a of raw as any[]) {
    if (typeof a?.url !== "string" || !a.url) continue;
    const t = a?.type;
    out.push({
      type: t === "image" || t === "video" || t === "audio" || t === "sticker" ? t : "file",
      url: a.url,
      name: typeof a?.name === "string" ? a.name : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!SECRET) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const platform = body?.platform;
  const channelExternalId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
  const from = body?.from;
  const externalUserId = typeof from?.id === "string" ? from.id.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  const attachments = normalizeAttachments(body?.attachments);

  if (!isPlatform(platform) || !channelExternalId || !externalUserId) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!text && attachments.length === 0) return Response.json({ ok: true, skipped: "empty" });

  const channel = await findChannel(platform, channelExternalId);
  if (!channel || channel.status !== "connected") {
    return Response.json({ error: "channel_not_found" }, { status: 404 });
  }
  // Tiến trình ngoài chỉ được bơm tin vào ĐÚNG loại kênh nó phụ trách.
  if (channel.platform !== "zalo_personal") {
    return Response.json({ error: "platform_not_allowed" }, { status: 400 });
  }

  try {
    const result = await ingestIncoming(channel, {
      externalUserId,
      body: text,
      attachments,
      externalId: typeof body?.messageId === "string" ? body.messageId : null,
      name: typeof from?.name === "string" ? from.name : null,
      avatarUrl: typeof from?.avatar === "string" ? from.avatar : null,
    });
    if (result.duplicate) return Response.json({ ok: true, duplicate: true });

    const ai = await maybeAutoReply(channel, result.conversation);
    return Response.json({ ok: true, conversationId: result.conversation.id, aiReplied: ai.replied });
  } catch (e) {
    console.error("[inbox/ingest] lỗi:", (e as Error)?.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
