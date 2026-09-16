/* Kiểm thử chốt "database chưa chạy migration cột mới".
 *
 * Vì sao đáng test: mỗi cột mới đi kèm một file SQL mà chủ studio phải tự chạy
 * trên Supabase của mình, nên LUÔN có một khoảng giữa — bản web đã lên, SQL thì
 * chưa. Trong khoảng ấy, chỗ lưu hạng mục hợp đồng XOÁ HẾT rồi mới chèn lại:
 * nhận nhầm hay bỏ sót lỗi thiếu cột là studio bấm "Lưu" một cái mất sạch bảng
 * giá của hợp đồng.
 *
 * Nên chốt này phải chặt cả hai đầu: nhận đúng lỗi thiếu cột để còn lùi về bản
 * không có cột đó, và KHÔNG nhận nhầm lỗi khác (mất quyền, sai kiểu dữ liệu,
 * rớt mạng) — nhận nhầm thì lỗi thật bị giấu đi, ghi vào database thiếu cột mà
 * ai cũng tưởng đã lưu xong.
 *
 * Nạp thẳng code thật ở src/lib/missing-column.ts.
 */
import { isMissingColumn, withoutColumn } from "../../src/lib/missing-column.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── PHẢI nhận ra: đúng là thiếu cột ─────────────────────────────────────── */
check("Postgres 42703 đúng tên cột",
  isMissingColumn({ code: "42703", message: `column "description" of relation "contract_items" does not exist` }, "description"), true);
check("PostgREST PGRST204",
  isMissingColumn({ code: "PGRST204", message: "Could not find the 'description' column of 'contract_items' in the schema cache" }, "description"), true);
check("42703 không kèm thông báo — cứ lùi một bước còn hơn chặn cả trang",
  isMissingColumn({ code: "42703" }, "description"), true);

/* ── KHÔNG được nhận nhầm: lỗi khác phải nổi lên cho người ta thấy ───────── */
check("mã lỗi khác dù thông báo có chữ description",
  isMissingColumn({ code: "42501", message: "permission denied for column description" }, "description"), false);
check("đúng mã nhưng là CỘT KHÁC",
  isMissingColumn({ code: "42703", message: `column "ghi_chu" does not exist` }, "description"), false);
check("vi phạm ràng buộc", isMissingColumn({ code: "23505", message: "duplicate key" }, "description"), false);
check("lỗi mạng (không có code)", isMissingColumn(new Error("fetch failed"), "description"), false);
check("null", isMissingColumn(null, "description"), false);
check("chuỗi", isMissingColumn("boom", "description"), false);

/* ── Bỏ cột khỏi dòng sắp ghi ────────────────────────────────────────────── */
const rows = [
  { contract_id: "c1", name: "Chụp cả ngày", description: "2 thợ", qty: 1, unit_price: 28000000 },
  { contract_id: "c1", name: "Album", description: null, qty: 2, unit_price: 3500000 },
];
check("bỏ đúng cột, giữ nguyên phần còn lại", withoutColumn(rows, "description"), [
  { contract_id: "c1", name: "Chụp cả ngày", qty: 1, unit_price: 28000000 },
  { contract_id: "c1", name: "Album", qty: 2, unit_price: 3500000 },
]);
check("không sửa mảng gốc", rows[0].description, "2 thợ");
check("bỏ cột không tồn tại thì không hỏng gì",
  withoutColumn([{ a: 1 }], "description"), [{ a: 1 }]);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} phép kiểm SAI`);
process.exit(fail === 0 ? 0 : 1);
