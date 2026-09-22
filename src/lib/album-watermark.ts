import type { CSSProperties } from "react";

/**
 * Lớp watermark của một ô ảnh trong lưới album — MỘT thẻ, không phải tám.
 *
 * Bản trước rải 8 thẻ <span> chữ trong mỗi ô. Nhân lên album 2–3 nghìn ảnh là
 * thêm hai chục nghìn thẻ chỉ để vẽ chữ mờ: trình duyệt phải đo và xếp chữ cho
 * từng thẻ một, và trên điện thoại đó là phần lớn thời gian layout của trang.
 *
 * Giờ chữ nằm trong MỘT ảnh SVG lặp nền: trình duyệt vẽ một mẫu rồi trải ra,
 * không có chữ nào phải đo. Nhìn vẫn là chữ nghiêng -30° lặp đều, mờ như cũ.
 *
 * Chữ được nhét vào SVG nên phải thoát ký tự &, <, > — tên studio có dấu "&"
 * (kiểu "Mây & Nắng") mà để nguyên là hỏng cả ảnh nền, mất sạch watermark.
 */
export function watermarkLayer(text: string): CSSProperties {
  const chu = text.trim() || "";
  const an = chu.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Ô mẫu đủ rộng cho chữ nghiêng: ~7,2px mỗi ký tự ở cỡ 12px + khoảng thở.
  const w = Math.max(120, Math.round(chu.length * 7.2) + 56);
  const h = 104;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<text x="50%" y="50%" transform="rotate(-30 ${w / 2} ${h / 2})"` +
    ` font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="12"` +
    ` font-weight="600" letter-spacing="1.5" fill="#fff"` +
    ` text-anchor="middle" dominant-baseline="middle">${an}</text>` +
    `</svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundRepeat: "repeat",
    backgroundPosition: "center",
  };
}
