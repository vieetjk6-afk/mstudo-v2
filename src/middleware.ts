import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { cookieDomainForHost } from "@/lib/hosts";

// Domain split (set these on Vercel to enable it). When unset (local dev,
// *.vercel.app previews) the full app is served on one host.
//   MAIN_HOST  = mstudo.com        -> landing + studio management
//   APP_HOST   = album.mstudo.com  -> RETIRED (album app now served by MAIN_HOST;
//                                     kept only as a known system host)
//   IMG_HOST   = img.mstudo.com    -> image-compress tool
//   ADMIN_HOST = admin.mstudo.com  -> site administration + settings
const MAIN_HOST = process.env.NEXT_PUBLIC_MAIN_HOST;
const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST;
const IMG_HOST = process.env.NEXT_PUBLIC_IMG_HOST;
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST;
// thiep.mstudo.com -> online wedding invitations. Serves /thiep/* at the root.
const THIEP_HOST = process.env.NEXT_PUBLIC_THIEP_HOST;
const COMPRESS_PATH = "/dashboard/compress";
const ADMIN_PATH = "/dashboard/admin";

/**
 * Returns the canonical host for a path, or undefined when no forced redirect
 * is needed (path may be served on whatever host the request arrived at).
 *
 * Domain split intent:
 *   mstudo.com        → marketing landing + the WHOLE studio management app
 *                       (studio dashboard, contracts, calendar, galleries,
 *                       clients, settings, admin, …)
 *   album.mstudo.com  → ONLY the album-creation / photo-filter tool
 *   img.mstudo.com    → image-compress tool
 */
/** File SEO phục vụ theo từng host (route handler tự đọc Host header). */
const SEO_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function hostForPath(path: string): string | undefined {
  // Auth pages are shared — never redirect.
  if (path.startsWith("/login") || path.startsWith("/auth")) return undefined;

  // Photo tools (create selection-album, filter, compress) run IN-APP inside the
  // studio admin — never force them onto another subdomain. Serve on whatever
  // host the request arrived at (img.mstudo.com still works too, not forced).
  if (
    path.startsWith(COMPRESS_PATH) ||
    path.startsWith("/dashboard/create") ||
    path.startsWith("/dashboard/filter")
  ) return undefined;

  // album.mstudo.com is retired — the album app (library, public viewer /a/,
  // and the whole dashboard) is served by the main host now.
  if (path.startsWith("/dashboard") || path.startsWith("/a/") || path === "/start") return MAIN_HOST;

  // Wedding invitations belong on the thiệp host (canonical) when configured.
  if (path.startsWith("/thiep")) return THIEP_HOST || undefined;

  return undefined;
}

/**
 * Middleware chạy trên MỌI request, nên một exception ở đây không hỏng một
 * trang mà trả 500 (`MIDDLEWARE_INVOCATION_FAILED`) cho TOÀN BỘ site — kể cả
 * landing. Không có việc gì trong này quan trọng hơn việc site còn sống: ghi
 * log rồi cho request đi tiếp. Hàng rào auth thật nằm ở dashboard/layout.tsx
 * (getSessionUser + redirect /login), không nằm ở đây.
 */
export async function middleware(request: NextRequest) {
  try {
    return await route(request);
  } catch (err) {
    console.error("[middleware] cho request đi tiếp sau lỗi:", err);
    return NextResponse.next();
  }
}

async function route(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname, search } = request.nextUrl;

  // ── Canonical host: www.mstudo.com → mstudo.com ──────────────────────────
  // The apex (mstudo.com) is the canonical main domain. Send www → apex so we
  // have one source of truth for cookies/sessions. (Make sure Vercel itself
  // does NOT add an opposite apex → www redirect, or the two would loop.)
  if (MAIN_HOST && host === `www.${MAIN_HOST}`) {
    return NextResponse.redirect(new URL(pathname + search, `https://${MAIN_HOST}`));
  }

  // ── Wedding invitations: thiep.mstudo.com/<slug> → /thiep/<slug> ─────────
  // The thiệp host serves the (public) invitation pages and the client editor
  // at the root, so we prefix everything with /thiep internally. /api and
  // Next internals are left untouched.
  if (THIEP_HOST && host === THIEP_HOST) {
    // Only treat an EXACT "/thiep" or "/thiep/..." as already-prefixed; a slug
    // like "/thiep-cuoi-x" must still be rewritten to "/thiep/thiep-cuoi-x".
    const alreadyPrefixed = pathname === "/thiep" || pathname.startsWith("/thiep/");
    if (!alreadyPrefixed && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/thiep" : `/thiep${pathname}`;
      return NextResponse.rewrite(url);
    }
    // Already a /thiep route, /api or asset path — serve as-is on this host.
    return NextResponse.next();
  }

  // ── Tenant sites: <subdomain>.mstudo.com → /site/<subdomain> ─────────────
  // Any *.MAIN_HOST that isn't a known system host is treated as a tenant site.
  if (MAIN_HOST && host.endsWith(`.${MAIN_HOST}`) && host !== MAIN_HOST) {
    const systemHosts = new Set(
      [MAIN_HOST, APP_HOST, IMG_HOST, ADMIN_HOST, THIEP_HOST, `www.${MAIN_HOST}`].filter(Boolean) as string[]
    );
    if (!systemHosts.has(host)) {
      const sub = host.slice(0, -(`.${MAIN_HOST}`.length));
      if (sub && !sub.includes(".")) {
        // Studio admin & auth always live on the main host.
        if (pathname.startsWith("/dashboard") || pathname === "/start" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
          return NextResponse.redirect(new URL(pathname + search, `https://${MAIN_HOST}`));
        }
        // robots.txt / sitemap.xml được xử lý bởi route handler đọc Host header
        // (mỗi tenant một nội dung) — không rewrite vào /site/<sub>/…
        if (SEO_FILES.has(pathname)) return NextResponse.next();
        // Customer/app routes are SERVED on the studio's own subdomain so every
        // activity a studio shares runs under its personalised URL.
        const CUSTOMER = ["/a/", "/album", "/c/", "/q/", "/gia/", "/book/", "/crew", "/quote", "/showcase", "/story", "/form/"];
        if (CUSTOMER.some((p) => pathname.startsWith(p))) {
          return NextResponse.next();
        }
        // Everything else on the subdomain is the portfolio site. Preserve the
        // sub-path so bespoke multi-page sites (e.g. vieetjk /cuoi) keep working.
        const url = request.nextUrl.clone();
        url.pathname = `/site/${sub}${pathname === "/" ? "" : pathname}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // ── Custom domains: an external host (studio.com) mapped to a studio's site.
  // Any host that isn't mstudo / a system host / localhost / a *.vercel.app
  // preview is treated as a tenant custom domain and served like the subdomain.
  if (
    MAIN_HOST && host && host !== MAIN_HOST && !host.endsWith(`.${MAIN_HOST}`) &&
    host !== "localhost" && !host.startsWith("127.") && !host.endsWith(".vercel.app")
  ) {
    if (pathname.startsWith("/dashboard") || pathname === "/start" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
      return NextResponse.redirect(new URL(pathname + search, `https://${MAIN_HOST}`));
    }
    if (SEO_FILES.has(pathname)) return NextResponse.next();
    const CUSTOMER = ["/a/", "/album", "/c/", "/q/", "/gia/", "/book/", "/crew", "/showcase", "/story", "/form/"];
    if (CUSTOMER.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    // Portfolio: the /site route resolves the tenant by custom_domain. Preserve
    // the sub-path so bespoke multi-page sites (e.g. vieetjk /cuoi) keep working.
    const url = request.nextUrl.clone();
    url.pathname = `/site/${host}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // ── Main workspace is the studio dashboard ───────────────────────────────
  // On mstudo.com the studio management app is the user's home, so the bare
  // /dashboard goes to /dashboard/studio instead of bouncing to the album host.
  // (Free/Basic accounts have no studio tier — StudioOverview sends them on to
  // the album dashboard, so there's no loop.) Album host keeps /dashboard = albums.
  if (MAIN_HOST && host === MAIN_HOST && pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/studio", request.url));
  }

  // ── Host-based routing ────────────────────────────────────────
  // Bỏ qua trên bản Preview của Vercel (*.vercel.app): nếu không, mở /dashboard,
  // /a/, /start… trên preview sẽ bị hostForPath ép chuyển sang MAIN_HOST
  // (domain production) → không test được preview sau khi đăng nhập.
  if (MAIN_HOST && host && !host.endsWith(".vercel.app")) {
    // Per-host home pages.
    if (pathname === "/") {
      if (IMG_HOST && host === IMG_HOST) return NextResponse.redirect(new URL(COMPRESS_PATH, request.url));
      if (ADMIN_HOST && host === ADMIN_HOST) return NextResponse.redirect(new URL(ADMIN_PATH, request.url));
      // MAIN_HOST / = marketing landing — fall through.
    } else {
      const target = hostForPath(pathname);
      // Treat the apex and its www. variant as the SAME host, so we never
      // bounce between mstudo.com ⇄ www.mstudo.com (Vercel canonicalises one
      // to the other, which would cause an infinite redirect loop).
      const sameAsMain =
        target === MAIN_HOST && (host === MAIN_HOST || host === `www.${MAIN_HOST}`);
      if (target && target !== host && !sameAsMain) {
        return NextResponse.redirect(new URL(pathname + search, `https://${target}`));
      }
    }
  }

  // ── Supabase session refresh (runs on every non-static request) ──────────
  // This keeps the access token alive regardless of which page the user is on.
  // Without this, the token would only refresh on /dashboard routes and would
  // expire silently while the user is on the landing page.
  if (request.headers.get("next-router-prefetch") === "1" || request.headers.get("purpose") === "prefetch") {
    // Prefetch: skip full auth round-trip, just check cookie presence for dashboard.
    if (pathname.startsWith("/dashboard")) {
      const hasSession = request.cookies.getAll().some(
        (c) => c.name.includes("sb-") && c.name.includes("-auth-token")
      );
      if (!hasSession) return NextResponse.redirect(new URL(`/login?next=${pathname}`, request.url));
    }
    return NextResponse.next();
  }

  // Perf: nếu request KHÔNG mang cookie phiên Supabase nào thì không có gì để
  // refresh — bỏ qua round-trip auth (tiết kiệm 1 network call tới Supabase trên
  // mọi trang public: landing, album, story, thiệp…). Dashboard vẫn an toàn:
  // không cookie → chắc chắn chưa đăng nhập → redirect /login ngay.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) {
    const response = NextResponse.next({ request });
    const refAnon = request.nextUrl.searchParams.get("ref");
    if (refAnon && /^[A-Z0-9]{4,16}$/.test(refAnon) && !request.cookies.get("aff_ref")) {
      response.cookies.set("aff_ref", refAnon, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true });
    }
    if (pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response;
  }

  let response = NextResponse.next({ request });

  // Middleware chạy trên MỌI request, nên một exception ở đây không chỉ hỏng
  // trang đang mở mà trả 500 (MIDDLEWARE_INVOCATION_FAILED) cho toàn bộ site —
  // kể cả landing. Phần dưới chỉ là refresh phiên cho nhanh; hàng rào thật nằm
  // ở dashboard/layout.tsx (getSessionUser + redirect /login). Vì vậy mọi lỗi ở
  // đây đều cho đi tiếp thay vì ném.
  // .trim() vì giá trị dán vào ô Environment Variables của Vercel rất dễ mang
  // theo khoảng trắng / xuống dòng ở cuối.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    // Thiếu biến môi trường (quên khai ở Vercel, hoặc khai nhầm Environment).
    // createServerClient sẽ ném "Your project's URL and Key are required" →
    // sập cả site. Bỏ qua bước refresh; layout dashboard vẫn chặn người lạ.
    return response;
  }
  // Biến CÓ nhưng sai dạng (dán kèm dấu nháy, thiếu https://, dán Project ID
  // thay vì URL) cũng làm createServerClient ném "Invalid URL". Báo rõ trong
  // log rồi bỏ qua, đừng để một biến gõ sai kéo sập cả site.
  if (!isHttpUrl(supabaseUrl)) {
    console.error(
      `[middleware] NEXT_PUBLIC_SUPABASE_URL sai dạng (${JSON.stringify(supabaseUrl)}) — bỏ qua refresh phiên. Phải là https://<mã-project>.supabase.co`
    );
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      ...((() => { const d = cookieDomainForHost(host); return d ? { cookieOptions: { domain: d } } : {}; })()),
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  // Supabase lỗi mạng / cookie phiên hỏng (ví dụ cookie còn sót của project
  // Supabase cũ sau khi đổi khoá) đều làm getUser() ném. Coi như "chưa xác
  // định" và cho đi tiếp: layout dashboard sẽ tự kiểm tra lại. Không redirect
  // về /login ở đây, vì như thế một cú chớp mạng của Supabase sẽ đá văng tất cả
  // người đang đăng nhập.
  let user: User | null = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    return response;
  }

  // Affiliate ref tracking: set a 30-day cookie when ?ref=CODE is present.
  const refParam = request.nextUrl.searchParams.get("ref");
  if (refParam && /^[A-Z0-9]{4,16}$/.test(refParam) && !request.cookies.get("aff_ref")) {
    response.cookies.set("aff_ref", refParam, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true });
  }

  // Only enforce auth for dashboard routes.
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.jpg|api/).*)"],
};
