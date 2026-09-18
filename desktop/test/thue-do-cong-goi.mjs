/* Kiểm thử CỔNG GÓI của mục "Thuê đồ" trong hợp đồng.
 *
 * Vì sao đáng test: hai màn này mở ở HAI GÓI KHÁC NHAU — hợp đồng từ
 * Photographer Plus, còn kho đồ (Phòng váy) chỉ gói Studio. Mục Thuê đồ sống
 * trong hợp đồng nhưng ăn dữ liệu của kho đồ, nên nó phải theo gói của KHO,
 * không theo gói của hợp đồng. Quên chốt này thì người gói Plus thấy một tab
 * dẫn tới kho họ không mở được: vào chỉ thấy kho trống, tạo đơn xong không có
 * màn nào xem lại — và không có lỗi nào nổ ra để ai biết.
 *
 * Chốt thêm hai điều dễ quên:
 *   • Gói Studio HẾT HẠN phải rơi về free và cổng ĐÓNG — không phải "đã từng
 *     mua thì mãi có".
 *   • Cổng của mục Thuê đồ phải TRÙNG KHÍT với cổng của màn Phòng váy
 *     (studio-nav ghi minTier "full"). Lệch nhau là lại có tab dẫn vào ngõ cụt.
 */
import { effectivePlan, planAllowsRental, tierAllowsRental, studioTier, STUDIO_TIER_RANK } from "../../src/lib/plans.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/* ── 1. Truth table ──────────────────────────────────────────────────────── */

for (const p of ["free", "basic", "photographer", "photographer_plus"]) {
  ok(`gói ${p} KHÔNG có mục Thuê đồ`, planAllowsRental(p) === false);
}
ok("gói studio CÓ mục Thuê đồ", planAllowsRental("studio") === true);
ok("admin luôn có, kể cả trên gói free", planAllowsRental("free", true) === true);

// Đây là ca đáng chú ý nhất: Photographer Plus CÓ hợp đồng nhưng KHÔNG có kho
// đồ. Nếu cổng này đi theo gói của hợp đồng thì nó sẽ sai đúng ở đây.
ok("Photographer Plus có hợp đồng nhưng KHÔNG có Thuê đồ",
  STUDIO_TIER_RANK[studioTier("photographer_plus")] >= STUDIO_TIER_RANK["plus"] &&
  planAllowsRental("photographer_plus") === false);

/* ── 2. Hết hạn thì đóng ─────────────────────────────────────────────────── */

const HOM_QUA = new Date(Date.now() - 86_400_000).toISOString();
const NGAY_MAI = new Date(Date.now() + 86_400_000).toISOString();
ok("gói studio CÒN hạn → mở", planAllowsRental(effectivePlan("studio", NGAY_MAI)) === true);
ok("gói studio HẾT hạn → đóng", planAllowsRental(effectivePlan("studio", HOM_QUA)) === false);

/* ── 3. Hai đường tính phải cho cùng kết quả ─────────────────────────────── */

// planAllowsRental(plan) dùng ở phía máy chủ chưa có bậc; tierAllowsRental(tier)
// dùng khi requireStudio đã tính bậc rồi. Hai đường lệch nhau là một màn mở còn
// màn kia đóng.
for (const p of ["free", "basic", "photographer", "photographer_plus", "studio"]) {
  ok(`hai đường tính khớp nhau — gói ${p}`,
    planAllowsRental(p) === tierAllowsRental(studioTier(p)),
    `planAllowsRental=${planAllowsRental(p)} tierAllowsRental=${tierAllowsRental(studioTier(p))}`);
}

/* ── 4. Trùng khít với cổng của màn Phòng váy ────────────────────────────── */

// Đọc thẳng studio-nav: màn Phòng váy khai minTier nào thì mục Thuê đồ phải
// đúng bằng bấy nhiêu. Ai đổi một bên mà quên bên kia là đỏ.
const nav = (await import("node:fs")).readFileSync(new URL("../../src/lib/studio-nav.ts", import.meta.url), "utf8");
const dong = nav.split("\n").find((l) => l.includes('/dashboard/studio/rental"')) ?? "";
const bacPhongVay = dong.match(/minTier:\s*"(\w+)"/)?.[1];
ok("đọc được minTier của màn Phòng váy", !!bacPhongVay, `dòng: ${dong.trim().slice(0, 70)}`);
ok(`mục Thuê đồ dùng CÙNG bậc với màn Phòng váy ("${bacPhongVay}")`,
  bacPhongVay === "full" && tierAllowsRental("full") === true,
  "đổi bậc ở một nơi thì phải đổi cả nơi kia");
for (const t of ["none", "booking", "plus"]) {
  ok(`bậc ${t} không mở được Thuê đồ`, tierAllowsRental(t) === false);
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
