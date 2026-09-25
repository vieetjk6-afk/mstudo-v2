/* Kiểm thử phần thuần của tự xác nhận chuyển khoản (src/lib/bank-reconcile.ts).
 *
 * Vì sao đáng test:
 *
 *  • Dò mã sai theo hướng KHỚP OAN là ghi tiền của người này vào hợp đồng của
 *    người kia, tự động, không ai nhìn. Sai theo hướng KHÔNG KHỚP thì tính năng
 *    vô dụng: studio lại phải dò sao kê bằng tay.
 *    Ngân hàng nắn nội dung đủ kiểu: viết hoa, bỏ dấu, xoá dấu gạch, dán tiền tố
 *    "MBVCB.3278907687.", nối liền các chữ. Mọi kiểu phải ra ĐÚNG mã.
 *
 *  • Payload SePay là dữ liệu từ bên ngoài: tiền có thể đến dạng chuỗi, thiếu
 *    trường, hoặc là tiền RA. Đọc sai là ghi thu một khoản không có thật.
 *
 * Nạp thẳng code thật ở src/lib/.
 */
import {
  normalizeMemo,
  payCodeCandidates,
  depositCodeCandidates,
  parseSepay,
  hookSecretFromHeader,
  amountFit,
  vnTimeToIso,
  vnDate,
  newPayCode,
  newHookSecret,
  PAY_CODE_ALPHABET,
} from "../../src/lib/bank-reconcile.ts";
import { instalmentNote } from "../../src/lib/vietqr.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Chuẩn hoá nội dung ─────────────────────────────────────────────────────
check("bỏ dấu, viết hoa, bỏ ký tự lạ", normalizeMemo("Chuyển tiền cọc – đợt 1!"), "CHUYENTIENCOCDOT1");
check("đ/Đ thành D", normalizeMemo("Đặt đồ"), "DATDO");
check("null → rỗng", normalizeMemo(null), "");

// ── Dò mã đợt ──────────────────────────────────────────────────────────────
check("mã đứng đầu nội dung", payCodeCandidates("MSAB23CD45 HD-2026-001 Coc"), ["MSAB23CD45"]);
check("ngân hàng dán tiền tố + dấu chấm", payCodeCandidates("MBVCB.3278907687.MSAB23CD45 HD2026001.CT tu 0123"), ["MSAB23CD45"]);
check("viết thường vẫn nhận", payCodeCandidates("msab23cd45 coc"), ["MSAB23CD45"]);
check("khách gõ cách giữa mã", payCodeCandidates("MS AB23 CD45"), ["MSAB23CD45"]);
// Ứng viên THỪA vô hại (DB chỉ trả mã có thật, và mã thừa ngẫu nhiên trùng một
// mã thật là 1 phần ~850 tỉ). Ứng viên THIẾU mới là hỏng: tiền không tự ghi.
check("chữ MS đứng trước mã thật không làm lạc", payCodeCandidates("NGUYEN MS THU MSAB23CD45").includes("MSAB23CD45"), true);
check("MSMS… vẫn ra mã", payCodeCandidates("MSMSAB23CD45").includes("MSAB23CD45"), true);
check("ký tự dễ nhầm (0/O/1/I/L) không phải mã", payCodeCandidates("MSAB0OCD1I"), []);
check("thiếu ký tự thì không phải mã", payCodeCandidates("MSAB23CD4"), []);
check("không có mã", payCodeCandidates("chuyen tien an sang"), []);
check("hai mã khác nhau → cả hai", payCodeCandidates("MSAB23CD45 MSZZ22YY33").sort(), ["MSAB23CD45", "MSZZ22YY33"]);

// ── Dò mã cọc giữ ngày ─────────────────────────────────────────────────────
check("COC-7F3A nguyên dạng", depositCodeCandidates("COC-7F3A Nguyen Van A"), ["COC-7F3A"]);
check("ngân hàng xoá dấu gạch", depositCodeCandidates("COC7F3A NGUYEN VAN A"), ["COC-7F3A"]);
check("viết thường", depositCodeCandidates("coc-7f3a"), ["COC-7F3A"]);
check("khách gõ cách", depositCodeCandidates("COC 7F3A"), ["COC-7F3A"]);
check("ngân hàng nối tiền tố bằng dấu chấm", depositCodeCandidates("MBVCB.123.COC-7F3A.CT tu"), ["COC-7F3A"]);
check("chữ 'cọc' thường không phải mã", depositCodeCandidates("tien coc dam cuoi"), []);
check("chữ 'cọc' dính chữ sau không phải mã", depositCodeCandidates("TIENCOCDAMCUOI"), []);
check("mã dài hơn 4 ký tự không phải mã", depositCodeCandidates("COC-7F3AB"), []);

// ── Mã sinh ra phải dò lại được ────────────────────────────────────────────
{
  let allOk = true;
  for (let i = 0; i < 200; i++) {
    const c = newPayCode();
    const body = c.slice(2);
    if (!c.startsWith("MS") || body.length !== 8 || [...body].some((ch) => !PAY_CODE_ALPHABET.includes(ch))) allOk = false;
    const memo = instalmentNote("HD-2026-001", "Đặt cọc", c);
    if (!payCodeCandidates(memo).includes(c)) allOk = false;
  }
  check("200 mã sinh ngẫu nhiên đều dò lại được từ nội dung QR", allOk, true);
}
check("mã đợt đứng đầu nội dung QR", instalmentNote("HD-2026-001", "Đặt cọc", "MSAB23CD45"), "MSAB23CD45 HD-2026-001 Đặt cọc");
check("nội dung dài bị cắt vẫn giữ mã", instalmentNote("X".repeat(60), "Đợt", "MSAB23CD45").startsWith("MSAB23CD45"), true);
check("chưa có mã → nội dung như cũ", instalmentNote("HD-2026-001", "Đặt cọc"), "HD-2026-001 Đặt cọc");

// ── Payload SePay ──────────────────────────────────────────────────────────
const sample = {
  id: 92704,
  gateway: "Vietcombank",
  transactionDate: "2026-09-24 14:02:37",
  accountNumber: "0123499999",
  code: null,
  content: "MSAB23CD45 HD2026001 Dat coc",
  transferType: "in",
  transferAmount: 5000000,
  accumulated: 19077000,
  subAccount: null,
  referenceCode: "MBVCB.3278907687",
  description: "",
};
check("đọc payload mẫu", parseSepay(sample), {
  txnId: "92704",
  amount: 5000000,
  direction: "in",
  content: "MSAB23CD45 HD2026001 Dat coc",
  accountNumber: "0123499999",
  gateway: "Vietcombank",
  referenceCode: "MBVCB.3278907687",
  txnAt: "2026-09-24T07:02:37.000Z",
});
check("tiền dạng chuỗi vẫn nhận", parseSepay({ ...sample, transferAmount: "2500000" })?.amount, 2500000);
check("tiền ra → direction out", parseSepay({ ...sample, transferType: "out" })?.direction, "out");
check("thiếu id → bỏ", parseSepay({ ...sample, id: undefined }), null);
check("tiền 0 → bỏ", parseSepay({ ...sample, transferAmount: 0 }), null);
check("tiền rác → bỏ", parseSepay({ ...sample, transferAmount: "abc" }), null);
check("không phải object → bỏ", parseSepay("hello"), null);
check("mã SePay tự nhận (code) cũng được dò", payCodeCandidates(parseSepay({ ...sample, content: "chuyen tien", code: "MSZZ22YY33" })?.content), ["MSZZ22YY33"]);

// ── Giờ Việt Nam ───────────────────────────────────────────────────────────
check("giờ VN → UTC", vnTimeToIso("2026-01-01 06:30:00"), "2025-12-31T23:30:00.000Z");
check("sai dạng → null", vnTimeToIso("24/09/2026"), null);
check("ngày thu theo giờ VN (qua nửa đêm UTC)", vnDate("2026-09-24T18:00:00.000Z"), "2026-09-25");

// ── Header xác thực ────────────────────────────────────────────────────────
const key = "msk0123456789abcdef0123456789abcdef";
check("Apikey <khoá>", hookSecretFromHeader(`Apikey ${key}`), key);
check("apikey viết thường", hookSecretFromHeader(`apikey ${key}`), key);
check("Bearer <khoá>", hookSecretFromHeader(`Bearer ${key}`), key);
check("khoá trần", hookSecretFromHeader(key), key);
check("không có header", hookSecretFromHeader(null), null);
check("khoá quá ngắn", hookSecretFromHeader("Apikey abc"), null);
check("khoá có ký tự lạ", hookSecretFromHeader("Apikey abc' OR 1=1 --xxxxxxxxxx"), null);
check("khoá sinh ra qua được bộ đọc header", (() => { const s = newHookSecret(); return hookSecretFromHeader(`Apikey ${s}`) === s && s.length >= 32; })(), true);

// ── So tiền ────────────────────────────────────────────────────────────────
check("đúng tiền", amountFit(5_000_000, 5_000_000), "exact");
check("chuyển dư", amountFit(5_100_000, 5_000_000), "over");
check("chuyển thiếu", amountFit(3_000_000, 5_000_000), "under");

if (fail) {
  console.error(`\n${fail} kiểm tra hỏng.`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra đều qua.");
