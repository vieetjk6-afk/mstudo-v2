/**
 * ĐƯỜNG DẪN NÀO DÙNG SHELL STUDIO (sidebar xanh, màu nhấn #1e9e72).
 *
 * Tách khỏi `DashboardChrome` vì có HAI thứ cần cùng một câu trả lời:
 *   • `DashboardChrome` — chọn vẽ shell studio hay khung dashboard thường.
 *   • `NavProgress` — thanh tiến độ điều hướng ở đỉnh trang, phải mang màu của
 *     khu đang mở, nếu không nó luôn vàng kể cả khi đang ở trong khu studio.
 *
 * Vì sao NavProgress không nhận màu từ DashboardChrome. Hai component là ANH EM
 * trong `dashboard/layout.tsx`, NavProgress còn đứng TRƯỚC — nên không có đường
 * truyền prop. Và cũng không dồn NavProgress vào trong shell được: `<main>` mang
 * `.page-in` (animation `transform` + `fill-mode: both`), nên nó là containing
 * block của mọi phần tử `position: fixed` bên trong — thanh tiến độ sẽ dính vào
 * `<main>` thay vì đỉnh cửa sổ. Ghi chú trong globals.css đã cảnh báo đúng bẫy này.
 *
 * Nên cả hai cùng gọi hàm ở đây. Một luật, hai nơi dùng, không lệch nhau được.
 */

export type ShellTier = "none" | "booking" | "plus" | "full";

/**
 * Đường dẫn này thuộc khu quản lý studio?
 *
 * Giữ NGUYÊN từng dòng điều kiện của bản trước khi tách (kể cả `/dashboard`
 * trần và `/dashboard/albums` lặp lại trong nhánh thứ hai) — đây là hàm được
 * rút ra, không phải dịp dọn dẹp: đổi một dòng ở đây là đổi trang nào vẽ bằng
 * shell nào.
 *
 * `tier` quyết định nhóm thứ hai: các trang liền kề chỉ vào shell studio khi tài
 * khoản CÓ gói studio — tài khoản thường mở chúng thì vẫn là khung dashboard cũ.
 */
export function isStudioPath(pathname: string, tier: ShellTier): boolean {
  const p = pathname || "";
  return (
    p.startsWith("/dashboard/studio") ||
    p.startsWith("/dashboard/albums") ||
    (tier !== "none" &&
      (p.startsWith("/dashboard/site") ||
        p.startsWith("/dashboard/upgrade") ||
        p.startsWith("/dashboard/settings") ||
        // Nhóm "Tài khoản" của sidebar mới trỏ sang các trang này — nếu không
        // nhận là màn studio thì bấm một mục trong sidebar lại rơi ra header cũ.
        p.startsWith("/dashboard/account") ||
        p.startsWith("/dashboard/affiliate") ||
        p.startsWith("/dashboard/connections") ||
        p.startsWith("/dashboard/admin") ||
        // Bộ công cụ ảnh chạy ngay trong shell studio (không chuyển hướng ra ngoài)
        p === "/dashboard" ||
        p.startsWith("/dashboard/albums") ||
        p.startsWith("/dashboard/create") ||
        p.startsWith("/dashboard/tools") ||
        p.startsWith("/dashboard/filter") ||
        p.startsWith("/dashboard/compress")))
  );
}

/** Màu thanh tiến độ điều hướng: xanh studio trong khu quản lý, vàng ngoài đó. */
export function navProgressColor(pathname: string, tier: ShellTier): string {
  return isStudioPath(pathname, tier) ? "#1e9e72" : "var(--gold)";
}
