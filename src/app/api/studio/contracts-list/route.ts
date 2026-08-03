import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { autoAdvanceContracts } from "@/lib/contract-status";

export const dynamic = "force-dynamic";

/**
 * Danh sách hợp đồng cho web app (phiên đăng nhập) — để trang "Quản lý HĐ" tải
 * client-side + cache trên máy (stale-while-revalidate), hiển thị tức thì.
 * Cùng truy vấn với bản SSR cũ trong contracts/page.tsx.
 */
export async function GET() {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Tới ngày sớm nhất của HĐ (kể cả ngày đãi trước) thì tự chuyển sang "đang
  // thực hiện" ngay khi mở trang. Dùng admin client (scoped theo owner) để chạy
  // được cả với tài khoản nhân viên; lỗi ở bước này không được làm hỏng danh sách.
  try {
    await autoAdvanceContracts(createAdminClient(), profile.id);
  } catch {
    /* best-effort — cron hằng ngày vẫn xử lý */
  }

  const supabase = createClient();
  let q = supabase
    .from("studio_contracts")
    .select("id, code, title, client_name, client_phone, event_date, event_time, status, shoot_type, contract_items(qty, unit_price, name), contract_payments(amount), contract_crew(id, name, role, status)")
    .eq("owner_id", profile.id);
  if (profile.actingRole === "staff") q = q.eq("assigned_to", profile.actingUserId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: data ?? [] });
}
