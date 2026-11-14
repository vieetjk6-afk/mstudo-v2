"use client";

/**
 * Báo máy chủ bỏ bản nhớ của website công khai sau khi studio lưu (xem
 * /api/site/revalidate). Gom các lần lưu dồn dập (gõ chữ, kéo thả) thành một
 * lượt gọi 1,5 giây sau lần lưu cuối; lỗi mạng thì thôi — bản nhớ tự hết sau 5 phút.
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export function refreshPublicSite(): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void fetch("/api/site/revalidate", { method: "POST", keepalive: true }).catch(() => {});
  }, 1500);
}
