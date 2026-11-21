/* Kiểm thử phần "mở ra ngoài" + chốt một bản chạy của app desktop (client Windows).
 *
 * App không còn nhúng webapp trong cửa sổ WebView2 — chỉ mở trang web bằng
 * trình duyệt mặc định (nút "Mở mstudo trên trình duyệt", trang tải bản cài).
 * Điều cần giữ: chỉ http/https được giao cho Windows, không đi qua `cmd`, và chỉ
 * MỘT bản app chạy mỗi lúc.
 *
 * Đọc NGUỒN Rust chứ không biên dịch: build được cần Windows + WebView2.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = import.meta.dirname;
const rs = readFileSync(resolve(dir, "../src-tauri/src/main.rs"), "utf8");

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
/** Thân của một hàm Rust (từ `fn tên` tới dòng `}` ở cột 0 kế tiếp). */
const fnBody = (name) => {
  const at = rs.indexOf(`fn ${name}(`);
  if (at < 0) return "";
  const end = rs.indexOf("\n}\n", at);
  return rs.slice(at, end < 0 ? rs.length : end);
};

/* ── App KHÔNG còn nhúng giao diện studio ───────────────────────────────── */
// Quản lý studio làm trên webapp (trình duyệt). Cửa sổ WebView2 nhúng webapp đã
// bỏ — cùng với nó là cả đống xử lý link/cookie/đăng nhập chỉ để vá cho cửa sổ
// đó. Có ai thêm lại thì phải nghĩ lại cả phần bảo mật ở dưới.
check("không còn cửa sổ studio nhúng", rs.includes('"studioapp"'), false);
check("không còn bộ bắt cửa sổ mới", rs.includes(".on_new_window("), false);
check("không còn lệnh xóa dữ liệu duyệt web", rs.includes("clear_all_browsing_data"), false);

/* ── Chỉ giao ra ngoài những giao thức lành ───────────────────────────────── */
// `file:`, `javascript:`, `ms-msdt:`, `search-ms:` mở được ứng dụng/hệ thống →
// nếu trang web bị lợi dụng thì đây là cửa chạy lệnh. Danh sách phải đóng.
const schemes = (rs.match(/const EXTERNAL_SCHEMES: &\[&str\] = &\[([^\]]+)\]/) ?? [, ""])[1]
  .split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
check("danh sách giao thức được phép", schemes, ["http", "https"]);
const ext = fnBody("open_external");
check("kiểm tra giao thức bằng URL đã phân tích (không so chuỗi thô)", ext.includes("tauri::Url::parse(url)") && ext.includes("EXTERNAL_SCHEMES.contains(&parsed.scheme())"), true);
check("không mở qua cmd (chống chèn lệnh)", /Command::new\("cmd"/.test(rs), false);

/* ── Chỉ MỘT bản app chạy mỗi lúc ─────────────────────────────────────────── */
// Mở app lần nữa lúc nó đang chạy ngầm dưới khay mà không chặn thì Windows tạo
// hẳn tiến trình mới: thêm một biểu tượng khay (studio mở mấy lần là khay đầy
// icon), và thêm một engine đồng bộ ghi song song vào cùng thư mục dữ liệu.
check("có chốt chỉ một bản app chạy", rs.includes("tauri_plugin_single_instance::init"), true);
// Plugin yêu cầu đăng ký ĐẦU TIÊN; đăng ký sau plugin khác thì chốt không ăn.
check("chốt đăng ký trước mọi thứ khác", /Builder::default\(\)\s*(\/\/[^\n]*\n\s*)*\.plugin\(tauri_plugin_single_instance::init/.test(rs), true);
// Lần mở thứ hai phải ĐÁNH THỨC bản đang chạy, không thì bấm vào app không thấy
// gì xảy ra — người dùng lại bấm tiếp.
check("lần mở thứ hai đánh thức bản đang chạy", fnBody("focus_running_app").includes("show_main(app)") && fnBody("show_main").includes("set_focus()"), true);
// Trình cài đặt mở lại app ngay sau khi cài; khoá còn giữ thì bản mới tự thoát.
check("nhả khoá trước khi thoát để cài bản mới", fnBody("download_and_run").includes("tauri_plugin_single_instance::destroy(&app)"), true);

console.log(fail === 0 ? "\nTất cả đạt." : `\n${fail} mục KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
