import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";
import { albumChoQuetCuaChu } from "@/lib/face-local-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * HÀNG ĐỢI BỘ TỰ QUÉT KHUÔN MẶT NỀN (@/components/v2/FaceAutoScan).
 *
 *   GET → { ok, albums: [{ id, ten, conLai }] }   album CỦA CHÍNH người gọi còn ảnh chưa quét
 *
 * Chỉ album do người gọi sở hữu (owner_id = user.id) — nhân viên studio không
 * có album riêng nên luôn nhận danh sách rỗng. Gói không có tìm theo khuôn mặt
 * → { ok:false, error:"goi_khong_co_tinh_nang" } để máy khỏi hỏi lại.
 * Mỗi album rồi vẫn đi qua /api/albums/[id]/face-local (kiểm quyền từng album).
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`face-hang-doi:${user.id}`, 20, 60_000)) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const db = createAdminClient();
  if (!(await chuAlbumDuocTimMat(db, user.id))) return NextResponse.json({ ok: false, error: "goi_khong_co_tinh_nang" });
  try {
    return NextResponse.json({ ok: true, albums: await albumChoQuetCuaChu(db, user.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const thieuBang = /faces_scanned_at|does not exist|schema cache/i.test(msg);
    return NextResponse.json({ ok: false, error: thieuBang ? "thieu_bang" : "loi_may_chu" }, { status: thieuBang ? 200 : 500 });
  }
}
