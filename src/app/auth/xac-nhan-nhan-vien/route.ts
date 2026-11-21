import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readStaffConfirm } from "@/lib/staff-confirm";

export const dynamic = "force-dynamic";

/**
 * Nhân viên bấm link trong email để xác nhận địa chỉ (xem @/lib/staff-confirm).
 *
 * HAI BƯỚC: GET chỉ hiện nút, POST mới xác nhận. Trình quét link của Gmail /
 * Outlook mở sẵn mọi link trong thư bằng GET — xác nhận ngay trên GET là máy
 * quét bấm hộ, mất ý nghĩa "chỉ chủ hộp thư mới xác nhận được".
 *
 * KHÔNG tạo phiên đăng nhập: xác nhận xong chuyển về /login, nhân viên đăng nhập
 * bằng mật khẩu chủ studio đã đặt. Nhờ vậy link này không dùng được để đăng
 * nhập hộ ai (login CSRF).
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);

function page(body: string, status = 200) {
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex">
<title>Xác nhận tài khoản nhân viên</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f6f6f7; color: #18181b; }
  .card { max-width: 420px; width: 100%; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 24px; box-sizing: border-box; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.5; margin: 0 0 12px; color: #52525b; overflow-wrap: anywhere; }
  button, .btn { display: block; width: 100%; padding: 10px 14px; border: 0; border-radius: 10px; font-size: 15px; font-weight: 600;
           background: #18181b; color: #fff; cursor: pointer; text-align: center; text-decoration: none; box-sizing: border-box; }
  @media (prefers-color-scheme: dark) {
    body { background: #09090b; color: #fafafa; }
    .card { background: #18181b; border-color: #27272a; }
    p { color: #a1a1aa; }
    button, .btn { background: #fafafa; color: #18181b; }
  }
</style></head><body>${body}</body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  });
}

const expired = () =>
  page(`<div class="card"><h1>Link đã hết hạn hoặc không đúng</h1>
<p>Nhờ chủ studio tạo lại tài khoản (hoặc bấm “Gửi lại email xác nhận”) để nhận link mới.</p>
<a class="btn" href="/login">Về trang đăng nhập</a></div>`, 400);

export async function GET(request: NextRequest) {
  const t = new URL(request.url).searchParams.get("t");
  const info = readStaffConfirm(t);
  if (!info) return expired();
  return page(`<form class="card" method="post" action="/auth/xac-nhan-nhan-vien">
<h1>Xác nhận tài khoản nhân viên</h1>
<p>Email: <b>${esc(info.email)}</b></p>
<p>Bấm “Xác nhận” để kích hoạt tài khoản, rồi đăng nhập bằng mật khẩu chủ studio đã đưa cho bạn.</p>
<input type="hidden" name="t" value="${esc(t!)}">
<button type="submit">Xác nhận</button></form>`);
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const t = form?.get("t");
  const info = readStaffConfirm(typeof t === "string" ? t : null);
  if (!info) return expired();

  const db = createAdminClient();
  // Email phải còn đúng như lúc gửi link — tài khoản đã đổi email thì link cũ vô hiệu.
  const { data } = await db.auth.admin.getUserById(info.userId);
  if (!data?.user || (data.user.email || "").toLowerCase() !== info.email) return expired();
  if (!data.user.email_confirmed_at) {
    const { error } = await db.auth.admin.updateUserById(info.userId, { email_confirm: true });
    if (error) {
      console.error("[xac-nhan-nhan-vien] lỗi", error.message);
      return page(`<div class="card"><h1>Chưa xác nhận được</h1><p>Thử lại sau ít phút.</p></div>`, 500);
    }
  }
  return NextResponse.redirect(`${origin}/login?confirmed=1&email=${encodeURIComponent(info.email)}`, 303);
}
