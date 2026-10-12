import crypto from "node:crypto";
import net from "node:net";

/* ═══════════════════════════════════════════════════════════════════════════
   GIAO THỨC CẦU NỐI — phần logic THUẦN, tách khỏi phần vận chuyển.

   File này chỉ import `node:crypto` và `node:net`, không đụng Supabase, không `server-only`,
   không alias `@/` — nhờ vậy chạy thẳng được trong Node để kiểm thử:
   `npm run test:inbox`. Phần gọi mạng và giải mã bí mật nằm ở adapters/bridge.ts.

   Hai thứ ở đây đều là hàng rào an toàn, không phải tiện ích:
     • validRelayUrl  — chặn SSRF (URL do người dùng nhập, máy chủ tự gọi).
     • isBlockedIp    — địa chỉ IP nào KHÔNG được gọi tới (dùng cả cho IP viết
                        thẳng trong URL lẫn IP mà tên miền phân giải ra).
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
    // IP viết thẳng trong URL (kể cả dạng IPv4 nhúng trong IPv6 như
    // [::ffff:127.0.0.1] — trình phân tích URL đổi nó thành ::ffff:7f00:1).
    isBlockedIp(host);

  if (blocked) return { ok: false, error: "URL cầu nối không được trỏ vào địa chỉ nội bộ." };
  return { ok: true, url };
}

/**
 * Địa chỉ IP này có phải chỗ KHÔNG được gọi tới không: loopback, mạng riêng,
 * link-local (metadata đám mây 169.254.169.254), CGNAT 100.64/10, "this
 * network", multicast/dự phòng, và các dạng IPv6 bọc một IPv4 trong đó
 * (::ffff:a.b.c.d, ::a.b.c.d, NAT64 64:ff9b::/96, 6to4 2002::/16).
 *
 * Chuỗi không phải IP → false (tên miền thì kiểm sau khi phân giải DNS).
 */
export function isBlockedIp(raw: string): boolean {
  // Bỏ ngoặc vuông và zone id (fe80::1%eth0).
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const v = net.isIP(ip);
  if (v === 4) return blockedV4(ip.split(".").map(Number));
  if (v === 6) return blockedV6(ip);
  return false;
}

function blockedV4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, metadata đám mây
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF
    (a === 198 && (b === 18 || b === 19)) || // benchmark
    a >= 224 // multicast + dự phòng + broadcast
  );
}

/** Bung IPv6 thành 8 nhóm 16 bit; null nếu không đọc được (→ coi như chặn). */
function expandV6(ip: string): number[] | null {
  let s = ip;
  // Đuôi IPv4 dạng chấm (::ffff:1.2.3.4) → hai nhóm hex.
  const m = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (m) {
    const [a, b, c, d] = m.slice(1).map(Number);
    s = s.slice(0, m.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const words = [...head, ...Array(fill).fill("0"), ...tail].map((w) => parseInt(w, 16));
  return words.length === 8 && words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff) ? words : null;
}

function blockedV6(ip: string): boolean {
  const w = expandV6(ip);
  if (!w) return true;
  const v4 = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
  const zero = (from: number, to: number) => w.slice(from, to).every((x) => x === 0);
  if (zero(0, 8)) return true; // :: (unspecified)
  if (zero(0, 7) && w[7] === 1) return true; // ::1
  if (zero(0, 5) && w[5] === 0xffff) return blockedV4(v4(w[6], w[7])); // ::ffff:a.b.c.d
  if (zero(0, 6)) return blockedV4(v4(w[6], w[7])); // ::a.b.c.d (kiểu cũ)
  if (w[0] === 0x64 && w[1] === 0xff9b && zero(2, 6)) return blockedV4(v4(w[6], w[7])); // NAT64
  if (w[0] === 0x2002) return blockedV4(v4(w[1], w[2])); // 6to4
  return (
    (w[0] & 0xfe00) === 0xfc00 || // unique-local fc00::/7
    (w[0] & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (w[0] & 0xffc0) === 0xfec0 || // site-local (cũ) fec0::/10
    (w[0] & 0xff00) === 0xff00 // multicast
  );
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
