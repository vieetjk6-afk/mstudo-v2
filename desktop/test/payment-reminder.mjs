/* Kiểm thử nút "Nhắc Zalo" của từng ĐỢT thanh toán: nội dung tin và bộ lọc URL
 * ảnh đính kèm.
 *
 * Vì sao đáng test:
 *
 *  • Tin nhắc tiền là tin nhạy cảm nhất studio gửi cho khách. Sai số tiền, sai
 *    nội dung chuyển khoản hay bảo khách "quét mã QR bên dưới" trong khi studio
 *    CHƯA cấu hình ngân hàng (không có ảnh nào gửi kèm) đều làm khách bối rối
 *    và gọi lại hỏi — mất đúng thứ mà nút này định tiết kiệm.
 *
 *  • `safeImageUrl` là hàng rào SSRF: ảnh đính kèm do TRÌNH DUYỆT truyền lên
 *    nhưng MÁY CHỦ mới là bên đi tải. Lọt một host lạ là máy chủ đi dò mạng nội
 *    bộ hộ người khác.
 *
 * Nạp thẳng code thật ở src/lib/.
 */
import { instalmentReminderMessage } from "../../src/lib/zalo/messages.ts";
import { safeImageUrl, imageDims } from "../../src/lib/zalo/image.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const QR = "https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=15000000&addInfo=HD26%20D2";

// ── Nội dung tin nhắc một đợt ──────────────────────────────────────────────
const full = instalmentReminderMessage({
  name: "Chị Lan",
  title: "Chụp cưới Đà Lạt",
  label: "Đợt 2",
  amount: "15.000.000 ₫",
  dueDate: "05/09/2026",
  overdue: true,
  bankLine: "Vietcombank · 0123456789 · NGUYEN VAN A",
  transferNote: "HD26 Đợt 2",
  qrLink: QR,
  link: "https://mai.mstudo.vn/c/abc",
  studio: "Mai Studio",
});

check("gọi đúng tên đợt", full.includes("Đợt 2"), true);
check("nói đúng số tiền CỦA ĐỢT", full.includes("15.000.000 ₫"), true);
check("nói rõ đã quá hạn kèm ngày", full.includes("(đã quá hạn 05/09/2026)"), true);
check("kèm số tài khoản để chuyển tay", full.includes("Vietcombank · 0123456789"), true);
check("kèm nội dung chuyển khoản", full.includes("Nội dung chuyển khoản: HD26 Đợt 2"), true);
check("kèm link ảnh QR (phòng khi kênh gửi không đính kèm được)", full.includes(QR), true);
check("kèm link cổng khách", full.includes("https://mai.mstudo.vn/c/abc"), true);
check("ký tên studio ở cuối", full.trimEnd().endsWith("— Mai Studio"), true);

const upcoming = instalmentReminderMessage({
  name: "Anh Nam", label: "Cọc hợp đồng", amount: "5.000.000 ₫", dueDate: "01/10/2026", qrLink: QR,
});
check("chưa tới hạn thì ghi 'hạn …', không ghi quá hạn", upcoming.includes("(hạn 01/10/2026)"), true);
check("chưa tới hạn thì KHÔNG doạ quá hạn", upcoming.includes("quá hạn"), false);

// Chưa cấu hình ngân hàng → không có ảnh QR nào gửi kèm.
const noBank = instalmentReminderMessage({ label: "Đợt 3", amount: "2.000.000 ₫", link: "https://x/c/y" });
check("không có QR thì không bảo khách quét mã", noBank.includes("quét mã QR"), false);
check("không có tên khách thì xưng hô chung", noBank.startsWith("Chào anh/chị,"), true);
check("vẫn còn link cổng khách để khách tự xem", noBank.includes("https://x/c/y"), true);

const noLabel = instalmentReminderMessage({ label: "  ", amount: "1.000.000 ₫" });
check("đợt chưa đặt tên vẫn thành câu đọc được", noLabel.includes("nhắc đợt thanh toán: 1.000.000 ₫"), true);

// ── Hàng rào ảnh đính kèm ──────────────────────────────────────────────────
check("nhận ảnh VietQR", safeImageUrl(QR), QR);
check("nhận api.vietqr.io", safeImageUrl("https://api.vietqr.io/image/x.png"), "https://api.vietqr.io/image/x.png");
check("chặn host lạ", safeImageUrl("https://evil.example/x.png"), null);
check("chặn host chỉ NHÌN GIỐNG vietqr", safeImageUrl("https://img.vietqr.io.evil.example/x.png"), null);
check("chặn http (không mã hoá)", safeImageUrl("http://img.vietqr.io/x.png"), null);
check("chặn mạng nội bộ", safeImageUrl("http://169.254.169.254/latest/meta-data/"), null);
check("chặn file://", safeImageUrl("file:///etc/passwd"), null);
check("chặn chuỗi không phải URL", safeImageUrl("img.vietqr.io/x.png"), null);
check("rỗng → không có ảnh", safeImageUrl(""), null);
check("null → không có ảnh", safeImageUrl(null), null);

// ── Đọc kích thước ảnh ─────────────────────────────────────────────────────
// zca-js BẮT BUỘC có width/height mới tải ảnh lên Zalo được — đọc sai là tin
// rơi về dạng chỉ có link, đúng lỗi đã gặp ở bản đầu. Dựng ảnh thật để đo.
import QRCode from "qrcode";
const png = await QRCode.toBuffer("https://img.vietqr.io/x", { margin: 1, width: 320 });
check("đọc đúng cỡ ảnh PNG thật", imageDims(png), { width: 320, height: 320, ext: "png" });

// JPEG dựng tay: SOI + APP0 + SOF0 (cao 480, rộng 640) — đủ để chắc vòng duyệt
// đoạn không dừng ở đoạn đầu tiên.
const jpg = Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
]);
check("đọc đúng cỡ ảnh JPEG", imageDims(jpg), { width: 640, height: 480, ext: "jpg" });

check("không phải ảnh → null (để lùi về gửi văn bản)", imageDims(Buffer.from("<html>không phải ảnh</html>")), null);
check("buffer rỗng → null", imageDims(Buffer.alloc(0)), null);
check("PNG cụt đầu → null", imageDims(png.subarray(0, 12)), null);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
