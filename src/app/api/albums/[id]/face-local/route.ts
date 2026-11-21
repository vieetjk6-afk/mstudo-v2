import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";
import { faceServerScanEnabled } from "@/lib/plans";
import { THAN_TOI_DA } from "@/lib/face-scan-core";
import { revalidateAlbumData } from "@/lib/album-data-cache";
import { gomNeuCan, layViecQuet, nhanKetQuaGom, nhanLoKetQua, THAN_GOM_TOI_DA } from "@/lib/face-local-server";

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
 *   POST {gom}     → gom nhóm TRÊN MÁY CHỦ (đường cũ; album lớn dễ quá giờ)
 *   POST {luuGom}  → nhận kết quả gom máy studio đã tính, kiểm rồi ghi
 *
 * KHÔNG nhập @/lib/face-node / face-scan-server: route này không được kéo theo
 * TensorFlow (desktop/test/face-local.mjs canh điều đó). Luật nằm ở
 * @/lib/face-local-server để kiểm thử được không cần Next.
 *
 * Quyền: đọc album qua phiên đăng nhập (RLS: chủ album / admin), rồi mới dùng
 * khoá dịch vụ. Album id chỉ lấy từ URL; mọi photoId trong lô đều bị đối chiếu
 * với album đó — client xấu chỉ làm bẩn được album của chính mình.
 */
/**
 * Kết quả kiểm quyền + gói đã ĐẠT, nhớ trong máy chủ theo (người, album).
 *
 * Vòng quét gọi route này mỗi mẻ 20 ảnh — album 1.500 ảnh là ~100 lượt, mỗi lượt
 * ba câu đọc (album qua RLS, chủ album, gói) chỉ để trả lại đúng một câu trả lời.
 * Chỉ nhớ lượt ĐẠT, 5 phút: bị thu quyền / hết gói thì chậm nhất 5 phút sau mới
 * bị chặn, và ghi vẫn chỉ vào đúng album người đó vừa được phép.
 * Đăng nhập (requireUser) vẫn kiểm MỌI lượt.
 */
const DA_QUA_CUA = new Map<string, number>();
const NHO_CUA_MS = 5 * 60_000;

async function vaoCua(albumId: string): Promise<{ loi: NextResponse } | { db: ReturnType<typeof createAdminClient>; userId: string }> {
  const user = await requireUser();
  if (!user) return { loi: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const khoa = `${user.id}:${albumId}`;
  const luc = DA_QUA_CUA.get(khoa);
  if (luc && Date.now() - luc < NHO_CUA_MS) return { db: createAdminClient(), userId: user.id };
  const supabase = await createClient();
  const { data } = await supabase.from("albums").select("id").eq("id", albumId).maybeSingle();
  if (!data) return { loi: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: al } = await db.from("albums").select("owner_id").eq("id", albumId).maybeSingle();
  if (!(await chuAlbumDuocTimMat(db, al?.owner_id))) {
    return { loi: NextResponse.json({ ok: false, error: "goi_khong_co_tinh_nang" }, { status: 403 }) };
  }
  if (DA_QUA_CUA.size > 2000) DA_QUA_CUA.clear();
  DA_QUA_CUA.set(khoa, Date.now());
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
  const q = new URL(req.url).searchParams;
  const soTrang = Number(q.get("so") ?? 0);
  // gom=ngay: studio bấm quét tay — bỏ luật "gom lại nhiều nhất 12 giờ một lần".
  const gomNgay = q.get("gom") === "ngay";
  try {
    return NextResponse.json({ ok: true, mayChuQuet: faceServerScanEnabled(), ...(await layViecQuet(cua.db, id, soTrang, gomNgay)) });
  } catch (e) {
    return loiJson(e);
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const cua = await vaoCua(id);
  if ("loi" in cua) return cua.loi;
  if (!rateLimit(`face-local-post:${cua.userId}`, 240, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Chặn theo Content-Length TRƯỚC khi đọc, rồi kiểm lại độ dài thật. Kết quả
  // gom ({luuGom}: danh sách ảnh của từng người) lớn hơn một lô quét nên có trần riêng.
  const tran = Math.max(THAN_TOI_DA, THAN_GOM_TOI_DA);
  if (Number(req.headers.get("content-length") ?? 0) > tran) return NextResponse.json({ ok: false, error: "than_qua_lon" }, { status: 413 });
  let body: { ketQua?: unknown; gom?: unknown; luuGom?: unknown };
  try {
    const text = await req.text();
    if (text.length > tran) return NextResponse.json({ ok: false, error: "than_qua_lon" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    if (body?.gom === true) return NextResponse.json({ ok: true, ...(await gomNeuCan(cua.db, id)) });
    if (body?.luuGom !== undefined) {
      const g = await nhanKetQuaGom(cua.db, id, body.luuGom);
      if (g.ok) revalidateAlbumData(id);
      return NextResponse.json(g, { status: g.ok ? 200 : 400 });
    }
    if (JSON.stringify(body?.ketQua ?? "").length > THAN_TOI_DA) return NextResponse.json({ ok: false, error: "than_qua_lon" }, { status: 413 });
    const r = await nhanLoKetQua(cua.db, id, body?.ketQua);
    return NextResponse.json(r, { status: r.ok ? 200 : r.error === "ghi-khong-an" ? 200 : 400 });
  } catch (e) {
    return loiJson(e);
  }
}
