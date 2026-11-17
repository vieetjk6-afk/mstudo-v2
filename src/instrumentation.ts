import type { Instrumentation } from "next";

/*
 * Bắt mọi lỗi máy chủ KHÔNG ai bắt (trang, route handler, server action) để
 * ghi vào system_errors và nhắc admin khi gặp lỗi mới — trước đây chúng chỉ
 * nằm ở log Vercel không ai đọc.
 *
 * File này được dựng cho CẢ runtime Node lẫn Edge, nên không import tĩnh thứ gì
 * của Node: phần thân (Supabase service-role, server-only) chỉ được nạp bên
 * trong nhánh NEXT_RUNTIME === "nodejs" — đúng mẫu Next khuyên, để bản Edge
 * không kéo theo mã không chạy được ở đó.
 */

// Next gọi register() một lần lúc máy chủ khởi động. Không có gì phải khởi tạo.
export function register() {}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const { captureRequestError } = await import("@/lib/system-runs");
      await captureRequestError(err, request, context);
    }
  } catch {
    // Theo dõi không được phép sinh thêm lỗi cho request đang hỏng.
  }
};
