// MStudo Desktop — client Windows: tự lưu hợp đồng + sao lưu dữ liệu studio.
// Frontend (ui/) gọi các lệnh dưới đây qua window.__TAURI__.core.invoke.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine as _;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime};
use tauri::Emitter;

#[derive(Serialize)]
struct HttpResp {
    status: u16,
    body_b64: String,
}

/// Tiến trình tải lên (phát cho frontend qua sự kiện `drive-progress`) để hiển
/// thị thanh tiến trình + thời gian dự kiến giống app Google Drive.
#[derive(Serialize, Clone)]
struct UploadProgress {
    path: String,
    uploaded: u64,
    total: u64,
}

/// Các thư mục GỐC được phép thao tác (client đặt qua `set_roots`: thư mục dữ
/// liệu + thư mục ảnh/video). Mọi lệnh đọc/ghi/xóa file phải nằm trong đây — chốt
/// chặn để dù webview bị lợi dụng cũng không đọc/ghi/xóa file ngoài vùng dữ liệu.
static ROOTS: LazyLock<Mutex<Vec<String>>> = LazyLock::new(|| Mutex::new(Vec::new()));

fn norm_path(p: &str) -> String {
    p.replace('/', "\\").to_lowercase()
}

/// Đường dẫn có được phép không: không chứa "..", và nằm trong một thư mục gốc.
/// Khi CHƯA đặt gốc (mới mở app) → cho phép (tránh vỡ luồng khởi động).
fn path_allowed(path: &str) -> bool {
    if has_control_chars(path) {
        return false;
    }
    if path.split(|c| c == '\\' || c == '/').any(|seg| seg == "..") {
        return false;
    }
    let roots = ROOTS.lock().unwrap();
    if roots.is_empty() {
        return true;
    }
    let np = norm_path(path);
    roots.iter().any(|r| np.starts_with(&norm_path(r)))
}

/// Client khai báo các thư mục gốc được phép (thư mục lưu + thư mục ảnh/video).
#[tauri::command]
fn set_roots(paths: Vec<String>) {
    let mut roots = ROOTS.lock().unwrap();
    roots.clear();
    for p in paths {
        if !p.is_empty() && !has_control_chars(&p) {
            roots.push(p);
        }
    }
}

/// Gọi API mstudo từ phía Rust (tránh CORS của webview). Trả body dạng base64
/// để dùng được cho cả JSON lẫn file nhị phân (docx, xlsx).
#[tauri::command]
async fn http_get(url: String, token: Option<String>) -> Result<HttpResp, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.get(&url).header("User-Agent", "MStudoDesktop/0.1");
    if let Some(t) = token.filter(|t| !t.is_empty()) {
        req = req.header("Authorization", format!("Bearer {t}"));
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(HttpResp {
        status,
        body_b64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    })
}

#[tauri::command]
async fn http_post(url: String, token: Option<String>, body_json: String) -> Result<HttpResp, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client
        .post(&url)
        .header("User-Agent", "MStudoDesktop/0.1")
        .header("Content-Type", "application/json")
        .body(body_json);
    if let Some(t) = token.filter(|t| !t.is_empty()) {
        req = req.header("Authorization", format!("Bearer {t}"));
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(HttpResp {
        status,
        body_b64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    })
}

/// Hộp thoại chọn thư mục lưu dữ liệu.
#[tauri::command]
fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Chọn thư mục lưu dữ liệu MStudo")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

/// Lấy đuôi file (chữ thường), rỗng nếu không có.
fn ext_lower(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

/// Đuôi file mà app được phép GHI — chỉ tài liệu/dữ liệu, KHÔNG thực thi.
/// Nếu webview bị lợi dụng (XSS vượt CSP), đây là chốt chặn cuối để kẻ tấn công
/// không thể ghi .exe/.bat/.ps1… (vd thả vào thư mục Startup) chiếm quyền máy.
const WRITABLE_EXTS: &[&str] = &["docx", "xlsx", "json", "html", "htm", "txt", "csv", "pdf", "mstmp"];
/// Đuôi file mà app được phép ĐỌC (chỉ manifest/cache dữ liệu do app tạo) — chặn
/// đọc file lạ để lộ token/bí mật của app khác.
const READABLE_EXTS: &[&str] = &["json", "txt", "csv"];
/// Đuôi file mà app được phép MỞ bằng ứng dụng mặc định (không mở file thực thi).
const OPENABLE_EXTS: &[&str] = &["pdf", "html", "htm", "docx", "xlsx", "txt", "csv", "png", "jpg", "jpeg"];

/// Ghi file AN TOÀN: tạo thư mục cha, ghi ra .tmp rồi đổi tên — không hỏng file
/// khi mất điện giữa chừng. Nội dung nhận dạng base64 (dùng cho mọi loại file).
#[tauri::command]
fn write_file_b64(path: String, contents_b64: String) -> Result<(), String> {
    if has_control_chars(&path) || !WRITABLE_EXTS.contains(&ext_lower(&path).as_str()) {
        return Err("ext_not_allowed".to_string());
    }
    if !path_allowed(&path) {
        return Err("path_not_allowed".to_string());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(contents_b64.as_bytes())
        .map_err(|e| e.to_string())?;
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = target.with_extension(format!(
        "{}.mstmp",
        target.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));
    fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    // Windows: rename không đè file có sẵn → xóa trước (bản mới thay bản cũ cùng tên).
    let _ = fs::remove_file(&target);
    fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    // Chỉ đọc file dữ liệu app tạo (manifest/cache JSON…) trong thư mục gốc.
    if has_control_chars(&path) || !READABLE_EXTS.contains(&ext_lower(&path).as_str()) || !path_allowed(&path) {
        return Err("bad_path".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Đuôi ảnh được phép ĐỌC để tạo xem trước (thumbnail) trong lúc đồng bộ. Chỉ
/// ảnh phổ biến, nằm trong thư mục gốc; chặn đọc file lạ để lộ dữ liệu.
const PREVIEW_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
/// Ảnh lớn hơn mức này → không tạo xem trước (tránh nạp cả file RAW vào RAM chỉ
/// để hiện thumbnail). Frontend sẽ hiện tên file thay cho ảnh.
const PREVIEW_MAX_BYTES: u64 = 16 * 1024 * 1024;

/// Đọc một file ảnh (đang đồng bộ) trả về base64 để frontend hiện xem trước —
/// giống app Google Drive hiển thị ảnh đang tải lên.
#[tauri::command]
fn read_image_b64(path: String) -> Result<String, String> {
    if has_control_chars(&path)
        || !PREVIEW_EXTS.contains(&ext_lower(&path).as_str())
        || !path_allowed(&path)
    {
        return Err("bad_path".to_string());
    }
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > PREVIEW_MAX_BYTES {
        return Err("too_large".to_string());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    if !path_allowed(&path) {
        return Err("bad_path".to_string());
    }
    fs::remove_file(&path).map_err(|e| e.to_string())
}

/// Xóa các FILE trong thư mục cũ hơn `days` ngày (không đụng thư mục con —
/// thư mục hợp đồng không bao giờ tự xóa).
#[tauri::command]
fn cleanup_old(dir: String, days: u64) -> Result<u32, String> {
    if !path_allowed(&dir) {
        return Err("bad_path".to_string());
    }
    let cutoff = SystemTime::now() - Duration::from_secs(days * 24 * 3600);
    let mut removed = 0u32;
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(0), // thư mục chưa tồn tại → không có gì để dọn
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                if modified < cutoff && fs::remove_file(&p).is_ok() {
                    removed += 1;
                }
            }
        }
    }
    Ok(removed)
}

/// Chuyển HTML hợp đồng thành PDF bằng Microsoft Edge headless (có sẵn trên
/// Windows 10/11). Trả lỗi nếu không tìm thấy Edge — frontend sẽ giữ bản HTML.
#[tauri::command]
fn edge_pdf(html_path: String, pdf_path: String) -> Result<(), String> {
    // Chỉ nhận nguồn HTML và đích PDF hợp lệ, trong thư mục gốc (tránh ghi/đọc file lạ).
    if !path_allowed(&html_path) || !path_allowed(&pdf_path) {
        return Err("bad_path".to_string());
    }
    let src_ext = ext_lower(&html_path);
    if src_ext != "html" && src_ext != "htm" {
        return Err("bad_source".to_string());
    }
    if ext_lower(&pdf_path) != "pdf" {
        return Err("bad_target".to_string());
    }
    let candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ];
    let edge = candidates
        .iter()
        .find(|p| Path::new(p).exists())
        .ok_or_else(|| "edge_not_found".to_string())?;
    if let Some(parent) = Path::new(&pdf_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let url = format!("file:///{}", html_path.replace('\\', "/"));
    let status = std::process::Command::new(edge)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-pdf-header-footer",
            &format!("--print-to-pdf={pdf_path}"),
            &url,
        ])
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() || !Path::new(&pdf_path).exists() {
        return Err("edge_failed".to_string());
    }
    Ok(())
}

fn copy_dir_recursive(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        if src.is_dir() {
            copy_dir_recursive(&src, &dst)?;
        } else {
            fs::copy(&src, &dst)?;
        }
    }
    Ok(())
}

/// Di chuyển toàn bộ dữ liệu đã lưu sang thư mục mới (khi studio đổi vị trí lưu).
#[tauri::command]
fn move_dir(from: String, to: String) -> Result<(), String> {
    if !path_allowed(&from) || !path_allowed(&to) {
        return Err("bad_path".to_string());
    }
    let from_p = PathBuf::from(&from);
    let to_p = PathBuf::from(&to);
    if !from_p.exists() {
        return Ok(());
    }
    // Thử rename nhanh (cùng ổ đĩa); khác ổ thì copy + xóa.
    if fs::rename(&from_p, &to_p).is_ok() {
        return Ok(());
    }
    copy_dir_recursive(&from_p, &to_p).map_err(|e| e.to_string())?;
    fs::remove_dir_all(&from_p).map_err(|e| e.to_string())?;
    Ok(())
}

/// Tên máy (đặt tên thiết bị khi đăng ký).
#[tauri::command]
fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "May tinh Windows".to_string())
}

/// Mở TOÀN BỘ ứng dụng quản lý studio (web app hiện tại) trong một cửa sổ riêng
/// của client — đăng nhập & dùng đầy đủ chức năng; engine sao lưu vẫn chạy ở
/// cửa sổ chính. Gọi lại thì đưa cửa sổ đã mở lên trước.
#[tauri::command]
async fn open_app(app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_studio_window(&app, url, false)
}

/// Như `open_app` nhưng ÉP cửa sổ studio đi tới đúng địa chỉ đưa vào, kể cả khi
/// nó đang mở sẵn. Dùng cho "Đăng xuất / xóa cookie": cửa sổ studio đang kẹt ở
/// trang đăng nhập (hoặc ở một tài khoản khác) phải được đưa sang /auth/reset,
/// chứ chỉ hiện nó lên thì chẳng giải quyết được gì.
#[tauri::command]
async fn navigate_app(app: tauri::AppHandle, url: String) -> Result<(), String> {
    open_studio_window(&app, url, true)
}

/// Xóa dữ liệu duyệt web của cửa sổ studio (cookie, cache, localStorage…).
///
/// LÝ DO CÓ HÀM NÀY: cửa sổ studio là WebView2 không thanh địa chỉ, không menu
/// cài đặt — cookie phiên hỏng (phiên tài khoản cũ, khóa Supabase đã đổi, một
/// lần đăng nhập Google dở dang) là người dùng kẹt luôn, không có chỗ nào xóa
/// cookie. Đây là nút bấm cuối cùng khi /auth/reset trên máy chủ cũng không gỡ
/// được.
///
/// CẢNH BÁO cho phía gọi: WebView2 dùng CHUNG một hồ sơ cho mọi cửa sổ của app,
/// nên lệnh này xóa cả localStorage của BẢNG ĐIỀU KHIỂN (cấu hình `cfg`: địa chỉ
/// máy chủ, mã kết nối thiết bị, thư mục lưu). app.js phải ghi lại `cfg` sau khi
/// gọi. Việc xóa chạy bất đồng bộ trong WebView2 nên phía gọi cần chờ một nhịp
/// trước khi ghi lại và nạp lại trang.
#[tauri::command]
fn clear_web_data(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let studio = app.get_webview_window("studioapp");
    // Rời trang trước khi xóa: trang cũ còn chạy thì script của nó có thể ghi
    // lại ngay cookie/localStorage vừa bị xóa.
    if let Some(w) = &studio {
        if let Ok(blank) = tauri::Url::parse("about:blank") {
            let _ = w.navigate(blank);
        }
    }
    let target = studio.or_else(|| app.get_webview_window("main"));
    match target {
        Some(w) => w.clear_all_browsing_data().map_err(|e| e.to_string()),
        None => Err("no_webview".to_string()),
    }
}

/// Địa chỉ gốc (`https://máy-chủ`) của web app đang mở trong cửa sổ studio. Dùng
/// để phân biệt link NỘI BỘ (trang của chính studio) với link RA NGOÀI (Drive,
/// Facebook, Zalo…) khi người dùng bấm "mở ở tab mới".
static STUDIO_ORIGIN: LazyLock<Mutex<String>> = LazyLock::new(|| Mutex::new(String::new()));
/// Bộ đếm đặt nhãn duy nhất cho mỗi cửa sổ mở thêm từ một cái link.
static LINK_SEQ: AtomicU32 = AtomicU32::new(0);

/// Script tiêm vào mọi cửa sổ chạy web app studio.
///
/// Ngoài cờ báo "đang chạy trong app desktop", nó bắt cú bấm vào link TRỎ RA
/// NGOÀI mà KHÔNG có `target="_blank"` (vd link Google Drive trong trang chọn
/// ảnh). Để mặc thì cửa sổ studio — vốn không có thanh địa chỉ, không nút Back —
/// điều hướng thẳng sang trang ngoài và người dùng kẹt luôn ở đó. Chuyển thành
/// `window.open` để phần Rust (`handle_new_window`) đưa sang trình duyệt mặc định.
///
/// Link `target="_blank"`, `window.open`, `mailto:`, `tel:` KHÔNG đụng tới ở đây:
/// chúng đã được bắt ở phía Rust (bộ mở cửa sổ mới / bộ lọc điều hướng).
const STUDIO_INIT_JS: &str = r#"window.__MSTUDO_DESKTOP__ = true;
(function () {
  if (window.__mstudoLinkHook) return;
  window.__mstudoLinkHook = true;
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var el = e.target;
    var a = el && el.closest ? el.closest('a[href]') : null;
    if (!a) return;
    var t = (a.getAttribute('target') || '').toLowerCase();
    if (t === '_blank' || t === '_new') return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    var u;
    try { u = new URL(href, location.href); } catch (err) { return; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (u.origin === location.origin) return;
    e.preventDefault();
    try { window.open(u.href, '_blank'); } catch (err) {}
  }, true);
})();"#;

/// Địa chỉ này có thuộc chính web app studio đang mở không?
fn is_studio_url(u: &tauri::Url) -> bool {
    let origin = STUDIO_ORIGIN.lock().unwrap();
    !origin.is_empty() && u.origin().ascii_serialization() == *origin
}

/// Bộ lọc điều hướng dùng chung cho mọi cửa sổ chạy web app studio.
/// Trả `false` = huỷ điều hướng (đã xử lý theo cách khác).
fn studio_navigation(app: &tauri::AppHandle, u: &tauri::Url) -> bool {
    // Đường dẫn nội bộ "/__mstudo_control" (do nút web bấm) → mở BẢNG ĐIỀU KHIỂN
    // thay vì điều hướng. Không cần Tauri IPC trong trang web ngoài.
    if u.as_str().contains("__mstudo_control") {
        show_main(app);
        return false;
    }
    match u.scheme() {
        "http" | "https" | "about" | "blob" | "data" => true,
        // mailto:, tel:, sms:… — WebView2 không mở được, để mặc thì bấm số điện
        // thoại khách hàng trong app không có gì xảy ra. Giao cho Windows.
        _ => {
            let _ = open_external(u.as_str());
            false
        }
    }
}

/// Xử lý yêu cầu MỞ CỬA SỔ MỚI của trang web (link `target="_blank"`, `window.open`).
///
/// KHÔNG có bộ xử lý này thì WebView2 nuốt luôn yêu cầu: bấm link "mở tab mới"
/// trong app desktop chẳng có gì xảy ra (link Drive, Zalo, xem trước album…), và
/// cửa sổ IN hợp đồng/báo giá — vốn mở bằng `window.open("")` rồi tự ghi nội dung
/// vào — cũng im lặng không hiện.
///
/// - Link ra ngoài → trình duyệt mặc định của máy.
/// - Trang của chính studio và cửa sổ in (`about:blank`) → cửa sổ mới TRONG app:
///   dùng chung hồ sơ WebView2 nên vẫn còn phiên đăng nhập, và trang mở nó vẫn
///   ghi được nội dung vào (điều kiện sống còn của cửa sổ in).
fn handle_new_window(
    app: &tauri::AppHandle,
    url: tauri::Url,
    features: tauri::webview::NewWindowFeatures,
) -> tauri::webview::NewWindowResponse<tauri::Wry> {
    use tauri::webview::NewWindowResponse;
    let internal = match url.scheme() {
        "about" => true,
        "http" | "https" => is_studio_url(&url),
        _ => false,
    };
    if !internal {
        let _ = open_external(url.as_str());
        return NewWindowResponse::Deny;
    }
    match new_link_window(app, features) {
        Ok(window) => NewWindowResponse::Create { window },
        // Không dựng được cửa sổ → ít nhất mở ở trình duyệt (phải đăng nhập lại,
        // nhưng còn hơn bấm link không có gì xảy ra).
        Err(_) => {
            let _ = open_external(url.as_str());
            NewWindowResponse::Deny
        }
    }
}

/// Dựng cửa sổ trống để WebView2 gắn vào một yêu cầu mở cửa sổ mới. Tạo ở
/// `about:blank` — chính WebView2 sẽ điều hướng nó tới địa chỉ được yêu cầu.
fn new_link_window(
    app: &tauri::AppHandle,
    features: tauri::webview::NewWindowFeatures,
) -> Result<tauri::WebviewWindow, String> {
    let label = format!("mstudolink{}", LINK_SEQ.fetch_add(1, Ordering::Relaxed));
    let blank = tauri::Url::parse("about:blank").map_err(|e| e.to_string())?;
    let app_nav = app.clone();
    let app_new = app.clone();
    tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External(blank))
        .title("MStudo")
        .inner_size(1200.0, 840.0)
        .focused(true)
        // Giữ nguyên kích thước/vị trí trang web yêu cầu (vd cửa sổ in 640×720) và
        // — bắt buộc trên Windows — dùng CHUNG môi trường WebView2 với cửa sổ mở nó.
        .window_features(features)
        .initialization_script(STUDIO_INIT_JS)
        .on_document_title_changed(|w, title| {
            let _ = w.set_title(&title);
        })
        .on_navigation(move |u| studio_navigation(&app_nav, u))
        .on_new_window(move |u, f| handle_new_window(&app_new, u, f))
        .build()
        .map_err(|e| e.to_string())
}

/// Mở (hoặc điều hướng) cửa sổ studio. `force_navigate` = đi tới địa chỉ mới
/// ngay cả khi cửa sổ đã tồn tại.
fn open_studio_window(app: &tauri::AppHandle, url: String, force_navigate: bool) -> Result<(), String> {
    use tauri::Manager;
    // Chỉ mở/điều hướng tới địa chỉ web thật — chặn file://, javascript:… lọt vào
    // cửa sổ studio nếu JS của bảng điều khiển bị lợi dụng.
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("bad_url".to_string());
    }
    if has_control_chars(&url) {
        return Err("bad_url".to_string());
    }
    let parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
    // Ghi nhớ máy chủ studio để phân biệt link nội bộ / link ra ngoài về sau.
    *STUDIO_ORIGIN.lock().unwrap() = parsed.origin().ascii_serialization();
    if let Some(w) = app.get_webview_window("studioapp") {
        // Đã mở (kể cả đang ẩn xuống khay) → hiện lại + đưa lên trước.
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        if force_navigate {
            w.navigate(parsed).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let app_nav = app.clone();
    let app_new = app.clone();
    tauri::WebviewWindowBuilder::new(app, "studioapp", tauri::WebviewUrl::External(parsed))
        .title("MStudo — Quản lý studio")
        .inner_size(1360.0, 900.0)
        .maximized(true)
        .focused(true)
        // Cho web app biết nó đang chạy TRONG app desktop (để hiện nút "Điều khiển
        // đồng bộ" chỉ trên app, không hiện trên trình duyệt web) + bắt link ra ngoài.
        .initialization_script(STUDIO_INIT_JS)
        // Link "mở tab mới" và cửa sổ in: WebView2 mặc định bỏ qua → phải tự xử lý.
        .on_new_window(move |u, f| handle_new_window(&app_new, u, f))
        .on_navigation(move |u| {
            if !studio_navigation(&app_nav, u) {
                return false;
            }
            // Bị đá về TRANG ĐĂNG NHẬP ⇒ thử đăng nhập bằng mã kết nối của máy
            // này. Đây là chỗ mọi kiểu hỏng đổ về: Google chặn đăng nhập trong
            // webview nhúng, captcha không chạy, cookie phiên hết hạn. Máy đã
            // được chủ studio xác thực rồi nên không việc gì phải gõ lại.
            //
            // Bỏ qua khi vừa bấm "Đăng xuất" (/login?reset=1) — không thì vừa
            // đăng xuất đã bị đăng nhập lại ngay. app.js còn tự khóa để chỉ thử
            // đúng một lần mỗi lần chạy app (tránh vòng lặp khi mã hỏng).
            if u.path().starts_with("/login") && !u.query().unwrap_or("").contains("reset=1") {
                if let Some(w) = app_nav.get_webview_window("main") {
                    let _ = w.eval("window.autoDeviceLogin && window.autoDeviceLogin()");
                }
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Tự cập nhật: tải trình cài đặt (.exe) về thư mục tạm rồi chạy, và thoát app
/// để trình cài đặt ghi đè. Không cần khóa ký — dùng chính bản phát hành hiện có.
#[tauri::command]
async fn download_and_run(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Chỉ cho phép tải bản cài từ ĐÚNG repo phát hành chính thức. Nếu không,
    // lệnh này trở thành công cụ chạy .exe tùy ý (RCE) khi JS bị lợi dụng.
    // PHẢI parse URL trước rồi mới so host/path — kiểm tra chuỗi thô có thể bị
    // qua mặt bằng "../" (vd https://github.com/OWNER/../attacker/... sẽ chuẩn
    // hoá thành host github.com nhưng path /attacker/...).
    // Hẹp tới TÊN REPO chứ không chỉ tên chủ repo: chủ tài khoản còn nhiều repo
    // khác, mỗi repo là một chỗ có thể tải file lạ về chạy.
    let parsed = reqwest::Url::parse(&url).map_err(|_| "url không hợp lệ".to_string())?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("github.com")
        || !parsed.path().starts_with("/vieetjk6-afk/mstudo-desktop/")
    {
        return Err("nguồn cập nhật không hợp lệ".to_string());
    }
    let client = reqwest::Client::builder()
        // Asset GitHub 302 sang objects.githubusercontent.com → phải theo redirect.
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&url)
        .header("User-Agent", "MStudoDesktop/updater")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("tải lỗi HTTP {}", resp.status().as_u16()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    // File cài thật luôn > 1MB — nhỏ hơn nghĩa là tải hụt / trang lỗi.
    if bytes.len() < 1_000_000 {
        return Err(format!("tải lỗi (file quá nhỏ: {} bytes)", bytes.len()));
    }
    let mut path = std::env::temp_dir();
    path.push("MStudo-Desktop-setup.exe");
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    std::process::Command::new(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    // Cho trình cài đặt khởi động rồi thoát app (giải phóng file để ghi đè).
    std::thread::sleep(Duration::from_millis(1200));
    // Nhả khoá single-instance TRƯỚC khi thoát: trình cài đặt mở lại app ngay sau
    // khi cài xong, mà khoá còn giữ thì bản mới tưởng đã có bản khác chạy rồi tự
    // thoát — cập nhật xong lại không thấy app đâu.
    tauri_plugin_single_instance::destroy(&app);
    app.exit(0);
    Ok(())
}

/// Chặn ký tự điều khiển / xuống dòng trong tham số mở ngoài (phòng thủ chiều sâu).
fn has_control_chars(s: &str) -> bool {
    s.chars().any(|c| c.is_control())
}

/// Các giao thức được phép giao ra ngoài cho Windows mở. Chỉ những thứ một cái
/// link trong app studio thực sự cần: web, gửi mail, gọi điện, nhắn tin. KHÔNG
/// có `file:`, `ms-*:`, `search-ms:`… — những giao thức mở được ứng dụng hệ thống
/// nếu trang web bị lợi dụng.
const EXTERNAL_SCHEMES: &[&str] = &["http", "https", "mailto", "tel", "sms", "callto"];

/// Giao một địa chỉ cho Windows mở bằng ứng dụng mặc định (trình duyệt, phần mềm
/// mail, ứng dụng gọi điện).
///
/// Dùng `explorer` / `rundll32` (không qua `cmd`): Rust truyền tham số thẳng cho
/// CreateProcess nên KHÔNG có shell để chèn lệnh — trước đây `cmd /C start` cho
/// phép chèn lệnh qua ký tự `&`, `|`, `>`… nếu URL bị thao túng.
fn open_external(url: &str) -> Result<(), String> {
    if has_control_chars(url) {
        return Err("bad_url".to_string());
    }
    let parsed = tauri::Url::parse(url).map_err(|_| "bad_url".to_string())?;
    if !EXTERNAL_SCHEMES.contains(&parsed.scheme()) {
        return Err("bad_url".to_string());
    }
    let target = parsed.as_str().to_string();
    #[cfg(target_os = "windows")]
    {
        // http/https: `explorer` (cách đã chạy ổn từ đầu). Giao thức khác
        // (mailto:, tel:…) explorer không nhận → dùng bộ mở URI chuẩn của Windows.
        if parsed.scheme() == "http" || parsed.scheme() == "https" {
            if std::process::Command::new("explorer").arg(&target).spawn().is_ok() {
                return Ok(());
            }
        }
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", &target])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    {
        let _ = target;
        Err("unsupported".to_string())
    }
}

/// Mở liên kết bằng ứng dụng mặc định của máy (nút "Tải bản cập nhật", "Mở trong
/// trình duyệt", và mọi link ra ngoài bấm trong cửa sổ studio).
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open_external(&url)
}

/// Mở một file bằng ứng dụng mặc định (PDF/HTML để in hợp đồng).
/// Dùng `explorer` trực tiếp — không qua `cmd` (xem ghi chú ở `open_url`).
/// Chỉ mở tài liệu/ảnh; không cho mở file thực thi (chống lạm dụng để chạy .exe).
#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    if has_control_chars(&path) || !OPENABLE_EXTS.contains(&ext_lower(&path).as_str()) {
        return Err("bad_path".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    {
        let _ = path;
        Err("unsupported".to_string())
    }
}

/// Mở thư mục trong Windows Explorer.
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    // explorer <arg> sẽ CHẠY file nếu path trỏ tới .exe/UNC — chỉ cho mở THƯ MỤC.
    if has_control_chars(&path) || !Path::new(&path).is_dir() {
        return Err("bad_path".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    {
        let _ = path;
        Err("unsupported".to_string())
    }
}

/// Tạo cây thư mục (create_dir_all) cho một hợp đồng trên máy.
#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    if !path_allowed(&path) {
        return Err("bad_path".to_string());
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct DirEntryInfo {
    name: String,
    is_dir: bool,
    size: u64,
    mtime_ms: u64,
}

/// Liệt kê nội dung một thư mục (không đệ quy) — dùng để quét file cần tải lên
/// Drive (kèm size + thời điểm sửa để bỏ qua file đã tải, không đổi).
#[tauri::command]
fn list_dir(path: String) -> Result<Vec<DirEntryInfo>, String> {
    if !path_allowed(&path) {
        return Err("bad_path".to_string());
    }
    let mut out = Vec::new();
    let rd = match fs::read_dir(&path) {
        Ok(r) => r,
        Err(_) => return Ok(out), // thư mục chưa tồn tại → rỗng
    };
    for entry in rd.flatten() {
        let md = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let mtime_ms = md
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: md.is_dir(),
            size: if md.is_file() { md.len() } else { 0 },
            mtime_ms,
        });
    }
    Ok(out)
}

#[derive(Serialize)]
struct UploadResult {
    id: String,
}

async fn parse_upload_final(resp: reqwest::Response) -> Result<UploadResult, String> {
    let status = resp.status().as_u16();
    let txt = resp.text().await.map_err(|e| e.to_string())?;
    if status != 200 && status != 201 {
        return Err(format!("final {status}"));
    }
    let v: serde_json::Value = serde_json::from_str(&txt).map_err(|e| e.to_string())?;
    let id = v.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string();
    if id.is_empty() {
        return Err("no_id".to_string());
    }
    Ok(UploadResult { id })
}

/// Tải MỘT file lên Google Drive bằng resumable upload theo khối 8MB — file lớn
/// (video) KHÔNG bị nạp trọn vào RAM. `access_token` do máy chủ mstudo cấp
/// (scope drive.file); `folder_id` là thư mục đích trên Drive của studio.
#[tauri::command]
async fn drive_upload(
    app: tauri::AppHandle,
    access_token: String,
    folder_id: String,
    file_path: String,
    name: String,
    mime: String,
) -> Result<UploadResult, String> {
    use std::io::{Read, Seek, SeekFrom};
    if !path_allowed(&file_path) || has_control_chars(&folder_id) {
        return Err("bad_path".to_string());
    }
    let meta = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let total: u64 = meta.len();
    // Phát tiến trình cho frontend (thanh %, tốc độ, thời gian dự kiến).
    let emit = |uploaded: u64| {
        let _ = app.emit(
            "drive-progress",
            UploadProgress {
                path: file_path.clone(),
                uploaded,
                total,
            },
        );
    };
    let mime = if mime.is_empty() {
        "application/octet-stream".to_string()
    } else {
        mime
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|e| e.to_string())?;

    // File NHỎ (≤ 8MB, chủ yếu là ảnh) → multipart 1-request: tiết kiệm 1 round-trip
    // "initiate" của resumable (nhanh hơn rõ khi có hàng trăm ảnh nhỏ). Nạp trọn
    // vào RAM ở mức ≤ 8MB là chấp nhận được (× số luồng song song vẫn nhẹ).
    const SIMPLE_MAX: u64 = 8 * 1024 * 1024;
    if total > 0 && total <= SIMPLE_MAX {
        let data = fs::read(&file_path).map_err(|e| e.to_string())?;
        let meta_json = serde_json::to_string(&serde_json::json!({
            "name": name.clone(),
            "parents": [folder_id.clone()],
        }))
        .map_err(|e| e.to_string())?;
        // Boundary duy nhất theo thời điểm + dung lượng → gần như không thể trùng
        // với nội dung nhị phân của file.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let boundary = format!("mstudoBoundary{nanos:x}{total:x}");
        let mut body: Vec<u8> = Vec::with_capacity(data.len() + meta_json.len() + 256);
        body.extend_from_slice(
            format!("--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").as_bytes(),
        );
        body.extend_from_slice(meta_json.as_bytes());
        body.extend_from_slice(format!("\r\n--{boundary}\r\nContent-Type: {mime}\r\n\r\n").as_bytes());
        body.extend_from_slice(&data);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        let resp = client
            .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id")
            .header("Authorization", format!("Bearer {access_token}"))
            .header("Content-Type", format!("multipart/related; boundary={boundary}"))
            .body(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        emit(total);
        return parse_upload_final(resp).await;
    }

    // 1) Khởi tạo phiên resumable — gửi metadata, nhận URL tải lên ở header Location.
    let body = serde_json::json!({ "name": name, "parents": [folder_id] });
    let init = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Type", "application/json; charset=UTF-8")
        .header("X-Upload-Content-Type", &mime)
        .header("X-Upload-Content-Length", total.to_string())
        .body(serde_json::to_string(&body).map_err(|e| e.to_string())?)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !init.status().is_success() {
        return Err(format!("init {}", init.status().as_u16()));
    }
    let upload_url = init
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| "no_upload_url".to_string())?;

    // File rỗng → PUT một lần thân rỗng.
    if total == 0 {
        let resp = client
            .put(&upload_url)
            .header("Content-Length", "0")
            .body(Vec::<u8>::new())
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let r = parse_upload_final(resp).await;
        emit(0);
        return r;
    }

    let mut f = fs::File::open(&file_path).map_err(|e| e.to_string())?;
    const CHUNK: u64 = 8 * 1024 * 1024; // bội số 256KB theo yêu cầu của Google
    let mut offset: u64 = 0;

    loop {
        let end = std::cmp::min(offset + CHUNK, total);
        let len = (end - offset) as usize;
        let mut buf = vec![0u8; len];
        f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
        f.read_exact(&mut buf).map_err(|e| e.to_string())?;
        let range = format!("bytes {}-{}/{}", offset, end - 1, total);
        let resp = client
            .put(&upload_url)
            .header("Content-Length", len.to_string())
            .header("Content-Range", range)
            .body(buf)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = resp.status().as_u16();
        if status == 200 || status == 201 {
            emit(total);
            return parse_upload_final(resp).await;
        } else if status == 308 {
            offset = end; // Google đã nhận khối này → gửi khối kế
            emit(offset); // báo tiến trình sau mỗi khối 8MB
            if offset >= total {
                return Err("incomplete".to_string());
            }
        } else {
            let t = resp.text().await.unwrap_or_default();
            return Err(format!("upload {status} {}", t.chars().take(200).collect::<String>()));
        }
    }
}

/// Đưa cửa sổ chính hiện lên (từ khay hệ thống) và focus.
fn show_main(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Ẩn cửa sổ BẢNG ĐIỀU KHIỂN (main) xuống khay — engine đồng bộ vẫn chạy trong
/// webview ẩn. Dùng sau khi mở giao diện studio để người dùng chỉ thấy 1 cửa sổ.
#[tauri::command]
fn hide_main(app: tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}

/// Mở giao diện studio đầy đủ: gọi hàm frontend trong webview main (chạy cả khi
/// main đang ẩn) để nó đọc địa chỉ máy chủ rồi mở/hiện cửa sổ studioapp.
fn open_studio(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.eval("window.openStudioApp && window.openStudioApp()");
    }
}

/// Người dùng mở app lần nữa trong khi nó ĐANG chạy ngầm dưới khay.
///
/// Không chặn thì Windows mở thêm hẳn một tiến trình: thêm một biểu tượng khay
/// (mở mấy lần thì khay đầy icon — đúng cái studio nhìn thấy), và tệ hơn, thêm
/// một engine đồng bộ chạy song song ghi vào cùng thư mục dữ liệu. Nên: bản
/// đang chạy hiện lên trước, còn bản vừa mở tự thoát (plugin single-instance lo).
fn focus_running_app(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window("studioapp") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }
    // Chưa mở giao diện studio (hoặc chưa cài đặt xong) → hiện bảng điều khiển
    // rồi thử mở giao diện studio, y như bấm biểu tượng khay.
    show_main(app);
    open_studio(app);
}

/// Tạo biểu tượng khay hệ thống + menu (Mở / Đồng bộ ngay / Thoát). Để app chạy
/// ngầm dưới khay: đóng cửa sổ chỉ ẩn đi, engine đồng bộ vẫn tiếp tục.
fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let studio_i = MenuItem::with_id(app, "studio", "Mở giao diện studio", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "Bảng điều khiển & đồng bộ", true, None::<&str>)?;
    let sync_i = MenuItem::with_id(app, "sync", "Đồng bộ ngay", true, None::<&str>)?;
    // Cửa sổ studio không có menu trình duyệt, nên khay hệ thống là chỗ DUY NHẤT
    // gỡ được khi kẹt đăng nhập (cookie phiên cũ/hỏng) — kể cả lúc cửa sổ studio
    // đang chiếm hết màn hình và bảng điều khiển đã ẩn xuống khay.
    let logout_i = MenuItem::with_id(app, "logout", "Đăng xuất / xóa cookie đăng nhập", true, None::<&str>)?;
    let login_i = MenuItem::with_id(app, "login", "Đăng nhập tự động (mã thiết bị)", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&studio_i, &show_i, &sync_i, &login_i, &logout_i, &quit_i])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("MStudo Desktop — đang chạy ngầm")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "studio" => open_studio(app),
            "show" => show_main(app),
            "sync" => {
                show_main(app);
                if let Some(w) = tauri::Manager::get_webview_window(app, "main") {
                    // Gọi engine đồng bộ ở frontend (hàm toàn cục trong app.js).
                    let _ = w.eval("window.runDriveSync && window.runDriveSync(true)");
                }
            }
            "login" => {
                // Xin mã đăng nhập một lần bằng mã thiết bị rồi mở thẳng giao
                // diện studio — không phải gõ mật khẩu, không qua captcha.
                if let Some(w) = tauri::Manager::get_webview_window(app, "main") {
                    let _ = w.eval("window.deviceLogin && window.deviceLogin(true)");
                }
            }
            "logout" => {
                // Xóa cookie phiên rồi mở lại trang đăng nhập (hàm toàn cục
                // trong app.js — chạy được cả khi bảng điều khiển đang ẩn).
                if let Some(w) = tauri::Manager::get_webview_window(app, "main") {
                    let _ = w.eval("window.resetLogin && window.resetLogin(false)");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Bấm trái vào biểu tượng khay → mở lại giao diện studio (màn chính).
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                open_studio(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Đổi chú thích (tooltip) của biểu tượng khay.
///
/// Chạy ngầm nghĩa là studio không mở bảng điều khiển, nên mọi thứ ghi ra nhật ký
/// trong bảng đó đều vô hình. Khay là chỗ DUY NHẤT nhìn thấy được — đưa trạng thái
/// đồng bộ (và lỗi thiếu thư mục gốc) lên đây thì mới có cách biết vì sao im lặng.
#[tauri::command]
fn set_tray_tooltip(app: tauri::AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_tooltip(Some(text));
    }
}

/// Nhịp nền do RUST phát, thay cho setInterval trong webview.
///
/// Bảng điều khiển ẩn xuống khay nghĩa là WebView2 bị che, và Chromium bóp nghẹt
/// (có lúc dừng hẳn) mọi bộ đếm giờ của trang bị che. Hệ quả: studio dùng desktop
/// như app studio thì engine đồng bộ gần như không chạy — thư mục trên máy không
/// bao giờ được tạo. Luồng Rust không bị bóp, nên nó tự gọi hàm đồng bộ bên
/// trong webview theo nhịp cố định, kể cả khi cửa sổ đang ẩn.
fn start_background_tick(app: &tauri::AppHandle) {
    use tauri::Manager;
    let handle = app.clone();
    std::thread::spawn(move || {
        // Chờ webview nạp xong app.js trước nhịp đầu tiên.
        std::thread::sleep(std::time::Duration::from_secs(20));
        loop {
            if let Some(w) = handle.get_webview_window("main") {
                let _ = w.eval("window.__mstudoTick && window.__mstudoTick()");
            }
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    });
}

fn main() {
    tauri::Builder::default()
        // PHẢI đăng ký đầu tiên (yêu cầu của plugin): chốt chỉ cho MỘT bản app
        // chạy mỗi lúc. Lần mở thứ hai chỉ đánh thức bản đang chạy rồi tự thoát.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_running_app(app);
        }))
        .setup(|app| {
            setup_tray(app.handle())?;
            start_background_tick(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Bấm dấu × ở cửa sổ chính → ẩn xuống khay thay vì thoát (engine đồng
            // bộ ảnh/hợp đồng vẫn chạy ngầm). Thoát hẳn bằng menu khay "Thoát".
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Đóng cả cửa sổ studio lẫn bảng điều khiển → ẩn xuống khay thay vì
                // thoát (engine đồng bộ vẫn chạy ngầm). Thoát hẳn bằng menu khay.
                let label = window.label();
                if label == "main" || label == "studioapp" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            http_get,
            http_post,
            pick_folder,
            write_file_b64,
            read_text,
            read_image_b64,
            path_exists,
            delete_file,
            cleanup_old,
            edge_pdf,
            move_dir,
            hostname,
            open_folder,
            open_file,
            open_url,
            open_app,
            navigate_app,
            clear_web_data,
            hide_main,
            download_and_run,
            create_dir,
            list_dir,
            drive_upload,
            set_roots,
            set_tray_tooltip
        ])
        .run(tauri::generate_context!())
        .expect("Không khởi động được MStudo Desktop");
}
