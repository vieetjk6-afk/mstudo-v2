"use client";

import { ACCENT_COOKIE, UI_COOKIE, UI_COOKIE_MAX_AGE, type AccentKey } from "@/lib/ui-version";

function writeCookie(name: string, value: string) {
  // path=/ để mọi route của khu quản lý đọc chung một lựa chọn; SameSite=Lax là
  // đủ (cookie chỉ là sở thích hiển thị, server vẫn tự kiểm quyền dùng).
  document.cookie = `${name}=${value}; path=/; max-age=${UI_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Ghi lựa chọn giao diện. Người gọi phải `router.refresh()` sau đó: layout đọc
 * cookie ở server để chọn khung, nên chỉ một lần render lại là đổi khung — không
 * tải lại cả trang, không mất trạng thái đăng nhập.
 */
export function setUiVersion(v: "v1" | "v2") {
  writeCookie(UI_COOKIE, v);
}

/** Ghi màu chủ đạo. Khung mới đổi màu ngay bằng state, cookie để lần sau nhớ. */
export function setAccentCookie(key: AccentKey) {
  writeCookie(ACCENT_COOKIE, key);
}
