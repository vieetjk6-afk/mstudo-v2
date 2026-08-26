import { NextRequest } from "next/server";
import { findChannel, ingestIncoming } from "@/lib/inbox/store";
import { maybeAutoReply } from "@/lib/inbox/send";
import { fetchZaloOAProfile, verifyZaloSignature } from "@/lib/inbox/adapters/zalo";
import type { Attachment } from "@/lib/inbox/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * WEBHOOK ZALO OA — khai URL này ở mục Webhook của Zalo App:
 *   https://<tên-miền>/api/inbox/webhook/zalo
 *
 * Zalo bắn nhiều loại sự kiện; ta chỉ quan tâm `user_send_*` (khách nhắn tới
 * OA). Các sự kiện khác (follow, delivered, seen…) bỏ qua nhưng vẫn trả 200 để
 * Zalo không coi webhook là hỏng.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_ID = process.env.ZALO_OA_APP_ID || "";
// Zalo ký bằng OA Secret Key (mục Webhook), không phải App Secret của OAuth.
// Nhiều studio đặt trùng nhau nên cho phép rơi về App Secret khi chưa khai.
const WEBHOOK_SECRET = process.env.ZALO_OA_WEBHOOK_SECRET || process.env.ZALO_OA_APP_SECRET || "";

/** Đổi attachments của Zalo sang dạng của hộp thư. */
function normalize(event: any): { text: string; attachments: Attachment[] } {
  const text = typeof event?.message?.text === "string" ? event.message.text : "";
  const out: Attachment[] = [];
  for (const a of event?.message?.attachments ?? []) {
    const url = a?.payload?.url || a?.payload?.thumbnail;
    if (typeof url !== "string" || !url) continue;
    const t = a?.type;
    out.push({
      type: t === "image" ? "image" : t === "sticker" ? "sticker" : t === "video" ? "video" : "file",
      url,
    });
  }
  return { text, attachments: out };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!WEBHOOK_SECRET || !APP_ID) {
    console.error("[inbox/zalo] thiếu ZALO_OA_APP_ID / ZALO_OA_WEBHOOK_SECRET — từ chối webhook");
    return new Response("not_configured", { status: 503 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }

  const ok = verifyZaloSignature(
    raw,
    req.headers.get("x-zevent-signature"),
    APP_ID,
    WEBHOOK_SECRET,
    body?.timestamp != null ? String(body.timestamp) : null
  );
  if (!ok) return new Response("bad_signature", { status: 403 });

  try {
    const eventName = String(body?.event_name ?? "");
    if (!eventName.startsWith("user_send")) return new Response("ok", { status: 200 });

    const oaId = String(body?.recipient?.id ?? "");
    const senderId = String(body?.sender?.id ?? "");
    if (!oaId || !senderId) return new Response("ok", { status: 200 });

    const channel = await findChannel("zalo_oa", oaId);
    if (!channel || channel.status !== "connected") return new Response("ok", { status: 200 });

    const { text, attachments } = normalize(body);
    if (!text && attachments.length === 0) return new Response("ok", { status: 200 });

    const profile = await fetchZaloOAProfile(channel.owner_id, senderId);
    const result = await ingestIncoming(channel, {
      externalUserId: senderId,
      body: text,
      attachments,
      externalId: body?.message?.msg_id ? String(body.message.msg_id) : null,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    if (!result.duplicate) await maybeAutoReply(channel, result.conversation);
  } catch (e) {
    console.error("[inbox/zalo] lỗi xử lý:", (e as Error)?.message);
  }

  return new Response("ok", { status: 200 });
}
