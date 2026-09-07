import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { getOriginalFolders } from "@/lib/album-original";
import { isDeliveryPhase } from "@/lib/album-phase";
import { limitByIpDurable } from "@/lib/rate-limit";
import { faceChips } from "@/lib/face-people";
import { tienDoQuet } from "@/lib/face-pending";
import { effectivePlan, planAllowsFaceSearch, type Plan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Verify a gallery's phone password and return its photos + sources. */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // H7: mật khẩu gallery thường là SỐ ĐIỆN THOẠI (entropy thấp) — chặn dò mật khẩu.
  const limited = await limitByIpDurable(req, `gallery-pw:${params.slug}`, 10, 60_000, { failClosed: true });
  if (limited) return limited;

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const admin = createAdminClient();

  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, status, is_gallery, phase, password_hash, gallery_pinned")
    .eq("slug", params.slug)
    .single();

  // Nhận cả gallery kiểu cũ lẫn dự án hợp nhất — `phase` thắng cờ `is_gallery`.
  const isDelivery = isDeliveryPhase(album);
  if (!album || !isDelivery || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!album.gallery_pinned && album.password_hash) {
    const ok = password ? await bcrypt.compare(password.trim(), album.password_hash) : false;
    if (!ok) return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const allPhotos = await fetchAllPhotos(admin, album.id, "id, drive_file_id, name, source_id, position, is_video");
  const { data: allSources } = await admin
    .from("album_sources")
    .select("id, name, position, stage, drive_url, kind")
    .eq("album_id", album.id)
    .order("position");

  // Prefer delivery-stage photos; if none are tagged yet, fall back to showing
  // all the album's photos so the gallery is never unexpectedly empty.
  const delSources = (allSources ?? []).filter((x) => x.stage === "delivery");
  const useStages = delSources.length > 0;
  const delSourceIds = new Set(delSources.map((x) => x.id));
  const photos = (allPhotos ?? []).filter((ph) => !useStages || !ph.source_id || delSourceIds.has(ph.source_id));
  const shown = useStages ? delSources : (allSources ?? []);
  const sources = shown.map(({ id, name, position }) => ({ id, name, position }));
  // Folder Drive links of the shown sources → "Tải album" gives the customer a
  // Drive link (gated behind the password like the photos themselves).
  // Phải khớp Y HỆT src/app/album/[slug]/page.tsx: ở giai đoạn giao khách nhận
  // MỌI link Drive, không đòi kind === "folder" (kind chỉ là phỏng đoán từ dạng
  // URL lúc lưu). Trước đây chỗ này còn lọc theo folder nên album CÓ MẬT KHẨU
  // mất nút "Tải file chỉnh sửa", còn album không mật khẩu thì có — cùng một
  // album, hai kết quả khác nhau.
  const driveFolders = shown
    .filter((x) => x.drive_url && (useStages || x.kind === "folder"))
    .map(({ name, drive_url }) => ({ name, url: drive_url as string }));
  // Link file gốc giai đoạn chọn ảnh (JPG Goc) — cũng gated sau mật khẩu.
  const originalFolders = await getOriginalFolders(admin, album.id, allSources ?? []);

  // Khuôn mặt studio đã gom — album có mật khẩu thì trang chưa gửi gì trước khi
  // mở khoá, nên phải trả về ở đây. `select("*")`: cover_box là cột thêm sau.
  const [{ data: ppl }, { data: pplLinks }, { data: owner }] = await Promise.all([
    admin.from("album_people").select("*").eq("album_id", album.id).order("position"),
    admin.from("album_photo_people").select("person_id, photo_id").eq("album_id", album.id),
    admin.from("profiles").select("plan, plan_expires_at, role").eq("id", album.owner_id).maybeSingle(),
  ]);
  // Tìm ảnh theo khuôn mặt: chỉ Photographer Plus & Studio. Phải chốt ở ĐÂY nữa,
  // không chỉ ở trang: gallery CÓ MẬT KHẨU nhận toàn bộ khuôn mặt qua route này,
  // nên bỏ sót chỗ này là để ngỏ đúng những album mà trang chưa gửi gì.
  const canFaceSearch = planAllowsFaceSearch(
    effectivePlan(owner?.plan as Plan, owner?.plan_expires_at),
    owner?.role === "admin",
  );
  const people = canFaceSearch
    ? faceChips(ppl ?? [], pplLinks ?? [], new Set((photos ?? []).map((p: { id: string }) => p.id)))
    : [];
  // Chưa có mặt nào: phân biệt "máy chủ đang quét tới đâu" với "quét rồi, album
  // không có mặt người". Chỉ trường hợp đầu mới hiện tiến độ cho khách.
  const faceScan = canFaceSearch && people.length === 0 ? await tienDoQuet(admin, album.id) : null;

  return NextResponse.json({ photos, sources, driveFolders, originalFolders, people, faceScan });
}
