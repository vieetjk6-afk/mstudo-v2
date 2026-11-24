/* ── Khoá cuộn trang khi có lớp phủ (hộp thoại, ngăn kéo, khung xem ảnh) ──────
 *
 * Trước đây mỗi lớp phủ tự làm: nhớ `body.style.overflow` cũ → đặt "hidden" →
 * đóng thì trả lại giá trị đã nhớ. Cách đó hỏng khi các lớp lồng nhau và đóng
 * KHÔNG đúng thứ tự ngược lại lúc mở. Ví dụ hay gặp: bấm một link nằm trong hộp
 * thoại mở từ ngăn kéo → chuyển trang, React gỡ cả hai, chạy dọn dẹp của lớp
 * NGOÀI trước (trả về "") rồi tới lớp TRONG (trả về "hidden" mà nó nhớ lúc mở)
 * → trang mới mở ra đã bị khoá cuộn, lăn chuột / vuốt không nhúc nhích tới khi
 * tải lại trang.
 *
 * Giờ dùng bộ đếm chung: lớp đầu tiên mở thì khoá, lớp cuối cùng đóng thì mở
 * khoá — thứ tự đóng không còn quan trọng.
 */

let count = 0;

/** Khoá cuộn trang; trả về hàm mở khoá (gọi nhiều lần cũng chỉ tính một). */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  count += 1;
  if (count === 1) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    if (count === 0) document.body.style.overflow = "";
  };
}

/**
 * Lưới an toàn khi chuyển trang: không còn lớp phủ nào giữ khoá mà body vẫn
 * "hidden" (mã cũ / thư viện ngoài để sót) thì gỡ ra.
 */
export function releaseStrayScrollLock(): void {
  if (typeof document === "undefined") return;
  if (count === 0 && document.body.style.overflow === "hidden") document.body.style.overflow = "";
}
