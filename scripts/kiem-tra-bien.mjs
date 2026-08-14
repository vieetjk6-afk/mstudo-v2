#!/usr/bin/env node
/**
 * Soi bộ biến môi trường mà `vercel pull` vừa tải về, TRƯỚC khi build.
 *
 * Vì sao cần: các biến NEXT_PUBLIC_* bị nướng cứng vào bundle lúc build. Một
 * giá trị gõ sai (dán kèm dấu nháy, thiếu https://, dán chuỗi kết nối Postgres
 * thay vì Project URL) vẫn build thành công rồi mới nổ lúc chạy, với câu lỗi
 * "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL." ở phía trình duyệt —
 * không có gì trong log build chỉ ra biến nào sai. Bước này biến chuyện mò mẫm
 * thành một dòng log.
 *
 * Chạy: node scripts/kiem-tra-bien.mjs [đường-dẫn-file-env]
 * Mặc định đọc .vercel/.env.production.local (do `vercel pull` sinh ra).
 *
 * In giá trị ĐẦY ĐỦ cho các biến NEXT_PUBLIC_* — chúng vốn công khai, mọi khách
 * vào web đều tải được chúng trong JS. Biến bí mật chỉ in "có/không + độ dài".
 */

import { readFileSync } from "node:fs";

const file = process.argv[2] || ".vercel/.env.production.local";

/** Biến bắt buộc, thiếu là site không chạy. */
const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
/** Biến phải parse được thành URL http(s). */
const MUST_BE_HTTP_URL = ["NEXT_PUBLIC_SUPABASE_URL"];
/**
 * Biến phải là hostname TRẦN — không scheme, không dấu / ở cuối, không cổng.
 * Middleware so sánh chúng với header Host bằng dấu bằng, nên "https://mstudo.com"
 * hay "mstudo.com/" là không bao giờ khớp. Nặng nhất là NEXT_PUBLIC_MAIN_HOST đặt
 * thành "www.mstudo.com": lúc đó apex mstudo.com bị coi là domain riêng của một
 * studio khách → rewrite sang /site/mstudo.com → trang chủ TRẮNG, còn /login và
 * /dashboard thì bị đá sang www. Cả hai đều không có dòng lỗi nào ở đâu.
 */
const MUST_BE_BARE_HOST = [
  "NEXT_PUBLIC_MAIN_HOST",
  "NEXT_PUBLIC_APP_HOST",
  "NEXT_PUBLIC_IMG_HOST",
  "NEXT_PUBLIC_ADMIN_HOST",
  "NEXT_PUBLIC_THIEP_HOST",
];

function parseEnvFile(text) {
  const out = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    // `vercel pull` bọc giá trị trong dấu nháy kép của định dạng dotenv. Bóc
    // MỘT lớp đó ra; dấu nháy nào còn lại là do người dán vào Vercel, và chính
    // nó là thứ ta đang đi tìm.
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    out.set(key, value);
  }
  return out;
}

let env;
try {
  env = parseEnvFile(readFileSync(file, "utf8"));
} catch {
  console.log(`⚠️  Không đọc được ${file} — bỏ qua bước kiểm tra biến.`);
  process.exit(0);
}

const loi = [];

console.log(`── Biến môi trường build lấy từ ${file} (${env.size} biến) ──`);

/**
 * Bẫy nặng nhất và khó thấy nhất: biến bật cờ **Sensitive** trên Vercel.
 *
 * Vercel không cho đọc lại biến Sensitive, kể cả `vercel pull` — CLI ghi vào
 * .env.production.local đúng chuỗi ký tự "[SENSITIVE]". Build coi đó là giá trị
 * thật và nướng cứng vào bundle. Không có lỗi nào lúc build; hậu quả rải rác ra
 * khắp app và mỗi chỗ lộ ra một câu lỗi khác nhau, không câu nào nhắc tới
 * nguyên nhân:
 *   NEXT_PUBLIC_MAIN_HOST        → trang chủ trắng, link khách thành
 *                                  https://[SENSITIVE]/c/<token>
 *   NEXT_PUBLIC_SUPABASE_URL     → "Invalid supabaseUrl"
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY → "The string contains invalid characters"
 *   NEXT_PUBLIC_GOOGLE_API_KEY   → Drive 403 "Requests from referer … blocked"
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY → mọi form khách báo lỗi chung
 *
 * Biến CHỈ dùng ở máy chủ thì bật Sensitive vẫn chạy (runtime đọc trực tiếp từ
 * Vercel). Nhưng NEXT_PUBLIC_* thì bắt buộc phải đọc được LÚC BUILD.
 */
const SENSITIVE_PLACEHOLDER = "[SENSITIVE]";
const biBoiDen = [...env.entries()]
  .filter(([, v]) => v.trim() === SENSITIVE_PLACEHOLDER)
  .map(([k]) => k);
if (biBoiDen.length) {
  const congKhai = biBoiDen.filter((k) => k.startsWith("NEXT_PUBLIC_"));
  for (const k of biBoiDen) console.log(`🚫 ${k}: "[SENSITIVE]" — Vercel không cho build đọc giá trị`);
  if (congKhai.length) {
    loi.push(
      `${congKhai.join(", ")} đang bật cờ Sensitive trên Vercel nên build chỉ nhận được chuỗi "[SENSITIVE]" thay cho giá trị thật. Vào Vercel → Settings → Environment Variables, XOÁ từng biến rồi tạo lại với Sensitive TẮT. Cờ này vô nghĩa với NEXT_PUBLIC_* vì giá trị vốn được gửi tới mọi trình duyệt.`
    );
  }
}

for (const key of REQUIRED) {
  const value = env.get(key);
  if (value === undefined || value === "") {
    console.log(`❌ ${key}: KHÔNG CÓ`);
    loi.push(`${key} chưa được khai cho môi trường Production trên Vercel (hoặc đang bật Sensitive nên "vercel pull" không đọc được).`);
    continue;
  }
  const trimmed = value.trim();
  const laCongKhai = key.startsWith("NEXT_PUBLIC_");
  // JSON.stringify để dấu nháy dư, khoảng trắng và \n hiện ra thay vì vô hình.
  const hienThi = laCongKhai ? JSON.stringify(value) : `(${value.length} ký tự)`;
  console.log(`✅ ${key}: ${hienThi}`);
  if (value !== trimmed) {
    loi.push(`${key} có khoảng trắng hoặc dấu xuống dòng ở đầu/cuối — sửa lại trên Vercel, đừng để dấu cách nào.`);
  }
}

for (const key of MUST_BE_HTTP_URL) {
  const value = env.get(key)?.trim();
  if (!value) continue; // đã báo ở trên
  let u;
  try {
    u = new URL(value);
  } catch {
    loi.push(
      `${key} = ${JSON.stringify(value)} không phải URL. Phải là https://<mã-project>.supabase.co (Supabase → Project Settings → Data API → Project URL). Hay gặp: dán kèm dấu nháy, hoặc dán Project ID.`
    );
    continue;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    loi.push(
      `${key} = ${JSON.stringify(value)} dùng protocol "${u.protocol}" chứ không phải https. Đây KHÔNG phải chuỗi kết nối database (postgresql://…pooler.supabase.com) — chỗ này cần Project URL của API: https://<mã-project>.supabase.co`
    );
  }
}

for (const key of MUST_BE_BARE_HOST) {
  const value = env.get(key);
  if (value === undefined || value === "") continue; // để trống là hợp lệ: chạy một host duy nhất
  console.log(`   ${key}: ${JSON.stringify(value)}`);
  if (value !== value.trim()) {
    loi.push(`${key} có khoảng trắng ở đầu/cuối — middleware so sánh với header Host bằng dấu bằng nên sẽ không bao giờ khớp.`);
    continue;
  }
  if (/^[a-z]+:\/\//i.test(value)) {
    loi.push(`${key} = ${JSON.stringify(value)} có scheme. Chỗ này cần hostname trần, ví dụ "mstudo.com".`);
  } else if (value.includes("/")) {
    loi.push(`${key} = ${JSON.stringify(value)} có dấu "/". Chỗ này cần hostname trần, ví dụ "mstudo.com".`);
  } else if (value.includes(":")) {
    loi.push(`${key} = ${JSON.stringify(value)} có cổng. Chỗ này cần hostname trần, ví dụ "mstudo.com".`);
  }
}

// MAIN_HOST là tên miền GỐC (apex). Đặt thành www.* làm apex bị coi là domain
// riêng của studio khách → trang chủ trắng, /login bị đá sang www.
const mainHost = env.get("NEXT_PUBLIC_MAIN_HOST")?.trim();
if (mainHost?.startsWith("www.")) {
  loi.push(
    `NEXT_PUBLIC_MAIN_HOST = ${JSON.stringify(mainHost)} bắt đầu bằng "www.". Phải là tên miền gốc (${JSON.stringify(mainHost.slice(4))}) — middleware tự chuyển www về gốc. Để "www." ở đây làm trang chủ trắng và /login bị đá sang www.`
  );
}

if (loi.length) {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║ DỪNG BUILD — biến môi trường sai, build tiếp cũng ra site hỏng ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  for (const m of loi) console.log(`  • ${m}`);
  console.log("");
  console.log("Sửa ở Vercel → project → Settings → Environment Variables (nhớ tick");
  console.log("Production), rồi chạy lại workflow này. Đừng bấm Redeploy: bản");
  console.log("deploy là --prebuilt nên Redeploy dùng lại biến cũ.");
  process.exit(1);
}

console.log("── Biến bắt buộc: đủ và đúng dạng. ──");
