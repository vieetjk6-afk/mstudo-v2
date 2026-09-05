/* Kiểm luật đọc lỗi PostgREST: thiếu BẢNG hay thiếu CỘT.
 *
 * Bài này sinh ra TỪ một lỗi thật. Bản đầu xét chuỗi "does not exist" trước mã
 * lỗi, nên câu `column profiles.xyz does not exist` bị đọc thành "thiếu bảng
 * profiles" — và bản chẩn đoán gửi cho chủ studio nói database đang thiếu cái
 * bảng mà không có nó thì không ai đăng nhập nổi. Suýt nữa thì nó đẩy người ta
 * đi chạy setup-all.sql lên database đang có dữ liệu thật.
 */
import { phanLoaiLoi } from "../../src/lib/pg-loi.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${got}\n    cần : ${want}`}`);
};

/* ── Mã lỗi: nguồn sự thật chính xác nhất ─────────────────────────────────── */
check("42P01 → thiếu bảng", phanLoaiLoi({ code: "42P01", message: 'relation "public.x" does not exist' }), "thieu-bang");
check("PGRST205 → thiếu bảng", phanLoaiLoi({ code: "PGRST205", message: "Could not find the table" }), "thieu-bang");
check("42703 → thiếu cột", phanLoaiLoi({ code: "42703", message: "column x.y does not exist" }), "thieu-cot");
check("PGRST204 → thiếu cột", phanLoaiLoi({ code: "PGRST204", message: "Could not find the 'y' column" }), "thieu-cot");

/* ── ĐÚNG CHỖ ĐÃ HỎNG: cột thiếu KHÔNG được đọc thành bảng thiếu ──────────── */
check(
  "câu 'column … does not exist' (không kèm mã) → thiếu CỘT, không phải bảng",
  phanLoaiLoi({ message: 'column profiles.can_zip does not exist' }),
  "thieu-cot"
);
check(
  "câu \"Could not find the 'x' column of 'profiles'\" → thiếu CỘT",
  phanLoaiLoi({ message: "Could not find the 'faces_scanned_at' column of 'photos' in the schema cache" }),
  "thieu-cot"
);
check(
  "câu 'relation … does not exist' → thiếu BẢNG",
  phanLoaiLoi({ message: 'relation "public.album_faces" does not exist' }),
  "thieu-bang"
);
check(
  "câu 'Could not find the table' → thiếu BẢNG",
  phanLoaiLoi({ message: "Could not find the table 'public.album_faces' in the schema cache" }),
  "thieu-bang"
);

/* ── Không đoán bừa ───────────────────────────────────────────────────────── */
// Mã lỗi luôn thắng câu chữ: PostgREST có lúc kèm cả hai, và mã mới là thứ chuẩn.
check(
  "mã thắng câu chữ khi hai bên nói khác nhau",
  phanLoaiLoi({ code: "42703", message: 'relation "public.x" does not exist' }),
  "thieu-cot"
);
check("chỉ 'schema cache' → không kết luận", phanLoaiLoi({ message: "something in the schema cache" }), "khac");
check("lỗi quyền → không kết luận", phanLoaiLoi({ code: "42501", message: "permission denied for table x" }), "khac");
check("mất mạng (không có mã, không có câu) → không kết luận", phanLoaiLoi({ message: "Failed to fetch" }), "khac");
check("null → không kết luận", phanLoaiLoi(null), "khac");
check("rỗng → không kết luận", phanLoaiLoi({}), "khac");

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
