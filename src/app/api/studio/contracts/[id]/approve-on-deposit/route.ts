import { NextResponse } from "next/server";
import { studioFor } from "@/lib/contract-change";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveOnDeposit } from "@/lib/contract-approve";
import { canActOnContract } from "@/lib/studio-roles";

export const dynamic = "force-dynamic";

/**
 * Màn hợp đồng vừa ghi một khoản thu (bấm "Đánh dấu thu" / "Thêm & đã thu")
 * → chốt hợp đồng nếu nó còn nháp / chờ khách duyệt. Màn đó ghi tiền thẳng từ
 * trình duyệt, còn việc chốt kéo theo Drive + Google Lịch nên phải ở máy chủ.
 *
 * Chỉ chốt khi hợp đồng THẬT SỰ đã có tiền (tổng lần thu > 0): gọi route này
 * không kèm khoản thu nào thì không đổi gì.
 */
/**
 * Ngoài chủ studio/admin. Chỉ màn hợp đồng gọi route này, và màn đó chặn kế toán
 * (contracts/[id]/page.tsx) — nên kế toán không có lý do gọi; nhân viên thì được
 * vì họ ghi khoản thu trên hợp đồng được giao.
 */
const APPROVE_ROLES = ["manager", "branch_manager", "staff"] as const;

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const profile = await studioFor(APPROVE_ROLES);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: c } = await db.from("studio_contracts").select("id, owner_id, assigned_to, branch_id").eq("id", id).maybeSingle();
  // Cùng hàng rào với màn hợp đồng: nhân viên chỉ hợp đồng được giao, quản lý
  // chi nhánh chỉ chi nhánh mình.
  if (!c || c.owner_id !== profile.id || !canActOnContract(profile, c)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: pays } = await db.from("contract_payments").select("amount").eq("contract_id", id);
  const collected = ((pays ?? []) as { amount: number }[]).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (collected <= 0) return NextResponse.json({ ok: true, approved: false });

  const approved = await approveOnDeposit(db, profile.id, id);
  return NextResponse.json({ ok: true, approved });
}
