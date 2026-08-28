"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Brand from "@/components/Brand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import Turnstile from "@/components/Turnstile";
import { useLang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { TURNSTILE_UNAVAILABLE } from "@/lib/turnstile";
import { APP_VERSION } from "@/lib/version";

// Friendly Vietnamese label for the ?error=... codes we set in /auth/callback.
//
// `code` là mã chung (`server_error`, `access_denied`…), `errorCode` là mã cụ
// thể của Supabase (`unexpected_failure`, `validation_failed`…) và `description`
// là câu mô tả gốc — thứ duy nhất nói được HỎNG Ở ĐÂU. Ưu tiên đọc description.
function describeOAuthError(
  code: string | null,
  errorCode?: string | null,
  description?: string | null
): string | null {
  if (!code) return null;
  const detail = description ? decodeURIComponent(description).replace(/\+/g, " ") : "";
  const lower = detail.toLowerCase();

  // Đăng nhập tự động của app desktop (/auth/desktop) — KHÔNG dính gì tới
  // Google, đừng để rơi xuống các câu "Đăng nhập Google thất bại" bên dưới.
  if (code.startsWith("desktop_") || lower.includes("otp") || code === "otp_expired") {
    return code === "desktop_no_config"
      ? "Máy chủ thiếu cấu hình Supabase nên không đăng nhập tự động được. Báo quản trị viên kiểm tra biến môi trường trên Vercel."
      : "Mã đăng nhập tự động của app desktop đã hết hạn hoặc đã dùng rồi. Bấm lại “Đăng nhập tự động” trong bảng điều khiển, hoặc đăng nhập bằng email + mật khẩu ngay tại đây.";
  }

  // Mất `code_verifier` của luồng PKCE. Trình duyệt ghi mã tạm này vào cookie
  // lúc bấm "Đăng nhập với Google", rồi /auth/callback cần đọc lại để đổi code
  // lấy phiên. Mất nó chỉ có ba lý do, và cả ba đều nói được thành việc cụ thể.
  if (code === "pkce_code_verifier_not_found" || lower.includes("code verifier")) {
    // /auth/callback đã so địa chỉ mở luồng với địa chỉ nhận về; khớp thì nó
    // gửi kèm câu chỉ đúng chỗ phải sửa — dùng luôn, đừng nói chung chung nữa.
    if (detail && !lower.startsWith("pkce code verifier not found")) return detail;
    return (
      "Trình duyệt không giữ được mã tạm của lần đăng nhập này, nên bước cuối bị hủy. " +
      "Thường do: (1) mở đăng nhập ở một địa chỉ nhưng Google trả về địa chỉ khác — thêm địa chỉ đang dùng vào Supabase → Authentication → URL Configuration → Redirect URLs; " +
      "(2) trình duyệt/cửa sổ đang chặn cookie; (3) bấm đăng nhập ở cửa sổ này rồi hoàn tất ở cửa sổ khác. " +
      "Cách chắc ăn nhất: đăng nhập bằng email + mật khẩu ngay tại đây."
    );
  }

  // Lỗi hay gặp nhất của server_error: trigger tạo hồ sơ (profiles) trong CSDL
  // thất bại nên Supabase không lưu được tài khoản mới.
  if (lower.includes("database error")) {
    return "Không tạo được hồ sơ cho tài khoản mới nên đăng nhập bị hủy. Vui lòng báo quản trị viên chạy migration supabase/migrations/fix_google_signup_trigger.sql.";
  }
  if (lower.includes("user profile from external provider")) {
    return "Không lấy được thông tin tài khoản từ Google. Kiểm tra Client ID / Client Secret của Google trong Supabase.";
  }
  // Google đã cấp mã (4/0A…) nhưng từ chối đổi mã đó lấy token. Bước /authorize
  // trước đó đã chạy được, tức Client ID và redirect URI đều hợp lệ — nên biến
  // duy nhất còn lại của lần đổi mã này là CLIENT SECRET.
  if (lower.includes("unable to exchange external code")) {
    return "Google từ chối đổi mã đăng nhập. Gần như chắc chắn Client Secret trong Supabase không khớp với OAuth Client trên Google Cloud — vào Supabase → Authentication → Providers → Google và dán lại Client ID + Client Secret.";
  }
  if (lower.includes("already registered") || errorCode === "identity_already_exists") {
    return "Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng email + mật khẩu, hoặc liên kết Google trong phần Tài khoản.";
  }
  if (lower.includes("redirect") || lower.includes("not allowed")) {
    return "Địa chỉ chuyển hướng chưa được cho phép. Thêm URL của trang này vào Supabase → Authentication → URL Configuration.";
  }

  switch (code) {
    case "oauth":
      return "Đăng nhập Google thất bại. Vui lòng thử lại.";
    case "missing_code":
      return "Không nhận được mã từ Google. Vui lòng thử lại.";
    case "access_denied":
      return "Bạn đã hủy cho phép trên Google.";
    case "server_error":
    case "unexpected_failure":
      return `Đăng nhập Google thất bại do lỗi phía máy chủ xác thực${detail ? `: ${detail}` : " (server_error). Vui lòng thử lại sau ít phút hoặc liên hệ hỗ trợ."}`;
    default:
      return `Đăng nhập Google thất bại: ${decodeURIComponent(code)}${detail ? ` — ${detail}` : ""}`;
  }
}

function LoginForm() {
  const { t } = useLang();
  const params = useSearchParams();
  // Default landing = studio management. Free/Basic accounts (no studio tier)
  // are redirected on to the album dashboard by the studio page itself.
  const rawNext = params.get("next") || "/dashboard/studio";
  // C-1: Prevent open redirect — only allow relative paths
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard/studio";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaWarn, setCaptchaWarn] = useState(false);
  const didReset = params.get("reset") === "1";
  // Đang chạy TRONG cửa sổ của MStudo Desktop (cờ do app tiêm vào webview).
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(!!(window as unknown as { __MSTUDO_DESKTOP__?: boolean }).__MSTUDO_DESKTOP__);
  }, []);

  // Surface OAuth callback errors (?error=...) so the user isn't left wondering
  // why Google sign-in bounced them back here.
  useEffect(() => {
    // Supabase đôi khi trả lỗi trong FRAGMENT (#error=...) thay vì query string.
    // Route /auth/callback chạy trên server nên không đọc được fragment (nó chỉ
    // thấy "thiếu code"), nhưng fragment vẫn còn nguyên sau khi trình duyệt đi
    // theo redirect — nên đọc nốt ở đây để không mất lý do lỗi thật.
    const hash =
      typeof window !== "undefined" && window.location.hash.startsWith("#")
        ? new URLSearchParams(window.location.hash.slice(1))
        : null;

    const msg = describeOAuthError(
      hash?.get("error") || params.get("error"),
      hash?.get("error_code") || params.get("error_code"),
      hash?.get("error_description") || params.get("error_description")
    );
    if (msg) setError(msg);
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!captchaToken) {
      setError("Vui lòng xác minh bạn không phải robot.");
      setLoading(false);
      return;
    }

    // Guard: NEXT_PUBLIC_* vars are inlined at build time. If they're missing
    // the auth request would hang forever — fail fast with a clear message.
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      setError(
        "Thiếu cấu hình Supabase (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY). Thêm trên Vercel rồi Redeploy."
      );
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      // Fail instead of hanging if Supabase is unreachable (paused project, bad URL).
      const timeout = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ error: { message: "Hết thời gian kết nối tới Supabase. Kiểm tra URL/khóa và xem project có đang bị pause không." } }),
          15000
        )
      );
      // Mã captcha phải được GỬI KÈM thì Supabase mới xác minh được. Trước đây
      // trang này dựng widget Turnstile rồi... không làm gì với mã cả: ô captcha
      // chỉ khoá nút Đăng nhập ở phía trình duyệt, ai gọi thẳng API Supabase là
      // qua mặt hoàn toàn. Bật thêm Turnstile ở Supabase → Authentication →
      // Settings → Bot and Abuse Protection để phía máy chủ thật sự kiểm.
      //
      // Chỉ gửi mã THẬT: TURNSTILE_UNAVAILABLE là cờ nội bộ báo widget không
      // chạy được, đẩy sang Supabase chỉ tổ bị bác và khoá luôn khách thật.
      const realCaptcha = captchaToken && captchaToken !== TURNSTILE_UNAVAILABLE ? captchaToken : undefined;
      const { error } = (await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
          ...(realCaptcha ? { options: { captchaToken: realCaptcha } } : {}),
        }),
        timeout,
      ])) as { error: { message: string } | null };

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Đăng nhập ĐÚNG nhưng cookie không lưu được thì trang sau lại đá về
      // /login — nhìn từ ngoài y hệt "bấm nút chẳng thấy gì". Cửa sổ nhúng của
      // app desktop và trình duyệt chặn cookie hay rơi vào đúng cảnh này. Soát
      // lại phiên trước khi chuyển trang để nói thẳng ra, thay vì đá vòng vòng.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(
          "Đăng nhập đúng nhưng cửa sổ này không lưu được cookie phiên nên vẫn coi như chưa đăng nhập. " +
          "Nếu đang dùng MStudo Desktop: mở menu ở khay hệ thống → “Đăng nhập tự động (mã thiết bị)”. " +
          "Nếu đang dùng trình duyệt: bật lại cookie cho trang này rồi thử lại."
        );
        setLoading(false);
        return;
      }

      // Full reload (not router.push) so the middleware on the next request
      // definitely sees the freshly set auth cookies. router.push() can race
      // with the browser persisting the session cookies, which is the classic
      // "logged in but bounced back to /login" cache bug.
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setError("Thiếu cấu hình Supabase. Kiểm tra biến môi trường trên Vercel.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // `from` = địa chỉ ĐÃ MỞ luồng đăng nhập. Cookie mã tạm (code_verifier)
        // thuộc về địa chỉ này; nếu Supabase trả về một địa chỉ khác (redirectTo
        // chưa nằm trong Redirect URLs nên bị thay bằng Site URL) thì callback
        // đọc không ra và báo "pkce_code_verifier_not_found" — không kèm manh
        // mối nào. Có `from` là chỉ được đích danh chỗ sai.
        redirectTo:
          `${window.location.origin}/auth/callback` +
          `?next=${encodeURIComponent(next)}&from=${encodeURIComponent(window.location.origin)}`,
      },
    });
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Brand />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="card w-full max-w-sm animate-fade-in p-8"
        >
          <h1 className="text-xl font-medium text-accent">{t("login")}</h1>
          <p className="mt-1 mb-6 text-sm text-accent-muted">{t("loginSubtitle")}</p>

          <label className="label">{t("email")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mb-4"
            placeholder="you@example.com"
          />

          <label className="label">{t("password")}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mb-5"
            placeholder="••••••••"
          />

          <Turnstile
            onVerify={(tk) => { setCaptchaToken(tk); setCaptchaWarn(false); }}
            onExpire={() => setCaptchaToken(null)}
            onError={() => { setCaptchaToken(null); setCaptchaWarn(true); }}
            className="mb-4"
          />

          {/* Nút Đăng nhập bị khóa khi chưa có mã xác minh. Nói ra lý do, đừng để
              người dùng ngồi nhìn nút xám không hiểu vì sao (Turnstile hay trục
              trặc trong webview nhúng của app desktop). */}
          {captchaWarn && !captchaToken && (
            <p className="mb-4 text-sm text-accent-muted">
              Xác minh chống robot đang trục trặc — chờ vài giây, nút Đăng nhập sẽ tự bật lại.
            </p>
          )}

          {didReset && !error && (
            <p className="mb-4 text-sm text-accent-muted">
              Đã xóa cookie đăng nhập trên máy này. Mời bạn đăng nhập lại.
            </p>
          )}

          {error && (
            <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{error}</p>
          )}

          <button type="submit" disabled={loading || !captchaToken} className="btn-primary w-full">
            {loading ? t("signingIn") : t("login")}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider" style={{ color: "var(--text3)" }}>
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
            hoặc
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="btn-ghost w-full"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Đăng nhập với Google
          </button>

          {/* Trong cửa sổ nhúng của app desktop, Google hay từ chối thẳng
              ("browser may not be secure") và luồng PKCE cũng dễ đứt vì cookie.
              Chỉ đường sang cách đăng nhập không cần cả hai. */}
          {isDesktop && (
            <p className="mt-3 rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
              Đang mở trong <b>MStudo Desktop</b>. Google thường chặn đăng nhập trong cửa sổ nhúng —
              cách chắc ăn: chuột phải biểu tượng MStudo ở <b>khay hệ thống</b> → <b>Đăng nhập tự động (mã thiết bị)</b>.
              Máy này đã được xác thực bằng mã kết nối nên không cần gõ gì thêm.
            </p>
          )}

          {/* Lối thoát khi cookie phiên hỏng: kẹt vòng lặp /login ↔ /dashboard,
              còn phiên tài khoản cũ, hoặc đăng nhập Google dở dang để lại
              code-verifier mồ côi. Trong app desktop (WebView2) đây là CHỖ DUY
              NHẤT xóa được cookie vì cửa sổ không có menu trình duyệt. */}
          <a
            href={`/auth/reset?next=${encodeURIComponent(next)}`}
            className="mt-5 block text-center text-xs underline"
            style={{ color: "var(--text3)" }}
          >
            Không đăng nhập được? Xóa cookie đăng nhập rồi thử lại
          </a>

          <p className="mt-3 text-center text-[11px]" style={{ color: "var(--text3)" }}>
            Phiên bản {APP_VERSION}
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
