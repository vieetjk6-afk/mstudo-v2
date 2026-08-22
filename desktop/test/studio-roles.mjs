/* Kiểm thử luật phân quyền của studio, đặc biệt vai trò "Toàn quyền chi nhánh".
 *
 * Vì sao đáng test: đây là code QUYẾT ĐỊNH AI THẤY GÌ. Sai theo hướng chặt thì
 * người ta phàn nàn và mình sửa; sai theo hướng lỏng thì quản lý một cơ sở đọc
 * được doanh thu của cơ sở khác và KHÔNG AI BÁO — vì với họ trông như bình thường.
 *
 * Ba cái bẫy:
 *   • `branch_manager` chưa được gán chi nhánh: phải fail-CLOSED ("none" = chỉ
 *     phần chưa gán), tuyệt đối không được trả null vì null nghĩa là "xem gộp
 *     toàn studio" — một thiếu sót cấu hình biến thành lỗ hổng.
 *   • Đổi vai trò là đường leo thang đặc quyền ngắn nhất: `manager` và
 *     `branch_manager` KHÔNG được đổi vai trò của ai.
 *   • Gán chi nhánh: `branch_manager` không được, nếu không họ tự kéo nhân sự
 *     (kèm dữ liệu) về cơ sở mình.
 */
import {
  STUDIO_ROLES, STUDIO_ROLE_LABEL, roleLabel, ASSIGNABLE_ROLES, isAssignableRole,
  isBranchScopedRole, isOwnerLevel, canManageRoles, canAssignBranch, forcedBranchScope,
} from "../../src/lib/studio-roles.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Danh sách vai trò ───────────────────────────────────────────────────── */
check("bốn vai trò gán được", ASSIGNABLE_ROLES, ["manager", "branch_manager", "staff", "accountant"]);
check("owner/admin KHÔNG gán được từ ô chọn", [isAssignableRole("owner"), isAssignableRole("admin")], [false, false]);
check("vai trò lạ bị loại", isAssignableRole("superuser"), false);
check("null bị loại", isAssignableRole(null), false);
check("mọi vai trò đều có nhãn", STUDIO_ROLES.every((r) => !!STUDIO_ROLE_LABEL[r.key]), true);
check("mọi vai trò đều có dòng giải thích", STUDIO_ROLES.every((r) => r.hint.length > 10), true);
check("nhãn owner/admin có sẵn", [roleLabel("owner"), roleLabel("admin")], ["Chủ studio", "Quản trị mstudo"]);
check("nhãn vai trò mới", roleLabel("branch_manager"), "Toàn quyền chi nhánh");
check("vai trò lạ trả về chính nó, không rỗng", roleLabel("gi-do-la"), "gi-do-la");
check("null → nhãn mặc định", roleLabel(null), "Nhân viên");

/* ── Ai bị ghim vào chi nhánh ────────────────────────────────────────────── */
check("chỉ branch_manager bị ghim",
  ["owner", "admin", "manager", "branch_manager", "staff", "accountant"].map(isBranchScopedRole),
  [false, false, false, true, false, false]);

/* ── Đổi vai trò: CHỈ chủ studio ─────────────────────────────────────────── */
check("chủ studio đổi được vai trò", [canManageRoles("owner"), canManageRoles("admin")], [true, true]);
check("QUẢN LÝ không đổi được vai trò", canManageRoles("manager"), false);
check("toàn quyền chi nhánh không đổi được vai trò", canManageRoles("branch_manager"), false);
check("nhân viên / kế toán không đổi được", [canManageRoles("staff"), canManageRoles("accountant")], [false, false]);

/* ── Gán chi nhánh: chủ + quản lý toàn studio ────────────────────────────── */
check("chủ studio gán được chi nhánh", canAssignBranch("owner"), true);
check("quản lý toàn studio gán được", canAssignBranch("manager"), true);
check("TOÀN QUYỀN CHI NHÁNH không gán được (không tự kéo người về cơ sở mình)",
  canAssignBranch("branch_manager"), false);
check("nhân viên không gán được", canAssignBranch("staff"), false);

check("isOwnerLevel", ["owner", "admin", "manager", "staff"].map(isOwnerLevel), [true, true, false, false]);

/* ── Phạm vi bắt buộc ────────────────────────────────────────────────────── */
// null = "tự chọn được / xem gộp". Chỉ vai trò bị ghim mới có phạm vi bắt buộc.
check("manager tự chọn phạm vi", forcedBranchScope("manager", "b-q1"), null);
check("owner tự chọn phạm vi", forcedBranchScope("owner", null), null);
check("nhân viên tự chọn phạm vi (gán chi nhánh chỉ là mặc định hiển thị)",
  forcedBranchScope("staff", "b-q1"), null);
check("branch_manager bị ghim vào chi nhánh của mình", forcedBranchScope("branch_manager", "b-q1"), "b-q1");
// BẪY QUAN TRỌNG NHẤT của cả file.
check("branch_manager CHƯA gán chi nhánh → 'none' (fail-closed), KHÔNG phải null",
  forcedBranchScope("branch_manager", null), "none");
check("chuỗi rỗng cũng fail-closed", forcedBranchScope("branch_manager", ""), "none");
check("undefined cũng fail-closed", forcedBranchScope("branch_manager", undefined), "none");
// Khẳng định thẳng điều nguy hiểm nhất: không bao giờ trả null cho vai trò bị ghim.
check("vai trò bị ghim KHÔNG BAO GIỜ ra null (null = xem gộp toàn studio)",
  [null, "", undefined, "b-q1"].map((v) => forcedBranchScope("branch_manager", v)).some((v) => v === null),
  false);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
