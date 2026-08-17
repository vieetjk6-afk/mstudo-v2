"use client";

/* ── ĐÃ GỠ: buildZip() ──────────────────────────────────────────────────────
   Nén ảnh Drive thành ZIP ngay trong trình duyệt bắt MỌI byte ảnh phải đi qua
   /api/img: ZIP cần byte nằm trong JS, mà Drive không gửi header CORS nên không
   thể chuyển hướng thẳng sang Google như lượt xem thường. Một lượt tải ZIP ảnh
   gốc của album cưới 300 tấm ≈ 3,3 GB Fast Origin Transfer trên Vercel — đây là
   khoản tốn băng thông lớn nhất của cả hệ thống, và tốn lại từ đầu mỗi lần bấm
   vì không có lớp cache nào (DRIVE_IMG_CACHE_BUCKET cố ý để trống).

   Thay bằng hai đường sẵn có, đều tốn 0 byte của Vercel:
     • Lọc ảnh → "Copy sang Drive": chép thẳng file giữa hai thư mục Drive.
     • Link thư mục Drive trong gallery: Google tự nén và tự phục vụ.

   ZIP đóng gói file ĐÃ CÓ SẴN trong trình duyệt (ảnh máy khách, ảnh vừa nén,
   mã QR, DOCX/XLSX) vẫn giữ nguyên — chúng không kéo byte nào qua Vercel. */

function ensureExt(name: string, fallback: string): string {
  return /\.[a-z0-9]{2,4}$/i.test(name) ? name : `${name}.${fallback}`;
}

/**
 * Tải một ảnh Drive lẻ.
 *
 * Cả hai nhánh đều KHÔNG kéo byte ảnh vào JavaScript của trình duyệt:
 *   • có watermark → /api/img/watermark đóng dấu ở máy chủ rồi trả file kèm
 *     Content-Disposition, trình duyệt tải thẳng.
 *   • không watermark → 302 sang Drive, Google tự phục vụ (0 byte qua máy chủ).
 *
 * Bản cũ dựng canvas 2560px trong trình duyệt để đóng dấu. Cách đó khiến máy
 * yếu hết bộ nhớ khi tải nhiều ảnh, và bắt ảnh phải đi qua proxy dưới dạng
 * fetch CORS nên không tận dụng được cache của trình duyệt cho lượt tải lại.
 */
export function downloadImage(fileId: string, name: string, watermark?: string | null): void {
  const q = new URLSearchParams({ id: fileId });
  let href: string;
  if (watermark) {
    q.set("t", watermark);
    q.set("w", "2560");
    q.set("name", ensureExt(name, "jpg"));
    href = `/api/img/watermark?${q}`;
  } else {
    // Khách nhận đúng file gốc ⇒ để Google phục vụ luôn. Ảnh gốc trung bình
    // ~11 MB nên đây là khác biệt lớn nhất về băng thông.
    // Đánh đổi: tên file là tên trên Drive, vì thuộc tính `download` không có
    // hiệu lực sau khi chuyển hướng sang miền khác.
    q.set("dl", "1");
    href = `/api/img?${q}`;
  }
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  a.click();
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
