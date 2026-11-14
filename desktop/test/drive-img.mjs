/* Kiểm thử địa chỉ ảnh Drive (src/lib/drive.ts).
 *
 * Vì sao. Ảnh HIỂN THỊ nay trỏ thẳng CDN Google (lh3) thay vì đi vòng /api/img
 * — bỏ một lượt gọi Vercel cho mỗi ảnh. Ba thứ không được vỡ theo:
 *   · chỗ cần BYTE cùng miền (watermark, quét AI, xuất ảnh ghép) vẫn ra /api/img?…&raw=1;
 *   · ảnh bìa LƯU DB vẫn dạng /api/img (so "ảnh nào là bìa" với dữ liệu cũ);
 *   · ảnh hỏng vẫn có đường dự phòng: lh3 → drive.google.com/thumbnail → (khung
 *     xem lớn) proxy đọc byte.
 *
 * Chạy: node --experimental-strip-types desktop/test/drive-img.mjs
 */
let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

const { thumbnailUrl, fullImageUrl, rawImageUrl, coverImageUrl, proxyImageUrl, retryAltHost, retryViaProxy } = await import(
  "../../src/lib/drive.ts"
);
const ID = "1AbC_d-EfGh";

ok("ảnh lưới trỏ thẳng CDN Google", thumbnailUrl(ID, 400) === `https://lh3.googleusercontent.com/d/${ID}=w400`, thumbnailUrl(ID, 400));
ok("ảnh lớn trỏ thẳng CDN Google, kẹp ≤ 4096", fullImageUrl(ID, 9000) === `https://lh3.googleusercontent.com/d/${ID}=w4096`);
ok("byte cùng miền vẫn qua proxy raw=1", rawImageUrl(ID, 640) === `/api/img?id=${ID}&w=640&raw=1`);
ok("ảnh bìa lưu DB vẫn dạng /api/img (khớp dữ liệu cũ)", coverImageUrl(ID) === `/api/img?id=${ID}&w=800`);
ok("proxyImageUrl giữ dạng cũ", proxyImageUrl(ID, 480) === `/api/img?id=${ID}&w=480`);

const img = (src) => ({ src, dataset: {} });

// Lưới: lh3 hỏng → thumbnail của Drive → hết (không bao giờ kéo byte qua Vercel)
{
  const im = img(thumbnailUrl(ID, 400));
  ok("ảnh lưới hỏng → thử drive.google.com/thumbnail", retryAltHost({ currentTarget: im }) && im.src === `https://drive.google.com/thumbnail?id=${ID}&sz=w400`, im.src);
  ok("…hỏng tiếp → dừng, không rơi xuống proxy đọc byte", !retryAltHost({ currentTarget: im }) && im.dataset.retried === "done" && !im.src.includes("/api/img"));
}
// Ảnh bìa đã lưu dạng /api/img: lh3 trực tiếp trước, rồi thumbnail
{
  const im = img(`http://x${coverImageUrl(ID)}`);
  retryAltHost({ currentTarget: im });
  ok("bìa dạng /api/img hỏng → thử lh3 trực tiếp trước", im.src === `https://lh3.googleusercontent.com/d/${ID}=w800`, im.src);
  retryAltHost({ currentTarget: im });
  ok("…rồi tới drive.google.com/thumbnail", im.src === `https://drive.google.com/thumbnail?id=${ID}&sz=w800`, im.src);
}
// Khung xem lớn: hết đường Google thì mới về proxy đọc byte (kẹp 2560)
{
  const im = img(fullImageUrl(ID, 4096));
  retryViaProxy({ currentTarget: im });
  ok("ảnh lớn hỏng → thumbnail của Drive trước", im.src.startsWith("https://drive.google.com/thumbnail"), im.src);
  retryViaProxy({ currentTarget: im });
  ok("…rồi proxy đọc byte cùng miền, kẹp 2560", im.src === `/api/img?id=${ID}&w=2560&raw=1`, im.src);
  const before = im.src;
  retryViaProxy({ currentTarget: im });
  ok("…không lặp vô hạn", im.src === before);
}
{
  const im = img("https://example.com/khac.jpg");
  ok("ảnh ngoài app → không đụng tới", !retryAltHost({ currentTarget: im }) && im.src === "https://example.com/khac.jpg");
}

console.log(fail ? `\n${fail} kiểm tra hỏng` : "\nTất cả kiểm tra đều qua");
process.exit(fail ? 1 : 0);
