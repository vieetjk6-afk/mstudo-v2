/**
 * MÃ QR MỜI KHÁCH — mỗi khách một mã quét ra thiệp ghi đúng tên họ, in kèm tên
 * dưới mã. Dùng chung cho trình quản lý khách của thiệp (/thiep/sua/<token>) và
 * tab Khách mời của kế hoạch cưới (chế độ Quà cưới). Chỉ chạy trong trình duyệt
 * (canvas, tải file); `qrcode` và `jszip` nạp khi cần.
 */

/** Mã QR (dataURL PNG) của một link. */
export async function qrDataUrl(link: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(link, { margin: 1, width: 512, color: { dark: "#1a1205", light: "#ffffff" } });
}

/** Ghép QR + tên khách thành 1 ảnh PNG (để "QR hiện tên khách mời"). */
export function composeQrCard(name: string, qr: string, accent: string): Promise<Blob> {
  return new Promise((resolve) => {
    const W = 640, H = 760, pad = 64;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, pad, pad, W - 2 * pad, W - 2 * pad);
      ctx.fillStyle = accent; ctx.textAlign = "center";
      ctx.font = "500 24px 'Cormorant Garamond', Georgia, serif";
      ctx.fillText("TRÂN TRỌNG KÍNH MỜI", W / 2, W - pad + 66);
      ctx.fillStyle = "#1a1205";
      // Tên khách kiểu viết tay (dùng font script hệ thống — canvas không dùng được biến CSS).
      ctx.font = "italic 46px 'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive";
      ctx.fillText(name.length > 24 ? name.slice(0, 23) + "…" : name, W / 2, W - pad + 122);
      cv.toBlob((b) => resolve(b!), "image/png");
    };
    img.src = qr;
  });
}

/** Tên file không dấu: "Gia đình chú Ba" → "gia-dinh-chu-ba". */
export function qrFileBase(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "khach";
}

export function downloadBlob(blob: Blob, filename: string, keepMs = 4000) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), keepMs);
}

/** Tải QR của MỘT khách. `qr` có sẵn thì dùng luôn, không thì tạo từ link. */
export async function downloadGuestQr(name: string, link: string, accent: string, qr?: string) {
  const blob = await composeQrCard(name, qr ?? (await qrDataUrl(link)), accent);
  downloadBlob(blob, `qr-${qrFileBase(name)}.png`);
}

/** Tải QR của TẤT CẢ khách thành một file .zip — tên trùng thì thêm số. */
export async function downloadGuestQrZip(guests: { name: string; link: string; qr?: string }[], accent: string) {
  if (!guests.length) return;
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used: Record<string, number> = {};
  for (const g of guests) {
    let qr = g.qr;
    if (!qr) {
      try { qr = await qrDataUrl(g.link); } catch { continue; /* bỏ qua tên lỗi */ }
    }
    const blob = await composeQrCard(g.name, qr, accent);
    let base = qrFileBase(g.name);
    if (used[base] != null) { used[base]++; base = `${base}-${used[base]}`; } else used[base] = 0;
    zip.file(`${base}.png`, blob);
  }
  downloadBlob(await zip.generateAsync({ type: "blob" }), "qr-khach-moi.zip", 8000);
}
