/* Kiểm thử thứ tự Thư viện album (src/lib/album-order.ts).
 *
 * Vì sao đáng test: đây là code SAI ÂM THẦM. Xếp sai thì không có gì nổ — chỉ
 * có studio mở thư viện ra, không thấy album khách vừa chốt, và tưởng khách
 * chưa chọn xong. Ba bẫy:
 *
 *  - Thứ tự trong CÙNG một bậc phải giữ nguyên như server trả về (updated_at
 *    desc). Một hàm so sánh trả số bừa cho hai phần tử cùng bậc là đủ để danh
 *    sách xáo lại mỗi lần render.
 *  - Album RỖNG mang mốc "đã chốt" (ảnh bị gỡ khỏi Drive sau khi khách chọn)
 *    không được nhảy lên đầu — nó không còn việc gì để làm.
 *  - Không được sắp xếp tại chỗ mảng gốc: `albums` là props từ server.
 */
import { albumRank, sortAlbums, pendingSelectionCount } from "../../src/lib/album-order.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const A = (id, photoCount, selection_done_at = null) => ({ id, photoCount, selection_done_at });

/* ── Bậc ưu tiên ─────────────────────────────────────────────────────────── */
check("khách đã chốt + có ảnh → bậc 0", albumRank(A("x", 120, "2026-08-20T03:00:00Z")), 0);
check("đang chạy bình thường → bậc 1", albumRank(A("x", 120)), 1);
check("chưa có ảnh → bậc 2", albumRank(A("x", 0)), 2);
check("album RỖNG mang mốc đã chốt vẫn xuống đáy", albumRank(A("x", 0, "2026-08-20T03:00:00Z")), 2);
check("photoCount thiếu hẳn cũng coi là rỗng", albumRank({ selection_done_at: null }), 2);

/* ── Thứ tự tổng ─────────────────────────────────────────────────────────── */
// Đầu vào theo đúng thứ tự server (updated_at desc).
const rows = [
  A("moi-tao-chua-co-anh", 0),
  A("dang-chay-1", 300),
  A("chot-hom-qua", 150, "2026-08-21T02:00:00Z"),
  A("dang-chay-2", 80),
  A("chot-sang-nay", 90, "2026-08-22T09:30:00Z"),
  A("rong-nhung-co-moc", 0, "2026-08-22T10:00:00Z"),
];

check("đã chốt lên đầu (mới chốt trước), rỗng xuống đáy, còn lại giữ nguyên thứ tự",
  sortAlbums(rows).map((a) => a.id),
  ["chot-sang-nay", "chot-hom-qua", "dang-chay-1", "dang-chay-2", "moi-tao-chua-co-anh", "rong-nhung-co-moc"]);

check("đếm album đang chờ lọc", pendingSelectionCount(rows), 2);
check("không có album nào chờ → 0", pendingSelectionCount([A("a", 10), A("b", 0)]), 0);

/* ── Không phá dữ liệu gốc ───────────────────────────────────────────────── */
const before = rows.map((a) => a.id).join(",");
sortAlbums(rows);
check("không sắp xếp tại chỗ mảng gốc", rows.map((a) => a.id).join(","), before);
check("không thêm/bớt album nào", sortAlbums(rows).length, rows.length);

/* ── Ổn định: xếp lại nhiều lần cho cùng một kết quả ─────────────────────── */
check("xếp hai lần cho kết quả y hệt",
  sortAlbums(sortAlbums(rows)).map((a) => a.id).join(","),
  sortAlbums(rows).map((a) => a.id).join(","));

/* ── Danh sách rỗng ──────────────────────────────────────────────────────── */
check("danh sách rỗng không nổ", sortAlbums([]), []);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
