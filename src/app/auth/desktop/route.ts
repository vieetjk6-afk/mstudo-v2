import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieDomainForHost } from "@/lib/hosts";
import { safeNextPath } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/**
 * Đổi mã đăng nhập một lần (do /api/desktop/session cấp cho máy đã kết nối)
 * lấy phiên đăng nhập, rồi vào thẳng giao diện studio.
 *
 * Cùng khuôn với /auth/callback: TẠO response chuyển hướng TRƯỚC, để Supabase
 * ghi cookie phiên lên chính response đó. Trả về một NextResponse.redirect mới
 * sau khi xác thực là mất sạch Set-Cookie — đúng lỗi từng làm đăng nhập Google
 * quay vòng về /login.
 *
 * Middleware bỏ qua /auth/* nên không có gì đụng vào cookie trên đường ra.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  // Chỉ nhận đường dẫn nội bộ — chặn open redirect (xem @/lib/safe-next).
  const next = safeNextPath(searchParams.get("next"));

  const fail = (code: string, detail?: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", code);
    if (detail) url.searchParams.set("error_description", detail);
    return NextResponse.redirect(url.toString());
  };

  if (!tokenHash) return fail("desktop_missing_token");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return fail("desktop_no_config");

  const response = NextResponse.redirect(`${origin}${next}`);
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
    return fail(error.code || "desktop_login_failed", error.message);
  }

  return response;
}
