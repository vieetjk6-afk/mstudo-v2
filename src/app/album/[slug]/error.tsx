"use client";

import CustomerError from "@/components/customer/CustomerError";

// Trang gửi khách: báo lỗi + "Thử lại", KHÔNG tự chuyển về trang chủ như
// src/app/error.tsx (xem ghi chú trong CustomerError).
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <CustomerError {...props} />;
}
