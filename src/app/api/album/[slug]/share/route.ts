import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** A short URL-safe token (8 chars). */
function makeToken(): string {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

/**
 * Store a hand-picked subset of an album's photos under a short token so the
 * "share N selected photos" link stays short regardless of how many are chosen.
 * Returns { token } — the viewer opens /album/<slug>?s=<token> (or /a/...).
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Endpoint công khai ghi qua service-role: chặn spam tạo hàng loạt link share
  // (mỗi dòng tối đa 2000 chuỗi) gây phình bảng/chi phí lưu trữ.
  const rl = limitByIp(req, `album-share:${params.slug}`, 20, 60_000);
  if (rl) return rl;

  const { photoIds } = (await req.json().catch(() => ({}))) as { photoIds?: string[] };
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: "no_photos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status")
    .eq("slug", params.slug)
    .single();
  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Insert with a few retries in the (very unlikely) event of a token clash.
  // Chỉ nhận chuỗi định danh ảnh hợp lệ (chặn nhồi payload rác dài): id ảnh (uuid)
  // hoặc drive_file_id của Google đều ≤ 128 ký tự.
  const ids = photoIds.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 128).slice(0, 2000);
  if (ids.length === 0) {
    return NextResponse.json({ error: "no_photos" }, { status: 400 });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = makeToken();
    const { error } = await admin
      .from("album_shares")
      .insert({ token, album_id: album.id, photo_ids: ids });
    if (!error) return NextResponse.json({ token });
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "token_collision" }, { status: 500 });
}
