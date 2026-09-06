import "server-only";
import crypto from "crypto";
import { decryptJSON, encryptJSON } from "@/lib/zalo/crypto";
import type { Attachment, ChannelRow } from "../types";
import { noStoreFetch } from "@/lib/no-store-fetch";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   FACEBOOK MESSENGER & INSTAGRAM DM (Meta Graph API).

   Hai nền tảng, MỘT đường ống: Instagram doanh nghiệp liên kết với một trang
   Facebook, và tin nhắn IG cũng đi qua đúng webhook + đúng endpoint gửi của
   trang đó. Nên adapter dùng chung, chỉ khác `platform` để hiển thị.

   Bí mật của kênh là Page Access Token — lưu MÃ HOÁ trong inbox_channels.secret
   bằng đúng bộ AES-256-GCM của Zalo (src/lib/zalo/crypto.ts), không lưu thô.
   ═══════════════════════════════════════════════════════════════════════════ */

const GRAPH = process.env.META_GRAPH_BASE || "https://graph.facebook.com/v21.0";

export interface MetaSecret {
  pageAccessToken: string;
}

export function packMetaSecret(pageAccessToken: string): string {
  return encryptJSON({ pageAccessToken } satisfies MetaSecret);
}

export function readMetaSecret(channel: ChannelRow): MetaSecret | null {
  return decryptJSON<MetaSecret>(channel.secret);
}

/**
 * Kiểm chữ ký X-Hub-Signature-256 của Meta.
 *
 * BẮT BUỘC: endpoint webhook là URL công khai, ai cũng POST vào được. Không
 * kiểm chữ ký thì bất kỳ ai cũng bơm được tin giả vào hộp thư của studio — và
 * tệ hơn, kích được AI trả lời rồi đốt hạn mức của họ.
 *
 * So sánh bằng `timingSafeEqual` để không rò rỉ chữ ký qua thời gian phản hồi.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Gửi một tin văn bản cho khách qua trang Facebook / tài khoản Instagram. */
export async function sendMetaText(
  channel: ChannelRow,
  recipientId: string,
  text: string
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  const secret = readMetaSecret(channel);
  if (!secret?.pageAccessToken) return { ok: false, error: "no_page_token" };

  try {
    // noStoreFetch: cung nguoi nhan + cung noi dung thi lan gui thu hai bi
    // Data Cache cua Next nuot, khach khong nhan duoc. Xem @/lib/no-store-fetch.
    const res = await noStoreFetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(secret.pageAccessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        // RESPONSE = trả lời trong cửa sổ 24 giờ. Đây là loại duy nhất không
        // cần xin thêm quyền của Meta, và cũng là đúng việc hộp thư đang làm.
        messaging_type: "RESPONSE",
        message: { text: text.slice(0, 2000) },
      }),
      cache: "no-store",
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      return { ok: false, error: json?.error?.message || `meta_${res.status}` };
    }
    return { ok: true, externalId: json?.message_id ? String(json.message_id) : undefined };
  } catch (e: any) {
    return { ok: false, error: e?.message || "meta_request_failed" };
  }
}

/** Tên + ảnh của người nhắn (Messenger chỉ đưa psid trong webhook). */
export async function fetchMetaProfile(
  channel: ChannelRow,
  psid: string
): Promise<{ name: string | null; avatarUrl: string | null }> {
  const secret = readMetaSecret(channel);
  if (!secret?.pageAccessToken) return { name: null, avatarUrl: null };
  try {
    const res = await fetch(
      `${GRAPH}/${encodeURIComponent(psid)}?fields=name,profile_pic&access_token=${encodeURIComponent(
        secret.pageAccessToken
      )}`,
      { cache: "no-store" }
    );
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.error) return { name: null, avatarUrl: null };
    return { name: json?.name ?? null, avatarUrl: json?.profile_pic ?? null };
  } catch {
    // Không lấy được hồ sơ là chuyện thường (khách chặn, token thiếu quyền) —
    // hội thoại vẫn phải chạy, chỉ là hiện "Khách Facebook" thay cho tên.
    return { name: null, avatarUrl: null };
  }
}

/** Đổi phần `attachments` của webhook Meta sang dạng của hộp thư. */
export function normalizeMetaAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const a of raw as any[]) {
    const url = a?.payload?.url;
    if (typeof url !== "string" || !url) continue;
    const t = a?.type;
    const type: Attachment["type"] =
      t === "image" ? "image" : t === "video" ? "video" : t === "audio" ? "audio" : "file";
    out.push({ type, url });
  }
  return out;
}
