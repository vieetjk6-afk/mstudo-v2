/**
 * Màn chờ nhẹ cho các trang gửi khách trong lúc Server Component lấy dữ liệu:
 * hiện ngay khi bấm link thay vì để trắng trang tới khi truy vấn xong.
 * Chỉ một vòng xoay giữa màn hình theo token màu chung, để không "giật" sang
 * một bố cục khác hẳn trang thật (album nền tối, hợp đồng nền giấy…).
 */
export default function CustomerLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" role="status" aria-live="polite">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--text2)" }}
        aria-hidden="true"
      />
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}
