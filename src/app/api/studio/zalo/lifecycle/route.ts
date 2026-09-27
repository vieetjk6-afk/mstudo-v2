import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPaymentZalo } from "@/lib/bank-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Bắn tin Zalo theo MỐC do thao tác trên web (không qua cron). Gọi sau khi
 * studio ghi một lần thu (màn hợp đồng, nút "Đã nhận" ở Tổng quan):
 *
 *  • `payment_received` — máy chủ tự xem lần thu đó làm hợp đồng đủ tiền chưa
 *    (→ "đã thanh toán đủ"), chưa đủ mà là đợt cọc (→ "đã nhận cọc").
 *  • `deposit_confirm` — tên cũ, trình duyệt còn giữ bản trước vẫn gọi được.
 *
 * autoNotify tự kiểm tra studio đã bật mốc + đã kết nối; nếu tắt thì bỏ qua.
 */
const ALLOWED = new Set(["payment_received", "deposit_confirm"]);

export async function POST(req: NextRequest) {
  const profile = await requireStudio("full");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const contractId = typeof b.contractId === "string" ? b.contractId : "";
  const event = typeof b.event === "string" ? b.event : "";
  if (!contractId || !ALLOWED.has(event)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: c } = await db.from("studio_contracts").select("id, owner_id").eq("id", contractId).maybeSingle();
  if (!c || c.owner_id !== profile.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const amount = typeof b.amount === "number" && b.amount > 0 ? b.amount : 0;
  const isDeposit = event === "deposit_confirm" || b.isDeposit === true;
  const sent = await notifyPaymentZalo(db, c.owner_id, c.id, { amount, isDeposit });
  return NextResponse.json({ ok: !!sent, sent });
}
