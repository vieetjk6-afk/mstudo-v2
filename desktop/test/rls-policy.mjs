/* Kiểm thử RLS: policy nào cho ĐỌC RỘNG thì phải được khai báo có chủ đích.
 *
 * Vì sao đáng test: bật RLS không có nghĩa là an toàn. Một policy
 * `using (auth.role() = 'authenticated')` nghĩa là MỌI tài khoản đọc được TOÀN
 * bảng — mà trong Postgres nhiều policy permissive cộng bằng OR, nên một câu
 * rộng như thế vô hiệu hoá mọi câu hẹp khác trên cùng bảng.
 *
 * Lỗi thật đã xảy ra: `crew_unavailable` mở đọc cho mọi tài khoản từ hồi nó chỉ
 * có (phone, date) — "ngày này thợ bận", đúng là ít nhạy cảm. Về sau bảng được
 * MỞ RỘNG thêm `title` (tiêu đề hợp đồng, thường có tên khách) và `owner_id`
 * (studio nào đặt), nhưng policy thì không ai xem lại. Cửa mở ấy thành ra để lộ
 * lịch và khách của mọi studio cho bất kỳ ai có tài khoản.
 *
 * Bài học: cái hỏng không phải policy, mà là KHÔNG AI ĐƯỢC NHẮC xem lại policy
 * khi bảng đổi hình dạng. Test này là lời nhắc đó — thêm một policy đọc rộng
 * (hoặc thêm bảng mới có policy rộng) là test đỏ cho tới khi ghi vào danh sách
 * dưới kèm lý do.
 *
 * Đọc thẳng supabase/schema.sql — nguồn sự thật của lược đồ.
 */
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

let fail = 0;
const ok = (name, cond, chiTiet = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${chiTiet}`}`);
};

/**
 * Policy ĐỌC RỘNG được phép tồn tại — mỗi dòng phải kèm lý do đứng vững được.
 * Thêm vào đây là một quyết định, không phải thủ tục cho test xanh.
 */
const CHO_PHEP = {
  "site_settings.site_settings_public_read":
    "Nội dung trang chủ, vốn để công khai. Hai cột bí mật (drive_refresh_token, " +
    "drive_folder_id) đã được CHUYỂN sang bảng admin_drive chỉ service-role đọc — " +
    "xem migrations/admin_drive.sql.",
  "crew_shift_plan.crew_shift_plan_read":
    "Chỉ có (phone, company, shift A/B/C) — thợ freelance thuộc ca nào. Bảng không " +
    "có cột owner nên không lọc theo studio được, và TeamTab đọc thẳng từ trình " +
    "duyệt theo danh sách SĐT nó đã có. Nếu bảng này được thêm cột mô tả công " +
    "việc / khách hàng thì PHẢI siết lại như crew_unavailable.",
};

// Bắt trọn từng câu `create policy ... ;`
const policies = [...sql.matchAll(/create policy\s+(\w+)\s+on\s+public\.(\w+)([\s\S]*?);/gi)]
  .map(([, ten, bang, than]) => ({ ten, bang, than }));

ok("đọc được policy từ schema.sql", policies.length > 50, `chỉ thấy ${policies.length} policy — regex hỏng?`);

/** Policy có ràng buộc theo chủ sở hữu / quyền hay không. */
const CO_RANG_BUOC =
  /auth\.uid\(\)|is_admin\(\)|owner_id|user_id|profile_id|exists\s*\(|in\s*\(\s*select|current_setting/i;

const rong = policies
  .filter((p) => !CO_RANG_BUOC.test(p.than))
  .map((p) => `${p.bang}.${p.ten}`);

// ── 1. Không được có policy đọc rộng NGOÀI danh sách ──────────────────────
for (const khoa of rong) {
  ok(
    `policy đọc rộng được khai báo có chủ đích: ${khoa}`,
    Object.hasOwn(CHO_PHEP, khoa),
    `${khoa} cho MỌI tài khoản đọc toàn bảng mà không có lý do nào được ghi.\n` +
      `    Siết policy lại, hoặc thêm vào CHO_PHEP trong file này KÈM lý do.`
  );
}

// ── 2. Danh sách cho phép không được để lại rác ───────────────────────────
// Policy đã siết rồi mà tên vẫn nằm đây thì lần sau người đọc tưởng nó còn mở.
for (const khoa of Object.keys(CHO_PHEP)) {
  ok(
    `mục trong CHO_PHEP vẫn còn đúng thực tế: ${khoa}`,
    rong.includes(khoa),
    `${khoa} không còn là policy đọc rộng nữa — xoá khỏi CHO_PHEP.`
  );
}

// ── 3. Chốt riêng chỗ đã từng hỏng ────────────────────────────────────────
const crew = policies.find((p) => p.bang === "crew_unavailable" && p.ten === "crew_unavailable_read");
ok("crew_unavailable vẫn có policy đọc", !!crew);
if (crew) {
  ok(
    "crew_unavailable chỉ cho đọc dòng của chính mình",
    /owner_id\s*=\s*auth\.uid\(\)/i.test(crew.than),
    `đang là: ${crew.than.trim().replace(/\s+/g, " ")}`
  );
  ok(
    "crew_unavailable KHÔNG mở cho mọi tài khoản đã đăng nhập",
    !/auth\.role\(\)\s*=\s*'authenticated'/i.test(crew.than)
  );
}

// ── 4. Mọi bảng đều phải bật RLS ──────────────────────────────────────────
// \s+ chứ không phải một dấu cách: các câu này canh lề bằng nhiều khoảng trắng.
const bang = new Set([...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]));
const daBat = new Set(
  [...sql.matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi)].map((m) => m[1])
);
const thieu = [...bang].filter((t) => !daBat.has(t));
ok(`mọi bảng đều bật RLS (${bang.size} bảng)`, thieu.length === 0, `chưa bật: ${thieu.join(", ")}`);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
