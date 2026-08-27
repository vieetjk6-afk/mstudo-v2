import crypto from "node:crypto";

/* ═══════════════════════════════════════════════════════════════════════════
   GIAO THỨC CẦU NỐI — phần logic THUẦN, tách khỏi phần vận chuyển.

   File này chỉ import `node:crypto`, không đụng Supabase, không `server-only`,
   không alias `@/` — nhờ vậy chạy thẳng được trong Node để kiểm thử:
   `npm run test:inbox`. Phần gọi mạng và giải mã bí mật nằm ở adapters/bridge.ts.

   Hai thứ ở đây đều là hàng rào an toàn, không phải tiện ích:
     • validRelayUrl  — chặn SSRF (URL do người dùng nhập, máy chủ tự gọi).
     • signBridgePayload — ký tin đi ra, để cầu nối biết chắc tin là của MStudo.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Chỉ cho gọi ra HTTPS và chặn địa chỉ nội bộ.
 *
 * `relayUrl` do studio tự nhập, còn máy chủ thì gọi nó bằng chính danh tính của
 * mình — đó đúng định nghĩa SSRF. Không chặn thì có thể trỏ URL vào
 * `169.254.169.254` (metadata của máy chủ đám mây) hay một dịch vụ nội bộ, rồi
 * đọc phản hồi qua dòng báo lỗi hiện trong khung chat.
 */
export function validRelayUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "URL không hợp lệ." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "URL cầu nối phải dùng https." };

  // Bỏ ngoặc vuông của IPv6 dạng http://[::1]/ — `hostname` giữ nguyên ngoặc.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    // IPv4: loopback, riêng tư, link-local, "this network".
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    // IPv6: loopback, unique-local (fc00::/7), link-local (fe80::/10).
    host === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /^fe[89ab][0-9a-f]:/.test(host);

  if (blocked) return { ok: false, error: "URL cầu nối không được trỏ vào địa chỉ nội bộ." };
  return { ok: true, url };
}

/**
 * Chữ ký tin đi ra: `t=<giây>,s=<hex>` — HMAC-SHA256 trên chuỗi `<t>.<body>`.
 *
 * Dấu thời gian nằm TRONG phần được ký (không phải cạnh nó): có vậy kẻ chặn
 * đường mới không sửa được `t` để phát lại một tin cũ mà chữ ký vẫn hợp lệ.
 * Đây đúng khuôn mà Meta và Zalo dùng khi ký tin gửi cho ta.
 */
export function signBridgePayload(body: string, secret: string, nowMs = Date.now()): string {
  const t = Math.floor(nowMs / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`, "utf8").digest("hex");
  return `t=${t},s=${sig}`;
}
