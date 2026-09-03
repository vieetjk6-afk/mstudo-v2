/* Kiểm thử luật ĐÁNH GIÁ KHÁCH.
 *
 * Hai chuyện dễ sai mà mắt không thấy:
 *
 *   1. Ba trạng thái (chờ duyệt · đang hiện · đã ẩn) nằm trên HAI cột
 *      (`approved` + `moderated_at`), vì "chờ duyệt" và "đã ẩn" trong DB đều là
 *      approved=false. Nếu phân loại sai thì đánh giá bị ẩn cứ quay lại tab
 *      "Chờ duyệt" mãi, hoặc badge sidebar không bao giờ về 0. Và bản được
 *      studio TRẢ LỜI nhưng chưa quyết vẫn phải nằm ở "chờ duyệt" — đây chính
 *      là lý do `moderated_at` phải là cột riêng, không dùng ké `replied_at`.
 *
 *   2. Điểm trung bình chỉ được tính trên bản ĐÃ DUYỆT. Khách chỉ thấy bản đã
 *      duyệt, nên nếu studio tính cả bản đang ẩn thì con số studio khoe khác
 *      con số khách tự cộng được — mất tin ngay.
 *
 * Nạp thẳng code thật ở src/lib/types.ts (reviewScore) và lặp lại đúng hàm phân
 * loại của màn hình.
 */
import { reviewScore } from "../../src/lib/types.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${got}\n    cần : ${want}`}`);
};

/* ── 1. Phân loại ba trạng thái ─────────────────────────────────────────── */
// Cùng luật với `bucketOf` trong ReviewsView.tsx.
const bucketOf = (r) => (r.approved ? "live" : r.moderated_at ? "hidden" : "pending");

const T = "2026-09-01T10:00:00Z";
check("mới gửi, studio chưa động vào", bucketOf({ approved: false, moderated_at: null }), "pending");
check("studio đã duyệt", bucketOf({ approved: true, moderated_at: T }), "live");
check("studio đã chủ động ẩn", bucketOf({ approved: false, moderated_at: T }), "hidden");

// Ca lõi: trả lời KHÔNG được đẩy đánh giá ra khỏi hàng chờ duyệt. Studio hoàn
// toàn có thể soạn lời đáp cho một đánh giá xấu rồi mới cân nhắc cho hiện.
check(
  "đã trả lời nhưng CHƯA quyết → vẫn chờ duyệt",
  bucketOf({ approved: false, moderated_at: null, replied_at: T, reply: "Cảm ơn anh chị" }),
  "pending",
);

// Hàng cũ của studio đang chạy: migration đóng moderated_at cho mọi bản đang
// hiện, nên chúng không đổ vào tab Chờ duyệt ngay lần đầu mở màn hình.
check("hàng cũ đang hiện (migration đã đóng mốc)", bucketOf({ approved: true, moderated_at: T }), "live");

/* ── 2. Điểm trung bình ─────────────────────────────────────────────────── */
const rows = [
  { rating: 5, approved: true },
  { rating: 4, approved: true },
  { rating: 1, approved: false }, // đang ẩn — KHÔNG được kéo điểm xuống
  { rating: null, approved: true }, // chỉ viết chữ, không chấm sao
  { rating: 3, approved: false }, // chờ duyệt
];
const s = reviewScore(rows);
check("điểm trung bình chỉ tính bản đã duyệt", s.avg, 4.5);
check("số đánh giá có chấm sao (đã duyệt)", s.rated, 2);
check("số bản chưa duyệt", s.pending, 2);

const empty = reviewScore([{ rating: 2, approved: false }]);
check("chưa có bản duyệt nào → không có điểm", empty.avg, null);
check("chưa có bản duyệt nào → rated = 0", empty.rated, 0);

// Không có đánh giá nào thì cũng không được chia cho 0.
check("bảng rỗng → avg null", reviewScore([]).avg, null);
check("bảng rỗng → pending 0", reviewScore([]).pending, 0);

console.log(fail ? `\n${fail} MỤC SAI` : "\nTẤT CẢ ĐỀU ĐÚNG");
process.exit(fail ? 1 : 0);
