"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Last-resort boundary: catches errors thrown by the root layout itself, where
// the normal error.tsx (which renders *inside* the layout) can't help. It must
// supply its own <html>/<body>, so styles are inlined — no app CSS is loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Báo về trang Sức khoẻ hệ thống (gửi rồi quên).
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f5", color: "#2a2a2a" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>Đã xảy ra lỗi</h1>
            <p style={{ fontSize: "14px", color: "#777", marginTop: "8px" }}>
              Rất tiếc, có sự cố ngoài ý muốn. Vui lòng thử lại.
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: "16px", padding: "8px 20px", borderRadius: "10px", border: "none", background: "#2a2a2a", color: "#fff", fontSize: "14px", cursor: "pointer" }}
            >
              Thử lại
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
