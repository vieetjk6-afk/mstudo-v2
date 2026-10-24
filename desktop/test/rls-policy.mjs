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
import { readFileSync, readdirSync } from "node:fs";

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

// ── 5. Họ hợp đồng: luật vai trò phải nằm ở DATABASE, không chỉ ở route API ──
// Lỗ hổng thật: policy chỉ hỏi is_studio_member(owner_id), nên nhân viên / kế
// toán / quản lý chi nhánh gọi thẳng PostgREST là đọc mọi hợp đồng, huỷ hợp
// đồng, chèn khoản thu. Hành vi từng vai trò được kiểm trên Postgres thật ở
// desktop/test/rls-luu-nguoi.mjs; ở đây chốt những thứ đọc được từ văn bản.
const SUPA = new URL("../../supabase/", import.meta.url);
const VAI_TRO = "migrations/phan_quyen_vai_tro_hop_dong.sql";
const vaiTro = readFileSync(new URL(VAI_TRO, SUPA), "utf8");

// 5a. MỌI bản khai is_studio_member đều kiểm is_active — chạy lại một file cũ
//     không được trả tài khoản đã khoá về quyền cũ.
const nguon = [
  "schema.sql",
  ...readdirSync(new URL("migrations/", SUPA)).filter((f) => f.endsWith(".sql")).map((f) => `migrations/${f}`),
];
for (const f of nguon) {
  const text = readFileSync(new URL(f, SUPA), "utf8");
  for (const m of text.matchAll(/function public\.is_studio_member\(target uuid\)[\s\S]*?\$\$([\s\S]*?)\$\$/g)) {
    ok(`is_studio_member trong ${f} chặn tài khoản đã khoá (is_active)`, /me\.is_active/.test(m[1]) && /o\.is_active/.test(m[1]));
  }
}

// 5b. Mỗi bảng của họ hợp đồng có policy đọc + ghi theo vai trò.
const vtPolicies = [...vaiTro.matchAll(/create policy\s+(\w+)\s+on\s+public\.(\w+)([\s\S]*?);/gi)].map(([, ten, bang, than]) => ({ ten, bang, than }));
const HO_HOP_DONG = [
  "studio_contracts", "contract_items", "contract_crew", "contract_edit_requests", "contract_payments",
  "contract_payment_plan", "contract_tasks", "contract_equipment", "contract_products",
  "contract_quote_options", "contract_client_proofs", "studio_crew",
];
for (const t of HO_HOP_DONG) {
  ok(
    `${t} có policy đọc + ghi theo vai trò`,
    vtPolicies.some((p) => p.bang === t && p.ten === `${t}_member_read`) &&
      vtPolicies.some((p) => p.bang === t && p.ten === `${t}_member_write`)
  );
}
for (const t of ["contract_reschedules", "contract_addenda"]) {
  ok(`${t} chỉ có policy ĐỌC theo vai trò (ghi đi qua service role)`, vtPolicies.filter((p) => p.bang === t).map((p) => p.ten).join() === `${t}_member_read`);
}

// 5c. Không còn "mọi thành viên làm được mọi thứ".
ok(
  "policy mới không dùng is_studio_member (cho mọi thành viên mọi quyền)",
  vtPolicies.every((p) => !/is_studio_member/.test(p.than))
);
const ghi = vtPolicies.filter((p) => p.ten.endsWith("_member_write")).map((p) => p.than).join("\n");
ok("policy GHI không mở cho kế toán (năng lực all_write không gồm accountant)", !/'all_read'|'accountant'|'member'/.test(ghi));
ok(
  "quản lý chi nhánh bị ghim theo branch_id ở mọi policy hợp đồng",
  vtPolicies.filter((p) => HO_HOP_DONG.includes(p.bang) && /_member_/.test(p.ten)).every((p) => /branch_id = \(select public\.studio_my_branch\(\)\)/.test(p.than))
);
ok(
  "nhân viên chỉ ghi được hợp đồng giao cho mình",
  vtPolicies.filter((p) => p.ten.endsWith("_member_write") && p.bang !== "studio_crew").every((p) => /assigned_to = \(select auth\.uid\(\)\)/.test(p.than))
);
const thu = vtPolicies.find((p) => p.ten === "contract_payments_member_write");
ok(
  "khoản hoàn tiền / số âm chỉ chủ studio ghi được",
  !!thu && /kind is distinct from 'refund'/.test(thu.than) && /amount, 0\) >= 0/.test(thu.than) && /studio_scope_owner\('owner'\)/.test(thu.than)
);
ok(
  "huỷ hợp đồng chỉ chủ studio — trigger trên studio_contracts",
  /before insert or update of status on public\.studio_contracts/.test(vaiTro) && /contract_cancel_owner_only/.test(vaiTro)
);

// 5d. Dạng initPlan: mọi lời gọi "người gọi là ai" trong policy phải bọc (select …).
for (const p of vtPolicies) {
  const tran = p.than.replace(/\(select (public\.\w+\([^()]*\)|auth\.uid\(\))(::uuid\[\])?\)/g, "");
  ok(
    `policy ${p.bang}.${p.ten} gọi hàm vai trò dạng (select …) — tính một lần mỗi câu`,
    !/(auth\.uid\(\)|is_admin\(\)|studio_scope_owner\(|studio_my_branch\(|studio_my_product_contracts\()/.test(tran),
    `còn lời gọi trần: ${(tran.match(/(auth\.uid\(\)|is_admin\(\)|studio_scope_owner\([^)]*\)|studio_my_branch\(\)|studio_my_product_contracts\(\))/) || [""])[0]}`
  );
}

// 5e. File này phải chạy CUỐI: nó thay policy và hàm mà các file trước tạo.
const build = readFileSync(new URL("build-setup-all.mjs", SUPA), "utf8");
const order = build.slice(build.indexOf("const ORDER = ["), build.indexOf("];", build.indexOf("const ORDER = [")));
const cuoi = [...order.matchAll(/\["([^"]+)"/g)].pop()?.[1];
ok(`${VAI_TRO} đứng cuối ORDER`, cuoi === VAI_TRO, `đang cuối: ${cuoi}`);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
