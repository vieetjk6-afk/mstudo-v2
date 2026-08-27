import "server-only";
import { decryptJSON, encryptJSON } from "@/lib/zalo/crypto";
import { signBridgePayload, validRelayUrl } from "../bridge-protocol";
import type { ChannelRow, ContactRow } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ═══════════════════════════════════════════════════════════════════════════
   CẦU NỐI — kênh mà MStudo không nói chuyện thẳng với nền tảng.

   Hiện dùng cho TIKTOK. TikTok có Business Messaging API cho tài khoản doanh
   nghiệp (khu vực châu Á – Thái Bình Dương, gồm Việt Nam) nhưng còn beta và
   trên thực tế đi qua các đối tác nhắn tin được TikTok công nhận. Thay vì đoán
   endpoint rồi ra một adapter trông như chạy được, ta định nghĩa một giao thức
   NHỎ và RÕ, ai cũng nối vào được:

     • Tin VÀO : cầu nối POST /api/inbox/ingest (Bearer INBOX_INGEST_SECRET)
     • Tin RA  : MStudo POST tới `relayUrl` của kênh, ký HMAC-SHA256

   Ký tin đi ra là bắt buộc, không phải trang trí: `relayUrl` là một máy chủ của
   bên thứ ba, và nếu không ký thì bất kỳ ai đoán được URL đó cũng nhắn được cho
   khách của studio dưới danh nghĩa studio.

   Cùng khuôn với cách Meta/Zalo ký tin gửi cho ta — ta đối xử với cầu nối đúng
   như cách các nền tảng lớn đối xử với ta.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Cấu hình cầu nối, lưu MÃ HOÁ trong inbox_channels.secret. */
export interface BridgeSecret {
  /** URL của cầu nối nhận tin đi ra. */
  relayUrl: string;
  /** Khoá ký HMAC. Cầu nối dùng nó để xác minh tin đúng là của MStudo. */
  relaySecret: string;
}

export function packBridgeSecret(relayUrl: string, relaySecret: string): string {
  return encryptJSON({ relayUrl, relaySecret } satisfies BridgeSecret);
}

export function readBridgeSecret(channel: ChannelRow): BridgeSecret | null {
  const s = decryptJSON<BridgeSecret>(channel.secret);
  return s?.relayUrl ? s : null;
}

/** Gửi một tin cho khách qua cầu nối của kênh. */
export async function sendViaBridge(
  channel: ChannelRow,
  contact: ContactRow,
  text: string,
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const secret = readBridgeSecret(channel);
  if (!secret) return { ok: false, error: "chưa khai URL cầu nối cho kênh này" };

  const check = validRelayUrl(secret.relayUrl);
  if (!check.ok) return { ok: false, error: check.error };

  const body = JSON.stringify({
    platform: channel.platform,
    channelId: channel.external_id,
    conversationId,
    to: { id: contact.external_user_id, name: contact.name },
    text,
  });

  try {
    const res = await fetch(check.url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mstudo-Signature": signBridgePayload(body, secret.relaySecret),
      },
      body,
      cache: "no-store",
      // Cầu nối treo thì KHÔNG được kéo theo cả route gửi tin. Hết giờ thì coi
      // như gửi hỏng, nhân viên thấy ngay và gọi điện cho khách.
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      // Trả nguyên văn lý do của cầu nối (cắt ngắn) — "gửi hỏng" chung chung thì
      // nhân viên không biết là hết cửa sổ trả lời hay token của đối tác hết hạn.
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `cầu nối trả ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name === "TimeoutError" ? "cầu nối không phản hồi" : e?.message || "bridge_failed" };
  }
}
