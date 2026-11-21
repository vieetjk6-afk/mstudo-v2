/* Kiểm thử bộ dựng bản in hợp đồng (src/lib/contract-print.ts).
 *
 * Vì sao đáng test: bản in là thứ khách KÝ. Ba chỗ dễ sai âm thầm mà nhìn PDF
 * không ra ngay:
 *   1. Dòng "Bằng chữ" — sai một tiếng ("mươi/mười", "lăm/năm", "lẻ") là hợp
 *      đồng giấy sai số tiền so với bảng tổng.
 *   2. Đánh số mục — hợp đồng không có kế hoạch thanh toán/lịch trình thì mục
 *      kế tiếp phải là số liền sau, không được nhảy cóc.
 *   3. Thoát HTML & lọc src ảnh — tên khách có dấu "<" hay logo/chữ ký dạng
 *      "javascript:" không được chui thẳng vào trang in.
 */
import {
  vndInWords,
  contractPrintBody,
  contractPrintDocument,
  printVnd,
  printFooterLabel,
  vnSignDate,
  signVerifyLine,
} from "../../src/lib/contract-print.ts";
import { quotePrintData } from "../../src/lib/quote-print.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const checkTrue = (name, got) => check(name, got, true);

// ── 1. Đọc tiền thành chữ ────────────────────────────────────────────────
check("0 đồng", vndInWords(0), "Không đồng");
check("1.500.000", vndInWords(1_500_000), "Một triệu năm trăm nghìn đồng");
check("15.000.000", vndInWords(15_000_000), "Mười lăm triệu đồng");
check("21.000", vndInWords(21_000), "Hai mươi mốt nghìn đồng");
check("24.000", vndInWords(24_000), "Hai mươi tư nghìn đồng");
check("105", vndInWords(105), "Một trăm lẻ năm đồng");
// Nhóm giữa rỗng: bỏ hẳn nhóm đó, chính chữ đơn vị ("nghìn") phân biệt
// 1.000.500 với 1.500.000 nên không cần đọc "không nghìn".
check("1.000.500 (nhóm giữa rỗng)", vndInWords(1_000_500), "Một triệu năm trăm đồng");
check("1.000.050 (hàng trăm rỗng → đọc 'không trăm')", vndInWords(1_000_050), "Một triệu không trăm năm mươi đồng");
check("2.050.000", vndInWords(2_050_000), "Hai triệu không trăm năm mươi nghìn đồng");
check("1 tỷ", vndInWords(1_000_000_000), "Một tỷ đồng");
check("1.234.567.890", vndInWords(1_234_567_890),
  "Một tỷ hai trăm ba mươi tư triệu năm trăm sáu mươi bảy nghìn tám trăm chín mươi đồng");
check("số âm", vndInWords(-5_000), "Âm năm nghìn đồng");
check("làm tròn số lẻ", vndInWords(1_000.4), "Một nghìn đồng");
check("tiền đầy đủ", printVnd(1_500_000), "1.500.000đ");

// ── 2. Đánh số mục theo mục CÓ dữ liệu ───────────────────────────────────
const base = {
  title: "Chụp cưới Minh & Lan",
  code: "HD-2026-001",
  studio: { name: "Ánh Studio", phone: "0900000000" },
  client: { name: "Nguyễn Văn A", phone: "0911111111" },
  items: [{ name: "Chụp phóng sự", qty: 1, unitPrice: 10_000_000, amount: 10_000_000 }],
  totals: [{ label: "Tổng giá trị hợp đồng", amount: 10_000_000, strong: true }],
  amountInWords: 10_000_000,
};

const bare = contractPrintBody({ ...base, terms: "Cọc 30% giữ lịch." });
checkTrue("hợp đồng trơn: hạng mục là mục 1", bare.includes("1. Hạng mục dịch vụ"));
checkTrue("hợp đồng trơn: điều khoản là mục 2 (không nhảy cóc)", bare.includes("2. Điều khoản"));
checkTrue("không có kế hoạch thanh toán thì không in mục rỗng", !bare.includes("Kế hoạch thanh toán"));
checkTrue("không có lịch trình thì không in mục rỗng", !bare.includes("Lịch trình"));

const full = contractPrintBody({
  ...base,
  plan: [{ label: "Đợt 1", due: "01/09/2026", paid: true, amount: 3_000_000 }],
  schedule: [{ title: "Chụp ngoại cảnh", when: "12/09/2026" }],
  payments: [{ date: "01/09/2026", kind: "Đặt cọc", amount: 3_000_000 }],
  terms: "Cọc 30% giữ lịch.",
});
checkTrue("đủ mục: kế hoạch thanh toán là mục 2", full.includes("2. Kế hoạch thanh toán"));
checkTrue("đủ mục: lịch trình là mục 3", full.includes("3. Lịch trình"));
checkTrue("đủ mục: đã thanh toán là mục 4", full.includes("4. Các khoản đã thanh toán"));
checkTrue("đủ mục: điều khoản là mục 5", full.includes("5. Điều khoản"));

// ── 3. Nội dung bắt buộc phải có trên bản in ─────────────────────────────
checkTrue("in số hợp đồng", full.includes("HD-2026-001"));
checkTrue("in dòng bằng chữ", full.includes("Mười triệu đồng"));
checkTrue("in tên hai bên", full.includes("Ánh Studio") && full.includes("Nguyễn Văn A"));

// Logo: có thì in ảnh, không có thì in ô chữ cái đầu (không để trống đầu trang).
const withLogo = contractPrintBody({ ...base, studio: { ...base.studio, logo: "https://cdn.example.com/logo.png" } });
checkTrue("có logo → thẻ img", withLogo.includes('class="cpd-logo" src="https://cdn.example.com/logo.png"'));
checkTrue("không logo → ô chữ cái đầu", bare.includes('class="cpd-mono">Á<'));

// ── 4. Thoát HTML & lọc src ảnh ──────────────────────────────────────────
const nasty = contractPrintBody({
  ...base,
  client: { name: '<script>alert("x")</script>' },
  studio: { name: "Ánh Studio", logo: "javascript:alert(1)" },
  signs: [{ label: "Bên A", name: "A", image: "javascript:alert(2)" }],
});
checkTrue("tên khách bị thoát", !nasty.includes("<script>") && nasty.includes("&lt;script&gt;"));
checkTrue("logo javascript: bị loại", !nasty.includes("javascript:"));
checkTrue("chữ ký javascript: bị loại", !nasty.includes('<img src="javascript'));

// ── 5. Trang HTML hoàn chỉnh ─────────────────────────────────────────────
const doc = contractPrintDocument(base);
checkTrue("có doctype + charset", doc.startsWith("<!doctype html>") && doc.includes('charset="utf-8"'));
checkTrue("có khổ A4", doc.includes("@page { size: A4"));
checkTrue("tự gọi in sau khi ảnh tải xong", doc.includes("window.print()") && doc.includes('addEventListener("load"'));
checkTrue("tắt tự in khi cần (bản desktop lưu file)", !contractPrintDocument(base, { autoPrint: false }).includes("window.print()"));

// ── Điều khoản tách theo từng điều (không cắt ngang giữa trang) ──────────
const terms = contractPrintBody({ ...base, terms: "1. ĐẶT CỌC\n- Cọc 30%\n2. HUỶ LỊCH\n- Báo trước 7 ngày" });
checkTrue("mỗi điều một khối keep", (terms.match(/class="cpd-clause keep"/g) || []).length === 2);
checkTrue("tiêu đề điều in riêng", terms.includes('<div class="cpd-clh">2. HUỶ LỊCH</div>'));

// ── Chân trang, ngày ký, vết ký điện tử ──────────────────────────────────
check("chân trang hợp đồng", printFooterLabel({ code: "HD-1" }), "Hợp đồng HD-1");
check("chân trang phiếu thu", printFooterLabel({ code: "PT-1", codeLabel: "Số phiếu" }), "Phiếu PT-1");
check("không mã → không chân trang", printFooterLabel({ code: null }), null);
check("dòng ngày ký (giờ VN)", vnSignDate("2026-11-21T18:30:00Z"), "Ngày 22 tháng 11 năm 2026");
check("vết ký điện tử", signVerifyLine("2026-11-22T07:35:00Z"), "Ký điện tử lúc 14:35 22/11/2026");
checkTrue("có số trang trong @page", contractPrintDocument(base).includes('counter(pages)'));
checkTrue("bản nháp có chữ chìm", contractPrintBody({ ...base, draft: true }).includes("BẢN NHÁP"));

// ── Nhãn phiếu thu không còn là nhãn hợp đồng ────────────────────────────
const rc = contractPrintBody({ ...base, codeLabel: "Số phiếu", partyLabels: ["Đơn vị thu tiền", "Người nộp tiền"], itemsTitle: "Nội dung thu" });
checkTrue("phiếu thu: nhãn số phiếu", rc.includes("Số phiếu") && !rc.includes("Số hợp đồng"));
checkTrue("phiếu thu: nhãn hai bên", rc.includes("Người nộp tiền") && !rc.includes("Bên B · Khách hàng"));
checkTrue("phiếu thu: tên mục", rc.includes("1. Nội dung thu"));

// ── Báo giá: dòng chưa chọn tách riêng, không cộng vào tổng ──────────────
const qd = quotePrintData({
  quote: { title: "BG", code: "BG-1", event_date: "2026-12-20" },
  items: [
    { name: "Gói A", qty: 1, unit_price: 5_000_000, is_optional: true, selected: true, package_group: "a" },
    { name: "Gói B", qty: 1, unit_price: 8_000_000, is_optional: true, selected: true, package_group: "b" },
    { name: "Album", qty: 1, unit_price: 2_000_000, is_optional: true, selected: false },
  ],
  total: 5_000_000, payableTotal: 5_000_000, deposit: 1_000_000, depositPct: 20,
});
check("báo giá: chỉ gói A được tính", qd.items.map((x) => x.name).join("|"), "Gói A");
check("báo giá: gói B + album thành tuỳ chọn", qd.products.map((x) => x.name).join("|"), "Gói B|Album");
check("báo giá: ngày có thứ", qd.facts[0].value, "CN · 20/12/2026");

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
