/* Kiểm thử ĐƯỜNG ĐI CỦA MỘT CÁI LINK trong app desktop (client Windows).
 *
 * Vì sao đáng test: cửa sổ studio là WebView2 KHÔNG có tab, không thanh địa chỉ.
 * WebView2 mặc định NUỐT mọi yêu cầu mở cửa sổ mới (`args.SetHandled(true)` khi
 * app không tự xử lý), nên bấm link `target="_blank"` — Drive, Zalo, xem trước
 * album, và cả cửa sổ IN hợp đồng mở bằng `window.open("")` — chẳng có gì xảy
 * ra, im lặng, không báo lỗi. Đúng một dòng builder bị xoá là cả app quay lại
 * trạng thái "bấm link không mở được" mà không test nào đỏ.
 *
 * Đọc NGUỒN Rust chứ không biên dịch: build được cần Windows + WebView2, còn
 * điều cần giữ ở đây là các QUYẾT ĐỊNH (link nào ra trình duyệt, link nào mở cửa
 * sổ trong app, giao thức nào được phép giao cho hệ điều hành).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

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

/* ── Cửa sổ nào chạy web app studio đều phải có bộ bắt cửa sổ mới ─────────── */
// Cả cửa sổ studio chính lẫn cửa sổ mở thêm từ link: thiếu ở cửa sổ mở thêm thì
// bấm link trong đó lại rơi vào im lặng như cũ.
check("cửa sổ studio bắt yêu cầu mở cửa sổ mới", fnBody("open_studio_window").includes(".on_new_window("), true);
check("cửa sổ mở thêm cũng bắt yêu cầu mở cửa sổ mới", fnBody("new_link_window").includes(".on_new_window("), true);
check("cửa sổ mở thêm dùng chung môi trường WebView2 (window_features)", fnBody("new_link_window").includes(".window_features(features)"), true);
// WebView2 tự điều hướng cửa sổ vừa dựng tới địa chỉ được yêu cầu — dựng sẵn ở
// địa chỉ đích thì trang tải hai lần (và cửa sổ in thì mất nội dung).
check("cửa sổ mở thêm dựng ở about:blank", fnBody("new_link_window").includes('tauri::Url::parse("about:blank")'), true);

/* ── Link ra ngoài → trình duyệt; trang studio & cửa sổ in → cửa sổ trong app ─ */
const nw = fnBody("handle_new_window");
check("link ngoài giao cho hệ điều hành", nw.includes("open_external(url.as_str())"), true);
check("link ngoài KHÔNG mở cửa sổ trong app", nw.includes("NewWindowResponse::Deny"), true);
check("trang của chính studio mở cửa sổ trong app", /"http" \| "https" => is_studio_url/.test(nw), true);
// window.open("") của cửa sổ in: phải là cửa sổ THẬT của app thì trang mở nó mới
// ghi được nội dung vào (mở ở trình duyệt ngoài là mất trắng bản in).
check("cửa sổ in (about:blank) mở trong app", /"about" => true/.test(nw), true);
check("mở được cửa sổ thì gắn vào yêu cầu", nw.includes("NewWindowResponse::Create { window }"), true);

/* ── mailto:/tel: — WebView2 không mở được, phải giao cho Windows ─────────── */
const nav = fnBody("studio_navigation");
check("giao thức lạ giao cho hệ điều hành rồi huỷ điều hướng", /_ => \{\s*let _ = open_external\(u\.as_str\(\)\);\s*false/.test(nav), true);
check("http/https/about/blob/data vẫn đi tiếp bình thường", nav.includes('"http" | "https" | "about" | "blob" | "data" => true'), true);
check("nút Điều khiển đồng bộ vẫn mở bảng điều khiển", nav.includes("__mstudo_control"), true);

/* ── Chỉ giao ra ngoài những giao thức lành ───────────────────────────────── */
// `file:`, `javascript:`, `ms-msdt:`, `search-ms:` mở được ứng dụng/hệ thống →
// nếu trang web bị lợi dụng thì đây là cửa chạy lệnh. Danh sách phải đóng.
const schemes = (rs.match(/const EXTERNAL_SCHEMES: &\[&str\] = &\[([^\]]+)\]/) ?? [, ""])[1]
  .split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
check("danh sách giao thức được phép", schemes, ["http", "https", "mailto", "tel", "sms", "callto"]);
const ext = fnBody("open_external");
check("kiểm tra giao thức bằng URL đã phân tích (không so chuỗi thô)", ext.includes("tauri::Url::parse(url)") && ext.includes("EXTERNAL_SCHEMES.contains(&parsed.scheme())"), true);
check("không mở qua cmd (chống chèn lệnh)", /Command::new\("cmd"/.test(rs), false);

/* ── Script tiêm: link khác máy chủ → trình duyệt, link nội bộ để yên ─────── */
const js = (rs.match(/const STUDIO_INIT_JS: &str = r#"([\s\S]*?)"#;/) ?? [, ""])[1];
check("script tiêm giữ cờ đang chạy trong app desktop", js.includes("window.__MSTUDO_DESKTOP__ = true;"), true);
check("bỏ qua link _blank (đã có phía Rust lo)", js.includes("if (t === '_blank' || t === '_new') return;"), true);
check("link cùng máy chủ vẫn điều hướng như thường", js.includes("if (u.origin === location.origin) return;"), true);
check("chỉ đụng vào link http/https", js.includes("if (u.protocol !== 'http:' && u.protocol !== 'https:') return;"), true);
// Bấm giữ Ctrl/Shift hay chuột giữa là thao tác của trình duyệt, không cướp.
check("không cướp click có phím bổ trợ", js.includes("if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;"), true);
// Script chạy trong trang web ngoài (không có Tauri IPC) → phải là JS chạy được
// trên trình duyệt cũ nhất, và tuyệt đối không được văng làm hỏng trang.
check("script tiêm là JS hợp lệ", (() => {
  try { execFileSync(process.execPath, ["--check", "-"], { input: js }); return true; } catch { return false; }
})(), true);

/* ── Có link _blank thật trong web app thì test trên mới có nghĩa ─────────── */
const chrome = readFileSync(resolve(dir, "../../src/components/StudioShell.tsx"), "utf8");
check("web app vẫn có link mở tab mới (vd hỗ trợ Zalo)", chrome.includes('target="_blank"'), true);

console.log(fail === 0 ? "\nTất cả đạt." : `\n${fail} mục KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
