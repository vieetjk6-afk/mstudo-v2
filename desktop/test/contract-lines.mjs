/* Kiểm thử việc dựng mảng hạng mục ở bước "Gói dịch vụ" của màn tạo hợp đồng.
 *
 * Vì sao đáng test: tổng hợp đồng và MỌI số ăn theo nó (tiền cọc làm tròn, các
 * đợt thu, lợi nhuận dự kiến, cảnh báo lãi mỏng) đều cộng từ mảng này. Sai ở
 * đây thì hợp đồng gửi khách sai tiền — và sai kiểu im lặng, vì màn hình vẫn
 * hiện một con số trông rất hợp lý.
 *
 * Hai việc mới cần khoá lại:
 *   1. Sửa giá gói — bảng giá là giá NIÊM YẾT, hợp đồng là giá đã thương lượng.
 *      Giá sửa phải thắng, và "hoàn giá" phải quay về ăn theo bảng giá thật
 *      (không phải chụp lại giá cũ thành một con số đóng băng).
 *   2. Gói riêng gõ tay — dòng trống hoàn toàn không được thành hạng mục "0đ",
 *      còn dòng đã nhập phải vào tổng ngay ở bước tạo, không phải chờ mở màn
 *      chi tiết (lúc đó cọc đã chia thiếu rồi).
 */
import {
  buildContractLines,
  effectivePrice,
  isPriceEdited,
  linesTotal,
  isCustomLineFilled,
  CUSTOM_LINE_FALLBACK_NAME,
  discountAmount,
  rebalancePlan,
  syncPlanToTotal,
} from "../../src/lib/contract-lines.ts";
import { depositByPercent } from "../../src/lib/quote-deposit.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${g}\n    cần : ${w}`}`);
};

const GOI_CUOI = { id: "p1", name: "Gói cưới trọn gói", price: 45_000_000 };
const THEM_ALBUM = { id: "p2", name: "Album 30x30", price: 3_500_000 };
const THEM_FLYCAM = { id: "p3", name: "Flycam", price: 2_000_000 };

/* ── Nền: không chọn gì thì không có hạng mục nào ───────────────────────── */
check("chưa chọn gì → mảng rỗng", buildContractLines({}), []);
check("tổng của mảng rỗng là 0", linesTotal([]), 0);

/* ── Gói chính + hạng mục thêm, giá bảng giá ───────────────────────────── */
const base = buildContractLines({ mainPkg: GOI_CUOI, extras: [THEM_ALBUM, THEM_FLYCAM] });
check("gói chính đứng trước hạng mục thêm", base.map((l) => l.name), [
  "Gói cưới trọn gói",
  "Album 30x30",
  "Flycam",
]);
check("chưa sửa giá → dùng đúng giá bảng giá", linesTotal(base), 50_500_000);

/* ── Sửa giá: giá thương lượng thắng giá niêm yết ──────────────────────── */
const negotiated = { p1: 42_000_000, p2: 0 };
const edited = buildContractLines({
  mainPkg: GOI_CUOI,
  extras: [THEM_ALBUM, THEM_FLYCAM],
  pkgPrice: negotiated,
});
check("giá đã sửa thắng giá bảng giá", edited.map((l) => l.unit_price), [42_000_000, 0, 2_000_000]);
check("tổng tính theo giá đã sửa", linesTotal(edited), 44_000_000);
check("sửa giá về 0 (tặng kèm) vẫn được tôn trọng, không lùi về giá bảng giá",
  effectivePrice(THEM_ALBUM, negotiated), 0);
check("gói không nằm trong map → ăn theo bảng giá",
  effectivePrice(THEM_FLYCAM, negotiated), 2_000_000);

/* Hoàn giá = XOÁ khoá, nên bảng giá đổi thì hợp đồng đổi theo. Nếu "hoàn giá"
   được cài bằng cách ghi lại giá cũ vào map thì kiểm thử này vẫn xanh nhưng
   ngữ nghĩa đã sai — nên khoá cả hai đầu: có khoá và không có khoá. */
check("hoàn giá (xoá khoá) → giá bám bảng giá mới", effectivePrice({ ...GOI_CUOI, price: 47_000_000 }, {}), 47_000_000);
check("ghi đúng bằng giá bảng giá → KHÔNG coi là đã sửa", isPriceEdited(GOI_CUOI, { p1: 45_000_000 }), false);
check("ghi khác giá bảng giá → coi là đã sửa", isPriceEdited(GOI_CUOI, { p1: 44_000_000 }), true);
check("không có khoá → chưa sửa", isPriceEdited(GOI_CUOI, {}), false);
check("sửa thành 0đ vẫn là đã sửa (0 khác undefined)", isPriceEdited(GOI_CUOI, { p1: 0 }), true);

/* ── Gói riêng gõ tay ───────────────────────────────────────────────────── */
check("dòng trống hoàn toàn → chưa nhập", isCustomLineFilled({ name: "   ", qty: 1, unit_price: 0 }), false);
check("có tên → đã nhập", isCustomLineFilled({ name: "Thuê váy", qty: 1, unit_price: 0 }), true);
check("có giá → đã nhập (kể cả chưa đặt tên)", isCustomLineFilled({ name: "", qty: 1, unit_price: 500_000 }), true);

const withCustom = buildContractLines({
  mainPkg: GOI_CUOI,
  customLines: [
    { name: "  Chụp thêm buổi Đà Lạt  ", qty: 2, unit_price: 6_000_000 },
    { name: "   ", qty: 1, unit_price: 0 }, // bấm "Nhập gói riêng" rồi đổi ý
    { name: "", qty: 1, unit_price: 900_000 }, // có giá, quên tên
  ],
});
check("dòng trống bị bỏ, hai dòng còn lại vào hợp đồng", withCustom.length, 3);
check("tên gói riêng được cắt khoảng trắng", withCustom[1].name, "Chụp thêm buổi Đà Lạt");
check("quên tên → có tên mặc định, không để hạng mục trống tên", withCustom[2].name, CUSTOM_LINE_FALLBACK_NAME);
check("gói riêng nhân đúng số lượng vào tổng", linesTotal(withCustom), 45_000_000 + 12_000_000 + 900_000);

/* Số lượng bẩn: ô number để trống trả 0, mà hạng mục ×0 thì giá bao nhiêu cũng
   thành 0đ — làm hụt tổng hợp đồng mà không báo gì. */
const dirtyQty = buildContractLines({
  customLines: [
    { name: "Ảnh in", qty: 0, unit_price: 100_000 },
    { name: "Ảnh phóng", qty: Number.NaN, unit_price: 200_000 },
    { name: "Khung ảnh", qty: 2.6, unit_price: 300_000 },
    { name: "Giảm giá gõ tay", qty: 1, unit_price: -500_000 },
  ],
});
check("số lượng 0 → tối thiểu 1", dirtyQty[0].qty, 1);
check("số lượng NaN → tối thiểu 1", dirtyQty[1].qty, 1);
check("số lượng lẻ → làm tròn", dirtyQty[2].qty, 3);
check("đơn giá âm → kẹp về 0 (giảm giá làm ở màn chi tiết, không phải ở đây)", dirtyQty[3].unit_price, 0);

/* ── Mẫu hợp đồng vẫn phải xếp theo position và cộng chung ─────────────── */
const withTemplate = buildContractLines({
  templateItems: [
    { name: "Hậu kỳ", qty: 1, unit_price: 1_000_000, position: 2 },
    { name: "Chụp phóng sự", qty: 1, unit_price: 8_000_000, position: 1 },
  ],
  mainPkg: GOI_CUOI,
  pkgPrice: { p1: 40_000_000 },
  customLines: [{ name: "Xe đưa đón", qty: 1, unit_price: 1_500_000 }],
});
check("hạng mục mẫu xếp theo position, rồi tới gói, rồi tới gói riêng",
  withTemplate.map((l) => l.name),
  ["Chụp phóng sự", "Hậu kỳ", "Gói cưới trọn gói", "Xe đưa đón"]);
check("ba nguồn cộng vào cùng một tổng", linesTotal(withTemplate), 50_500_000);

/* Không được sửa mảng đầu vào của người gọi (mẫu hợp đồng là prop từ server —
   sắp xếp tại chỗ sẽ đổi thứ tự của chính ô chọn mẫu). */
const tplItems = [
  { name: "Hậu kỳ", qty: 1, unit_price: 1_000_000, position: 2 },
  { name: "Chụp phóng sự", qty: 1, unit_price: 8_000_000, position: 1 },
];
buildContractLines({ templateItems: tplItems });
check("không sắp xếp tại chỗ mảng hạng mục mẫu", tplItems.map((i) => i.name), ["Hậu kỳ", "Chụp phóng sự"]);

/* ── Mô tả gói trong bảng giá đi theo sang hạng mục ─────────────────────
   Khách đọc mô tả ở cổng hợp đồng và trên bản in. Trước đây nó rơi mất ở bước
   tạo hợp đồng: bảng giá có mô tả mà hợp đồng gửi khách thì trắng trơn. */
const withDesc = buildContractLines({
  mainPkg: { ...GOI_CUOI, description: "  2 thợ chụp\n300 ảnh chỉnh màu  " },
  extras: [{ ...THEM_ALBUM, description: "   " }, THEM_FLYCAM],
});
check("mô tả gói chính đi theo, cắt khoảng trắng hai đầu", withDesc[0].description, "2 thợ chụp\n300 ảnh chỉnh màu");
check("mô tả toàn khoảng trắng → không có khoá description", "description" in withDesc[1], false);
check("gói không có mô tả → không có khoá description", "description" in withDesc[2], false);

// ── Giảm giá ───────────────────────────────────────────────────────────────
check("giảm theo số tiền", discountAmount(20_000_000, 2_000_000, "vnd"), 2_000_000);
check("giảm theo %", discountAmount(20_000_000, 10, "pct"), 2_000_000);
check("giảm không quá tạm tính", discountAmount(5_000_000, 9_000_000, "vnd"), 5_000_000);
{
  const d = buildContractLines({ customLines: [{ name: "Gói", qty: 1, unit_price: 20_000_000 }], discount: 3_000_000 });
  check("dòng Giảm giá giá âm ở cuối, tổng trừ đúng", [d.at(-1), linesTotal(d)], [{ name: "Giảm giá", qty: 1, unit_price: -3_000_000 }, 17_000_000]);
}

// ── Đợt thu tự đổi theo tổng hợp đồng ──────────────────────────────────────
const amounts = (rows) => rows.map((p) => p.amount);
{
  // Kế hoạch mặc định của hợp đồng 20tr, cọc 25% → 5tr (đúng số tự tính).
  const plan = [
    { label: "Cọc giữ lịch", amount: 5_000_000, due: "" },
    { label: "Thanh toán khi giao sản phẩm", amount: 15_000_000, due: "" },
  ];
  const at20 = { prevTotal: 20_000_000, depositPercent: 25 };
  const up = rebalancePlan(plan, 28_000_000, at20);
  check("tổng tăng: cọc tự động tính lại 25%, đợt cuối nhận phần còn lại", amounts(up), [7_000_000, 21_000_000]);
  const plan30 = [
    { label: "Cọc giữ lịch", amount: 6_000_000, due: "" },
    { label: "Thanh toán khi giao sản phẩm", amount: 14_000_000, due: "" },
  ];
  check("studio đặt 30%: cọc tự động đi theo 30%", amounts(rebalancePlan(plan30, 30_000_000, { prevTotal: 20_000_000, depositPercent: 30 })), [9_000_000, 21_000_000]);
  check("studio tắt cọc tự động (0%) → giữ cọc đã gõ, đợt cuối gánh chênh", amounts(rebalancePlan(plan, 25_000_000, { prevTotal: 20_000_000, depositPercent: 0 })), [5_000_000, 20_000_000]);
  check("chỉ có đợt cọc → thêm đợt phần còn lại", amounts(rebalancePlan([plan[0]], 24_000_000, at20)), [6_000_000, 18_000_000]);
  const paid = syncPlanToTotal(
    [
      { label: "Cọc hợp đồng", amount: 5_000_000, paid: true },
      { label: "Đợt 2", amount: 5_000_000, paid: false },
      { label: "Thanh toán cuối", amount: 10_000_000, paid: false },
    ],
    24_000_000,
    at20
  );
  check("màn chi tiết: cọc ĐÃ THU không đổi, đợt giữa giữ, đợt chưa thu cuối gánh chênh", amounts(paid), [5_000_000, 5_000_000, 14_000_000]);
  check("% cọc mặc định 25, làm tròn 500k, tối thiểu 500k", [depositByPercent(18_000_000), depositByPercent(1_000_000), depositByPercent(10_000_000, 0)], [4_500_000, 500_000, 0]);
}

/* ── Cọc studio sửa tay KHÔNG bị ghi đè khi tổng đổi ─────────────────────
   Lỗi thật: hợp đồng 20tr, studio thoả thuận cọc 10tr (còn lại 10tr), thêm
   một hạng mục 300k → cọc nhảy về 5tr, còn lại 15,3tr, QR cổng khách đổi
   theo. Luật: cọc chỉ tự tính lại khi còn đúng số % của tổng CŨ. */
{
  const rule = { prevTotal: 20_000_000, depositPercent: 25 };
  const custom = [
    { label: "Cọc hợp đồng", amount: 10_000_000, paid: false },
    { label: "Thanh toán cuối", amount: 10_000_000, paid: false },
  ];
  check("cọc sửa tay giữ nguyên, đợt cuối gánh 300k thêm", amounts(syncPlanToTotal(custom, 20_300_000, rule)), [10_000_000, 10_300_000]);
  check("không sửa mảng đầu vào", amounts(custom), [10_000_000, 10_000_000]);
  const auto = [
    { label: "Cọc hợp đồng", amount: 5_000_000, paid: false },
    { label: "Thanh toán cuối", amount: 15_000_000, paid: false },
  ];
  check("cọc chưa sửa (đúng 25% của 20tr) vẫn đi theo % khi lên 30tr", amounts(syncPlanToTotal(auto, 30_000_000, rule)), [7_500_000, 22_500_000]);

  // Bước 5 của form tạo: studio gõ cọc 10tr rồi quay lại đổi gói.
  const step5 = [
    { label: "Cọc giữ lịch", amount: 10_000_000, due: "" },
    { label: "Thanh toán khi giao sản phẩm", amount: 10_000_000, due: "" },
  ];
  check("form tạo: cọc gõ ở bước 5 giữ khi đổi gói", amounts(rebalancePlan(step5, 23_500_000, rule)), [10_000_000, 13_500_000]);

  /* Màn chi tiết đồng bộ MỖI PHÍM (MoneyInput) và nối tiếp kết quả: cọc tự
     động phải theo được cả chuỗi tổng trung gian, cọc sửa tay phải sống sót. */
  const chain = (rows, totals) => {
    let prev = 20_000_000;
    for (const t of totals) {
      rows = syncPlanToTotal(rows, t, { prevTotal: prev, depositPercent: 25 });
      prev = t;
    }
    return amounts(rows);
  };
  const typing = [20_000_003, 20_000_030, 20_000_300, 20_003_000, 20_030_000, 20_300_000, 26_300_000];
  check("gõ từng phím: cọc tự động vẫn ra đúng % của tổng cuối", chain(auto, typing), [6_500_000, 19_800_000]);
  check("gõ từng phím: cọc sửa tay vẫn giữ 10tr", chain(custom, typing), [10_000_000, 16_300_000]);

  // Đợt cọc ĐÃ THU: không bao giờ đổi, kể cả khi tổng tụt dưới số đã thu.
  const paidDep = [
    { label: "Cọc hợp đồng", amount: 10_000_000, paid: true },
    { label: "Thanh toán cuối", amount: 10_000_000, paid: false },
  ];
  check("cọc đã thu giữ nguyên khi tổng tăng", amounts(syncPlanToTotal(paidDep, 20_300_000, rule)), [10_000_000, 10_300_000]);
  check("cọc đã thu giữ nguyên khi tổng tụt dưới nó, đợt cuối về 0 (không âm)", amounts(syncPlanToTotal(paidDep, 8_000_000, rule)), [10_000_000, 0]);

  /* Tổng tụt dưới cọc sửa tay: cọc kẹp về đúng số khách còn phải trả (tổng −
     đợt đã thu), đợt cuối về 0 — không bao giờ đòi cọc nhiều hơn cả hợp đồng. */
  check("tổng tụt dưới cọc sửa tay → cọc = tổng, đợt cuối 0", amounts(syncPlanToTotal(custom, 8_000_000, rule)), [8_000_000, 0]);
  check(
    "tổng tụt dưới cọc, có đợt đã thu → cọc = tổng − đã thu",
    amounts(syncPlanToTotal(
      [
        { label: "Đợt 1", amount: 3_000_000, paid: true },
        { label: "Cọc bổ sung", amount: 10_000_000, paid: false },
        { label: "Thanh toán cuối", amount: 7_000_000, paid: false },
      ],
      8_000_000,
      rule
    )),
    [3_000_000, 5_000_000, 0]
  );
  check("form tạo: chỉ có cọc gõ tay, tổng tụt dưới cọc → một đợt đúng bằng tổng", amounts(rebalancePlan([step5[0]], 8_000_000, rule)), [8_000_000]);
}

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
