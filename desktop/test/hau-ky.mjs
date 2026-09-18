/* Kiểm thử luật NGÀY của bước "Đang hậu kỳ".
 *
 * Vì sao đáng test: đây là bước chuyển TỰ ĐỘNG, không ai bấm nút nào. Sai thì
 * không nổ, không đỏ — chỉ là hợp đồng nằm sai trạng thái, và người phát hiện
 * ra là khách hoặc thợ, sau vài ngày.
 *
 * Hai cái bẫy, cả hai đều là lỗi lệch một bước:
 *   • Lấy ngày SỚM nhất thay vì MUỘN nhất: đám cưới nhiều buổi (đãi trước, cưới
 *     chính, chụp thêm hôm sau) sẽ nhảy sang "hậu kỳ" khi mới xong buổi đầu —
 *     trong khi thợ vẫn còn phải đi chụp.
 *   • Dùng `<=` thay vì `<`: hợp đồng đổi trạng thái NGAY GIỮA buổi chụp.
 *
 * Bước chuyển trước đó (sang "đang thực hiện") cố tình dùng ngày SỚM nhất và
 * `<=` — ngược hẳn. Hai luật ngược nhau nằm cạnh nhau là chỗ rất dễ chép nhầm.
 *
 * Nạp thẳng code thật ở src/lib/contract-phase.ts.
 */
import { latestShootDate, dueForPostProduction } from "../../src/lib/contract-phase.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Ngày chụp cuối: phải là MUỘN NHẤT ────────────────────────────────────── */

check("chỉ có ngày chụp chính", latestShootDate("2026-05-10", []), "2026-05-10");
check("chỉ có mốc, không có ngày chính", latestShootDate(null, ["2026-05-10"]), "2026-05-10");
check("không ngày nào → null", latestShootDate(null, []), null);
check("mốc null lẫn trong danh sách bị bỏ qua", latestShootDate("2026-05-10", [null, null]), "2026-05-10");

// Đây là ca thật của đám cưới: mốc "đãi trước" SỚM hơn ngày cưới chính, và mốc
// "chụp thêm hôm sau" MUỘN hơn. Phải ra ngày muộn nhất trong cả ba.
check("nhiều buổi → lấy buổi muộn nhất",
  latestShootDate("2026-05-10", ["2026-05-08", "2026-05-11"]), "2026-05-11");
check("mốc muộn hơn ngày chính", latestShootDate("2026-05-10", ["2026-06-01"]), "2026-06-01");
check("mốc sớm hơn ngày chính thì KHÔNG được thắng",
  latestShootDate("2026-05-10", ["2026-01-01"]), "2026-05-10");

/* ── Đã tới lúc sang hậu kỳ chưa ──────────────────────────────────────────── */

const HOM_NAY = "2026-05-10";

check("hôm nay đang là ngày chụp → CHƯA (vẫn đang chụp)",
  dueForPostProduction("2026-05-10", [], HOM_NAY), false);
check("ngày chụp là hôm qua → RỒI",
  dueForPostProduction("2026-05-09", [], HOM_NAY), true);
check("ngày chụp còn ở tương lai → chưa",
  dueForPostProduction("2026-05-20", [], HOM_NAY), false);
check("không có ngày nào → chưa (không đoán bừa)",
  dueForPostProduction(null, [], HOM_NAY), false);

// Cái bẫy chính: buổi đầu đã qua nhưng CÒN buổi chưa chụp.
check("buổi đầu đã qua, còn buổi ngày mai → CHƯA",
  dueForPostProduction("2026-05-08", ["2026-05-11"], HOM_NAY), false);
check("buổi đầu đã qua, buổi cuối cũng là hôm nay → CHƯA",
  dueForPostProduction("2026-05-08", ["2026-05-10"], HOM_NAY), false);
check("mọi buổi đều đã qua → RỒI",
  dueForPostProduction("2026-05-01", ["2026-05-08", "2026-05-09"], HOM_NAY), true);

// Chuỗi "YYYY-MM-DD" so sánh theo thứ tự chữ cái đúng bằng thứ tự thời gian —
// chốt lại vì cả hàm dựa vào tính chất đó.
check("so chuỗi qua mốc sang năm", dueForPostProduction("2025-12-31", [], "2026-01-01"), true);
check("so chuỗi trong cùng tháng, ngày 2 chữ số", dueForPostProduction("2026-05-09", [], "2026-05-10"), true);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
