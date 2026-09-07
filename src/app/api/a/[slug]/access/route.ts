import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { limitByIpDurable } from "@/lib/rate-limit";
import { pickFolderLinks } from "@/lib/album-original";
import { faceChips } from "@/lib/face-people";
import { tienDoQuet } from "@/lib/face-pending";
import { effectivePlan, planAllowsFaceSearch, type Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Verify an album password (if any) and return the photo list.
 * Public endpoint — uses the service role to read a published album, but only
 * returns photos when the password check passes.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // H7: chặn dò mật khẩu album (giới hạn theo IP + slug).
  const limited = await limitByIpDurable(req, `album-pw:${params.slug}`, 10, 60_000, { failClosed: true });
  if (limited) return limited;

  const { password } = (await req.json().catch(() => ({}))) as {
    password?: string;
  };
  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, status, password_hash, download_enabled")
    .eq("slug", params.slug)
    .single();

  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (album.password_hash) {
    const ok = password
      ? await bcrypt.compare(password, album.password_hash)
      : false;
    if (!ok) {
      return NextResponse.json({ error: "wrong_password" }, { status: 401 });
    }
  }

  const photos = await fetchAllPhotos(admin, album.id, "id, drive_file_id, name, source_id, position");

  const { data: sources } = await admin
    .from("album_sources")
    .select("id, name, position, stage, drive_url, kind")
    .eq("album_id", album.id)
    .order("position");

  // Link thư mục Drive — chỉ trả về khi studio cho phép khách tải, vì link mở ra
  // CẢ album. Cùng quy tắc quyền với src/app/a/[slug]/page.tsx.
  const { data: owner } = await admin
    .from("profiles")
    .select("role, can_zip, plan, plan_expires_at")
    .eq("id", album.owner_id)
    .maybeSingle();
  const allowDownload =
    (owner?.role === "admin" || !!owner?.can_zip) && album.download_enabled !== false;
  // Tìm ảnh theo khuôn mặt: chỉ Photographer Plus & Studio. Phải chốt ở ĐÂY nữa,
  // không chỉ ở trang: album CÓ MẬT KHẨU nhận toàn bộ khuôn mặt qua route này,
  // nên bỏ sót chỗ này là để ngỏ đúng những album mà trang chưa gửi gì.
  const canFaceSearch = planAllowsFaceSearch(
    effectivePlan(owner?.plan as Plan, owner?.plan_expires_at),
    owner?.role === "admin",
  );
  const driveFolders = allowDownload
    ? pickFolderLinks((sources ?? []).filter((x) => x.stage !== "delivery"))
    : [];

  const [{ data: sel }, { data: dis }, { data: ppl }, { data: pplLinks }] = await Promise.all([
    admin.from("selections").select("photo_id, client_note").eq("album_id", album.id),
    admin.from("dislikes").select("photo_id, client_note").eq("album_id", album.id),
    // Nhóm người studio đã lưu — cùng dữ liệu mà trang không mật khẩu dựng sẵn
    // ở src/app/a/[slug]/page.tsx. Chưa chạy migration thì `data` là null và
    // album vẫn chạy bình thường, chỉ không có hàng chip.
    admin
    // `select("*")` CÓ CHỦ Ý, không phải lười liệt kê cột: `cover_box` là cột
    // THÊM SAU. Liệt kê tên nó ra thì trên một database chưa chạy lại
    // migration, cả câu này lỗi và khối tìm theo khuôn mặt BIẾN MẤT HẲN — thay
    // vì chỉ mất phần ảnh mặt cắt sẵn. Lấy `*` thì cột thiếu chỉ là undefined,
    // và faceChips tự lùi về lấy cả tấm làm ảnh thẻ.
      .from("album_people")
      .select("*")
      .eq("album_id", album.id)
      .order("position"),
    admin.from("album_photo_people").select("person_id, photo_id").eq("album_id", album.id),
  ]);
  const selected = (sel ?? []).map((s) => s.photo_id);
  const disliked = (dis ?? []).map((d) => d.photo_id);
  const notes: Record<string, string> = {};
  for (const s of sel ?? []) if (s.client_note) notes[s.photo_id] = s.client_note;
  for (const d of dis ?? []) if (d.client_note) notes[d.photo_id] = d.client_note;

  const people = canFaceSearch
    ? faceChips(ppl ?? [], pplLinks ?? [], new Set((photos ?? []).map((p) => p.id)))
    : [];

  return NextResponse.json({
    photos: photos ?? [],
    sources: (sources ?? []).map(({ id, name, position }) => ({ id, name, position })),
    driveFolders,
    selected,
    disliked,
    notes,
    people,
    // Chưa có mặt nào: phân biệt "máy chủ đang quét tới đâu" với "quét rồi mà
    // album không có mặt người" — hai câu trả lời rất khác nhau cho khách.
    faceScan: canFaceSearch && people.length === 0 ? await tienDoQuet(admin, album.id) : null,
  });
}
