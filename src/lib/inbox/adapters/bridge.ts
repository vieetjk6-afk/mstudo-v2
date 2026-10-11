import "server-only";
import { lookup } from "node:dns/promises";
import { decryptJSON, encryptJSON } from "@/lib/zalo/crypto";
import { isBlockedIp, signBridgePayload, validRelayUrl } from "../bridge-protocol";
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
  // validRelayUrl chỉ nhìn được CHỮ trong URL. Một tên miền bình thường vẫn có
  // thể phân giải ra 127.0.0.1 hay 169.254.169.254 — nên phải hỏi DNS và chặn
  // nếu BẤT KỲ địa chỉ nào nó trả về là địa chỉ nội bộ.
  const dnsErr = await relayHostError(check.url.hostname);
  if (dnsErr) return { ok: false, error: dnsErr };

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
      // KHÔNG đi theo chuyển hướng: URL đã kiểm ở trên có thể 302 sang một địa
      // chỉ nội bộ, và fetch sẽ ngoan ngoãn gọi tới đó. 3xx coi như gửi hỏng.
      redirect: "manual",
      // Cầu nối treo thì KHÔNG được kéo theo cả route gửi tin. Hết giờ thì coi
      // như gửi hỏng, nhân viên thấy ngay và gọi điện cho khách.
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: `cầu nối trả chuyển hướng ${res.status} — không đi theo` };
    }
    if (!res.ok) {
      // CHỈ báo mã trạng thái, KHÔNG chép thân phản hồi vào lỗi: lỗi này hiện
      // trong khung chat, và chép nguyên văn là biến cầu nối thành cái ống đọc
      // phản hồi của bất kỳ máy chủ nào URL trỏ tới (SSRF có đọc được kết quả).
      await res.body?.cancel().catch(() => {});
      return { ok: false, error: `cầu nối trả ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    // Không chép e.message: lỗi mạng của undici có thể kèm địa chỉ/chi tiết nội bộ.
    return { ok: false, error: e?.name === "TimeoutError" ? "cầu nối không phản hồi" : "không gọi được cầu nối" };
  }
}

/**
 * Phân giải tên miền của cầu nối và chặn nếu có địa chỉ nội bộ. Trả chuỗi lỗi
 * (tiếng Việt, hiện cho nhân viên) hoặc null nếu gọi được.
 *
 * Còn một kẽ hở nhỏ: DNS rebinding — tên miền trả IP công khai lúc kiểm rồi đổi
 * sang IP nội bộ lúc fetch tự phân giải lại. Với `redirect: "manual"` và không
 * chép thân phản hồi, kẻ tấn công cũng không đọc được gì từ cú gọi đó.
 */
async function relayHostError(hostname: string): Promise<string | null> {
  const host = hostname.replace(/^\[|\]$/g, "");
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (!addrs.length) return "không phân giải được tên miền cầu nối";
    if (addrs.some((a) => isBlockedIp(a.address))) {
      return "URL cầu nối không được trỏ vào địa chỉ nội bộ.";
    }
    return null;
  } catch {
    return "không phân giải được tên miền cầu nối";
  }
}
