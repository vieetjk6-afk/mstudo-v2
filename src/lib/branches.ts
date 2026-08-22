import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { branchFilter, normalizeBranch, sortBranches, type BranchRow } from "@/lib/branch-rules";
import type { StudioBranch } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   CHI NHÁNH — phần chạm hệ thống: đọc danh sách của studio và biết studio đang
   xem chi nhánh nào. Luật thuần nằm ở `branch-rules.ts`.

   Vì sao lưu lựa chọn trong COOKIE chứ không phải query string: chủ studio chọn
   "Chi nhánh Quận 1" một lần rồi đi qua Hợp đồng → Lịch → Thu chi, và mong cả
   ba màn cùng nói về Quận 1. Nhét vào URL thì mỗi liên kết trong app phải tự
   mang tham số đó theo, sót một chỗ là phạm vi âm thầm nhảy về "toàn studio".
   ═══════════════════════════════════════════════════════════════════════════ */

export const BRANCH_COOKIE = "mstudo_branch";

/**
 * Chi nhánh của studio, đã sắp thứ tự. Cache theo request nên nhiều màn trong
 * cùng một lần render chỉ tốn MỘT truy vấn.
 *
 * Bảng chưa tồn tại (chưa chạy migration studio_branches.sql) → trả [] và mọi
 * màn hoạt động như studio một cơ sở. Đây là hành vi CỐ Ý: tính năng chi nhánh
 * không được phép làm hỏng app của studio chưa chạy migration.
 */
export const getBranches = cache(async (ownerId: string): Promise<StudioBranch[]> => {
  const { data } = await createClient()
    .from("studio_branches")
    .select("*")
    .eq("owner_id", ownerId)
    .order("position");
  return sortBranches((data ?? []) as StudioBranch[]);
});

/** Chỉ những chi nhánh còn hoạt động — dùng cho ô CHỌN khi gán dữ liệu mới. */
export async function getActiveBranches(ownerId: string): Promise<StudioBranch[]> {
  return (await getBranches(ownerId)).filter((b) => b.active);
}

export type BranchScope = {
  /** Danh sách để vẽ ô chọn. */
  branches: StudioBranch[];
  /** null = xem gộp · "none" = chưa gán · id = một cơ sở. */
  selected: string | null;
  /** Studio này có dùng chi nhánh không — false thì đừng hiện gì thêm. */
  enabled: boolean;
};

/**
 * Phạm vi chi nhánh cho lần render này.
 *
 * `staffBranchId` là chi nhánh của tài khoản ĐANG ĐĂNG NHẬP (profiles
 * .studio_branch_id). Khi nhân viên chưa tự chọn gì, phạm vi mặc định là chi
 * nhánh của họ — mở app ra thấy ngay việc ở cơ sở mình. Đây là MẶC ĐỊNH, không
 * phải hàng rào quyền: họ vẫn chuyển sang "Tất cả chi nhánh" được. Muốn khoá
 * cứng thì phải chặn ở từng truy vấn, và đó là một quyết định về phân quyền —
 * không nên lẫn vào một bộ lọc hiển thị.
 */
export async function getBranchScope(ownerId: string, staffBranchId?: string | null): Promise<BranchScope> {
  const branches = await getBranches(ownerId);
  if (branches.length === 0) return { branches, selected: null, enabled: false };

  const raw = cookies().get(BRANCH_COOKIE)?.value ?? null;
  const fromCookie = normalizeBranch(raw, branches as BranchRow[]);
  // Chưa có cookie (hoặc cookie không còn hợp lệ) → lùi về chi nhánh của chính
  // người đang đăng nhập, nếu họ được gán một cơ sở.
  const selected = raw ? fromCookie : normalizeBranch(staffBranchId ?? null, branches as BranchRow[]);
  return { branches, selected, enabled: true };
}

/* ── Áp phạm vi vào truy vấn ──────────────────────────────────────────────── */

/**
 * Thêm điều kiện chi nhánh vào một truy vấn Supabase.
 *   null   → không thêm gì (xem gộp)
 *   "none" → branch_id IS NULL (chỉ phần chưa gán)
 *   id     → branch_id = id
 *
 * Dùng ở MỌI màn lọc theo chi nhánh, để "chưa gán" không bị viết thành
 * `.eq("branch_id", "none")` ở một chỗ nào đó rồi trả về màn hình trống.
 *
 * `Q` không mang ràng buộc và phần gọi `.eq/.is` đi qua một ép kiểu hẹp: kiểu
 * builder của postgrest tự tham chiếu rất sâu, ràng buộc `Q extends { eq(): Q }`
 * làm tsc bung "Type instantiation is excessively deep". Ép ở đây an toàn vì cả
 * hai phương thức đều có trên MỌI builder của postgrest, và kiểu TRẢ VỀ vẫn
 * đúng `Q` nên chỗ gọi vẫn nối được `.order()`, `.limit()` như thường.
 */
export function applyBranch<Q>(q: Q, selected: string | null, column = "branch_id"): Q {
  const f = branchFilter(selected);
  if (f.kind === "all") return q;
  const b = q as unknown as { eq(c: string, v: unknown): Q; is(c: string, v: unknown): Q };
  return f.kind === "null" ? b.is(column, null) : b.eq(column, f.id);
}
