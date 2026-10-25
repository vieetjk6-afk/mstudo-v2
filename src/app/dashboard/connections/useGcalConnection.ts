"use client";

import { useState } from "react";

/* Kết nối Google Calendar — logic chung cho bản cũ (GoogleCalendarConnect) và
   bản giao diện mới (GoogleCalendarV2): trạng thái đã nối + ngắt kết nối qua
   /api/gcal/disconnect. Nối thì đi thẳng /api/gcal/connect (OAuth Google). */

export interface GcalProps {
  connected: boolean;
  gcalStatus: string | null;
  gcalMsg: string | null;
}

/** Những gì được đồng bộ — một danh sách cho cả hai bản. */
export const GCAL_FEATURES = [
  "Tạo hợp đồng có ngày chụp → sự kiện tự thêm vào Google Calendar",
  "Tạo hoặc chỉnh sửa sự kiện trong Lịch studio → đồng bộ ngay lên Google Calendar",
  "Xoá sự kiện hoặc hợp đồng → tự xoá khỏi Google Calendar",
  "Dùng lịch chính (primary calendar) của tài khoản Google đã kết nối",
];

/** Các bước kết nối. */
export const GCAL_STEPS = [
  "Bấm \"Kết nối Google Calendar\" — trình duyệt chuyển sang trang đăng nhập Google",
  "Chọn tài khoản Google bạn muốn dùng → bấm \"Cho phép\" để cấp quyền quản lý sự kiện",
  "Quay lại studio — từ đây mọi hợp đồng có ngày chụp và sự kiện trong Lịch studio sẽ tự đồng bộ lên Google Calendar",
  "Cập nhật hoặc xoá trong studio → Google Calendar cũng tự thay đổi theo",
];

export function useGcalConnection(initialConnected: boolean) {
  const [connected, setConnected] = useState(initialConnected);
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/gcal/disconnect", { method: "POST" });
    setConnected(false);
    setDisconnecting(false);
  }

  return { connected, disconnecting, disconnect };
}
