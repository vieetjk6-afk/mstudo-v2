import { NextResponse, type NextRequest } from "next/server";
import { cookieDomainForHost } from "@/lib/hosts";

export const dynamic = "force-dynamic";

/**
 * LỐI THOÁT khi cookie đăng nhập hỏng: xoá sạch cookie phiên rồi về /login.
 *
 * Nút "Đăng xuất" bình thường nằm TRONG dashboard, nên nó chỉ dùng được khi đã
 * vào được bên trong. Cookie phiên hỏng (còn sót của project Supabase cũ, đổi
 * khoá, chuyển tài khoản, hoặc `code-verifier` mồ côi sau một lần đăng nhập
 * Google dở dang) lại làm kẹt ngay ở /login — người dùng không còn chỗ nào để
 * xoá cookie. Trong MStudo Desktop (WebView2) còn bí hơn: cửa sổ studio không
 * có thanh địa chỉ lẫn menu cài đặt của trình duyệt.
 *
 * Route này chạy được kể cả khi phiên đã hỏng vì nó KHÔNG gọi Supabase — chỉ
 * xoá cookie rồi chuyển hướng. Middleware bỏ qua /auth/* nên không có gì ghi
 * đè lại cookie trên đường ra.
 *
 * Xoá phiên ở MÁY NÀY (giống bấm Đăng xuất), không thu hồi phiên trên máy khác.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const rawNext = searchParams.get("next") || "/dashboard/studio";
  // Chỉ nhận đường dẫn nội bộ — chặn open redirect (//evil.com, https://…).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard/studio";

  const url = new URL("/login", origin);
  url.searchParams.set("next", next);
  url.searchParams.set("reset", "1");
  const response = NextResponse.redirect(url.toString());

  // Cookie Supabase: sb-<mã-project>-auth-token (có thể bị chẻ .0/.1 khi dài),
  // sb-<mã-project>-auth-token-code-verifier… — quét theo tiền tố "sb-" cho
  // chắc, kể cả cookie còn sót của project cũ.
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const domain = cookieDomainForHost(host);
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    // Xoá cả hai biến thể: cookie đặt theo domain chung (.mstudo.com) và cookie
    // chỉ thuộc đúng host này. Thiếu một biến thể là cookie cũ vẫn còn nguyên.
    response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    if (domain) response.cookies.set(cookie.name, "", { path: "/", maxAge: 0, domain });
  }

  return response;
}
