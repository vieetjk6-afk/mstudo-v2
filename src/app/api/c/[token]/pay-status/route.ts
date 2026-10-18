import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * POST { phone } → các lần thu + trạng thái đợt của hợp đồng (cổng khách).
 *
 * Trang hợp đồng hỏi định kỳ khi khách đang chuyển khoản, để tiền về là hiện
 * màn "Đã nhận cọc". Tách khỏi /api/c/[token] có chủ đích:
 *   · giới hạn tần suất RIÊNG — hỏi định kỳ không được ăn vào hạn mức của ký,
 *     gửi yêu cầu sửa… (hai tab cùng một wifi là đủ chạm 20 lần/phút);
 *   · chỉ 3 câu đọc nhỏ, không kéo cả hợp đồng / thương hiệu / album.
 * Vẫn khoá bằng SĐT khách như cổng chính.
 */
export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const rl = await limitByIpDurable(req, `c-pay:${token}`, 40, 60_000, { failClosed: true });
  if (rl) return rl;
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const db = createAdminClient();
  const { data: c } = await db.from("studio_contracts").select("id, client_phone").eq("client_token", token).maybeSingle();
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!c.client_phone || digits(body.phone) !== digits(c.client_phone)) {
    return NextResponse.json({ error: "wrong_phone" }, { status: 401 });
  }
  const planQ = (cols: string) => db.from("contract_payment_plan").select(cols).eq("contract_id", c.id);
  const [{ data: payments }, planR] = await Promise.all([
    db.from("contract_payments").select("id, amount, kind, paid_at").eq("contract_id", c.id),
    planQ("id, label, paid, paid_at, payment_id"),
  ]);
  // payment_id là cột mới hơn — DB chưa có thì vẫn trả đợt (chỉ không khớp được tên đợt).
  const plan = planR.error ? (await planQ("id, label, paid, paid_at")).data : planR.data;
  return NextResponse.json({ payments: payments ?? [], plan: plan ?? [] });
}
