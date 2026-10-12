/* Kiểm thử VAI TRÒ THỢ STUDIO TỰ ĐẶT (src/lib/crew-roles.ts).
 *
 * Vì sao đáng test: chữ hiển thị của vai trò đi khắp nơi — bảng lương, cổng
 * thợ, tin Zalo gửi thợ, file xuất Excel. Tra sai một bước là thợ nhận tin
 * "Vai trò: c_8k2m1q", hoặc hợp đồng cũ gán vai trò đã xoá bỗng ra khoá thô.
 *
 * Điều phải giữ:
 *   • Tên: studio đặt → tên có sẵn → khoá thô (không bao giờ ra chuỗi rỗng).
 *   • Ẩn / xoá mềm chỉ bỏ khỏi Ô CHỌN, KHÔNG bỏ khỏi chữ hiển thị.
 *   • Ô chọn lọc theo nhóm hợp đồng, kể cả vai trò tự thêm.
 *   • "Khác" không ẩn được — lối thoát cuối cùng.
 *   • Giá trị đang chọn luôn còn trong ô chọn (kẻo lần lưu sau âm thầm đổi vai trò).
 *   • Database bỏ ràng buộc bảy khoá, và không migration nào tạo lại nó.
 *
 * Nạp thẳng code thật.
 */
import { readFileSync } from "node:fs";
import {
  crewRoleLabel, crewRolesFor, allCrewRoles, newCrewRoleKey, isBuiltinCrewRole,
  loadCrewRoles, BUILTIN_CREW_ROLES,
} from "../../src/lib/crew-roles.ts";
import { CREW_ROLES_BY_KIND } from "../../src/lib/contract-kind.ts";
import { CREW_ROLE_LABEL } from "../../src/lib/types.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const keys = (l) => l.map((r) => r.key);

/* ── 1. Không có vai trò tự đặt = y như trước ─────────────────────────────── */
for (const k of ["shoot", "makeup", "combo"]) {
  check(`không có dòng nào → ô chọn nhóm ${k} đúng bằng CREW_ROLES_BY_KIND`, keys(crewRolesFor(k)), CREW_ROLES_BY_KIND[k]);
}
check("không truyền nhóm → đủ bảy vai trò có sẵn", keys(crewRolesFor(null)), BUILTIN_CREW_ROLES);
check("tên có sẵn", crewRoleLabel("makeup"), CREW_ROLE_LABEL.makeup);
check("khoá lạ không có dòng → ra chính khoá", crewRoleLabel("c_zzz"), "c_zzz");
check("khoá rỗng → chuỗi rỗng", crewRoleLabel(null), "");

/* ── 2. Đổi tên / ẩn vai trò có sẵn ───────────────────────────────────────── */
const rows = [
  { key: "makeup", label: "Make-up artist", kinds: [], active: true, position: 1 },
  { key: "cameraman", label: "", kinds: [], active: false, position: 1 },
  { key: "other", label: "", kinds: [], active: false, position: 6 },
  { key: "c_flycam01", label: "Flycam", kinds: ["shoot", "combo"], active: true, position: 3 },
  { key: "c_stylist1", label: "Stylist", kinds: ["makeup"], active: true, position: 0 },
  { key: "c_cu000001", label: "Thợ cũ", kinds: ["shoot"], active: false, position: 9 },
];
check("tên studio đặt đè tên có sẵn", crewRoleLabel("makeup", rows), "Make-up artist");
check("label rỗng trên dòng đè = giữ tên mặc định", crewRoleLabel("cameraman", rows), CREW_ROLE_LABEL.cameraman);
check("vai trò tự thêm ra đúng tên", crewRoleLabel("c_flycam01", rows), "Flycam");
check("vai trò ĐÃ XOÁ vẫn ra đúng tên (hợp đồng cũ)", crewRoleLabel("c_cu000001", rows), "Thợ cũ");

const shoot = keys(crewRolesFor("shoot", rows));
check("vai trò có sẵn bị ẩn không vào ô chọn", shoot.includes("cameraman"), false);
check("\"Khác\" KHÔNG ẩn được dù có dòng active=false", shoot.includes("other"), true);
check("vai trò tự thêm hiện ở nhóm của nó", shoot.includes("c_flycam01"), true);
check("vai trò tự thêm KHÔNG hiện ở nhóm khác", shoot.includes("c_stylist1"), false);
check("vai trò tự thêm đã xoá không vào ô chọn", shoot.includes("c_cu000001"), false);
check("nhóm makeup có Stylist, không có Flycam",
  [keys(crewRolesFor("makeup", rows)).includes("c_stylist1"), keys(crewRolesFor("makeup", rows)).includes("c_flycam01")], [true, false]);
check("trọn gói có Flycam", keys(crewRolesFor("combo", rows)).includes("c_flycam01"), true);

/* ── 3. Thứ tự ────────────────────────────────────────────────────────────── */
// position: photographer 0 (mặc định), Stylist 0 (tự đặt) → có sẵn đứng trước khi bằng nhau.
// Mặc định vai trò có sẵn ở vị trí theo thứ tự trọn gói; Flycam (3) bằng vị
// trí với "Làm tóc" (3) → có sẵn đứng trước. Trang điểm được kéo lên vị trí 1.
check("xếp theo position, bằng nhau thì có sẵn đứng trước",
  keys(crewRolesFor("combo", rows)),
  ["photographer", "makeup", "hair", "c_flycam01", "editor", "assistant", "other"]);
check("vai trò tự thêm kéo lên đầu (vị trí 0) thì đứng đầu ô chọn nhóm makeup",
  keys(crewRolesFor("makeup", rows))[0], "c_stylist1");
check("allCrewRoles giữ cả vai trò ẩn/xoá (cho khối quản lý)",
  keys(allCrewRoles(rows)).filter((k) => ["cameraman", "c_cu000001"].includes(k)).sort(), ["c_cu000001", "cameraman"]);

/* ── 4. Giá trị đang chọn luôn còn trong ô chọn ───────────────────────────── */
const kept = crewRolesFor("makeup", rows, "c_flycam01");
check("giá trị đang chọn không thuộc nhóm → vẫn thêm vào cuối", kept.at(-1), { key: "c_flycam01", label: "Flycam" });
check("giá trị đã có trong danh sách → không lặp",
  crewRolesFor("shoot", rows, "photographer").filter((r) => r.key === "photographer").length, 1);
check("vai trò đã ẩn đang được chọn → vẫn hiện", keys(crewRolesFor("shoot", rows, "cameraman")).includes("cameraman"), true);

/* ── 5. Khoá mới ──────────────────────────────────────────────────────────── */
const k1 = newCrewRoleKey();
check("khoá mới có tiền tố c_ và 8 ký tự", /^c_[a-z0-9]{8}$/.test(k1), true);
check("khoá mới không bao giờ trùng khoá có sẵn", isBuiltinCrewRole(k1), false);
check("rand() = 0.9999… không vượt bảng chữ", /^c_[a-z0-9]{8}$/.test(newCrewRoleKey(() => 0.99999999)), true);
const many = new Set(Array.from({ length: 2000 }, () => newCrewRoleKey()));
check("2000 khoá ngẫu nhiên không trùng nhau", many.size, 2000);
check("\"constructor\" không bị coi là vai trò có sẵn", isBuiltinCrewRole("constructor"), false);

/* ── 6. Database chưa chạy migration → lùi về vai trò có sẵn ──────────────── */
const fakeDb = (result) => ({
  from: () => {
    const q = { select: () => q, in: () => q, eq: () => q, order: async () => result };
    return q;
  },
});
const origWarn = console.warn;
console.warn = () => {};
check("bảng chưa có (42P01) → rỗng",
  await loadCrewRoles(fakeDb({ data: null, error: { code: "42P01", message: 'relation "studio_crew_roles" does not exist' } }), "o1"), []);
check("lỗi khác → vẫn rỗng, không ném", await loadCrewRoles(fakeDb({ data: null, error: { code: "500", message: "boom" } }), "o1"), []);
console.warn = origWarn;
check("không có ownerId → rỗng", await loadCrewRoles(fakeDb({ data: [], error: null }), null), []);
check("đọc đúng dòng của studio",
  (await loadCrewRoles(fakeDb({ data: [{ id: "1", owner_id: "o1", key: "c_a", label: "A", kinds: ["shoot"], active: true, position: 2 }], error: null }), "o1")).map((r) => r.key),
  ["c_a"]);

/* ── 7. Database ──────────────────────────────────────────────────────────── */
const mig = readFileSync(new URL("../../supabase/migrations/vai_tro_tho_tu_dat.sql", import.meta.url), "utf8");
check("migration tạo bảng studio_crew_roles", /create table if not exists public\.studio_crew_roles/.test(mig), true);
check("migration bật RLS", /alter table public\.studio_crew_roles enable row level security/.test(mig), true);
check("migration bỏ ràng buộc vai trò của contract_crew",
  /alter table public\.contract_crew drop constraint if exists contract_crew_role_check/.test(mig), true);
check("migration KHÔNG tạo lại ràng buộc", /add constraint contract_crew_role_check/.test(mig), false);
const cu = readFileSync(new URL("../../supabase/migrations/crew_role_makeup.sql", import.meta.url), "utf8");
check("crew_role_makeup.sql chỉ tạo lại ràng buộc khi CHƯA có bảng vai trò tự đặt",
  /to_regclass\('public\.studio_crew_roles'\) is null/.test(cu), true);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
