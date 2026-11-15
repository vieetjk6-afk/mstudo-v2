/**
 * Báo lỗi dựng trang về máy chủ (POST /api/client-error) — gửi rồi quên.
 * Dùng ở error.tsx / global-error.tsx: không import gì, không bao giờ ném, và
 * chỉ gửi đường dẫn (không query string — nơi token của khách hay nằm).
 */
export function reportClientError(error: unknown): void {
  try {
    const e = (error ?? {}) as { name?: unknown; message?: unknown; digest?: unknown };
    const body = JSON.stringify({
      name: typeof e.name === "string" ? e.name : "Error",
      message: (typeof e.message === "string" && e.message ? e.message : String(error)).slice(0, 300),
      digest: typeof e.digest === "string" ? e.digest : undefined,
      path: window.location.pathname.slice(0, 200),
    });
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* báo lỗi không được phép làm hỏng trang báo lỗi */
  }
}
