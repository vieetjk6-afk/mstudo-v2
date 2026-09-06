import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { sendPushToOwner } from "@/lib/push";
import { sendZalo } from "@/lib/zalo/send";

export const dynamic = "force-dynamic";

/**
 * Khách bấm "đã chọn xong" trên trang album → báo cho studio. Public (không đăng
 * nhập). Ba kênh:
 *   1. Chuông (studio_notifications) hiện trong dashboard.
 *   2. Web-push tới điện thoại chủ studio (giống khi khách ký hợp đồng).
 *   3. Zalo cho chủ studio (best-effort, nếu đã kết nối Zalo + có SĐT).
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Chặn spam nút báo (mỗi IP tối đa 6 lần/phút cho 1 album).
  const limited = limitByIp(req, `album-done:${params.slug}`, 6, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { clientName?: string };

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, title, status")
    .eq("slug", params.slug)
    .single();
  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Đếm số ảnh khách đã chọn + số ảnh khách không thích (dùng trong nội dung
  // thông báo — studio biết ngay là có danh sách ảnh cần xoá hay không).
  const [{ count }, { count: disCount }] = await Promise.all([
    admin.from("selections").select("id", { count: "exact", head: true }).eq("album_id", album.id),
    admin.from("dislikes").select("id", { count: "exact", head: true }).eq("album_id", album.id),
  ]);
  const n = count ?? 0;
  const nDis = disCount ?? 0;

  const who = body.clientName?.trim().slice(0, 120) || "Khách";
  const message =
    `${who} đã chọn xong ${n} ảnh cho album “${album.title}”` +
    (nDis > 0 ? ` · ${nDis} ảnh không thích cần xoá` : "");

  // 0) Ghi mốc chốt lên chính album. Đây là thứ giữ cho Thư viện album biết
  //    album nào đến lượt studio xử lý — thông báo thì lướt qua rồi trôi mất.
  //    Bọc riêng: DB chưa chạy migration album_selection_done.sql thì cột chưa
  //    có, và một lỗi ở đây không được phép nuốt mất cả chuông lẫn push.
  const { error: doneErr } = await admin
    .from("albums")
    .update({ selection_done_at: new Date().toISOString() })
    .eq("id", album.id);
  if (doneErr) console.warn("[album-done] không ghi được selection_done_at:", doneErr.message);

  // 1) Chuông trong dashboard (bấm vào → mở thẳng album chọn ảnh). Thử kèm
  //    album_id; nếu DB chưa có cột (chưa chạy lại schema.sql) thì chèn không kèm
  //    để thông báo vẫn hiện.
  const notif = { owner_id: album.owner_id, kind: "selection", message };
  const { error: insErr } = await admin.from("studio_notifications").insert({ ...notif, album_id: album.id });
  if (insErr) await admin.from("studio_notifications").insert(notif);

  // 2) Web-push tới điện thoại chủ studio → mở album chọn ảnh.
  try {
    await sendPushToOwner(album.owner_id, {
      title: "Khách đã chọn ảnh xong",
      body: message,
      url: `/dashboard/albums/${album.id}`,
      tag: `selection-${album.id}`,
    });
  } catch {
    /* push chưa cấu hình VAPID → bỏ qua */
  }

  // 3) Zalo cho chủ studio (best-effort).
  try {
    const { data: owner } = await admin
      .from("profiles")
      .select("pl_phone, full_name")
      .eq("id", album.owner_id)
      .maybeSingle();
    if (owner?.pl_phone) {
      await sendZalo({
        ownerId: album.owner_id,
        toPhone: owner.pl_phone,
        toName: owner.full_name,
        body: `🔔 ${message}\n— Vào Dashboard → Album → Lựa chọn khách để lọc ảnh.`,
        kind: "selection_done",
        log: false,
      });
    }
  } catch {
    /* chưa kết nối Zalo / lỗi tạm → bỏ qua */
  }

  return NextResponse.json({ ok: true, count: n, disliked: nDis });
}
