/* Kiểm thử cảnh báo trùng lịch ở màn tạo hợp đồng (src/lib/contract-conflicts.ts).
 *
 * Sai ở đây là kiểu sai im lặng tệ nhất: không báo khi thợ đã đi show khác
 * cùng giờ → hai khách cùng chờ một người. Báo thừa (sáng/chiều không chồng)
 * thì studio quen dần và bỏ qua mọi cảnh báo.
 */
import { crewClashes } from "../../src/lib/contract-conflicts.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};

const contracts = [
  { id: "a", code: "HD-1", title: "Cưới Lan", event_time: "07:00" },
  { id: "b", code: "HD-2", title: "Kỷ yếu", event_time: "14:00" },
];
const crew = [
  { contract_id: "a", name: "Trần Minh Quân", phone: "0987 654 321", start_time: "07:00:00", end_time: "11:00:00" },
  { contract_id: "b", name: "Hùng", phone: null, start_time: null, end_time: null },
];
const quan = { name: "Quân", phone: "0987654321" };

const morning = crewClashes([quan], contracts, crew, "08:00", "10:00");
check("trùng giờ theo SĐT", morning.map((x) => [x.contract.id, x.overlap, x.otherTime]), [["a", true, "07:00 – 11:00"]]);

check("sáng – chiều không chồng → không báo", crewClashes([quan], contracts, crew, "13:00", "17:00"), []);

const noTime = crewClashes([quan], contracts, crew, "", "");
check("show mới chưa có giờ → báo cùng ngày", noTime.map((x) => [x.contract.id, x.overlap]), [["a", false]]);

const byName = crewClashes([{ name: "hùng", phone: "" }], contracts, crew, "15:00", "");
check("nhận theo tên khi thiếu SĐT; giờ lấy của hợp đồng", byName.map((x) => [x.contract.id, x.overlap, x.otherTime]), [["b", true, "14:00"]]);

check("người khác → không báo", crewClashes([{ name: "Lan", phone: "0900000000" }], contracts, crew, "08:00", ""), []);

const endless = crewClashes([quan], contracts, crew, "10:30", "");
check("show mới thiếu giờ kết thúc → mặc định 4 tiếng", endless.length, 1);

if (fail) {
  console.log(`\n${fail} kiểm thử HỎNG`);
  process.exit(1);
}
console.log("\nTất cả đều qua.");
