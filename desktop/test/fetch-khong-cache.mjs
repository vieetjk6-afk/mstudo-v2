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
import { noStoreFetch } from "../../src/lib/supabase/no-cache-fetch.ts";

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
const phaiDung = [
  ["src/lib/supabase/admin.ts", "khoá dịch vụ — cron, webhook, đồng bộ desktop"],
  ["src/lib/supabase/server.ts", "phiên đăng nhập — dashboard, route handler"],
];
for (const [duong, vaiTro] of phaiDung) {
  const src = readFileSync(new URL(`../../${duong}`, import.meta.url), "utf8");
  const coNhap = /from ["']\.\/no-cache-fetch["']/.test(src);
  const coCam = /global:\s*\{\s*fetch:\s*noStoreFetch\s*\}/.test(src);
  ok(`${duong} nhập noStoreFetch (${vaiTro})`, coNhap);
  ok(`${duong} truyền vào global.fetch`, coCam);
}

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
