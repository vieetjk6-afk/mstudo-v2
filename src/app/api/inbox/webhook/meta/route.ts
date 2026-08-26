import { NextRequest } from "next/server";
import { findChannel, ingestIncoming } from "@/lib/inbox/store";
import { maybeAutoReply } from "@/lib/inbox/send";
import { fetchMetaProfile, normalizeMetaAttachments, verifyMetaSignature } from "@/lib/inbox/adapters/meta";
import type { ChannelRow } from "@/lib/inbox/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * WEBHOOK FACEBOOK MESSENGER & INSTAGRAM DM.
 *
 * Khai một URL này cho cả hai sản phẩm trong Meta App:
 *   https://<tên-miền>/api/inbox/webhook/meta
 *
 * GET  — Meta gọi một lần để xác minh, trả lại `hub.challenge` nếu token khớp.
 * POST — tin nhắn mới. Kiểm chữ ký, tra ra studio nào sở hữu trang, ghi vào hộp
 *        thư, rồi nhờ AI trả lời nếu hội thoại chưa có người tiếp quản.
 *
 * LUÔN trả 200 (kể cả khi ta xử lý hỏng, trừ chữ ký sai): Meta coi mã lỗi là
 * "chưa nhận được" và sẽ bắn lại, rồi tắt webhook nếu hỏng nhiều lần. Việc của
 * ta là nhận cho nhanh rồi tự lo phần còn lại.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_SECRET = process.env.META_APP_SECRET || "";
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && VERIFY_TOKEN && p.get("hub.verify_token") === VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!APP_SECRET) {
    console.error("[inbox/meta] thiếu META_APP_SECRET — từ chối webhook");
    return new Response("not_configured", { status: 503 });
  }
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), APP_SECRET)) {
    return new Response("bad_signature", { status: 403 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }

  // `object` cho biết tin đến từ đâu: 'page' = Messenger, 'instagram' = IG DM.
  const platform = body?.object === "instagram" ? "instagram" : "facebook";

  try {
    for (const entry of body?.entry ?? []) {
      // Id của trang / tài khoản IG nhận tin — chìa khoá tra ngược ra studio.
      const pageId = String(entry?.id ?? "");
      if (!pageId) continue;

      const channel = await findChannel(platform, pageId);
      if (!channel || channel.status !== "connected") continue;

      for (const ev of entry?.messaging ?? []) {
        await handleEvent(channel, ev);
      }
    }
  } catch (e) {
    console.error("[inbox/meta] lỗi xử lý:", (e as Error)?.message);
  }

  return new Response("ok", { status: 200 });
}

async function handleEvent(channel: ChannelRow, ev: any) {
  const senderId = String(ev?.sender?.id ?? "");
  if (!senderId) return;
  // `is_echo` = tin do chính trang gửi ra (kể cả tin ta vừa gửi). Ghi lại sẽ
  // thành vòng lặp AI tự trả lời chính mình.
  if (ev?.message?.is_echo) return;
  // Trang tự nhắn cho chính nó — bỏ.
  if (senderId === channel.external_id) return;

  const message = ev?.message;
  if (!message) return; // delivery / read receipt — không phải nội dung

  const text = typeof message.text === "string" ? message.text : "";
  const attachments = normalizeMetaAttachments(message.attachments);
  if (!text && attachments.length === 0) return;

  const profile = await fetchMetaProfile(channel, senderId);

  const result = await ingestIncoming(channel, {
    externalUserId: senderId,
    body: text,
    attachments,
    externalId: message.mid ? String(message.mid) : null,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
  });
  if (result.duplicate) return;

  await maybeAutoReply(channel, result.conversation);
}
