import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { verifyAlbumAccess } from "@/lib/album-access";
import { isDeliveryPhase } from "@/lib/album-phase";
import { sendPushToOwner } from "@/lib/push";
import { loadPrintQuota } from "@/lib/album-print";
import { cleanPrintIds, isPrintable } from "@/lib/album-print-rules";

export const dynamic = "force-dynamic";

/**
 * Khách gửi danh sách ẢNH IN cho studio — album giao khách của hợp đồng có tặng
 * ảnh in (studio_contracts.print_quota). Public, không đăng nhập.
 *
 * Chỉ ghi khi khách BẤM GỬI (không tự lưu từng lần chạm): studio thấy đúng
 * danh sách khách đã chốt, không phải bản nháp đang chọn dở. Gửi lại thì thay
 * cả danh sách, cho tới khi studio đã chép ảnh đi in (print_copied_at) — lúc đó
 * khoá, studio mở lại được trong trang album.
 *
 * Body: { photoIds: string[], access?: string }
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const limited = limitByIp(req, `album-print:${params.slug}`, 10, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { photoIds?: unknown; access?: string };

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, title, client_name, status, is_gallery, phase, password_hash, gallery_pinned")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!album || album.status !== "published" || !isDeliveryPhase(album)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cùng điều kiện khoá với trang /album/[slug]: gallery ghim thì không hỏi mật khẩu.
  if (!album.gallery_pinned && album.password_hash && !verifyAlbumAccess(album.id, album.password_hash, body.access)) {
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const quota = await loadPrintQuota(admin, album.id);
  if (!quota) return NextResponse.json({ error: "not_enabled" }, { status: 403 });

  const { data: lock, error: lockErr } = await admin
    .from("albums")
    .select("print_copied_at")
    .eq("id", album.id)
    .maybeSingle();
  if (lockErr) return NextResponse.json({ error: "not_ready" }, { status: 503 });
  if (lock?.print_copied_at) return NextResponse.json({ error: "locked" }, { status: 409 });

  const clean = cleanPrintIds(body.photoIds, quota);
  if (!clean.ok) return NextResponse.json({ error: clean.error, quota }, { status: 400 });
  if (clean.ids.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  // Ảnh phải thuộc đúng album này và là ảnh (không phải video).
  const { data: photos } = await admin
    .from("photos")
    .select("id, name, is_video")
    .eq("album_id", album.id)
    .in("id", clean.ids);
  const rows = (photos ?? [])
    .filter(isPrintable)
    .map((p) => ({ album_id: album.id, photo_id: p.id as string, photo_name: (p.name as string) ?? "" }));
  if (rows.length === 0) return NextResponse.json({ error: "empty" }, { status: 400 });

  // Thay cả danh sách (xoá rồi chèn) — cùng cách /api/a/[slug]/select.
  const del = await admin.from("print_picks").delete().eq("album_id", album.id);
  if (del.error) return NextResponse.json({ error: "not_ready" }, { status: 503 });
  const ins = await admin.from("print_picks").insert(rows);
  if (ins.error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  const sentAt = new Date().toISOString();
  await admin.from("albums").update({ print_sent_at: sentAt }).eq("id", album.id);

  // Báo studio: chuông trong dashboard + thông báo đẩy (như "khách chọn xong").
  const who = (album.client_name as string | null)?.trim() || "Khách";
  const message = `${who} đã gửi ${rows.length}/${quota} ảnh in cho album “${album.title}”`;
  const notif = { owner_id: album.owner_id, kind: "print_pick", message };
  const { error: nErr } = await admin.from("studio_notifications").insert({ ...notif, album_id: album.id });
  if (nErr) await admin.from("studio_notifications").insert(notif);
  try {
    await sendPushToOwner(album.owner_id, {
      title: "Khách đã chọn ảnh in",
      body: message,
      url: `/dashboard/albums/${album.id}?tab=deliver`,
      tag: `print-${album.id}`,
    });
  } catch {
    /* chưa cấu hình VAPID → bỏ qua */
  }

  return NextResponse.json({ ok: true, count: rows.length, quota, sentAt, picks: rows.map((r) => r.photo_id) });
}
