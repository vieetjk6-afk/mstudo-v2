import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { limitByIpDurable } from "@/lib/rate-limit";
import { pickFolderLinks } from "@/lib/album-original";
import { faceChips } from "@/lib/face-people";

export const dynamic = "force-dynamic";

/**
 * Verify an album password (if any) and return the photo list.
 * Public endpoint — uses the service role to read a published album, but only
 * returns photos when the password check passes.
 */
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
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
    .select("role, can_zip")
    .eq("id", album.owner_id)
    .maybeSingle();
  const allowDownload =
    (owner?.role === "admin" || !!owner?.can_zip) && album.download_enabled !== false;
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
      .from("album_people")
      .select("id, name, cover_photo_id, cover_box, descriptor, face_count, position")
      .eq("album_id", album.id)
      .order("position"),
    admin.from("album_photo_people").select("person_id, photo_id").eq("album_id", album.id),
  ]);
  const selected = (sel ?? []).map((s) => s.photo_id);
  const disliked = (dis ?? []).map((d) => d.photo_id);
  const notes: Record<string, string> = {};
  for (const s of sel ?? []) if (s.client_note) notes[s.photo_id] = s.client_note;
  for (const d of dis ?? []) if (d.client_note) notes[d.photo_id] = d.client_note;

  return NextResponse.json({
    photos: photos ?? [],
    sources: (sources ?? []).map(({ id, name, position }) => ({ id, name, position })),
    driveFolders,
    selected,
    disliked,
    notes,
    people: faceChips(ppl ?? [], pplLinks ?? [], new Set((photos ?? []).map((p) => p.id))),
  });
}
