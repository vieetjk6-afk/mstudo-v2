/* Kiểm thử luật "mỗi người một tin" của thông báo đẩy.
 *
 * Lỗi đã xảy ra: khách bấm "đã chọn xong" một lần, studio nhận BA thông báo đẩy
 * liên tiếp. Nguyên nhân không phải gửi ba lần, mà là chủ studio có ba đăng ký
 * còn sống cho cùng một người (Safari, app đã thêm vào màn hình chính, máy tính,
 * hoặc đăng ký cũ từ lần cài trước). Trình duyệt chỉ gộp được các tin CÙNG một
 * đăng ký theo `tag`, nên ba đăng ký là ba tin nổi lên.
 *
 * Ba điều phải đúng:
 *  1. Một người nhiều đăng ký CÙNG loại thiết bị → đúng MỘT tin, gửi tới đăng
 *     ký MỚI NHẤT; khác loại (iPhone vs Chrome máy tính) → mỗi loại một tin.
 *  2. Lọc theo TÀI KHOẢN, không theo studio: nhân viên đăng ký chung owner_id
 *     với chủ, gom theo studio thì cả nhóm chỉ một người nhận được.
 *  3. Thiếu created_at (dữ liệu cũ) không được làm hỏng phép chọn.
 */
import { motThietBiMoiNguoi } from "../../src/lib/push-chon-thiet-bi.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ids = (list) => list.map((x) => x.id).sort();

check(
  "một người, ba đăng ký → một tin, gửi tới cái mới nhất",
  ids(
    motThietBiMoiNguoi([
      { id: "safari-cu", user_id: "u1", created_at: "2026-01-01T00:00:00Z" },
      { id: "may-tinh", user_id: "u1", created_at: "2026-02-01T00:00:00Z" },
      { id: "app-moi-cai", user_id: "u1", created_at: "2026-03-01T00:00:00Z" },
    ])
  ),
  ["app-moi-cai"]
);

check(
  "chủ studio và nhân viên (cùng studio) → mỗi người một tin",
  ids(
    motThietBiMoiNguoi([
      { id: "chu-cu", user_id: "chu", created_at: "2026-01-01T00:00:00Z" },
      { id: "chu-moi", user_id: "chu", created_at: "2026-03-01T00:00:00Z" },
      { id: "nv-cu", user_id: "nv", created_at: "2026-01-05T00:00:00Z" },
      { id: "nv-moi", user_id: "nv", created_at: "2026-02-05T00:00:00Z" },
    ])
  ),
  ["chu-moi", "nv-moi"]
);

check(
  "thiếu created_at → vẫn chọn được, ưu tiên dòng CÓ mốc thời gian",
  ids(
    motThietBiMoiNguoi([
      { id: "khong-moc", user_id: "u1", created_at: null },
      { id: "co-moc", user_id: "u1", created_at: "2026-01-01T00:00:00Z" },
    ])
  ),
  ["co-moc"]
);

check(
  "mốc thời gian hỏng → không văng, vẫn ra đúng một tin",
  motThietBiMoiNguoi([
    { id: "a", user_id: "u1", created_at: "khong-phai-ngay" },
    { id: "b", user_id: "u1", created_at: "cung-khong-phai" },
  ]).length,
  1
);

check("không có đăng ký nào → không gửi gì", motThietBiMoiNguoi([]), []);

const APPLE = (n) => `https://web.push.apple.com/Q${n}`;
const GOOGLE = (n) => `https://fcm.googleapis.com/fcm/send/${n}`;

check(
  "iPhone bật TRƯỚC, máy tính Chrome bật SAU → iPhone vẫn nhận (lỗi cũ: iPhone im)",
  ids(
    motThietBiMoiNguoi([
      { id: "iphone", user_id: "u1", created_at: "2026-01-01T00:00:00Z", endpoint: APPLE(1) },
      { id: "chrome-pc", user_id: "u1", created_at: "2026-02-01T00:00:00Z", endpoint: GOOGLE(1) },
    ])
  ),
  ["chrome-pc", "iphone"]
);

check(
  "cùng iPhone: tab Safari + app màn hình chính → vẫn MỘT tin (cái mới nhất)",
  ids(
    motThietBiMoiNguoi([
      { id: "safari-tab", user_id: "u1", created_at: "2026-01-01T00:00:00Z", endpoint: APPLE(1) },
      { id: "app-home", user_id: "u1", created_at: "2026-03-01T00:00:00Z", endpoint: APPLE(2) },
      { id: "chrome-pc", user_id: "u1", created_at: "2026-02-01T00:00:00Z", endpoint: GOOGLE(1) },
    ])
  ),
  ["app-home", "chrome-pc"]
);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
