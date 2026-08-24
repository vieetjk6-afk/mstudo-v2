/* Kiểm thử VỊ TRÍ MỤC MENU trong sidebar khu quản lý.
 *
 * Vì sao đáng test: chỗ đứng của một mục menu là một quyết định về SẢN PHẨM
 * (chủ studio đi tìm "Chi nhánh" trong nhóm nào?), nhưng trong code nó chỉ là
 * một dòng trong mảng — ai dọn dẹp cũng có thể vô tình kéo nó về nhóm cũ, và
 * không có gì báo. Ba lần gần đây menu bị xếp lại đều là do người dùng phàn nàn
 * chứ không phải do test đỏ.
 *
 * Đọc NGUỒN chứ không nhập module: src/lib/studio-nav.ts nhập lucide-react, mà
 * kéo cả một thư viện icon vào chỉ để đọc một mảng chuỗi là không đáng.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(import.meta.dirname, "../../src/lib/studio-nav.ts"), "utf8");

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Tách NAV_GROUPS thành { tên nhóm → danh sách href } ─────────────────── */
const groupsSrc = src.slice(src.indexOf("export const NAV_GROUPS"), src.indexOf("export const EXTRA_COMMANDS"));
/** Vị trí bắt đầu của từng nhãn nhóm, theo đúng thứ tự trong file. */
const marks = [...groupsSrc.matchAll(/^\s*label: "(.*)",$/gm)].map((m) => ({ label: m[1], at: m.index }));

const groups = new Map();
marks.forEach(({ label, at }, i) => {
  const body = groupsSrc.slice(at, marks[i + 1]?.at ?? groupsSrc.length);
  groups.set(label, [...body.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]));
});

const inGroup = (label, href) => (groups.get(label) ?? []).includes(href);
/** Nhóm đang chứa href này (để thông báo lỗi nói được nó lạc đi đâu). */
const groupOf = (href) => [...groups].find(([, hrefs]) => hrefs.includes(href))?.[0] ?? "(không nhóm nào)";

check("đọc được đủ các nhóm", [...groups.keys()].filter(Boolean), [
  "Kinh doanh", "Sản xuất", "Kho", "Tài chính", "Nhân sự", "Thiết lập", "Quản trị hệ thống",
]);

/* ── Hai mục người dùng yêu cầu chuyển nhóm ──────────────────────────────── */

// "Chi nhánh sẽ đưa lên tab nhân sự" — chủ studio tìm nó bằng câu hỏi "cơ sở
// này ai làm?", chứ không ai mở "Thiết lập" để mở/đóng một cơ sở.
check("Chi nhánh nằm trong nhóm Nhân sự", groupOf("/dashboard/studio/branches"), "Nhân sự");
check("Chi nhánh KHÔNG còn ở Thiết lập", inGroup("Thiết lập", "/dashboard/studio/branches"), false);

// "Gói & Bảng giá đưa lên tài chính" — giá bán là một quyết định tiền bạc.
check("Gói & bảng giá nằm trong nhóm Tài chính", groupOf("/dashboard/studio/pricing"), "Tài chính");
check("Gói & bảng giá KHÔNG còn ở Thiết lập", inGroup("Thiết lập", "/dashboard/studio/pricing"), false);

/* ── Luật xếp menu: mục sửa vài lần một năm đứng CUỐI nhóm ───────────────── */
const last = (label) => (groups.get(label) ?? []).at(-1);
check("Gói & bảng giá đứng cuối nhóm Tài chính", last("Tài chính"), "/dashboard/studio/pricing");
check("Chi nhánh đứng cuối nhóm Nhân sự", last("Nhân sự"), "/dashboard/studio/branches");

/* ── Không mục nào được nằm ở hai nhóm (bấm mãi một chỗ, hai dòng cùng sáng) ─ */
const all = [...groups.values()].flat();
check("không có href trùng giữa các nhóm", all.length, new Set(all).size);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
