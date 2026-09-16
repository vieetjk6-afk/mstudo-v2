/* Kiểm thử luật đặt tên miền phụ của studio (<sub>.mstudo.com).
 *
 * Vì sao đáng test: hàm này là hàng rào DUY NHẤT giữa cái studio gõ và một host
 * thật. Lọt một nhãn không chạy được thì hậu quả không phải "báo lỗi" mà là
 * "trang trắng, không ai hiểu vì sao":
 *
 *   • Nhãn hệ thống (www, admin, img, thiep, api…) — middleware coi chúng là
 *     host của nền tảng nên KHÔNG BAO GIỜ rẽ vào trang studio. Lưu được vào
 *     bảng `sites` nhưng mở link ra thì thấy landing hoặc bị chuyển hướng.
 *   • Nhãn hạ tầng (mail, ns1, cdn…) — DNS của chúng thường trỏ tới máy chủ
 *     mail/CDN chứ không tới Vercel, nên request còn chẳng tới được app.
 *
 * Trình tạo website VÀ /api/site/subdomain dùng chung đúng hàm này — lệch luật
 * giữa hai nơi thì trình duyệt cho qua mà máy chủ chặn (hoặc tệ hơn: ngược lại).
 *
 * Nạp thẳng code thật ở src/lib/hosts.ts.
 */
import { RESERVED_SUBDOMAINS, subdomainError } from "../../src/lib/hosts.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
/** Chỉ quan tâm "có lỗi hay không", không so từng câu chữ thông báo. */
const ok = (v) => subdomainError(v) === null;

// ── Tên hợp lệ ────────────────────────────────────────────────────────────
check("tên thường", ok("anh-vien-hoa"), true);
check("có số", ok("studio2025"), true);
check("đúng 3 ký tự (ngắn nhất)", ok("abc"), true);
check("đúng 30 ký tự (dài nhất)", ok("a".repeat(30)), true);
check("CHỮ HOA vẫn nhận (tự hạ chữ)", ok("MyStudio"), true);
check("có khoảng trắng thừa hai đầu", ok("  my-studio  "), true);

// ── Sai định dạng ─────────────────────────────────────────────────────────
check("để trống", ok(""), false);
check("chỉ khoảng trắng", ok("   "), false);
check("2 ký tự — quá ngắn", ok("ab"), false);
check("31 ký tự — quá dài", ok("a".repeat(31)), false);
check("có dấu chấm (nhiều cấp)", ok("a.b"), false);
check("có gạch dưới", ok("my_studio"), false);
check("có dấu tiếng Việt", ok("ảnh-viện"), false);
check("mở đầu bằng gạch ngang", ok("-studio"), false);
check("kết thúc bằng gạch ngang", ok("studio-"), false);
check("tiền tố xn-- (tên miền mã hoá)", ok("xn--abc"), false);

// ── Nhãn bị giữ chỗ ───────────────────────────────────────────────────────
check("www", ok("www"), false);
check("admin", ok("admin"), false);
check("img", ok("img"), false);
check("thiep", ok("thiep"), false);
check("album", ok("album"), false);
check("api", ok("api"), false);
check("mail", ok("mail"), false);
check("cdn", ok("cdn"), false);
check("WWW (khác hoa thường vẫn chặn)", ok("WWW"), false);
check("www có khoảng trắng vẫn chặn", ok(" www "), false);

// Chặn "admin" mà quên "administrator"? Không sao — cái sau là tên bình thường,
// không phải host hệ thống. Test này giữ đúng ranh giới đó: chỉ chặn nhãn CÓ
// trong danh sách, đừng chặn lan sang tên hợp lệ của studio.
check("administrator vẫn dùng được", ok("administrator"), true);
check("mailbox vẫn dùng được", ok("mailbox"), true);

// ── Danh sách giữ chỗ phải đồng bộ với middleware ─────────────────────────
// Mọi host hệ thống mà middleware nhận ra (xem systemHosts trong
// src/middleware.ts) đều phải nằm trong danh sách này, nếu không studio lấy
// được tên rồi trang không bao giờ mở.
for (const label of ["www", "album", "img", "admin", "thiep"]) {
  check(`RESERVED có “${label}”`, RESERVED_SUBDOMAINS.has(label), true);
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
