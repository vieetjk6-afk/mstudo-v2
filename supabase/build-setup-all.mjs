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
 *
 * QUÊN BƯỚC ĐÓ LÀ LỖI IM LẶNG, và đã xảy ra thật: tám migration nằm trong repo
 * mà không có trong ORDER, nên `setup-all.sql` dựng ra một database THIẾU BẢNG —
 * app chạy được tới lúc ai đó mở đúng màn dùng bảng ấy. Nên script này giờ tự
 * đối chiếu ORDER với thư mục `migrations/` và DỪNG nếu thiếu file nào.
 *
 * `node supabase/build-setup-all.mjs --check` kiểm mà KHÔNG ghi: thoát khác 0
 * nếu thiếu file hoặc nếu setup-all.sql trên đĩa đã cũ so với các file SQL.
 * Đây là thứ `npm run test:setup-all` gọi.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
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
  ["migrations/activity_tracking.sql", "Bộ đếm hoạt động tài khoản (lần cuối mở app, số ngày dùng)"],
  ["migrations/studio_appointments.sql", "Lịch studio: lịch trang điểm / thử đồ / tư vấn, phòng & nguồn lực"],
  ["migrations/studio_branches.sql", "Chi nhánh studio: nhiều cơ sở trong một tài khoản (chạy SAU studio_appointments)"],
  ["migrations/upgrade_payment.sql", "Thanh toán gói dịch vụ: QR chuyển khoản, studio báo đã chuyển, admin xác nhận"],
  ["migrations/crew_phone_digits.sql", "Tra thợ theo SĐT bằng chỉ mục (bỏ quét toàn bảng ở cổng /crew)"],
  ["migrations/contract_deposit_percent.sql", "% cọc hợp đồng do studio tự đặt"],
  ["migrations/inbox_unified.sql", "Hộp thư hợp nhất: gom tin Zalo/Facebook/Instagram/website về một chỗ"],
  ["migrations/inbox_tiktok.sql", "Hộp thư: thêm kênh TikTok (chạy SAU inbox_unified)"],
  ["migrations/danh_gia_khach.sql", "Đánh giá khách: studio duyệt & trả lời (chạy SAU schema.sql)"],
  ["migrations/nguon_khach.sql", "Nguồn khách & phễu chuyển đổi (chạy SAU website_leads)"],
  ["migrations/album_selection_done.sql", "Mốc 'khách đã chọn xong ảnh' trên album"],
  ["migrations/watermark_opt_in.sql", "Watermark phải do studio TỰ BẬT, không mặc định bật"],
  ["migrations/rls_thanh_vien_hop_dong.sql", "Vá quyền: thành viên studio lưu được hạng mục hợp đồng (chạy SAU studio_branches)"],
  // Năm mục cuối của docs/goi-y-hoan-thien-app.md. Đều ALTER/thêm bảng trên nền
  // đã có nên xếp sau; weather + crew_timesheet còn tham chiếu studio_appointments.
  ["migrations/automations.sql", "Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)"],
  ["migrations/crew_timesheet.sql", "Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)"],
  ["migrations/vendors.sql", "Nhà cung cấp & đơn đặt ngoài"],
  ["migrations/accounting.sql", "Phiếu thu có số & khoá sổ kế toán"],
  ["migrations/weather.sql", "Toạ độ điểm chụp cho dự báo thời tiết (chạy SAU studio_appointments)"],
  ["migrations/album_people.sql", "Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)"],
  ["migrations/album_faces.sql", "Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)"],
  // Vá cuối cùng: chạy SAU schema.sql vì nó create-or-replace handle_new_user().
  ["migrations/fix_google_signup_trigger.sql", "Vá đăng nhập Google báo server_error"],
];

/**
 * Migration mà một project ĐANG CHẠY còn thiếu — gộp thành supabase/cap-nhat.sql.
 *
 * Vì sao cần file riêng: `setup-all.sql` là để dựng project TRẮNG. Chủ studio đã
 * có database chạy thật thì phải chạy đúng phần mới. Trước đây tài liệu chỉ ghi
 * TÊN các file ấy, và người dùng — hợp lý thôi — dán chính cái danh sách tên đó
 * vào SQL Editor rồi nhận `syntax error at or near "accounting"`. Mở bảy tám file
 * rồi dán bảy tám lượt cũng là bảy tám cơ hội bỏ sót một cái, mà bỏ sót một
 * migration thì hỏng âm thầm: app chạy tới lúc ai đó mở đúng màn dùng bảng ấy.
 *
 * Nên: MỘT file, dán MỘT lần. Sinh ra từ cùng bộ máy với setup-all.sql (cùng cách
 * xếp lại 3 nhịp bảng → vá → quyền) và cùng chịu `--check`, nên nó không thể cũ
 * đi trong im lặng.
 *
 * Khi phát hành xong một đợt: xoá các dòng đã ra mắt khỏi đây, thêm dòng mới.
 * Thứ tự phải khớp thứ tự trong ORDER.
 */
const MOI = [
  "migrations/danh_gia_khach.sql",
  "migrations/nguon_khach.sql",
  "migrations/automations.sql",
  "migrations/crew_timesheet.sql",
  "migrations/vendors.sql",
  "migrations/accounting.sql",
  "migrations/weather.sql",
  "migrations/album_people.sql",
  "migrations/album_faces.sql",
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

// ── Hàng rào: ORDER phải phủ HẾT thư mục migrations/ ────────────────────────
// Chỉ xét `migrations/`: các file nền (schema.sql, push_subscriptions.sql…) nằm
// ngay trong supabase/ và đã được khai tường minh ở đầu ORDER.
const listed = new Set(ORDER.map(([rel]) => rel));
const missing = readdirSync(join(HERE, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => `migrations/${f}`)
  .filter((rel) => !listed.has(rel))
  .sort();
if (missing.length) {
  console.error(
    `THIẾU ${missing.length} file trong ORDER của supabase/build-setup-all.mjs:\n` +
      missing.map((m) => `  • ${m}`).join("\n") +
      "\n\nsetup-all.sql dựng từ ORDER, nên thiếu ở đây là project mới sẽ thiếu bảng.\n" +
      "Thêm từng dòng vào ORDER (ĐÚNG THỨ TỰ CHẠY, không phải alphabet) rồi chạy lại."
  );
  process.exit(1);
}

/** Đọc một danh sách file SQL rồi xếp lại theo 3 nhịp: bảng → vá → quyền. */
function assemble(files, headLines) {
  const tables = [];
  const setup = [];
  const grants = [];
  let nStmt = 0;

  for (const [rel, desc] of files) {
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
    ...headLines,
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
  return { text: body.join("\n").replace(/\n{4,}/g, "\n\n\n") + "\n", nStmt };
}

/** Ghi, hoặc ở chế độ --check thì đối chiếu với bản trên đĩa. */
function emit(name, files, headLines) {
  const out = join(HERE, name);
  const { text, nStmt } = assemble(files, headLines);
  if (process.argv.includes("--check")) {
    let onDisk = "";
    try {
      onDisk = readFileSync(out, "utf8");
    } catch {
      /* chưa có file → coi như đã cũ */
    }
    if (onDisk !== text) {
      console.error(
        `supabase/${name} ĐÃ CŨ so với các file SQL trong repo.\n` +
          "Chạy: node supabase/build-setup-all.mjs"
      );
      process.exit(1);
    }
    console.log(`${name} khớp — ${files.length} file, ${nStmt} câu lệnh.`);
  } else {
    writeFileSync(out, text);
    console.log(
      `Đã ghi ${out} — ${files.length} file, ${nStmt} câu lệnh, ` +
        `${text.split("\n").length} dòng.`
    );
  }
}

emit("setup-all.sql", ORDER, header);

// ── Bản cập nhật cho project ĐANG CHẠY ──────────────────────────────────────
const byRel = new Map(ORDER);
const moiFiles = MOI.map((rel) => {
  if (!byRel.has(rel)) {
    console.error(
      `MOI có "${rel}" nhưng ORDER thì không.\n` +
        "Mọi file trong MOI phải nằm trong ORDER — nếu không, project mới sẽ thiếu nó."
    );
    process.exit(1);
  }
  return [rel, byRel.get(rel)];
});
// Thứ tự trong MOI phải khớp thứ tự chạy ở ORDER; lệch là chạy sai phụ thuộc.
const rank = new Map(ORDER.map(([rel], i) => [rel, i]));
for (let i = 1; i < MOI.length; i++) {
  if (rank.get(MOI[i]) < rank.get(MOI[i - 1])) {
    console.error(
      `MOI xếp sai thứ tự: "${MOI[i]}" phải đứng TRƯỚC "${MOI[i - 1]}" (theo ORDER).`
    );
    process.exit(1);
  }
}

emit("cap-nhat.sql", moiFiles, [
  line,
  "-- mstudo — CẬP NHẬT CHO PROJECT SUPABASE ĐANG CHẠY",
  "--",
  "-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay, sửa file",
  "-- gốc rồi chạy lại: node supabase/build-setup-all.mjs",
  "--",
  "-- Cách dùng: mở Supabase → SQL Editor → dán TOÀN BỘ file này → Run. Một lần.",
  "-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.",
  "--",
  "-- Project MỚI TINH thì đừng dùng file này — dùng supabase/setup-all.sql, nó",
  "-- gồm cả schema nền. File này CHỈ có phần mới, nó giả định database của bạn",
  "-- đã có sẵn albums, photos, profiles, studio_contracts…",
  line,
  "",
]);
