/* Kiểm thử NGUỒN KHÁCH & PHỄU CHUYỂN ĐỔI.
 *
 * Vì sao đáng có test riêng: nguồn khách được ĐOÁN từ dữ liệu bẩn (utm do studio
 * tự gõ, referrer do trình duyệt đưa), và cái giá của đoán sai không nhìn thấy
 * được — nó chỉ hiện ra sáu tháng sau dưới dạng một biểu đồ nói studio nên đổ
 * tiền vào sai kênh. Ba luật phải giữ:
 *
 *   1. Không đoán được thì trả null. Thà để trống còn hơn dồn vào "khác" rồi
 *      studio tưởng đó là con số thật.
 *   2. Referrer NỘI BỘ (khách bấm từ trang này sang trang kia của chính studio)
 *      KHÔNG phải một nguồn.
 *   3. Tỉ lệ phễu không bao giờ được chia cho 0.
 *
 * Nạp thẳng code thật ở src/lib/lead-source.ts.
 */
import { buildFunnel, inferSource, isLeadSource, readUtm, sourceLabel } from "../../src/lib/lead-source.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${got}\n    cần : ${want}`}`);
};
const qs = (s) => new URLSearchParams(s);

/* ── readUtm ────────────────────────────────────────────────────────────── */
const u1 = readUtm(qs("utm_source=fb&utm_medium=cpc&utm_campaign=cuoi-thu"));
check("đọc utm_source", u1.source, "fb");
check("đọc utm_medium", u1.medium, "cpc");
check("đọc utm_campaign", u1.campaign, "cuoi-thu");

// Link quảng cáo Google/Meta thường chỉ có gclid/fbclid, studio quên đặt utm.
check("gclid không có utm_source → suy ra google", readUtm(qs("gclid=abc123")).source, "google");
check("fbclid không có utm_source → suy ra facebook", readUtm(qs("fbclid=xyz")).source, "facebook");
// utm_source thật thì thắng gclid, không được ghi đè.
check("utm_source thật thắng gclid", readUtm(qs("utm_source=zalo&gclid=abc")).source, "zalo");

check("không có tham số nào → object rỗng", Object.keys(readUtm(qs(""))).length, 0);
// Khoá rỗng phải bị bỏ hẳn, không lưu {source: undefined} xuống jsonb.
check("utm_source rỗng bị bỏ", "source" in readUtm(qs("utm_source=&utm_medium=cpc")), false);
// Tên chiến dịch dài bất thường bị cắt, không cho nhét dữ liệu vào cột.
check("cắt giá trị quá dài ở 120 ký tự", readUtm(qs(`utm_campaign=${"x".repeat(300)}`)).campaign.length, 120);

/* ── inferSource ────────────────────────────────────────────────────────── */
check("utm_source là nhãn hợp lệ sẵn", inferSource({ utm: { source: "referral" } }), "referral");
check("utm_source 'fb' → facebook", inferSource({ utm: { source: "fb" } }), "facebook");
check("utm_source 'Meta' → facebook", inferSource({ utm: { source: "Meta" } }), "facebook");
check("utm_source 'adwords' → google", inferSource({ utm: { source: "adwords" } }), "google");
check("utm_source 'gioi_thieu' → referral", inferSource({ utm: { source: "gioi_thieu" } }), "referral");
// Studio tự đặt tên kênh lạ: vẫn là nguồn CÓ THẬT, chỉ là không xếp được.
check("utm_source lạ → other", inferSource({ utm: { source: "bao-tuoi-tre" } }), "other");

check("referrer facebook", inferSource({ referrer: "https://m.facebook.com/x" }), "facebook");
check("referrer google", inferSource({ referrer: "https://www.google.com/search?q=studio" }), "google");
check("referrer instagram", inferSource({ referrer: "https://l.instagram.com/" }), "facebook");
check("referrer lạ → other", inferSource({ referrer: "https://vnexpress.net/bai-viet" }), "other");

// Luật 2: khách bấm từ trang này sang trang kia của CHÍNH studio.
check(
  "referrer nội bộ KHÔNG phải nguồn",
  inferSource({ referrer: "https://maistudio.vn/bang-gia", selfHost: "maistudio.vn" }),
  null,
);
check(
  "referrer nội bộ có www vẫn không phải nguồn",
  inferSource({ referrer: "https://www.maistudio.vn/bang-gia", selfHost: "www.maistudio.vn" }),
  null,
);

// Luật 1: không có gì để đoán.
check("không utm, không referrer → null", inferSource({}), null);
check("referrer rỗng → null", inferSource({ referrer: "" }), null);
check("referrer hỏng (không phải URL) → null", inferSource({ referrer: "khong-phai-url" }), null);

// ?ref= là link khách cũ giới thiệu — nói đúng ý định, thắng referrer.
check("?ref= thắng referrer", inferSource({ ref: "0912345678", referrer: "https://facebook.com/" }), "referral");
// nhưng utm do studio tự gắn vẫn thắng ?ref=.
check("utm thắng ?ref=", inferSource({ utm: { source: "google" }, ref: "0912345678" }), "google");

check("isLeadSource nhận nhãn hợp lệ", isLeadSource("walk_in"), true);
check("isLeadSource từ chối nhãn lạ", isLeadSource("hacker"), false);
check("isLeadSource từ chối số", isLeadSource(42), false);

check("nhãn của nguồn rỗng", sourceLabel(null), "Không rõ nguồn");
check("nhãn của nguồn đã biết", sourceLabel("facebook"), "Facebook");
check("nhãn của nguồn lạ giữ nguyên", sourceLabel("bao-tuoi-tre"), "bao-tuoi-tre");

/* ── buildFunnel ────────────────────────────────────────────────────────── */
const f = buildFunnel({ leads: 100, bookings: 40, contracts: 10, revenue: 500_000_000 });
check("bậc đầu không có tỉ lệ", f[0].rate, null);
check("40/100 = 40%", f[1].rate, 40);
check("10/40 = 25%", f[2].rate, 25);
check("bậc tiền không có tỉ lệ", f[3].rate, null);
check("bậc tiền giữ nguyên số tiền", f[3].value, 500_000_000);

// Luật 3: studio mới tinh, chưa có gì.
const zero = buildFunnel({ leads: 0, bookings: 0, contracts: 0, revenue: 0 });
check("không có lead → tỉ lệ null chứ không NaN", zero[1].rate, null);
check("không có yêu cầu → tỉ lệ null chứ không NaN", zero[2].rate, null);

// Studio chưa bật chatbox: bậc đầu = 0 nhưng hai bậc dưới vẫn có số thật.
const noChat = buildFunnel({ leads: 0, bookings: 12, contracts: 6, revenue: 30_000_000 });
check("bậc đầu 0 → tỉ lệ bậc 2 là null", noChat[1].rate, null);
check("bậc 3 vẫn tính được", noChat[2].rate, 50);

// Làm tròn tới 1 chữ số thập phân, không ra 33.33333333333333.
check("làm tròn 1 chữ số", buildFunnel({ leads: 3, bookings: 1, contracts: 0, revenue: 0 })[1].rate, 33.3);

// leads = null: KHÔNG ĐO ĐƯỢC (đang lọc theo một chi nhánh), khác hẳn 0. Phải
// BỎ HẲN bậc đầu chứ không vẽ nó bằng 0 — vẽ ra là studio đọc thành "tháng này
// không ai hỏi".
const scoped = buildFunnel({ leads: null, bookings: 12, contracts: 6, revenue: 30_000_000 });
check("không đo được → chỉ còn 3 bậc", scoped.length, 3);
check("bậc đầu còn lại là 'yêu cầu'", scoped[0].key, "bookings");
check("bậc 'yêu cầu' không có tỉ lệ khi thiếu bậc trên", scoped[0].rate, null);
check("bậc hợp đồng vẫn tính được", scoped[1].rate, 50);
// Còn leads = 0 thì vẫn phải GIỮ bậc đầu: đó là một sự thật ("chưa ai hỏi").
check("leads = 0 vẫn đủ 4 bậc", buildFunnel({ leads: 0, bookings: 0, contracts: 0, revenue: 0 }).length, 4);

console.log(fail ? `\n${fail} MỤC SAI` : "\nTẤT CẢ ĐỀU ĐÚNG");
process.exit(fail ? 1 : 0);
