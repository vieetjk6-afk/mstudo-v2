"use client";

import { useEffect } from "react";

/**
 * Màn lỗi cho các trang GỬI KHÁCH (album, hợp đồng, cổng khách…).
 *
 * Khác src/app/error.tsx ở chỗ KHÔNG tự chuyển trang: khách mở link studio gửi
 * thường chưa đăng nhập, nên error.tsx gốc sẽ đá họ về trang chủ mstudo sau 6
 * giây — mất luôn đường quay lại album/hợp đồng của mình. Ở đây chỉ báo lỗi
 * và cho bấm "Thử lại"; khách vẫn đứng nguyên trên đường dẫn của họ.
 */
export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi lại để còn lần ra lỗi từ console/log của trình duyệt.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-serif text-3xl font-medium">Chưa tải được trang</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
          Có trục trặc nhỏ khi mở trang này — có thể do mạng chập chờn. Bạn bấm
          thử lại nhé; nếu vẫn chưa được, hãy báo studio đã gửi đường dẫn cho bạn.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <button type="button" onClick={reset} className="btn-primary">Thử lại</button>
        </div>
      </div>
    </div>
  );
}
