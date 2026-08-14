import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieDomainForHost } from "@/lib/hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/**
 * Redirect back to /login carrying the REAL reason.
 *
 * Supabase trả lỗi OAuth dưới dạng ba tham số: `error` (mã chung, hay gặp nhất
 * là `server_error`), `error_code` (mã cụ thể, vd `unexpected_failure`) và
 * `error_description` (câu mô tả, vd "Database error saving new user"). Trước
 * đây ta chỉ chuyển tiếp `error`, nên người dùng chỉ thấy "server_error" —
 * không đủ để biết hỏng ở đâu. Giữ đủ ba tham số + log lại phía server.
 */
function loginError(
  origin: string,
  code: string,
  errorCode?: string | null,
  description?: string | null
) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (errorCode) url.searchParams.set("error_code", errorCode);
  if (description) url.searchParams.set("error_description", description);
  return NextResponse.redirect(url.toString());
}

/**
 * OAuth (Google) callback — exchange the code for a session, then continue.
 *
 * IMPORTANT: We MUST create the redirect response first and let
 * `exchangeCodeForSession` write the session cookies ONTO that same response.
 * Returning a brand-new `NextResponse.redirect(...)` after the exchange drops
 * the `Set-Cookie` headers, which is what was causing OAuth sign-in to loop
 * back to /login (the cookies never made it to the browser).
 *
 * See Supabase SSR docs (server-side auth, advanced guide).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/dashboard/studio";
  // C-1: Prevent open redirect — only allow relative paths (not //evil.com or https://...)
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard/studio";
  const oauthError = searchParams.get("error");
  const oauthErrorCode = searchParams.get("error_code");
  const oauthErrorDescription = searchParams.get("error_description");

  // Provider-side error: người dùng bấm Huỷ trên màn hình Google (access_denied),
  // hoặc Supabase/Google hỏng phía trong (server_error + unexpected_failure).
  if (oauthError) {
    console.error("[auth/callback] OAuth provider error", {
      error: oauthError,
      error_code: oauthErrorCode,
      error_description: oauthErrorDescription,
    });
    return loginError(origin, oauthError, oauthErrorCode, oauthErrorDescription);
  }

  if (!code) {
    return loginError(origin, "missing_code");
  }

  // 1) Build the redirect response we'll return on success.
  //    Cookies set during the exchange below will be attached to THIS response.
  const response = NextResponse.redirect(`${origin}${next}`);

  // 2) Create a Supabase server client bound to the request cookies (for the
  //    PKCE code_verifier) and the response cookies (for the new session).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Share the session cookie across MAIN_HOST subdomains (album/img/studio)
      // — nhưng CHỈ khi request thực sự đến trên host đó.
      //
      // Trước đây chỗ này dùng COOKIE_DOMAIN cố định (suy ra từ
      // NEXT_PUBLIC_MAIN_HOST) thay vì xét host của request, khác với
      // middleware.ts và lib/supabase/client.ts. Hậu quả: nếu app được phục vụ
      // trên một host khác MAIN_HOST (vừa đổi domain mà chưa sửa env, domain
      // riêng, bản preview *.vercel.app), trình duyệt ÂM THẦM TỪ CHỐI cookie có
      // Domain không khớp trang → phiên không bao giờ được lưu → đăng nhập
      // Google xong lại bị đá về /login.
      ...((() => {
        const domain = cookieDomainForHost(request.headers.get("host"));
        return domain ? { cookieOptions: { domain } } : {};
      })()),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2]
            )
          );
        },
      },
    }
  );

  // 3) Exchange the auth code for a session. Cookies land on `response`.
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return loginError(origin, error.code || "oauth", null, error.message);
  }

  // 4) Save affiliate referral code if present and user has no referrer yet.
  const affRef = request.cookies.get("aff_ref")?.value;
  if (affRef) {
    const { data: { user: newUser } } = await supabase.auth.getUser();
    if (newUser) {
      const db = createAdminClient();
      const { data: profile } = await db.from("profiles").select("referred_by").eq("id", newUser.id).maybeSingle();
      if (profile && !profile.referred_by) {
        const { data: affCode } = await db.from("affiliate_codes").select("user_id").eq("code", affRef).eq("active", true).maybeSingle();
        // Don't let users refer themselves
        if (affCode && affCode.user_id !== newUser.id) {
          await db.from("profiles").update({ referred_by: affRef }).eq("id", newUser.id);
        }
      }
      // Clear the cookie once stored
      response.cookies.set("aff_ref", "", { maxAge: 0, path: "/" });
    }
  }

  // 4.5) Thông báo admin khi có TÀI KHOẢN MỚI (chỉ trong ~60s kể từ lúc tạo, và
  //      không phải nhân viên phụ) — tránh báo lại mỗi lần đăng nhập.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const db = createAdminClient();
      const { data: prof } = await db
        .from("profiles")
        .select("created_at, email, studio_owner_id")
        .eq("id", user.id)
        .maybeSingle();
      if (
        prof && !prof.studio_owner_id && prof.created_at &&
        Date.now() - new Date(prof.created_at).getTime() < 60_000
      ) {
        await notifyAdmins("new_user", `Tài khoản mới đăng ký: ${prof.email || user.email}`);
      }
    }
  } catch { /* không chặn đăng nhập nếu thông báo lỗi */ }

  // 5) Return the SAME response object that now carries the Set-Cookie headers.
  return response;
}
