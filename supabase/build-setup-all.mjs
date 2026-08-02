/**
 * Gộp toàn bộ SQL của dự án thành MỘT file chạy một lần: supabase/setup-all.sql
 * — dùng khi dựng một project Supabase MỚI hoàn toàn (bản 2.0, môi trường test…).
 *
 * Vì sao cần script thay vì `cat *.sql`: thứ tự chạy KHÔNG trùng thứ tự alphabet
 * (crew_profile_show phải chạy SAU crew_schedule), và các file nền phải đi trước
 * mọi migration vì migration chỉ ALTER/patch những bảng đã có.
 *
 * Thêm file SQL mới → thêm tên vào ORDER bên dưới rồi chạy:
 *   node supabase/build-setup-all.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Thứ tự chạy — nền trước, vá sau. Mỗi dòng: [đường dẫn, mô tả ngắn].
const ORDER = [
  ["schema.sql", "Nền: profiles, albums, hợp đồng, studio, site_settings, storage buckets"],
  ["push_subscriptions.sql", "Web Push (thông báo đẩy)"],
  ["wedding_invitations.sql", "Thiệp cưới online"],
  ["story_pages.sql", "Trang Love Story"],
  ["migrations/c1_profiles_column_grants.sql", "Vá C1: chặn leo thang đặc quyền trên profiles"],
  ["migrations/admin_drive.sql", "Vá bảo mật: tách refresh_token Drive của admin"],
  ["migrations/atomic_redemptions.sql", "Chống race condition khi dùng mã giảm giá / bản dùng thử"],
  ["migrations/album_designs.sql", "Thiết kế Album"],
  ["migrations/contract_intake.sql", "Form điền thông tin trước buổi chụp"],
  ["migrations/crew_schedule.sql", "Lịch thợ (phải chạy TRƯỚC crew_profile_show)"],
  ["migrations/crew_profile_show.sql", "Hồ sơ thợ & thông tin show"],
  ["migrations/photographer_plus_pricing.sql", "Cột giá còn thiếu của gói Photographer Plus"],
  ["migrations/rental.sql", "Phòng váy: kho trang phục & đơn thuê"],
  ["migrations/site_views.sql", "Đếm lượt xem website studio"],
  ["migrations/studio_drive_sync.sql", "Đồng bộ Google Drive cho hợp đồng"],
  ["migrations/studio_zalo.sql", "Tự động nhắn Zalo theo từng studio"],
  ["migrations/website_chat_config.sql", "Cấu hình chatbox website"],
  ["migrations/website_leads.sql", "Lead & hội thoại từ chatbox"],
];

const line = "-- " + "═".repeat(74);
const parts = [
  line,
  "-- mstudo — CÀI ĐẶT MỘT LẦN CHO PROJECT SUPABASE MỚI",
  "--",
  "-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay, sửa file",
  "-- gốc rồi chạy lại: node supabase/build-setup-all.mjs",
  "--",
  "-- Cách dùng: mở Supabase → SQL Editor → dán toàn bộ file này → Run.",
  "-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.",
  line,
  "",
];

for (const [rel, desc] of ORDER) {
  const sql = readFileSync(join(HERE, rel), "utf8").trimEnd();
  parts.push("", line, `-- ▶ ${rel} — ${desc}`, line, "", sql, "");
}

const out = join(HERE, "setup-all.sql");
writeFileSync(out, parts.join("\n") + "\n");
console.log(`Đã ghi ${out} — ${ORDER.length} file, ${parts.join("\n").split("\n").length} dòng.`);
