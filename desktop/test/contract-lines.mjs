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
} from "../../src/lib/contract-lines.ts";

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

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
