import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/**
 * Trạng thái duyệt của một yêu cầu nâng cấp — trang thanh toán hỏi lại vài chục
 * giây một lần để tự chuyển sang "đã nâng cấp" ngay khi admin xác nhận, thay vì
 * bắt studio tải lại trang.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db
    .from("upgrade_requests")
    .select("user_id, payment_status, review_note")
    .eq("id", id)
    .maybeSingle();
  // Không phải yêu cầu của mình thì coi như không tồn tại — id là uuid nhưng
  // đừng để lộ trạng thái đơn của studio khác.
  if (!data || data.user_id !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, status: data.payment_status, reviewNote: data.review_note ?? null });
}

/**
 * Studio bấm "Tôi đã chuyển khoản".
 *
 * Chỉ đổi sang 'awaiting_confirm' = studio BÁO đã chuyển, KHÔNG phải đã nhận.
 * Gói chỉ được nâng khi admin nhìn thấy tiền trong sao kê rồi tự xác nhận.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: row } = await db
    .from("upgrade_requests")
    .select("id, user_id, email, plan, cycle, payment_status, payment_code, payment_amount")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Đã nâng cấp xong rồi thì đừng để bấm nhầm đẩy ngược trạng thái.
  if (row.payment_status === "paid") return NextResponse.json({ error: "already_paid" }, { status: 409 });
  // Bấm lại lần nữa (kể cả sau khi admin báo chưa nhận được) là hợp lệ: studio
  // chuyển lại rồi báo lại. Chỉ cần đừng spam thông báo cho admin khi đang chờ.
  const alreadyWaiting = row.payment_status === "awaiting_confirm";

  const { error } = await db
    .from("upgrade_requests")
    .update({ payment_status: "awaiting_confirm", declared_at: new Date().toISOString(), handled: false })
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  if (!alreadyWaiting) {
    const amount = row.payment_amount ? `${row.payment_amount.toLocaleString("vi-VN")}đ` : "";
    await notifyAdmins(
      "upgrade_request",
      `${row.email || "Studio"} báo ĐÃ CHUYỂN KHOẢN ${amount} gói ${row.plan}/${row.cycle}${row.payment_code ? ` · ${row.payment_code}` : ""} — chờ xác nhận`,
      { push: true, url: "/dashboard/settings" },
    );
  }

  return NextResponse.json({ ok: true, status: "awaiting_confirm" });
}
