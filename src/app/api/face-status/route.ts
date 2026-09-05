import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkSqlEditor, maDuAn } from "@/lib/supabase-du-an";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "TÌM ẢNH THEO KHUÔN MẶT ĐANG TẮC Ở ĐÂU?" — trả lời bằng SỐ, không cần tham số.
 *
 * Đã có /api/albums/<id>/face-scan làm việc tương tự cho MỘT album, nhưng nó đòi
 * dán id album vào URL — và đúng chỗ đó đã hỏng trong thực tế: studio dán nguyên
 * chữ `<id>` rồi báo "không được". Một đường dẫn không có gì phải thay thì không
 * hỏng theo kiểu ấy được.
 *
 * Route này trả về đủ mọi mắt xích, theo đúng thứ tự chúng có thể đứt:
 *
 *   1. `bang`    — ba thứ SQL phải tạo. Thiếu là chưa chạy supabase/khuon-mat.sql.
 *   2. `cronSecret` — thiếu thì cron Vercel bị chính app trả 401 và KHÔNG BAO GIỜ
 *      quét. Đây là mắt xích vô hình nhất: mọi thứ khác đúng mà vẫn không có mặt nào.
 *   3. `albums`  — từng album: đã phát hành chưa, bao nhiêu ảnh, còn bao nhiêu
 *      chưa quét, tìm được bao nhiêu khuôn mặt, gom thành bao nhiêu người.
 */

/** Số album gần nhất được soi. Đây là màn chẩn đoán, không phải báo cáo. */
const SO_ALBUM = 10;

async function coBang(db: ReturnType<typeof createAdminClient>, bang: string): Promise<boolean> {
  const { error } = await db.from(bang).select("*").limit(1);
  if (!error) return true;
  const code = (error as { code?: string }).code ?? "";
  return !(code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? ""));
}

async function coCot(
  db: ReturnType<typeof createAdminClient>,
  bang: string,
  cot: string
): Promise<boolean> {
  const { error } = await db.from(bang).select(cot).limit(1);
  return !error;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const [album_people, album_faces, faces_scanned_at, faces_clustered_at] = await Promise.all([
    coBang(db, "album_people"),
    coBang(db, "album_faces"),
    coCot(db, "photos", "faces_scanned_at"),
    coCot(db, "albums", "faces_clustered_at"),
  ]);
  const bang = { album_people, album_faces, faces_scanned_at, faces_clustered_at };
  const thieu = Object.entries(bang)
    .filter(([, co]) => !co)
    .map(([ten]) => ten);

  const duAn = maDuAn(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const out: Record<string, unknown> = {
    ok: thieu.length === 0,
    bang,
    thieu,
    /*
     * Project mà app này ĐANG THẬT SỰ nói chuyện.
     *
     * Đây là câu trả lời cho kiểu hỏng khó chịu nhất: chạy SQL trong tab project
     * CŨ thì Supabase báo "Success" đàng hoàng, mà app vẫn không thấy bảng nào.
     * Không lộ khoá, chỉ lộ mã project — thứ vốn nằm sẵn trong URL công khai mà
     * mọi trình duyệt đều thấy.
     */
    duAn,
    sqlEditor: linkSqlEditor(process.env.NEXT_PUBLIC_SUPABASE_URL),
    // Không lộ giá trị, chỉ lộ CÓ hay KHÔNG — biết là đủ để sửa.
    cronSecret: !!process.env.CRON_SECRET,
    quetBiTat: process.env.FACE_SCAN_OFF === "1",
  };
  if (thieu.length > 0) {
    out.viecPhaiLam =
      `Chạy supabase/khuon-mat.sql trong SQL Editor của ĐÚNG project ${duAn ?? "(không đọc được mã)"}` +
      " — mở /api/setup-sql/khuon-mat để lấy nội dung. Chạy nhầm project thì Supabase vẫn báo Success mà app không thấy bảng nào.";
    return NextResponse.json(out);
  }
  if (!out.cronSecret) {
    out.viecPhaiLam =
      "Thiếu biến môi trường CRON_SECRET trên Vercel — app tự trả 401 cho cron, nên không album nào được quét. Đặt biến rồi Redeploy.";
  }

  // Album của CHÍNH studio này. Dùng khoá dịch vụ nên phải tự lọc theo chủ sở
  // hữu — không có RLS che cho ở đây.
  const { data: albums } = await db
    .from("albums")
    .select("id, title, slug, status, phase, faces_clustered_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(SO_ALBUM);
  const ids = ((albums ?? []) as { id: string }[]).map((a) => a.id);

  const dem = (rows: { album_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.album_id, (m.get(r.album_id) ?? 0) + 1);
    return m;
  };
  const [photos, faces, people] = ids.length
    ? await Promise.all([
        db.from("photos").select("album_id, faces_scanned_at, is_video").in("album_id", ids),
        db.from("album_faces").select("album_id").in("album_id", ids),
        db.from("album_people").select("album_id").in("album_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const anhRows = (photos.data ?? []) as { album_id: string; faces_scanned_at: string | null; is_video: boolean | null }[];
  const tongAnh = dem(anhRows);
  const chuaQuet = dem(anhRows.filter((p) => !p.is_video && !p.faces_scanned_at));
  const soMat = dem((faces.data ?? []) as { album_id: string }[]);
  const soNguoi = dem((people.data ?? []) as { album_id: string }[]);

  out.albums = ((albums ?? []) as Record<string, string | null>[]).map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    status: a.status,
    // Cron CHỈ nhặt album đã phát hành. Nói thẳng ra để studio không phải đoán.
    seDuocQuet: a.status === "published",
    anh: tongAnh.get(a.id as string) ?? 0,
    chuaQuet: chuaQuet.get(a.id as string) ?? 0,
    khuonMat: soMat.get(a.id as string) ?? 0,
    nguoi: soNguoi.get(a.id as string) ?? 0,
    daGomLuc: a.faces_clustered_at,
  }));
  return NextResponse.json(out);
}
