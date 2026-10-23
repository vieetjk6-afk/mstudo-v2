import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { phanLoaiLoi } from "@/lib/pg-loi";
import { normalizePlan, planToRow, syncInviteReplies, weddingGiftCombo, type InviteReply } from "@/lib/wedding-plan";

/**
 * Đọc / ghi bảng `wedding_plans` phía máy chủ — dùng chung cho trang kế hoạch
 * cưới của khách (/api/c/[token]/ke-hoach) và form xác nhận tham dự trên thiệp
 * (/api/thiep/rsvp, chế độ Quà cưới). Luật nằm ở @/lib/wedding-plan.
 */

type Db = ReturnType<typeof createAdminClient>;

export type PlanRow = {
  id: string;
  wedding_date: string | null;
  budget_total: number;
  tasks: unknown;
  budget: unknown;
  day_plan: unknown;
  extra?: unknown;
  rev: number;
  updated_at: string;
};
export const PLAN_BASE_COLS = "id, wedding_date, budget_total, tasks, budget, day_plan, rev, updated_at";

/**
 * Đọc kế hoạch của hợp đồng. Thử kèm cột `extra` trước; database chưa chạy
 * migrations/ke_hoach_cuoi_mo_rong.sql thì đọc lại phần gốc và báo `ext: false`
 * — ba danh sách gốc vẫn dùng được, chỉ các mục mới tạm ẩn.
 */
export async function readPlan(db: Db, contractId: string, ext: boolean | null) {
  if (ext !== false) {
    const full = await db.from("wedding_plans").select(`${PLAN_BASE_COLS}, extra`).eq("contract_id", contractId).maybeSingle();
    if (!full.error) return { row: full.data as PlanRow | null, ext: true, error: null };
    if (phanLoaiLoi(full.error) !== "thieu-cot") return { row: null, ext: true, error: full.error };
  }
  const base = await db.from("wedding_plans").select(PLAN_BASE_COLS).eq("contract_id", contractId).maybeSingle();
  return { row: base.data as PlanRow | null, ext: false, error: base.error };
}

/**
 * CHẾ ĐỘ QUÀ CƯỚI: ghi những phản hồi mới gửi qua thiệp vào danh sách khách của
 * kế hoạch (`syncInviteReplies`), rồi trả dòng kế hoạch sau khi ghi.
 *
 * Gọi ở hai chỗ: ngay khi khách bấm xác nhận trên thiệp, và mỗi lần cặp đôi mở
 * kế hoạch (vớt lại phản hồi lỡ — vd. lúc đó máy chủ trục trặc). Ghi kèm điều
 * kiện `rev` như mọi lượt ghi kế hoạch: cô dâu đang sửa cùng lúc thì đọc lại bản
 * mới rồi áp lại. Hỏng ở đâu cũng chỉ trả nguyên dòng cũ — phản hồi vẫn nằm
 * trong `wedding_rsvps`, lượt sau sẽ ghi.
 *
 * `row` phải đọc kèm cột `extra` (danh sách khách nằm trong đó).
 */
export async function syncPlanReplies(db: Db, row: PlanRow, invitationId: string, contractId: string): Promise<PlanRow> {
  let cur = row;
  for (let attempt = 0; attempt < 3; attempt++) {
    const plan = normalizePlan(cur);
    let q = db
      .from("wedding_rsvps")
      .select("guest_name, attending, num_guests, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at")
      .limit(2000);
    if (plan.invite_seen) q = q.gt("created_at", plan.invite_seen);
    const { data, error } = await q;
    if (error || !data?.length) return cur;
    const r = syncInviteReplies(plan, data as InviteReply[]);
    if (!r.changed) return cur;
    const { data: saved, error: saveErr } = await db
      .from("wedding_plans")
      .update({ ...planToRow(r.plan, true), rev: cur.rev + 1 })
      .eq("id", cur.id)
      .eq("rev", cur.rev)
      .select(`${PLAN_BASE_COLS}, extra`);
    if (saveErr) return cur;
    const s = ((saved ?? []) as unknown as PlanRow[])[0];
    if (s) return s;
    // Trượt `rev` (cặp đôi vừa ghi) → đọc bản mới rồi thử lại.
    const again = await readPlan(db, contractId, true);
    if (!again.row || !again.ext) return cur;
    cur = again.row;
  }
  return cur;
}

/**
 * Khách vừa xác nhận trên thiệp → nếu thiệp thuộc một hợp đồng ở chế độ Quà
 * cưới thì ghi ngay vào danh sách khách của kế hoạch. Không phải chế độ đó,
 * chưa có kế hoạch, database chưa có cột `extra` → không làm gì.
 */
export async function syncRepliesForInvitation(db: Db, inv: { id: string; owner_id: string; contract_id: string | null }): Promise<void> {
  if (!inv.contract_id) return;
  const { data: owner } = await db.from("profiles").select("role").eq("id", inv.owner_id).maybeSingle();
  if (!weddingGiftCombo((owner as { role?: string | null } | null)?.role)) return;
  const read = await readPlan(db, inv.contract_id, null);
  if (read.error || !read.ext || !read.row) return;
  await syncPlanReplies(db, read.row, inv.id, inv.contract_id);
}
