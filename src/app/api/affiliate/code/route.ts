import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET — return or create the calling user's affiliate code */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const prefix = (user.email || "user").split("@")[0];

  // Atomic: RPC khoá hàng theo user, trả mã đã có hoặc tạo mã mới (tự retry khi
  // trùng mã ngẫu nhiên). Chống race "tạo hai mã cho một user" và mã ma (insert
  // lỗi bị nuốt) của bản cũ.
  const { data, error } = await db.rpc("get_or_create_affiliate_code", {
    p_user_id: user.id,
    p_prefix: prefix,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) return NextResponse.json({ error: "alloc_failed" }, { status: 500 });
  return NextResponse.json({ code: row.code, active: row.active });
}
