/* Kiểm thử PHÂN LOẠI HỢP ĐỒNG: gói dịch vụ → nhóm → hạng mục & việc gợi ý.
 *
 * Vì sao đáng test: bảng tra cứu kiểu này hỏng một cách im lặng. Thêm một gói
 * dịch vụ mới mà quên xếp nhóm thì nó rơi vào nhóm mặc định, studio chọn
 * "Trang điểm" xong vẫn thấy chip "Album in" — không có lỗi nào nổ ra, chỉ có
 * người dùng thấy lạ rồi thôi không dùng nữa.
 *
 * Ba điều phải giữ:
 *   • MỌI gói dịch vụ đều được xếp nhóm, không sót cái nào.
 *   • Hợp đồng makeup KHÔNG bị gieo việc của nghề ảnh (chọn ảnh, sửa ảnh) —
 *     đây chính là thứ đã sai trước bản này, khi cả app dùng chung một danh
 *     sách việc gieo sẵn.
 *   • Trọn gói = hợp của hai nhóm, không phải một danh sách viết tay thứ ba.
 *
 * Nạp thẳng code thật ở src/lib/contract-kind.ts.
 */
import {
  contractKind, shootTypesByKind, kindHasRental, kindHasPhotoWork,
  CONTRACT_KIND_LABEL, PRESET_ITEMS_BY_KIND, DEFAULT_TASKS_BY_KIND, PRESET_TASKS_BY_KIND,
} from "../../src/lib/contract-kind.ts";
import { SHOOT_TYPES, SHOOT_TYPE_LABEL } from "../../src/lib/types.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, chiTiet = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${chiTiet}`}`);
};

/* ── 1. Xếp nhóm ──────────────────────────────────────────────────────────── */

check("Chụp ảnh → nhóm chụp", contractKind("photo"), "shoot");
check("Quay phim → nhóm chụp", contractKind("video"), "shoot");
check("Prewedding → nhóm chụp", contractKind("prewedding"), "shoot");
check("Trang điểm → nhóm makeup", contractKind("makeup"), "makeup");
check("Thuê đồ → nhóm makeup", contractKind("rental"), "makeup");
check("Trọn gói ngày cưới → nhóm trọn gói", contractKind("wedding"), "combo");
// Hợp đồng cũ có giá trị legacy "both" (Chụp & Quay) — vẫn phải ra nhóm chụp.
check("giá trị cũ 'both' → nhóm chụp", contractKind("both"), "shoot");
check("thiếu gói dịch vụ → nhóm chụp (mặc định của database)", contractKind(null), "shoot");

// Không gói nào được rơi ra ngoài.
const nhom = shootTypesByKind(SHOOT_TYPES);
const gom = [...nhom.shoot, ...nhom.makeup, ...nhom.combo];
check(`mọi gói dịch vụ đều được xếp nhóm (${SHOOT_TYPES.length} gói)`, [...gom].sort(), [...SHOOT_TYPES].sort());
ok("không gói nào nằm ở hai nhóm", new Set(gom).size === gom.length);
for (const k of ["shoot", "makeup", "combo"]) {
  ok(`nhóm ${k} có ít nhất một gói dịch vụ`, nhom[k].length > 0, `nhóm ${k} rỗng — ô chọn sẽ có mục trống`);
  ok(`nhóm ${k} có nhãn tiếng Việt`, !!CONTRACT_KIND_LABEL[k]);
}
ok("mọi gói dịch vụ trong ô chọn đều có nhãn", gom.every((t) => !!SHOOT_TYPE_LABEL[t]));

/* ── 2. Việc gieo sẵn: đúng nghề ──────────────────────────────────────────── */

const VIEC_ANH = /chọn ảnh|chỉnh sửa ảnh|album|ảnh phóng/i;
const VIEC_DO = /thử đồ|trả đồ|giữ đồ|hoàn cọc/i;

ok("hợp đồng makeup KHÔNG bị gieo việc của nghề ảnh",
  !DEFAULT_TASKS_BY_KIND.makeup.some((t) => VIEC_ANH.test(t)),
  `đang gieo: ${DEFAULT_TASKS_BY_KIND.makeup.join(", ")}`);
ok("hợp đồng chụp KHÔNG bị gieo việc thuê đồ",
  !DEFAULT_TASKS_BY_KIND.shoot.some((t) => VIEC_DO.test(t)),
  `đang gieo: ${DEFAULT_TASKS_BY_KIND.shoot.join(", ")}`);
ok("hợp đồng makeup có việc trả đồ", DEFAULT_TASKS_BY_KIND.makeup.some((t) => VIEC_DO.test(t)));
ok("hợp đồng chụp có việc chọn ảnh", DEFAULT_TASKS_BY_KIND.shoot.some((t) => VIEC_ANH.test(t)));

/* ── 3. Trọn gói = hợp của hai nhóm ───────────────────────────────────────── */

for (const [ten, bang] of [["việc gieo sẵn", DEFAULT_TASKS_BY_KIND], ["hạng mục gợi ý", PRESET_ITEMS_BY_KIND]]) {
  for (const k of ["shoot", "makeup"]) {
    const thieu = bang[k].filter((x) => !bang.combo.includes(x));
    ok(`trọn gói có đủ ${ten} của nhóm ${k}`, thieu.length === 0, `thiếu: ${thieu.join(", ")}`);
  }
}
ok("trọn gói có hạng mục riêng của nó", PRESET_ITEMS_BY_KIND.combo.some((x) => /trọn gói/i.test(x)));

// Không được lặp: viên hiện hai lần trong cùng một hàng là lỗi nhìn thấy ngay.
for (const [ten, bang] of [["hạng mục", PRESET_ITEMS_BY_KIND], ["việc gieo sẵn", DEFAULT_TASKS_BY_KIND], ["việc gợi ý", PRESET_TASKS_BY_KIND]]) {
  for (const k of ["shoot", "makeup", "combo"]) {
    const d = bang[k].filter((x, i) => bang[k].indexOf(x) !== i);
    ok(`${ten} nhóm ${k} không lặp`, d.length === 0, `lặp: ${[...new Set(d)].join(", ")}`);
  }
}

// Việc gợi ý phải bao trọn việc gieo sẵn: gieo một việc rồi xoá đi thì phải
// bấm lại thêm được, không thì studio mất hẳn việc đó.
for (const k of ["shoot", "makeup", "combo"]) {
  const thieu = DEFAULT_TASKS_BY_KIND[k].filter((t) => !PRESET_TASKS_BY_KIND[k].includes(t));
  ok(`xoá việc gieo sẵn rồi vẫn thêm lại được (nhóm ${k})`, thieu.length === 0, `không thêm lại được: ${thieu.join(", ")}`);
}

/* ── 4. Cờ tính năng theo nhóm ────────────────────────────────────────────── */

check("nhóm nào có thuê đồ", ["shoot", "makeup", "combo"].map(kindHasRental), [false, true, true]);
check("nhóm nào có hậu kỳ ảnh", ["shoot", "makeup", "combo"].map(kindHasPhotoWork), [true, false, true]);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
