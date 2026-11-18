import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";
import { faceServerScanEnabled } from "@/lib/plans";
import { THAN_TOI_DA } from "@/lib/face-scan-core";
import { gomNeuCan, layViecQuet, nhanLoKetQua } from "@/lib/face-local-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 300 giây: lượt GOM của album cưới lớn (vài chục nghìn khuôn mặt) cần đọc hết
// vector rồi so từng cặp — 60 giây thì bị cắt ngang giữa chừng và album không
// bao giờ có "người" nào cho khách tìm. Lượt giao việc / nhận kết quả vẫn xong
// trong vài trăm mili-giây; con số này chỉ là trần.
export const maxDuration = 300;

/**
 * QUÉT KHUÔN MẶT TRÊN MÁY STUDIO — phía máy chủ chỉ GIAO VIỆC và NHẬN KẾT QUẢ.
 *
 *   GET            → tiến độ + một trang ảnh còn phải quét (id, drive_file_id, name)
 *   POST {ketQua}  → nhận một lô kết quả, ghi album_faces + mốc photos
 *   POST {gom}     → gom nhóm (phép tính vector thuần) khi cần
 *
 * KHÔNG nhập @/lib/face-node / face-scan-server: route này không được kéo theo
 * TensorFlow (desktop/test/face-local.mjs canh điều đó). Luật nằm ở
 * @/lib/face-local-server để kiểm thử được không cần Next.
 *
 * Quyền: đọc album qua phiên đăng nhập (RLS: chủ album / admin), rồi mới dùng
 * khoá dịch vụ. Album id chỉ lấy từ URL; mọi photoId trong lô đều bị đối chiếu
 * với album đó — client xấu chỉ làm bẩn được album của chính mình.
 */
async function vaoCua(albumId: string): Promise<{ loi: NextResponse } | { db: ReturnType<typeof createAdminClient>; userId: string }> {
  const supabase = await createClient();
  const user = await requireUser();
  if (!user) return { loi: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data } = await supabase.from("albums").select("id").eq("id", albumId).maybeSingle();
  if (!data) return { loi: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: al } = await db.from("albums").select("owner_id").eq("id", albumId).maybeSingle();
  if (!(await chuAlbumDuocTimMat(db, al?.owner_id))) {
    return { loi: NextResponse.json({ ok: false, error: "goi_khong_co_tinh_nang" }, { status: 403 }) };
  }
  return { db, userId: user.id };
}

const loiJson = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  const thieuBang = /album_faces|album_people|faces_scanned_at|faces_clustered_at|does not exist|schema cache/i.test(msg);
  return NextResponse.json({ ok: false, error: thieuBang ? "thieu_bang" : "loi_may_chu", detail: msg.slice(0, 300) }, { status: 500 });
};

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const cua = await vaoCua(id);
  if ("loi" in cua) return cua.loi;
  // 120 lượt/phút: vòng quét hỏi một trang mỗi ~20 ảnh, thừa cho máy nhanh nhất.
  if (!rateLimit(`face-local-get:${cua.userId}`, 120, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const soTrang = Number(new URL(req.url).searchParams.get("so") ?? 0);
  try {
    return NextResponse.json({ ok: true, mayChuQuet: faceServerScanEnabled(), ...(await layViecQuet(cua.db, id, soTrang)) });
  } catch (e) {
    return loiJson(e);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const cua = await vaoCua(id);
  if ("loi" in cua) return cua.loi;
  if (!rateLimit(`face-local-post:${cua.userId}`, 240, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Chặn theo Content-Length TRƯỚC khi đọc, rồi kiểm lại độ dài thật.
  if (Number(req.headers.get("content-length") ?? 0) > THAN_TOI_DA) return NextResponse.json({ ok: false, error: "than_qua_lon" }, { status: 413 });
  let body: { ketQua?: unknown; gom?: unknown };
  try {
    const text = await req.text();
    if (text.length > THAN_TOI_DA) return NextResponse.json({ ok: false, error: "than_qua_lon" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    if (body?.gom === true) return NextResponse.json({ ok: true, ...(await gomNeuCan(cua.db, id)) });
    const r = await nhanLoKetQua(cua.db, id, body?.ketQua);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "ghi-khong-an" ? 200 : 400 });
  } catch (e) {
    return loiJson(e);
  }
}
