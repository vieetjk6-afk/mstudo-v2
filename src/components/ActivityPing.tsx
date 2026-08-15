"use client";

import { useEffect } from "react";
import { SESSION_GAP_MINUTES } from "@/lib/activity";

const KEY = "mstudo_activity_ping";

/**
 * Báo cho máy chủ biết tài khoản này vừa mở khu quản lý.
 *
 * Vì sao là component client chứ không ghi thẳng trong layout (server): layout
 * chạy lại ở mọi lượt điều hướng VÀ ở cả prefetch/bot, nên ghi ở đó vừa tốn một
 * lượt ghi DB mỗi lần bấm menu, vừa đếm cả những lượt không phải người thật mở.
 * Ở client, một lần mount = một người thật đang nhìn màn hình.
 *
 * Chặn lặp bằng sessionStorage chỉ để ĐỠ GỌI MẠNG; máy chủ vẫn tự chốt lại bằng
 * dữ liệu trong DB nên sửa/xoá sessionStorage cũng không bơm được số.
 */
export default function ActivityPing() {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(KEY) || "0");
      if (Date.now() - last < SESSION_GAP_MINUTES * 60_000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Trình duyệt chặn storage (ẩn danh, cookie bị khoá) → cứ gọi, máy chủ lo.
    }
    // keepalive: người dùng bấm sang trang khác ngay sau khi mở thì request vẫn
    // đi hết thay vì bị huỷ giữa chừng.
    fetch("/api/activity/ping", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  return null;
}
