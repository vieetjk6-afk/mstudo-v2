/* Kiểm FILE SQL DỰNG RIÊNG cho database đang chạy.
 *
 * Đây là file mà chủ studio sẽ dán thẳng vào database production. Nếu nó thiếu
 * một migration, xếp sai thứ tự, hay kèm nhầm một file không cần, thì hậu quả
 * rơi vào dữ liệu thật — nên nó phải có bài kiểm riêng, không chỉ "chạy thử rồi
 * thấy ổn".
 *
 * Kiểm ba tính chất, và cả ba đều từng suýt sai:
 *  1. Chỉ gồm migration THIẾU, không kéo theo cái đã có.
 *  2. Giữ ĐÚNG THỨ TỰ CHẠY — phụ thuộc giữa các file (studio_appointments phải
 *     đứng trước crew_timesheet) là thứ quyết định cả gói chạy được hay rollback.
 *  3. Kết thúc bằng bảng kết quả kiểm chứng, vì "Success. No rows returned."
 *     không phân biệt được chạy đúng chỗ với chạy nhầm project.
 */
import { dungSqlBuThieu } from "../../src/lib/db-thieu.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

// Dựng đúng tình huống thật của database này: thiếu một migration NGOÀI gói
// cập nhật (studio_appointments) mà một migration TRONG gói lại phụ thuộc vào.
const thieu = [
  { file: "migrations/album_designs.sql", moTa: "đã có", thieuBang: [], thieuCot: [], ok: true },
  {
    file: "migrations/studio_appointments.sql",
    moTa: "Lịch studio",
    thieuBang: ["studio_appointments", "studio_rooms"],
    thieuCot: [],
    ok: false,
  },
  { file: "migrations/inbox_unified.sql", moTa: "đã có", thieuBang: [], thieuCot: [], ok: true },
  {
    file: "migrations/crew_timesheet.sql",
    moTa: "Chấm công thợ",
    thieuBang: ["crew_timesheet"],
    thieuCot: ["studio_crew.hourly_rate"],
    ok: false,
  },
];

const sql = await dungSqlBuThieu(thieu);

ok("có migration thiếu thứ nhất", sql.includes("▶ migrations/studio_appointments.sql"));
ok("có migration thiếu thứ hai", sql.includes("▶ migrations/crew_timesheet.sql"));
ok(
  "KHÔNG kéo theo migration đã có",
  !sql.includes("▶ migrations/album_designs.sql") && !sql.includes("▶ migrations/inbox_unified.sql")
);
// Thứ tự là thứ quyết định cả gói chạy được hay rollback: crew_timesheet có hàng
// rào đòi studio_appointments tồn tại trước.
ok(
  "giữ đúng thứ tự chạy (phụ thuộc đứng trước)",
  sql.indexOf("▶ migrations/studio_appointments.sql") < sql.indexOf("▶ migrations/crew_timesheet.sql")
);
ok("nội dung SQL thật được nhúng vào", /create\s+table\s+if\s+not\s+exists/i.test(sql));
ok("đầu file liệt kê đúng thứ còn thiếu", sql.includes("bảng studio_rooms") && sql.includes("cột studio_crew.hourly_rate"));
ok("kết thúc bằng bảng kiểm chứng", /to_regclass\('public\.crew_timesheet'\)/.test(sql) && sql.trimEnd().endsWith(";"));
ok(
  "kiểm cả CỘT chứ không chỉ bảng",
  sql.includes("column_name='hourly_rate'"),
  "thiếu câu kiểm cột thì studio chạy xong vẫn không biết cột đã vào chưa"
);

// Không thiếu gì thì đừng sinh ra một file rỗng trông như hỏng.
const sach = await dungSqlBuThieu([{ file: "x.sql", moTa: "", thieuBang: [], thieuCot: [], ok: true }]);
ok("database đủ rồi → nói thẳng, không sinh SQL rác", sach.includes("KHÔNG THIẾU GÌ CẢ") && !sach.includes("▶ "));

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
