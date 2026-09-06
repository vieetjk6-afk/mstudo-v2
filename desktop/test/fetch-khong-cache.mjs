/* Kiểm thử: mọi câu Supabase phía máy chủ phải ĐI THẬT, không lấy đồ trong cache.
 *
 * Vì sao bài này tồn tại — đây là gốc rễ của lỗi "album khác không thấy khuôn
 * mặt". Next 14 vá đè `fetch` toàn cục và cho vào Data Cache, và trong Route
 * Handler thì `export const dynamic = "force-dynamic"` KHÔNG tắt được nó. Đo
 * bằng một route dựng riêng (force-dynamic, gọi ba loại request tới một máy chủ
 * đếm), gọi route 3 lần:
 *
 *     GET   /dem     máy chủ nhận 1 lần   (lẽ ra 3)
 *     PATCH /tang    máy chủ nhận 1 lần   (lẽ ra 3)  ← CẢ LỆNH GHI cũng bị nuốt
 *     HEAD  /dem     máy chủ nhận 1 lần   (lẽ ra 3)
 *
 * Câu UPDATE thứ hai trở đi không rời khỏi máy chủ, mà vẫn trả về "đã ghi N
 * dòng" của lần đầu — nên mọi vòng kiểm "ghi có ăn không" đều bị lừa, và mọi
 * câu đọc lặp lại thì đóng băng ở ảnh chụp đầu tiên.
 *
 * Bài này KHÔNG dựng Next lên (quá nặng cho một bài test). Nó kiểm đúng thứ có
 * thể hỏng lặng lẽ về sau: `noStoreFetch` phải THẬT SỰ đặt cache:"no-store" lên
 * mọi request, và hai client Supabase phía máy chủ phải THẬT SỰ dùng nó. Ai đó
 * "dọn dẹp" bỏ tuỳ chọn `global.fetch` đi là bài này đỏ ngay.
 */
import { readFileSync } from "node:fs";
import { noStoreFetch } from "../../src/lib/no-store-fetch.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/* ── 1. noStoreFetch có thật sự ép cache:"no-store" lên mọi request không ─── */
{
  const thay = [];
  const that = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    thay.push({ url: String(input), cache: init?.cache, method: init?.method });
    return new Response("{}", { status: 200 });
  };
  try {
    await noStoreFetch("http://x/doc");
    await noStoreFetch("http://x/ghi", { method: "PATCH", body: "{}" });
  } finally {
    globalThis.fetch = that;
  }
  ok("câu ĐỌC được đặt cache:'no-store'", thay[0]?.cache === "no-store", `nhận: ${thay[0]?.cache}`);
  ok("câu GHI được đặt cache:'no-store'", thay[1]?.cache === "no-store", `nhận: ${thay[1]?.cache}`);
  ok("vẫn giữ nguyên method của lời gọi", thay[1]?.method === "PATCH", `nhận: ${thay[1]?.method}`);
}

/* ── 2. Hai client Supabase phía máy chủ phải CẮM noStoreFetch vào ────────── */
const clientSupabase = [
  ["src/lib/supabase/admin.ts", "khoá dịch vụ — cron, webhook, đồng bộ desktop"],
  ["src/lib/supabase/server.ts", "phiên đăng nhập — dashboard, route handler"],
];
for (const [duong, vaiTro] of clientSupabase) {
  const src = readFileSync(new URL(`../../${duong}`, import.meta.url), "utf8");
  ok(`${duong} nhập noStoreFetch (${vaiTro})`, /from ["']@\/lib\/no-store-fetch["']/.test(src));
  ok(`${duong} truyền vào global.fetch`, /global:\s*\{\s*fetch:\s*noStoreFetch\s*\}/.test(src));
}

/* ── 3. Mọi lời gọi RA NGOÀI khác cũng không được dùng `fetch` trần ─────────
 * Nguy nhất là hai cái đầu: chúng CÓ TÁC DỤNG PHỤ. Hai lần gửi cùng URL và
 * cùng thân request thì lần thứ hai bị Data Cache nuốt — người nhận không bao
 * giờ thấy mail/tin nhắn, mà code vẫn nhận về "gửi thành công" của lần đầu.  */
const goiRaNgoai = [
  ["src/lib/email.ts", "gửi mail qua Resend (CÓ TÁC DỤNG PHỤ)"],
  ["src/lib/inbox/adapters/meta.ts", "gửi tin nhắn Facebook/Instagram (CÓ TÁC DỤNG PHỤ)"],
  ["src/lib/vieetjk/providers.ts", "gọi mô hình AI cho chatbot"],
  ["src/app/api/studio/weather/route.ts", "bản tin thời tiết"],
  ["src/app/api/img/route.ts", "thăm dò ảnh đã cache trên Supabase Storage"],
];
for (const [duong, vaiTro] of goiRaNgoai) {
  const src = readFileSync(new URL(`../../${duong}`, import.meta.url), "utf8");
  // Duyệt TỪNG lời gọi `fetch(` trần (bỏ `noStoreFetch(`, `.fetch(`) rồi soi
  // 300 ký tự tiếp theo: khai `cache:` ngay tại chỗ cũng được, không bắt buộc
  // phải qua noStoreFetch. Kiểm theo dòng thì trượt các lời gọi xuống dòng.
  const con = [];
  for (const m of src.matchAll(/(?<!noStore)(?<!\.)(?<![A-Za-z])fetch\(/g)) {
    const truoc = src.slice(0, m.index);
    const dong = truoc.slice(truoc.lastIndexOf("\n") + 1).trim();
    if (dong.startsWith("*") || dong.startsWith("//")) continue; // trong ghi chú
    const sau = src.slice(m.index, m.index + 300);
    if (/cache:\s*["']no-store["']/.test(sau)) continue;         // đã khai tại chỗ
    con.push(src.slice(m.index, m.index + 60).replace(/\s+/g, " "));
  }
  ok(`${duong} không còn fetch() bỏ ngỏ cache (${vaiTro})`, con.length === 0, con.join(" | ").slice(0, 140));
}

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
