import { NextResponse, type NextRequest } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { autoEventsOnConnect, loadZalo, packPersonalSession, saveZalo } from "@/lib/zalo/config";
import { loginPersonalQR, personalAvailable } from "@/lib/zalo/personal";

export const dynamic = "force-dynamic";
// Đăng nhập QR cần giữ tiến trình sống trong lúc studio quét mã.
export const maxDuration = 60;

type StudioCtx = { isStaff?: boolean; actingRole?: string } | null;
function guard(profile: StudioCtx) {
  return !!profile && !profile.isStaff && (profile.actingRole === "owner" || profile.actingRole === "admin");
}

/**
 * Bắt đầu đăng nhập Zalo cá nhân bằng QR.
 *
 * Luồng: request này chạy loginQR và GIỮ đến khi quét xong (tới maxDuration).
 * Ảnh QR được ghi tạm vào studio_zalo.personal_self.qr để trình duyệt poll qua
 * /api/studio/zalo/status hiển thị. Quét xong → lưu phiên (đã mã hoá) + self.
 */
export async function POST() {
  const profile = await requireStudio("full");
  if (!guard(profile)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await personalAvailable())) {
    return NextResponse.json(
      { error: "not_available", hint: "Máy chủ chưa cài thư viện zca-js (optionalDependency)." },
      { status: 200 }
    );
  }

  // Đánh dấu đang chờ quét (xoá QR cũ).
  await saveZalo(profile!.id, { channel: "personal", status: "disconnected", personal_self: { phase: "waiting" }, last_error: null });

  try {
    const { session, self } = await loginPersonalQR(
      (img) => {
        // Ghi ảnh QR để trình duyệt poll thấy (bỏ qua lỗi ghi).
        saveZalo(profile!.id, { personal_self: { phase: "scan", qr: img } }).catch(() => {});
      },
      (info) => {
        // Khách đã quét — báo trạng thái để UI hiện "đang hoàn tất".
        saveZalo(profile!.id, { personal_self: { phase: "scanned", name: info.display_name } }).catch(() => {});
      }
    );
    // Kết nối lần đầu thì mồi sẵn ba mốc an toàn — xem DEFAULT_AUTO_EVENTS.
    const before = await loadZalo(profile!.id);
    await saveZalo(profile!.id, {
      channel: "personal",
      status: "connected",
      display_name: self?.name ?? null,
      personal_session: packPersonalSession(session),
      personal_self: self ? { id: self.id, name: self.name, avatar: self.avatar } : null,
      auto_events: autoEventsOnConnect(before?.auto_events),
      connected_at: new Date().toISOString(),
      last_error: null,
    });
    return NextResponse.json({ ok: true, self });
  } catch (e) {
    const msg = (e instanceof Error && e.message) || "login_failed";
    await saveZalo(profile!.id, { status: "error", personal_self: null, last_error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}

/** Ngắt kết nối tài khoản cá nhân (xoá phiên). */
export async function DELETE(_req: NextRequest) {
  const profile = await requireStudio("full");
  if (!guard(profile)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const row = await loadZalo(profile!.id);
  if (row) {
    await saveZalo(profile!.id, { status: "disconnected", personal_session: null, personal_self: null, last_error: null });
  }
  return NextResponse.json({ ok: true });
}
