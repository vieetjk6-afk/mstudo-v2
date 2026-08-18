"use client";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw a tiled, diagonal watermark over an image and return a JPEG blob. */
async function watermarkImage(img: HTMLImageElement, text: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(18, Math.round(canvas.width / 28));
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const stepX = fontSize * 12;
  const stepY = fontSize * 6;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-30 * Math.PI) / 180);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
    for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9)
  );
}

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
 * Tải một ảnh Drive lẻ. Nếu có `watermark` → đóng watermark bằng canvas (ảnh
 * ~2560px) để ảnh tải về vẫn được bảo vệ; nếu không → tải THẲNG từ Drive.
 */
export async function downloadImage(fileId: string, name: string, watermark?: string | null): Promise<void> {
  if (watermark) {
    // raw=1: bắt /api/img trả BYTE cùng miền thay vì 302 sang Google. Trình
    // duyệt cũ (Safari iOS ≤ 16.3, webview Zalo/Facebook) không gửi
    // Sec-Fetch-*, thiếu cờ này thì rơi vào nhánh "ảnh hiển thị" → canvas bị
    // tainted → toBlob() ném lỗi, không đóng được watermark.
    const img = await loadImage(`/api/img?id=${encodeURIComponent(fileId)}&w=2560&raw=1`);
    const blob = await watermarkImage(img, watermark);
    triggerDownload(blob, ensureExt(name, "jpg"));
    return;
  }
  // Không watermark ⇒ khách nhận đúng file gốc, nên để Google phục vụ luôn.
  // /api/img?dl=1 chỉ 302 sang Drive: không byte nào đi qua Vercel/Supabase
  // (ảnh gốc trung bình ~11 MB — tải thẳng là khác biệt lớn nhất về băng thông).
  // Drive trả Content-Disposition: attachment nên trình duyệt tải xuống mà
  // không rời trang. Đánh đổi: tên file là tên trên Drive, vì thuộc tính
  // `download` không có hiệu lực sau khi chuyển hướng sang miền khác.
  const a = document.createElement("a");
  a.href = `/api/img?id=${encodeURIComponent(fileId)}&dl=1`;
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
