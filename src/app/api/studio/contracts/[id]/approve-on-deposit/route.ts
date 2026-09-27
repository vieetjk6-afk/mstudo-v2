import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveOnDeposit } from "@/lib/contract-approve";

export const dynamic = "force-dynamic";

/**
 * Màn hợp đồng vừa ghi một khoản thu (bấm "Đánh dấu thu" / "Thêm & đã thu")
 * → chốt hợp đồng nếu nó còn nháp / chờ khách duyệt. Màn đó ghi tiền thẳng từ
 * trình duyệt, còn việc chốt kéo theo Drive + Google Lịch nên phải ở máy chủ.
 *
 * Chỉ chốt khi hợp đồng THẬT SỰ đã có tiền (tổng lần thu > 0): gọi route này
 * không kèm khoản thu nào thì không đổi gì.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const profile = await requireStudio("booking");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data: c } = await db.from("studio_contracts").select("id, owner_id").eq("id", id).maybeSingle();
  if (!c || c.owner_id !== profile.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: pays } = await db.from("contract_payments").select("amount").eq("contract_id", id);
  const collected = ((pays ?? []) as { amount: number }[]).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  if (collected <= 0) return NextResponse.json({ ok: true, approved: false });

  const approved = await approveOnDeposit(db, profile.id, id);
  return NextResponse.json({ ok: true, approved });
}
