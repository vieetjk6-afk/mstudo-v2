/* Kiểm phép dựng link SQL Editor từ chính biến kết nối của app.
 *
 * Vì sao đáng test một hàm ba dòng: nó là thứ duy nhất chặn được kiểu hỏng đã
 * ngốn tám vòng trao đổi — studio chạy SQL trong tab project CŨ, Supabase báo
 * "Success", mà app vẫn không thấy bảng nào. Link dựng sai thì hàng rào đó biến
 * mất mà không ai biết, vì màn hình vẫn có một cái nút trông rất hợp lý.
 */
import { maDuAn, linkSqlEditor } from "../../src/lib/supabase-du-an.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const REF = "abcdefghijklmnopqrst"; // 20 chữ thường, đúng dạng Supabase cấp
check("lấy được mã project từ URL thường", maDuAn(`https://${REF}.supabase.co`), REF);
check("URL có đường dẫn phía sau vẫn lấy đúng", maDuAn(`https://${REF}.supabase.co/rest/v1/`), REF);
check("miền .supabase.in cũng nhận", maDuAn(`https://${REF}.supabase.in`), REF);

// Thà không có nút còn hơn có một nút dẫn tới trang 404: studio bấm vào, thấy
// Supabase báo lỗi, và lại tưởng lỗi nằm ở chỗ khác.
check("domain riêng → không đoán bừa", maDuAn("https://db.mstudo.com"), null);
check("mã sai độ dài → không đoán bừa", maDuAn("https://abc.supabase.co"), null);
check("mã có chữ số → không đoán bừa", maDuAn("https://abcdefghijklmnopqr12.supabase.co"), null);
check("biến trống → null", maDuAn(""), null);
check("biến thiếu hẳn → null", maDuAn(undefined), null);
check("URL rác → null, không ném lỗi", maDuAn("khong-phai-url"), null);

check(
  "link trỏ thẳng vào query mới của ĐÚNG project",
  linkSqlEditor(`https://${REF}.supabase.co`),
  `https://supabase.com/dashboard/project/${REF}/sql/new`
);
check("không có mã thì không có link", linkSqlEditor("https://db.mstudo.com"), null);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
