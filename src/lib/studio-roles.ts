/* ═══════════════════════════════════════════════════════════════════════════
   VAI TRÒ TRONG MỘT STUDIO — nguồn duy nhất cho nhãn, mô tả và luật phân quyền.

   Trước đây bảng nhãn vai trò nằm rải ở StudioShell, StaffManager và
   BranchesManager, còn danh sách vai trò được phép thì nằm trong route API. Thêm
   một vai trò là phải sửa bốn nơi, và sớm muộn bốn nơi lệch nhau — nguy nhất là
   khi chỗ lệch nằm ở phía KIỂM QUYỀN.

   File này KHÔNG import gì để chạy được trực tiếp trong Node (kiểm thử):
   `npm run test:studio-roles`.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Vai trò gán được cho một tài khoản nhân viên của studio.
 *
 * `owner` / `admin` KHÔNG nằm ở đây: đó không phải vai trò gán được, mà là chủ
 * tài khoản và admin nền tảng — `requireStudio` suy ra chúng, không ai chọn từ
 * ô chọn được.
 */
export type StudioRole = "manager" | "branch_manager" | "staff" | "accountant";

export const STUDIO_ROLES: readonly {
  key: StudioRole;
  label: string;
  /** Dòng phụ trong ô chọn — nói rõ vai trò này thấy gì. */
  hint: string;
}[] = [
  { key: "manager", label: "Quản lý", hint: "Toàn bộ studio, trừ mục tài chính" },
  {
    key: "branch_manager",
    label: "Toàn quyền chi nhánh",
    hint: "Toàn quyền NHƯNG chỉ trong chi nhánh được gán — kể cả doanh thu của chi nhánh đó",
  },
  { key: "staff", label: "Nhân viên", hint: "Chỉ hợp đồng được giao cho mình" },
  { key: "accountant", label: "Kế toán", hint: "Chỉ mục thu chi và tiền công" },
];

export const STUDIO_ROLE_LABEL: Record<string, string> = {
  owner: "Chủ studio",
  admin: "Quản trị mstudo",
  ...Object.fromEntries(STUDIO_ROLES.map((r) => [r.key, r.label])),
};

export function roleLabel(role: string | null | undefined): string {
  return STUDIO_ROLE_LABEL[role ?? ""] ?? role ?? "Nhân viên";
}

/** Vai trò gán được — dùng để lọc giá trị nhận từ client trong route API. */
export const ASSIGNABLE_ROLES: readonly string[] = STUDIO_ROLES.map((r) => r.key);

export function isAssignableRole(role: string | null | undefined): role is StudioRole {
  return !!role && ASSIGNABLE_ROLES.includes(role);
}

/* ── Luật phân quyền ─────────────────────────────────────────────────────── */

/**
 * Vai trò bị KHOÁ vào đúng một chi nhánh.
 *
 * Đây là điểm khác biệt duy nhất về BẢN CHẤT giữa `branch_manager` và `manager`:
 * quyền hạn như nhau, nhưng phạm vi dữ liệu bị ghim. Khác với việc gán chi nhánh
 * cho các vai trò khác — cái đó chỉ là MẶC ĐỊNH hiển thị, đổi được; còn ở đây là
 * hàng rào, không đổi được từ phía người dùng.
 */
export function isBranchScopedRole(role: string | null | undefined): boolean {
  return role === "branch_manager";
}

/** Chủ tài khoản studio hoặc admin nền tảng — mức quyền cao nhất. */
export function isOwnerLevel(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Được TẠO / XOÁ tài khoản nhân viên và ĐỔI VAI TRÒ của người khác.
 *
 * Chỉ chủ studio. Cố ý KHÔNG cho `manager` và `branch_manager`: đổi vai trò là
 * đường leo thang đặc quyền ngắn nhất (một quản lý tự nâng mình, hoặc nâng người
 * khác rồi nhờ họ nâng lại).
 */
export function canManageRoles(role: string | null | undefined): boolean {
  return isOwnerLevel(role);
}

/**
 * Được GÁN nhân sự vào chi nhánh.
 *
 * Chủ studio và quản lý toàn studio. `branch_manager` KHÔNG được: chuyển người
 * giữa các cơ sở là việc ở tầng trên chi nhánh, và cho phép thì họ tự kéo được
 * nhân sự (kèm dữ liệu của nhân sự đó) về cơ sở mình.
 */
export function canAssignBranch(role: string | null | undefined): boolean {
  return isOwnerLevel(role) || role === "manager";
}

/**
 * Phạm vi chi nhánh BẮT BUỘC của một người, hay null nếu họ được tự chọn.
 *
 * Trả `"none"` khi vai trò bị ghim mà CHƯA được gán chi nhánh: fail-closed. Cho
 * họ thấy toàn studio trong lúc cấu hình còn thiếu là biến một thiếu sót thành
 * một lỗ hổng; còn "chỉ thấy phần chưa gán" thì vô hại và làm sai sót lộ ra ngay.
 */
export function forcedBranchScope(
  role: string | null | undefined,
  branchId: string | null | undefined
): string | null {
  if (!isBranchScopedRole(role)) return null;
  return branchId || "none";
}
