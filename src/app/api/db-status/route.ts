import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maDuAn } from "@/lib/supabase-du-an";
import { docBanKe, soiDatabase } from "@/lib/db-thieu";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * DATABASE ĐANG CHẠY CÒN THIẾU MIGRATION NÀO?
 *
 * Suốt một tuần, mọi migration được dán vào SQL Editor của một project KHÁC với
 * project app đang dùng. Supabase báo Success từng lần, app thì thiếu bảng, và
 * không ai biết database thật đang thiếu những gì — vì ngoài app ra không có gì
 * đọc được nó. Route này trả lời bằng danh sách chính xác.
 *
 * Phần đo nằm ở @/lib/db-thieu, dùng chung với /api/setup-sql/bu-thieu — file
 * dán vào phải khớp đúng cái báo cáo này nói là thiếu.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ke;
  try {
    ke = await docBanKe();
  } catch (e) {
    return NextResponse.json(
      { error: "thieu_ban_ke", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  const muc = await soiDatabase(createAdminClient(), ke);
  const chuaChay = muc.filter((m) => !m.ok);

  return NextResponse.json({
    duAn: maDuAn(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ok: chuaChay.length === 0,
    daKiem: { migration: ke.muc.length },
    thieu: chuaChay.length,
    canChay: chuaChay.map((m) => m.file),
    muc,
    viecPhaiLam:
      chuaChay.length === 0
        ? "Không thiếu gì. Database đang chạy đã có đủ mọi bảng và cột của repo."
        : "Mở /api/setup-sql/bu-thieu để lấy file SQL dựng riêng cho database này, dán vào SQL Editor của ĐÚNG project ở trên rồi Run.",
  });
}
