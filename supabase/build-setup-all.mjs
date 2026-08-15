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
  ["migrations/album_dislikes.sql", "Ảnh khách 'không thích' trong album chọn ảnh"],
  ["migrations/lifecycle_followup.sql", "Theo đuổi khách chưa chọn ảnh · hạn lưu trữ ảnh gốc · hạn hiệu lực báo giá"],
  ["migrations/referral_deposit.sql", "Khách giới thiệu khách · đặt cọc giữ ngày (chạy sau lifecycle_followup)"],
  // Vá cuối cùng: chạy SAU schema.sql vì nó create-or-replace handle_new_user().
  ["migrations/fix_google_signup_trigger.sql", "Vá đăng nhập Google báo server_error"],
];

/**
 * Tách một chuỗi SQL thành từng câu lệnh. Không thể cắt bừa theo dấu ';' vì
 * dấu đó còn nằm trong thân hàm $$…$$, trong chuỗi nháy đơn và trong ghi chú.
 * Ghi chú/khoảng trắng đứng trước được gắn LIỀN vào câu lệnh phía sau để khi
 * xếp lại thứ tự thì lời giải thích vẫn đi theo đúng câu lệnh của nó.
 */
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const rest = sql.slice(i);

    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") { j++; break; }
        else j++;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === ";") {
      buf += ";";
      out.push(buf);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** Bỏ ghi chú + khoảng trắng đầu câu để nhận dạng loại câu lệnh. */
function head(stmt) {
  return stmt
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Câu lệnh TẠO BẢNG — phải chạy TRƯỚC mọi câu vá cột / chỉ mục / seed.
 *
 * Vì sao cần tách: các file SQL lớn dần theo thời gian — bảng mới nối vào cuối
 * file, còn `alter table … add column` của nó lại nằm ở đoạn giữa (viết khi
 * bảng đã tồn tại sẵn trên database đang chạy). Trên project TRẮNG thứ tự đó sai.
 */
function isTableCreate(stmt) {
  const h = head(stmt);
  return /^create\s+(schema|extension|type|sequence)\b/.test(h) || /^create\s+table\b/.test(h);
}

/**
 * Câu lệnh PHÂN QUYỀN — phải chạy SAU khi mọi bảng/cột đã tồn tại.
 *
 * Cùng nguyên nhân: phần RLS nằm gần đầu schema.sql nhưng liệt kê cả những cột
 * mãi cuối file mới thêm → trên database trắng sẽ lỗi kiểu
 * `column "monthly_revenue_target" ... does not exist`. Supabase SQL Editor chạy
 * cả file trong MỘT transaction nên chỉ một lỗi là rollback sạch toàn bộ.
 */
function isGrantLike(stmt) {
  const h = head(stmt);
  return (
    /^(create|drop)\s+policy\b/.test(h) ||
    /^(grant|revoke)\b/.test(h) ||
    /^alter\s+table\s+[^ ]+\s+(enable|disable|force|no force)\s+row\s+level\s+security\b/.test(h) ||
    /^alter\s+publication\b/.test(h)
  );
}

const line = "-- " + "═".repeat(74);
const header = [
  line,
  "-- mstudo — CÀI ĐẶT MỘT LẦN CHO PROJECT SUPABASE MỚI",
  "--",
  "-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay, sửa file",
  "-- gốc rồi chạy lại: node supabase/build-setup-all.mjs",
  "--",
  "-- Cách dùng: mở Supabase → SQL Editor → dán toàn bộ file này → Run.",
  "-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.",
  "--",
  "-- Bố cục: PHẦN 1 tạo bảng, PHẦN 2 vá cột/chỉ mục/hàm/seed, PHẦN 3 cấp quyền.",
  "-- Bộ sinh tự xếp lại theo 3 nhịp đó (giữ nguyên thứ tự tương đối trong mỗi",
  "-- nhịp) vì trong file gốc nhiều policy/grant và `alter table add column` đứng",
  "-- TRƯỚC bảng mà chúng tham chiếu — chạy trên database trắng sẽ lỗi.",
  line,
  "",
];

const tables = [];
const setup = [];
const grants = [];
let nStmt = 0;

for (const [rel, desc] of ORDER) {
  const sql = readFileSync(join(HERE, rel), "utf8");
  const banner = ["", line, `-- ▶ ${rel} — ${desc}`, line].join("\n");
  const mine = { tables: [], setup: [], grants: [] };
  for (const stmt of splitStatements(sql)) {
    if (!stmt.trim()) continue;
    nStmt++;
    const bucket = isGrantLike(stmt) ? "grants" : isTableCreate(stmt) ? "tables" : "setup";
    mine[bucket].push(stmt.trim());
  }
  for (const k of ["tables", "setup", "grants"]) {
    const target = k === "tables" ? tables : k === "setup" ? setup : grants;
    if (mine[k].length) target.push(banner, "", mine[k].join("\n\n"), "");
  }
}

const body = [
  ...header,
  line,
  "-- PHẦN 1 — TẠO BẢNG",
  line,
  ...tables,
  "",
  line,
  "-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH",
  line,
  ...setup,
  "",
  line,
  "-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)",
  line,
  ...grants,
];

const out = join(HERE, "setup-all.sql");
writeFileSync(out, body.join("\n").replace(/\n{4,}/g, "\n\n\n") + "\n");
console.log(
  `Đã ghi ${out} — ${ORDER.length} file, ${nStmt} câu lệnh, ` +
    `${body.join("\n").split("\n").length} dòng.`
);
