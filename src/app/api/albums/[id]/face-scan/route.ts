import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clusterAlbum, hanQuetMs, pendingRows, scanAlbum, type ScanRow } from "@/lib/face-scan-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Xem ghi chú ở /api/cron/face-scan: 300 là trần gói Pro, Hobby cắt ở 60.
export const maxDuration = 60;

/**
 * TÌNH TRẠNG QUÉT KHUÔN MẶT CỦA MỘT ALBUM — và nút chạy ngay.
 *
 * Studio KHÔNG phải dùng route này để tính năng hoạt động: cron
 * /api/cron/face-scan lo hết. Nó tồn tại vì một lý do khác, đã trả giá mấy vòng
 * mới học được: khi khách nói "tôi không thấy tìm khuôn mặt", không có cách nào
 * biết đang tắc ở đâu — chưa chạy SQL? chưa phát hành album? cron chưa tới? hay
 * quét rồi mà không thấy mặt nào? GET ở đây trả lời đúng câu đó bằng số.
 *
 * Quyền: đọc album qua phiên đăng nhập (RLS chỉ cho chủ album / admin thấy).
 * Sau khi đã qua cửa đó mới dùng khoá dịch vụ để đọc/ghi bảng khuôn mặt.
 */
async function ownsAlbum(albumId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("albums").select("id").eq("id", albumId).maybeSingle();
  return !!data;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await ownsAlbum(params.id))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();

  /*
   * `?chay=1` — QUÉT NGAY, không đợi cron.
   *
   * Cùng việc với POST, nhưng gọi được bằng cách dán URL vào trình duyệt. Đó
   * không phải chuyện tiện tay: khi cron im lặng không chạy, cách duy nhất để
   * biết là do LỊCH CRON hay do BỘ QUÉT là chạy tay đúng đường code đó và đọc
   * câu lỗi. Mà chủ studio thì không POST được từ thanh địa chỉ.
   *
   * GET có tác dụng phụ là điều đáng cân nhắc; ở đây nó đáng, vì đường này chỉ
   * chủ album mở được và thứ nó làm thì idempotent (quét lại ảnh đã quét là
   * không làm gì).
   */
  if (new URL(req.url).searchParams.get("chay") === "1") return POST(req, { params });

  const { data: album } = await db.from("albums").select("status, phase").eq("id", params.id).maybeSingle();
  const { data: photos, error: ePhotos } = await db
    .from("photos")
    .select("id, drive_file_id, name, is_video, faces_scanned_at")
    .eq("album_id", params.id);
  if (ePhotos) {
    return NextResponse.json({ error: "thieu_cot_faces_scanned_at", detail: ePhotos.message, hint: SQL_HINT });
  }
  const rows = (photos ?? []) as ScanRow[];

  const { count: faces, error: eFaces } = await db
    .from("album_faces")
    .select("photo_id", { count: "exact", head: true })
    .eq("album_id", params.id);
  if (eFaces) return NextResponse.json({ error: "thieu_bang_album_faces", detail: eFaces.message, hint: SQL_HINT });

  const { count: people } = await db
    .from("album_people")
    .select("id", { count: "exact", head: true })
    .eq("album_id", params.id);

  const conLai = pendingRows(rows).length;
  return NextResponse.json({
    ok: true,
    status: album?.status ?? null,
    // Cron chỉ nhặt album đã phát hành — nói thẳng ra để studio không phải đoán.
    seCronQuet: album?.status === "published",
    anh: rows.length,
    chuaQuet: conLai,
    daQuet: rows.filter((p) => !p.is_video && !!p.faces_scanned_at).length,
    khuonMat: faces ?? 0,
    nguoi: people ?? 0,
  });
}

const SQL_HINT = "Chạy supabase/khuon-mat.sql trong Supabase SQL Editor.";

/** Quét ngay, không đợi cron. Dùng khi studio vừa thêm ảnh và muốn có liền. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await ownsAlbum(params.id))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  try {
    const r = await scanAlbum(db, params.id, { budgetMs: hanQuetMs(), maxPhotos: 400 });
    // Gom luôn khi đã quét hết — studio bấm "chạy ngay" là muốn thấy kết quả
    // ngay, không phải đợi thêm một lượt cron nữa.
    if (r.remaining === 0) r.clustered = await clusterAlbum(db, params.id);
    // `remaining` là thứ studio cần thấy: còn > 0 thì bấm lại đường dẫn này một
    // lượt nữa. Mỗi lượt ghi lại tiến độ nên không bao giờ phải làm lại từ đầu.
    return NextResponse.json({
      ok: true,
      ...r,
      conLai: r.remaining,
      lamTiep: r.remaining > 0 ? "Còn ảnh chưa quét — mở lại đúng đường dẫn này thêm một lượt." : "Xong album này.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const thieuBang = /album_faces|album_people|faces_scanned_at|does not exist|schema cache/i.test(msg);
    return NextResponse.json({ ok: false, error: msg, hint: thieuBang ? SQL_HINT : undefined });
  }
}
