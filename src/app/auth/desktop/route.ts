import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieDomainForHost } from "@/lib/hosts";
import { safeNextPath } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/**
 * Đổi mã đăng nhập một lần (do /api/desktop/session cấp cho máy đã kết nối)
 * lấy phiên đăng nhập, rồi vào thẳng giao diện studio.
 *
 * HAI BƯỚC, không đổi mã ngay trên GET — chống "login CSRF": trước đây ai cũng
 * gửi được cho nạn nhân link `/auth/desktop?token_hash=<mã của tài khoản kẻ
 * gian>`; bấm vào là trình duyệt nạn nhân ÂM THẦM đăng nhập vào tài khoản kẻ
 * gian, rồi mọi thứ nạn nhân nhập (khách, hợp đồng, kết nối Drive/Zalo…) rơi
 * vào tay kẻ gian. Nên:
 *
 *   GET  → trang xác nhận, KHÔNG đụng phiên. Có nút POST lại chính route này.
 *   POST → kiểm Origin cùng nguồn (form từ trang khác POST sang bị từ chối),
 *          rồi mới verifyOtp và ghi cookie phiên.
 *
 * App desktop KHÔNG phải bấm gì: cửa sổ studio tiêm cờ `window.__MSTUDO_DESKTOP__`
 * (desktop/src-tauri STUDIO_INIT_JS) trước mọi script của trang, nên trang xác
 * nhận tự gửi form khi có cờ đó VÀ lượt mở là điều hướng trực tiếp
 * (`Sec-Fetch-Site: none` — app gọi navigate, không phải bấm link trong trang).
 * Trình duyệt thường không có cờ → luôn hiện nút; link bấm từ trong chính app
 * (Sec-Fetch-Site same-origin) cũng phải bấm nút. Không cần phát hành lại app.
 *
 * Cùng khuôn với /auth/callback: TẠO response chuyển hướng TRƯỚC, để Supabase
 * ghi cookie phiên lên chính response đó. Trả về một NextResponse.redirect mới
 * sau khi xác thực là mất sạch Set-Cookie — đúng lỗi từng làm đăng nhập Google
 * quay vòng về /login.
 *
 * Middleware bỏ qua /auth/* nên không có gì đụng vào cookie trên đường ra.
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]!);

function failRedirect(origin: string, code: string, detail?: string, status?: number) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (detail) url.searchParams.set("error_description", detail);
  // 303 sau POST để trình duyệt chuyển sang GET /login, không gửi lại form.
  return NextResponse.redirect(url.toString(), status);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  // Chỉ nhận đường dẫn nội bộ — chặn open redirect (xem @/lib/safe-next).
  const next = safeNextPath(searchParams.get("next"));
  if (!tokenHash) return failRedirect(origin, "desktop_missing_token");

  // Chỉ tự gửi khi là điều hướng trực tiếp (app desktop gọi navigate). Bấm link
  // từ một trang — kể cả trang của chính studio — thì trình duyệt gửi
  // same-origin/cross-site, và người dùng phải tự bấm nút.
  const direct = request.headers.get("sec-fetch-site") === "none";

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>Đăng nhập MStudo Desktop</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f6f6f7; color: #18181b; }
  .card { max-width: 420px; width: 100%; background: #fff; border: 1px solid #e4e4e7; border-radius: 14px; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; line-height: 1.5; margin: 0 0 12px; color: #52525b; }
  .warn { color: #b45309; }
  button { width: 100%; padding: 10px 14px; border: 0; border-radius: 10px; font-size: 15px; font-weight: 600;
           background: #18181b; color: #fff; cursor: pointer; }
  a { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: #71717a; }
  @media (prefers-color-scheme: dark) {
    body { background: #09090b; color: #fafafa; }
    .card { background: #18181b; border-color: #27272a; }
    p { color: #a1a1aa; }
    .warn { color: #fbbf24; }
    button { background: #fafafa; color: #18181b; }
  }
</style>
</head>
<body>
<form class="card" id="f" method="post" action="/auth/desktop">
  <h1>Đăng nhập vào MStudo Desktop với tài khoản này?</h1>
  <p>Bấm “Đăng nhập” để tiếp tục bằng mã đăng nhập tự động của app MStudo Desktop.</p>
  <p class="warn">Nếu bạn KHÔNG vừa mở app MStudo Desktop mà ai đó gửi link này cho bạn — đừng bấm. Bạn sẽ bị đăng nhập vào tài khoản của người khác.</p>
  <input type="hidden" name="token_hash" value="${esc(tokenHash)}">
  <input type="hidden" name="next" value="${esc(next)}">
  <button type="submit">Đăng nhập</button>
  <a href="/login">Huỷ, về trang đăng nhập</a>
</form>
${direct ? `<script>if (window.__MSTUDO_DESKTOP__) document.getElementById("f").submit();</script>` : ""}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Không cho nhúng trang xác nhận vào iframe của trang khác (clickjacking:
      // che nút "Đăng nhập" dưới một nút mồi).
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  });
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  // Form POST từ trang khác mang Origin của trang đó → từ chối. So theo Host
  // (thứ trình duyệt thật sự gửi tới) chứ không theo request.url, để sau proxy
  // vẫn đúng. Thiếu Origin cũng từ chối: trình duyệt hiện đại luôn gửi Origin
  // cho form POST.
  const reqOrigin = request.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin = !!reqOrigin && new URL(reqOrigin).host === request.headers.get("host");
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return failRedirect(origin, "desktop_bad_origin", undefined, 303);

  const form = await request.formData().catch(() => null);
  const tokenHash = form?.get("token_hash");
  const next = safeNextPath(typeof form?.get("next") === "string" ? (form.get("next") as string) : null);
  if (typeof tokenHash !== "string" || !tokenHash) return failRedirect(origin, "desktop_missing_token", undefined, 303);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return failRedirect(origin, "desktop_no_config", undefined, 303);

  const response = NextResponse.redirect(`${origin}${next}`, 303);
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    // Chỉ đặt Domain khi request thực sự đến trên MAIN_HOST — cookie có Domain
    // không khớp trang sẽ bị trình duyệt ÂM THẦM từ chối (xem ghi chú dài ở
    // /auth/callback).
    ...((() => {
      const domain = cookieDomainForHost(request.headers.get("host"));
      return domain ? { cookieOptions: { domain } } : {};
    })()),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
        );
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.error("[auth/desktop] verifyOtp lỗi", { message: error.message, code: error.code });
    return failRedirect(origin, error.code || "desktop_login_failed", error.message, 303);
  }

  return response;
}
