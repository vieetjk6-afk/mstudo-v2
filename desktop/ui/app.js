/* MStudo Desktop — engine đồng bộ.
 * - Hợp đồng: tải bù từ mốc lần-đồng-bộ-cuối, lưu theo cấu trúc
 *   {Loại dịch vụ}/Thang N/{Tên hợp đồng}/, mỗi hợp đồng đúng 1 file PDF (qua
 *   Edge headless) + 1 Word; sửa/ký lại → GHI ĐÈ (không tạo nhiều bản).
 * - Excel: xuất mỗi mảng 1 file, hằng ngày + khi mở app; SaoLuu JSON đầy đủ;
 *   tự dọn file cũ hơn 30 ngày (không đụng thư mục hợp đồng).
 */

const invoke = window.__TAURI__.core.invoke;

const APP_VERSION = "1.0.9"; // giữ khớp với src-tauri/tauri.conf.json

// ─── Cấu hình (localStorage) ─────────────────────────────────────────────────
const cfg = JSON.parse(localStorage.getItem("cfg") || "{}");
const saveCfg = () => localStorage.setItem("cfg", JSON.stringify(cfg));
// Khai báo cho Rust các thư mục gốc được phép thao tác (bảo mật: mọi lệnh file
// bị giới hạn trong đây). Gọi lúc khởi động + mỗi khi đổi thư mục.
const syncRoots = () => invoke("set_roots", { paths: [cfg.dir, cfg.mediaDir].filter(Boolean) }).catch(() => {});

const SYNC_EVERY_MS = 20 * 1000;         // đồng bộ hợp đồng mỗi 20 giây (gần như tức thì)
const DATA_REFRESH_MS = 5 * 60 * 1000;    // tải lại dữ liệu offline mỗi 5 phút
const KEEP_DAYS = 30;                     // giữ file xuất 30 ngày
const EXPORTS = [
  ["customers", "KhachHang"], ["quotes", "BaoGia"], ["expenses", "ChiTieu"],
  ["payroll", "Luong"], ["bookings", "LichHen"], ["staff", "NhanVien"],
];

// ─── Tiện ích ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const b64ToText = (b64) => new TextDecoder("utf-8").decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
const textToB64 = (t) => {
  const bytes = new TextEncoder().encode(t);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const join = (...parts) => parts.filter(Boolean).join("\\").replace(/[\\/]+/g, "\\");
const cachePath = () => join(cfg.dir, "_offline-cache.json");
// Mốc cập nhật cache (cho trình duyệt dữ liệu offline hiển thị).
window.cacheStamp = () => (cfg.lastCache ? fmtTime(cfg.lastCache) : "chưa tải");
// Lần tải dữ liệu GẦN NHẤT có lỗi hay không — để Tổng quan nói ra ngay dưới các
// con số, thay vì chỉ nằm trong nhật ký ở tab khác.
window.cacheError = () => (cfg.lastCacheErr ? { ...cfg.lastCacheErr, atText: fmtTime(cfg.lastCacheErr.at) } : null);
const today = () => new Date().toISOString().slice(0, 10);

// ─── Cờ "đang chạy" TỰ HẾT HẠN ───────────────────────────────────────────────
// Cửa sổ bị ẩn xuống khay GIỮA LÚC đang gọi mạng thì WebView2 có thể treo lời
// gọi đó vĩnh viễn: promise không bao giờ settle nên khối finally không chạy, và
// một cờ boolean thường sẽ kẹt ở true MÃI MÃI. Từ đó mọi lần chạy sau đều lặng
// lẽ thoát ngay ở dòng đầu — không lỗi, không nhật ký, dữ liệu đứng im y như
// đang chạy bình thường. Cho cờ một hạn sống để hệ thống tự gỡ kẹt.
const BUSY_TTL_MS = 3 * 60 * 1000;
const _busy = {};
const busy = (k) => !!_busy[k] && Date.now() - _busy[k] < BUSY_TTL_MS;
const busyOn = (k) => { _busy[k] = Date.now(); };
const busyOff = (k) => { delete _busy[k]; };

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function log(msg, kind = "") {
  const item = { t: new Date().toISOString(), msg, kind };
  const list = JSON.parse(localStorage.getItem("log") || "[]");
  list.unshift(item);
  localStorage.setItem("log", JSON.stringify(list.slice(0, 100)));
  renderLog();
}
function renderLog() {
  const list = JSON.parse(localStorage.getItem("log") || "[]");
  $("log").innerHTML = list
    .map((l) => `<li><span class="t">${fmtTime(l.t)}</span><span class="${l.kind}">${l.msg.replace(/</g, "&lt;")}</span></li>`)
    .join("");
}

// ─── Gọi API mstudo (qua Rust để tránh CORS) ─────────────────────────────────
async function api(path) {
  const r = await invoke("http_get", { url: cfg.server + path, token: cfg.token });
  if (r.status === 401) { onRevoked(); throw new Error("device_revoked"); }
  if (r.status === 402) { setPlanLocked(true); throw new Error("plan_expired"); }
  if (r.status >= 400) {
    let detail = "";
    try { detail = JSON.parse(b64ToText(r.body_b64)).error || ""; } catch { /* body không phải JSON */ }
    throw new Error("HTTP " + r.status + (detail ? " · " + detail : ""));
  }
  setPlanLocked(false);
  return r;
}
const apiJson = async (path) => JSON.parse(b64ToText((await api(path)).body_b64));
const apiB64 = async (path) => (await api(path)).body_b64;

// ─── Màn hình ────────────────────────────────────────────────────────────────
function show(screen) {
  for (const s of ["setup", "folder", "main"]) $("screen-" + s).classList.toggle("hidden", s !== screen);
  // Tên tài khoản LUÔN hiện cạnh trạng thái kết nối. Studio có nhiều tài khoản
  // mà máy gắn nhầm cái khác thì mọi con số đều sai, và trước đây không có chỗ
  // nào trong app nói ra máy đang đồng bộ cho ai.
  const st = $("topStatus");
  if (st) st.innerHTML = cfg.token
    ? `<span class="ok">● Đã kết nối</span> ${cfg.acct ? `<b>${String(cfg.acct).replace(/</g, "&lt;")}</b> · ` : ""}${cfg.server || ""}`
    : "Chưa kết nối";
  // Màn chính có sidebar riêng (brand ở đó) → ẩn thanh tiêu đề trên cùng.
  const tb = $("topbar"); if (tb) tb.classList.toggle("hidden", screen === "main");
}
function setPlanLocked(locked) {
  $("planBanner").classList.toggle("hidden", !locked);
}
function refreshStats() {
  $("stSync").textContent = fmtTime(cfg.lastSync);
  $("stContracts").textContent = String(Object.keys(cfg.saved || {}).length);
  $("stExport").textContent = cfg.lastExportDate || "—";
  { const sd = $("stDrive"); if (sd) sd.textContent = fmtTime(cfg.lastDriveSync); }
  { const dd = $("driveDir"); if (dd) dd.textContent = cfg.mediaDir || "chưa chọn"; }
  $("mainFolderPath").textContent = cfg.dir || "";
  $("deviceInfo").textContent = `${cfg.deviceName || "Máy tính Windows"} · máy chủ ${cfg.server || ""}`;
}

// ─── Màn 1: Kết nối ──────────────────────────────────────────────────────────
$("btnConnect").onclick = async () => {
  const server = $("inServer").value.trim().replace(/\/+$/, "");
  const token = $("inToken").value.trim();
  const msg = $("setupMsg");
  msg.className = "msg";
  if (!/^https?:\/\//.test(server)) { msg.className = "msg err"; msg.textContent = "Địa chỉ máy chủ chưa đúng (bắt đầu bằng https://)."; return; }
  if (!token.startsWith("msd_")) { msg.className = "msg err"; msg.textContent = "Mã kết nối chưa đúng (bắt đầu bằng msd_)."; return; }
  msg.textContent = "Đang kiểm tra kết nối…";
  try {
    const r = await invoke("http_get", { url: `${server}/api/desktop/contracts?since=${encodeURIComponent(new Date().toISOString())}`, token });
    if (r.status === 401) throw new Error("Mã kết nối không hợp lệ hoặc thiết bị đã bị thu hồi.");
    if (r.status === 402) throw new Error("Gói Studio của tài khoản đã hết hạn.");
    if (r.status >= 400) throw new Error("Máy chủ trả lỗi HTTP " + r.status);
    cfg.server = server; cfg.token = token;
    cfg.deviceName = await invoke("hostname").catch(() => "Máy tính Windows");
    saveCfg();
    // Đọc luôn tài khoản của mã vừa dán — dán nhầm mã của studio khác thì phải
    // biết NGAY tại đây, chứ không phải sau khi thấy số liệu sai.
    let who = null;
    try {
      const rr = await invoke("http_get", { url: `${server}/api/desktop/whoami`, token });
      if (rr.status === 200) who = JSON.parse(b64ToText(rr.body_b64));
    } catch { /* không đọc được thì thôi, không chặn kết nối */ }
    if (who?.account) { cfg.acct = who.account.name || who.account.email || ""; saveCfg(); }
    const acctLine = who?.account
      ? ` Tài khoản: ${who.account.name || who.account.email} (${who.counts?.contractsActive ?? "?"} hợp đồng).`
      : "";
    msg.className = "msg ok"; msg.textContent = "Kết nối thành công!" + acctLine;
    log("Kết nối thiết bị thành công." + acctLine);
    show("folder");
  } catch (e) {
    msg.className = "msg err";
    msg.textContent = e.message || "Không kết nối được — kiểm tra mạng và thử lại.";
  }
};

// ─── Màn 2: Chọn thư mục ─────────────────────────────────────────────────────
$("btnPickFolder").onclick = async () => {
  const p = await invoke("pick_folder");
  if (!p) return;
  $("folderPath").textContent = p;
  $("btnFolderNext").disabled = false;
};
$("btnFolderNext").onclick = async () => {
  const p = $("folderPath").textContent;
  if (!p || p === "Chưa chọn thư mục") return;
  cfg.dir = p; cfg.saved = cfg.saved || {}; saveCfg();
  log("Đã chọn thư mục lưu: " + p);
  show("main"); refreshStats(); renderLog(); gotoNav("overview");
  bootSync(true); // lần đầu: tải TOÀN BỘ hợp đồng đã ký + xuất đủ bộ Excel
  openStudioApp(); // vào thẳng giao diện studio đầy đủ sau khi cài đặt xong
};

// ─── Mở TOÀN BỘ ứng dụng quản lý NGAY TRONG CLIENT (cửa sổ nhúng phóng to) ────
// Cửa sổ nhúng chính là web app thật → giao diện & tính năng y hệt. Đăng nhập
// một lần trong cửa sổ đó; phiên được lưu lại cho các lần sau.
async function openStudioApp() {
  if (!cfg.server) return;
  try {
    await invoke("open_app", { url: cfg.server + "/dashboard/studio" });
    // Ẩn BẢNG ĐIỀU KHIỂN xuống khay → người dùng chỉ thấy giao diện studio đầy đủ
    // (engine đồng bộ vẫn chạy ngầm trong webview ẩn). Mở lại bảng điều khiển ở
    // menu khay "Bảng điều khiển & đồng bộ".
    //
    // CHỜ lần tải dữ liệu ĐẦU TIÊN xong rồi mới ẩn. Ẩn sau đúng 600ms như trước
    // là cắt ngang lời gọi đang bay: webview bị che có thể không bao giờ nhận
    // được hồi đáp, nên bản dữ liệu offline không lần nào ghi được — dữ liệu
    // càng nhiều thì càng chắc chắn trượt.
    await Promise.race([
      window.__firstData || Promise.resolve(),
      new Promise((r) => setTimeout(r, 20000)),
    ]);
    invoke("hide_main").catch(() => {});
  } catch (e) {
    log("Không mở được ứng dụng: " + e, "err");
  }
}
window.openStudioApp = openStudioApp; // để menu khay (Rust) gọi được
// Dự phòng: mở trong trình duyệt ngoài (nếu cửa sổ nhúng gặp sự cố).
function openStudioBrowser() {
  if (!cfg.server) return;
  invoke("open_url", { url: cfg.server + "/dashboard/studio" }).catch(() => {});
}
$("btnOpenApp").onclick = openStudioApp;
const _obb = $("btnOpenAppBrowser"); if (_obb) _obb.onclick = (e) => { e.preventDefault(); openStudioBrowser(); };

// ─── Menu trái: điều hướng giữa các mục dữ liệu + Sao lưu & thiết bị ─────────
const NAV_TITLE = {
  overview: "Tổng quan", calendar: "Lịch & đặt lịch", backup: "Đồng bộ & sao lưu",
};
function gotoNav(nav) {
  document.querySelectorAll("#sideNav .side-item").forEach((b) => b.classList.toggle("on", b.dataset.nav === nav));
  const title = $("pageTitle"); if (title) title.textContent = NAV_TITLE[nav] || "";
  if (nav === "backup") { showSub("backup"); return; }
  showSub("data");
  if (typeof gotoTab === "function") gotoTab(nav); // đặt tab dữ liệu + vẽ lại
}
function showSub(sub) {
  $("sub-data").classList.toggle("hidden", sub !== "data");
  $("sub-backup").classList.toggle("hidden", sub !== "backup");
}
document.querySelectorAll("#sideNav .side-item").forEach((b) => b.onclick = () => gotoNav(b.dataset.nav));
// "Tải dữ liệu mới": làm mới cache offline (dùng lại luồng xuất/sao lưu).
$("btnRefreshData").onclick = () => refreshData(true).then(checkAccount);
// Kiểm tra cập nhật thủ công (phòng khi app chưa tự báo).
{ const b = $("btnCheckUpdate"); if (b) b.onclick = () => checkUpdate(true); }
{ const v = $("appVer"); if (v) v.textContent = "Phiên bản " + APP_VERSION + " (beta)"; }

// ─── Màn 3: hành động ────────────────────────────────────────────────────────
$("btnSyncNow").onclick = () => runSync(true);
$("btnExportNow").onclick = () => runExports(true);
{ const b = $("btnDriveSync"); if (b) b.onclick = () => runDriveSync(true); }
{ const b = $("btnPickMediaDir"); if (b) b.onclick = async () => {
  const p = await invoke("pick_folder");
  if (!p) return;
  cfg.mediaDir = p; saveCfg(); syncRoots(); refreshStats();
  log("Đã chọn thư mục gốc ảnh/video: " + p);
  runDriveSync(true);
}; }
$("btnOpenFolder").onclick = () => invoke("open_folder", { path: cfg.dir }).catch(() => {});
$("btnChangeFolder").onclick = async () => {
  const p = await invoke("pick_folder");
  if (!p || p === cfg.dir) return;
  const move = confirm("Di chuyển toàn bộ dữ liệu đã lưu sang thư mục mới?\n\nOK = di chuyển · Cancel = giữ nguyên dữ liệu cũ, chỉ lưu mới vào vị trí mới");
  // Cho phép thao tác ở cả thư mục cũ + mới trong lúc di chuyển.
  await invoke("set_roots", { paths: [cfg.dir, p, cfg.mediaDir].filter(Boolean) }).catch(() => {});
  if (move) {
    try {
      for (const sub of ["HopDong", "SaoLuu", ...EXPORTS.map(([, f]) => f)]) {
        if (await invoke("path_exists", { path: join(cfg.dir, sub) })) {
          await invoke("move_dir", { from: join(cfg.dir, sub), to: join(p, sub) });
        }
      }
      log("Đã di chuyển dữ liệu sang " + p);
    } catch (e) { log("Lỗi di chuyển dữ liệu: " + e, "err"); }
  }
  cfg.dir = p; saveCfg(); syncRoots(); refreshStats();
  log("Đổi thư mục lưu thành " + p);
};
$("btnDisconnect").onclick = () => {
  if (!confirm("Ngắt kết nối thiết bị này? Dữ liệu đã lưu trên máy vẫn giữ nguyên.")) return;
  localStorage.removeItem("cfg");
  location.reload();
};
function onRevoked() {
  log("Thiết bị đã bị thu hồi từ trang quản trị — cần kết nối lại.", "err");
  delete cfg.token; saveCfg();
  show("setup");
}

// ─── Đồng bộ hợp đồng ────────────────────────────────────────────────────────
async function runSync(manual = false) {
  if (busy("sync") || !cfg.token || !cfg.dir) return;
  busyOn("sync");
  try {
    const since = cfg.lastSync ? `?since=${encodeURIComponent(cfg.lastSync)}` : "";
    const r = await apiJson(`/api/desktop/contracts${since}`);
    if (r.contracts.length) log(`Có ${r.contracts.length} hợp đồng cần lưu…`);
    else if (manual) log("Không có hợp đồng mới.");
    let okAll = true;
    for (const c of r.contracts) {
      try { await saveContract(c); }
      catch (e) { okAll = false; log(`Lỗi lưu HĐ ${c.code || c.id}: ${e.message || e}`, "err"); }
    }
    // Chỉ dời mốc khi mọi hợp đồng lưu xong — hợp đồng lỗi sẽ được thử lại lần sau.
    if (okAll) { cfg.lastSync = r.now; saveCfg(); }
    refreshStats();
    // Có hợp đồng mới (đã ký) → tạo thư mục ảnh/video trên máy + Drive ngay.
    if (r.contracts.length) runDriveSync(false);
  } catch (e) {
    if (manual) log("Không đồng bộ được: " + (e.message || e), "err");
  } finally {
    busyOff("sync");
  }
}

async function saveContract(c) {
  const meta = await apiJson(`/api/desktop/contracts/${c.id}`);
  // Lưu file hợp đồng theo CÙNG cấu trúc với ảnh/video:
  //   {thư mục lưu}/{Loại dịch vụ}/Thang N/{Tên hợp đồng}/...
  // (bản server cũ không trả path_segments → giữ nếp cũ "HopDong/{tên}").
  const folderRel = Array.isArray(meta.path_segments) && meta.path_segments.length
    ? join(...meta.path_segments)
    : join("HopDong", meta.file_base);
  const manifestPath = join(cfg.dir, folderRel, "mstudo.json");
  let man = { updated_at: null };
  try { man = JSON.parse(await invoke("read_text", { path: manifestPath })); } catch { /* chưa có */ }
  if (man.updated_at === c.updated_at) return; // bản này đã lưu rồi

  // GHI ĐÈ lên file cũ (không tạo nhiều "(ban 2, 3…)") — mỗi hợp đồng đúng 1 file.
  const baseRel = join(folderRel, meta.file_base);

  // Word
  const docx = await apiB64(`/api/desktop/contracts/${c.id}?format=docx`);
  await invoke("write_file_b64", { path: join(cfg.dir, baseRel + ".docx"), contentsB64: docx });

  // PDF: HTML bản in → Edge headless. Không có Edge → giữ file HTML làm dự phòng.
  const html = await apiB64(`/api/desktop/contracts/${c.id}?format=html`);
  const htmlTmp = join(cfg.dir, folderRel, "~print.html");
  await invoke("write_file_b64", { path: htmlTmp, contentsB64: html });
  try {
    await invoke("edge_pdf", { htmlPath: htmlTmp, pdfPath: join(cfg.dir, baseRel + ".pdf") });
    await invoke("delete_file", { path: htmlTmp }).catch(() => {});
  } catch {
    await invoke("write_file_b64", { path: join(cfg.dir, baseRel + ".html"), contentsB64: html });
    await invoke("delete_file", { path: htmlTmp }).catch(() => {});
    log(`Không tìm thấy Microsoft Edge — HĐ ${c.code || ""} lưu bản HTML thay PDF.`, "warn");
  }

  man.updated_at = c.updated_at;
  await invoke("write_file_b64", { path: manifestPath, contentsB64: textToB64(JSON.stringify(man, null, 2)) });
  cfg.saved = cfg.saved || {}; cfg.saved[c.id] = c.updated_at; saveCfg();
  log(`Đã lưu hợp đồng: ${meta.file_base}`);
}

// ─── Đồng bộ ảnh/video hợp đồng lên Google Drive (1 chiều: máy → Drive) ───────
// Khi hợp đồng đã ký: tạo cây thư mục trên máy (Photo/JPG Goc,Raw,File ChinhSua
// + Video nếu có quay) khớp cây trên Drive studio, rồi tải file MỚI lên. Server
// tự tạo "JPG Goc" → album chọn ảnh, "File ChinhSua" → gallery giao khách.
//
// PHƯƠNG ÁN TỐI ƯU (thay vì quét TẤT CẢ hợp đồng mỗi 10s):
//  - Vòng CHẬM (2 phút): quét toàn bộ hợp đồng đã ký — bắt file bỏ vào muộn.
//  - Vòng NHANH (10s): CHỈ quét hợp đồng "đang thực hiện" — thợ đang đổ ảnh vào
//    máy là tải lên gần như tức thì, không phải chờ. Nhẹ vì chỉ đụng vài hợp đồng
//    đang chạy + danh sách hợp đồng được cache 30s (không gọi server mỗi vòng).
//  - Cây thư mục Drive (plan) cache 5 phút → vòng nhanh không gọi lại server.
const DRIVE_FULL_SYNC_MS = 2 * 60 * 1000;   // quét toàn bộ hợp đồng đã ký
const DRIVE_WATCH_MS = 10 * 1000;           // theo dõi nhanh hợp đồng đang thực hiện
const INPROGRESS_TTL_MS = 30 * 1000;        // cache danh sách hợp đồng đang thực hiện
const PLAN_TTL_MS = 5 * 60 * 1000;          // cache cây thư mục Drive mỗi hợp đồng
const THUMB_MAX_BYTES = 16 * 1024 * 1024;   // ảnh lớn hơn → không tạo xem trước
// Số file tải SONG SONG cùng lúc (như app Google Drive) — chồng độ trễ mạng,
// một video lớn không còn chặn các ảnh phía sau. Mặc định 10; chỉnh qua
// cfg.driveConcurrency (2–16). Ảnh nhỏ dùng multipart 1-request ở Rust nên
// 10 luồng chạy rất nhanh mà vẫn nhẹ RAM.
const DRIVE_CONCURRENCY_DEFAULT = 10;
const DRIVE_UPLOAD_RETRIES = 2;             // thử lại file lỗi (tạm mạng) trước khi bỏ qua
let driveTok = { v: null, exp: 0 };
let driveWarned = false;
const planCache = new Map();                 // contractId → { tree, folderId, folderName, at }
const driveSkipLogged = new Set();           // {id}:{reason} đã log (tránh lặp mỗi vòng)
// Lý do bỏ qua 1 hợp đồng khi đồng bộ ảnh → câu tiếng Việt dễ hiểu.
function driveSkipReason(msg) {
  if (msg === "not_signed") return "hợp đồng chưa ký / chưa duyệt";
  if (msg === "not_connected") return "chưa kết nối Google Drive";
  return msg;
}

const MIME_BY_EXT = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", tif: "image/tiff", tiff: "image/tiff",
  mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
  mkv: "video/x-matroska", m4v: "video/x-m4v", webm: "video/webm",
};
const THUMB_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
const guessMime = (name) => MIME_BY_EXT[extOf(name)] || "application/octet-stream";
const safeJson = (b64) => { try { return JSON.parse(b64ToText(b64)); } catch { return {}; } };

// ─── Trạng thái tiến trình (hiển thị như app Google Drive) ───────────────────
const dsync = {
  active: false, total: 0, done: 0,
  totalBytes: 0, doneBytes: 0, curBytes: 0,
  curName: "", curPath: "", curThumb: "", startedAt: 0,
  // Nhiều file tải song song: theo dõi số byte đã gửi của TỪNG file đang tải
  // (path → bytes) để tính tiến độ gộp mượt như app Drive.
  inflight: new Map(),
};
// Tổng byte của các file đang tải dở (cộng vào doneBytes để ra tiến độ hiện tại).
function inflightBytes() {
  let s = 0;
  for (const v of dsync.inflight.values()) s += v || 0;
  return s;
}
let _lastSyncRender = 0;
const fmtBytes = (n) => {
  if (!n || n < 0) n = 0;
  const u = ["B", "KB", "MB", "GB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + " " + u[i];
};
const fmtSpeed = (bps) => fmtBytes(bps) + "/s";
const fmtDuration = (s) => {
  s = Math.max(0, Math.round(s));
  if (s < 60) return s + " giây";
  const m = Math.floor(s / 60), ss = s % 60;
  if (m < 60) return m + " phút" + (ss ? ` ${ss} giây` : "");
  const h = Math.floor(m / 60);
  return h + " giờ" + (m % 60 ? ` ${m % 60} phút` : "");
};
function renderSyncStatus(force = false) {
  const box = $("syncStatus"); if (!box) return;
  const now = Date.now();
  if (!force && now - _lastSyncRender < 350) return;
  _lastSyncRender = now;
  if (!dsync.active) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const sent = dsync.doneBytes + inflightBytes();
  const pct = dsync.totalBytes ? Math.min(100, Math.round((sent / dsync.totalBytes) * 100)) : 0;
  const elapsed = (now - dsync.startedAt) / 1000;
  const speed = elapsed > 0.6 ? sent / elapsed : 0;
  const remain = Math.max(0, dsync.totalBytes - sent);
  const eta = speed > 0 ? remain / speed : 0;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("syncTitle", `Đang đồng bộ ${Math.min(dsync.done, dsync.total)}/${dsync.total} ảnh lên Drive`);
  const fill = $("syncBarFill"); if (fill) fill.style.width = pct + "%";
  set("syncPct", pct + "%");
  const nInflight = dsync.inflight.size;
  set("syncFile", nInflight > 1 ? `Đang tải ${nInflight} file song song…` : dsync.curName || "");
  set("syncMeta", [speed ? fmtSpeed(speed) : "", eta ? "còn khoảng " + fmtDuration(eta) : ""].filter(Boolean).join(" · "));
  const img = $("syncThumb");
  if (img) {
    if (dsync.curThumb) { img.src = dsync.curThumb; img.classList.remove("hidden"); }
    else { img.removeAttribute("src"); img.classList.add("hidden"); }
  }
}
// Xem trước ảnh đang tải (bỏ qua ảnh quá lớn / không phải ảnh → hiện tên file).
async function makeThumb(file) {
  if (!THUMB_EXTS.has(extOf(file.name)) || file.size > THUMB_MAX_BYTES) return "";
  try { return "data:" + guessMime(file.name) + ";base64," + await invoke("read_image_b64", { path: file.path }); }
  catch { return ""; }
}
// Nghe tiến trình từng khối từ Rust → thanh % + thời gian dự kiến chạy mượt
// (quan trọng với video lớn tải nhiều phút).
if (window.__TAURI__ && window.__TAURI__.event) {
  window.__TAURI__.event.listen("drive-progress", (ev) => {
    const p = ev.payload || {};
    // Nhiều file tải song song → cập nhật byte theo path của từng file đang tải.
    if (dsync.active && p.path && dsync.inflight.has(p.path)) {
      dsync.inflight.set(p.path, Math.min(p.uploaded || 0, p.total || 0));
      renderSyncStatus();
    }
  }).catch(() => {});
}

// Access token tạm (server cấp) để tải file thẳng lên Drive; cache tới gần hết hạn.
async function getDriveToken() {
  const now = Date.now();
  if (driveTok.v && now < driveTok.exp - 60000) return driveTok.v;
  const r = await invoke("http_get", { url: cfg.server + "/api/desktop/drive/token", token: cfg.token });
  if (r.status === 409) return null;            // chưa kết nối Drive
  if (r.status >= 400) throw new Error("token HTTP " + r.status);
  const j = safeJson(r.body_b64);
  driveTok = { v: j.access_token, exp: j.expiry || now + 50 * 60 * 1000 };
  return driveTok.v;
}

// Tạo cây thư mục Drive + album cho 1 hợp đồng; resync=true → đồng bộ lại ảnh album.
async function prepareContract(id, resync = false) {
  const r = await invoke("http_post", { url: cfg.server + "/api/desktop/drive/prepare", token: cfg.token, bodyJson: JSON.stringify({ contractId: id, resync }) });
  if (r.status === 409) return { skip: safeJson(r.body_b64).error || "not_connected" };
  if (r.status >= 400) throw new Error("prepare HTTP " + r.status);
  return safeJson(r.body_b64);
}
// Lấy cây thư mục hợp đồng — cache để vòng theo dõi nhanh không gọi server mỗi lần.
async function getPlan(id) {
  const c = planCache.get(id);
  if (c && Date.now() - c.at < PLAN_TTL_MS) return c;
  const plan = await prepareContract(id, false);
  if (plan.skip) return { skip: plan.skip };
  // pathSegments = [Gốc, Loại dịch vụ, Thang N, Tên hợp đồng]; bản server cũ chỉ
  // có folderName (+ rootFolderName) → dựng tạm để vẫn chạy.
  const segments = Array.isArray(plan.pathSegments) && plan.pathSegments.length
    ? plan.pathSegments
    : [plan.rootFolderName, plan.folderName].filter(Boolean);
  const entry = { tree: plan.tree, folderId: plan.folderId, folderName: plan.folderName, pathSegments: segments, at: Date.now() };
  planCache.set(id, entry);
  return entry;
}

// Quét 1 hợp đồng: trả DANH SÁCH file cần tải (chưa tải) + tham chiếu manifest,
// để lõi đồng bộ gom tổng số ảnh/tổng dung lượng trước khi tải (tính % + ETA).
async function scanContract(c, manual = false) {
  const plan = await getPlan(c.id);
  if (plan.skip) throw new Error(plan.skip);
  // Cây thư mục local = mediaDir + [Loại dịch vụ, Thang N, Tên hợp đồng] — y hệt
  // cấu trúc trên Drive (không kèm thư mục gốc; mediaDir chính là gốc trên máy).
  const base = join(cfg.mediaDir, ...(plan.pathSegments && plan.pathSegments.length ? plan.pathSegments : [plan.folderName]));
  const manPath = join(base, "mstudo-drive.json");
  let man = { folderId: plan.folderId, uploaded: {} };
  try { man = JSON.parse(await invoke("read_text", { path: manPath })); } catch { /* chưa có */ }
  man.uploaded = man.uploaded || {};
  // Tạo thư mục hợp đồng + MỌI nút con (kể cả loại trừ — để studio bỏ ảnh/raw vào).
  // KHÔNG nuốt lỗi tạo thư mục → nếu ổ đĩa/quyền có vấn đề, ghi rõ ra log.
  let dirErr = null;
  try { await invoke("create_dir", { path: base }); } catch (e) { dirErr = e; }
  for (const node of plan.tree) {
    try { await invoke("create_dir", { path: join(base, node.path.replace(/\//g, "\\")) }); }
    catch (e) { dirErr = e; }
  }
  if (dirErr) log(`Lỗi tạo thư mục HĐ ${c.code || c.id} tại ${base}: ${dirErr.message || dirErr}`, "err");
  else if (manual) log(`HĐ ${c.code || c.id}: đã tạo ${plan.tree.length} thư mục con tại ${base}`);
  const pending = [];
  for (const node of plan.tree) {
    if (node.excluded) continue; // thư mục loại trừ (VD Raw, Video gốc) → chỉ giữ ở máy
    const localDir = join(base, node.path.replace(/\//g, "\\"));
    let entries = [];
    try { entries = await invoke("list_dir", { path: localDir }); } catch { entries = []; }
    for (const e of entries) {
      if (e.is_dir || e.name.startsWith("~") || e.name.startsWith(".")) continue;
      const key = node.path + "/" + e.name;
      const prev = man.uploaded[key];
      if (prev && prev.size === e.size && prev.mtime === e.mtime_ms) continue; // đã tải, không đổi
      pending.push({ node, key, name: e.name, size: e.size, mtime: e.mtime_ms, path: join(localDir, e.name) });
    }
  }
  return { c, base, manPath, man, pending };
}

// Lõi đồng bộ: quét danh sách hợp đồng → gom việc → tải lần lượt kèm tiến trình.
async function driveSyncRun(contracts, manual = false) {
  if (manual) log(`Đồng bộ Drive: ${contracts.length} hợp đồng đã ký cần quét.`);
  const jobs = [];
  for (const c of contracts) {
    try { jobs.push(await scanContract(c, manual)); }
    catch (e) {
      // Ghi rõ lý do bỏ qua (chưa ký / chưa nối Drive / lỗi khác) — kể cả vòng tự
      // động, log 1 lần / hợp đồng để không lặp mỗi 20s.
      const msg = e.message || String(e);
      const key = `${c.id}:${msg}`;
      if (manual || !driveSkipLogged.has(key)) {
        driveSkipLogged.add(key);
        log(`Bỏ qua thư mục HĐ ${c.code || c.id}: ${driveSkipReason(msg)}`, "warn");
      }
    }
  }
  const files = [];
  for (const j of jobs) for (const p of j.pending) files.push({ job: j, ...p });
  if (!files.length) return 0;

  dsync.active = true; dsync.total = files.length; dsync.done = 0;
  dsync.totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
  dsync.doneBytes = 0; dsync.curBytes = 0; dsync.startedAt = Date.now();
  dsync.inflight.clear();
  const resyncNeeded = new Set();
  let uploaded = 0;

  // Ghi manifest AN TOÀN khi tải song song: nối chuỗi ghi theo TỪNG hợp đồng
  // (job) để hai file cùng hợp đồng không ghi đè manifest của nhau.
  const flushManifest = (job) => {
    job._wq = (job._wq || Promise.resolve()).then(() =>
      invoke("write_file_b64", {
        path: job.manPath,
        contentsB64: textToB64(JSON.stringify(job.man, null, 2)),
      }).catch(() => {})
    );
    return job._wq;
  };

  // Tải 1 file (có thử lại khi lỗi tạm mạng). Cập nhật tiến độ gộp.
  async function uploadOne(f) {
    dsync.curName = f.name;
    dsync.inflight.set(f.path, 0);
    makeThumb(f).then((t) => { if (t) dsync.curThumb = t; }).catch(() => {}); // không chặn luồng tải
    renderSyncStatus(true);
    let ok = false;
    for (let attempt = 0; attempt <= DRIVE_UPLOAD_RETRIES && !ok; attempt++) {
      try {
        const token = await getDriveToken();
        if (!token) throw new Error("not_connected");
        const res = await invoke("drive_upload", { accessToken: token, folderId: f.node.id, filePath: f.path, name: f.name, mime: guessMime(f.name) });
        f.job.man.uploaded[f.key] = { size: f.size, mtime: f.mtime, id: res.id };
        await flushManifest(f.job); // ghi manifest → ngắt giữa chừng cũng không tải lại từ đầu
        if (f.node.role === "selection" || f.node.role === "delivery") resyncNeeded.add(f.job.c.id);
        uploaded++;
        ok = true;
      } catch (e) {
        if (attempt < DRIVE_UPLOAD_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); // backoff 1s, 2s
        } else if (manual) {
          log(`Lỗi tải ${f.name}: ${e.message || e}`, "err");
        }
      }
    }
    dsync.inflight.delete(f.path);
    dsync.done++;
    dsync.doneBytes += (f.size || 0);
    renderSyncStatus(true);
  }

  // Pool N luồng tải SONG SONG (như app Google Drive). idx++ an toàn vì JS đơn luồng.
  const conc = Math.max(1, Math.min(16, cfg.driveConcurrency || DRIVE_CONCURRENCY_DEFAULT));
  let idx = 0;
  const worker = async () => {
    while (idx < files.length) {
      await uploadOne(files[idx++]);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(conc, files.length) }, worker));
  } finally {
    dsync.inflight.clear();
    dsync.active = false; dsync.curThumb = ""; renderSyncStatus(true);
  }
  // Có file mới vào JPG Goc / File ChinhSua → đồng bộ lại danh sách ảnh của album.
  for (const id of resyncNeeded) { try { await prepareContract(id, true); } catch { /* thử lại lần sau */ } }
  return uploaded;
}

let mediaDirWarned = false;

// Vòng CHẬM + nút bấm tay: quét toàn bộ hợp đồng đã ký.
async function runDriveSync(manual = false) {
  if (busy("drive") || !cfg.token) return;
  if (!cfg.mediaDir) {
    // Cảnh báo cả ở vòng TỰ ĐỘNG (một lần), không chỉ khi bấm tay. Studio bỏ qua
    // bước chọn thư mục gốc rồi dùng desktop như app studio sẽ không bao giờ có
    // thư mục trên máy — mà trước đây tuyệt đối không có dòng nào nói ra.
    if (manual || !mediaDirWarned) {
      log("Chưa chọn THƯ MỤC GỐC ảnh/video trên máy — thư mục hợp đồng sẽ không được tạo. Bấm “Chọn thư mục gốc” ở Bảng điều khiển.", "warn");
      mediaDirWarned = true;
    }
    return;
  }
  busyOn("drive");
  try {
    let token;
    try { token = await getDriveToken(); } catch { token = null; }
    if (!token) {
      if (manual || !driveWarned) { log("Chưa kết nối Google Drive — vào mstudo (web) › Khách hàng › Đồng bộ Drive để kết nối.", "warn"); driveWarned = true; }
      return;
    }
    driveWarned = false;
    // ?drive=1: hợp đồng khách đã ký HOẶC studio đã duyệt/đang thực hiện/hoàn thành
    // (không chỉ hợp đồng khách e-ký) → mới tạo đủ thư mục trên máy.
    const list = await apiJson("/api/desktop/contracts?drive=1");
    const uploaded = await driveSyncRun(list.contracts || [], manual);
    cfg.lastDriveSync = new Date().toISOString(); saveCfg();
    if (manual) log(uploaded ? `Đã tải ${uploaded} file lên Drive.` : "Không có file mới để tải lên Drive.");
    refreshStats();
  } catch (e) {
    if (manual) log("Không đồng bộ được Drive: " + (e.message || e), "err");
  } finally {
    busyOff("drive");
  }
}

// Vòng NHANH (10s): CHỈ hợp đồng "đang thực hiện" → tải ảnh mới gần như tức thì.
let _ipCache = { at: 0, list: [] };
async function getInProgress() {
  if (Date.now() - _ipCache.at < INPROGRESS_TTL_MS) return _ipCache.list;
  try {
    const r = await apiJson("/api/desktop/contracts?status=in_progress");
    _ipCache = { at: Date.now(), list: r.contracts || [] };
  } catch { /* giữ cache cũ */ }
  return _ipCache.list;
}
async function runDriveWatch() {
  if (busy("drive") || !cfg.token || !cfg.mediaDir) return;
  let token;
  try { token = await getDriveToken(); } catch { token = null; }
  if (!token) return;                       // chưa nối Drive → im lặng (vòng chậm đã cảnh báo)
  const list = await getInProgress();
  if (!list.length) return;                 // không có hợp đồng đang thực hiện → khỏi quét
  busyOn("drive");
  try {
    const uploaded = await driveSyncRun(list, false);
    if (uploaded) {
      cfg.lastDriveSync = new Date().toISOString(); saveCfg(); refreshStats();
      log(`Tự tải ${uploaded} ảnh mới (hợp đồng đang thực hiện) lên Drive.`);
    }
  } catch { /* thử lại vòng sau */ } finally {
    busyOff("drive");
  }
}

// ─── Tải lại dữ liệu offline ─────────────────────────────────────────────────
// TÁCH RIÊNG khỏi việc xuất Excel. Trước đây hai việc này nằm chung trong
// runExports() và bị khoá bởi `lastExportDate !== today()`, nên bản cache offline
// (thứ nuôi Tổng quan / Hợp đồng / Lịch) chỉ được làm mới MỖI NGÀY MỘT LẦN — mọi
// thay đổi trên web sau lần đó đều không hiện ra, dù "Đồng bộ ngay" vẫn báo vừa
// chạy (runSync chỉ tải file hợp đồng, không đụng tới cache). Tệ hơn: một lỗi khi
// xuất Excel sẽ ném ra trước và cache không bao giờ được ghi.
async function refreshData(manual = false) {
  if (busy("data") || !cfg.token || !cfg.dir) return false;
  busyOn("data");
  try {
    const backup = await apiB64(`/api/desktop/export?type=backup`);
    await invoke("write_file_b64", { path: cachePath(), contentsB64: backup });
    setData(JSON.parse(b64ToText(backup)));
    cfg.lastCache = new Date().toISOString();
    delete cfg.lastCacheErr;
    saveCfg(); refreshStats();
    if (manual) log("Đã tải dữ liệu mới từ máy chủ.");
    return true;
  } catch (e) {
    // Báo cả khi TỰ ĐỘNG: cache cũ mà im lặng chính là thứ khiến số liệu lệch
    // với web mà không ai biết. Lỗi được GHI LẠI để màn Tổng quan nói ra ngay
    // dưới các con số — nhật ký trong tab khác thì không ai thấy.
    cfg.lastCacheErr = { at: new Date().toISOString(), msg: String(e.message || e) };
    saveCfg();
    log("Không tải được dữ liệu mới: " + (e.message || e), "err");
    if (typeof renderData === "function") renderData();
    return false;
  } finally {
    busyOff("data");
  }
}

// So dữ liệu trên máy với máy chủ và nói thẳng ra chỗ lệch (và tài khoản đang
// gắn). Đây là câu trả lời cho "web một đằng, app một nẻo".
async function checkAccount() {
  try {
    const w = await apiJson("/api/desktop/whoami");
    cfg.acct = w.account?.name || w.account?.email || "";
    cfg.acctCounts = w.counts; saveCfg();
    const t = (typeof DB !== "undefined" && DB.tables) || {};
    const local = {
      contracts: (t.studio_contracts || []).length,
      events: (t.studio_events || []).length,
    };
    const el = $("stAccount");
    if (el) el.textContent = cfg.acct || "—";
    // Đưa luôn sang màn dữ liệu để Tổng quan tự cảnh báo (chỗ người dùng nhìn).
    if (window.setServerInfo) window.setServerInfo(w);
    const el2 = $("stCompare");
    if (el2) {
      const lech = local.contracts !== w.counts.contracts || local.events !== w.counts.events;
      el2.textContent = `${local.contracts}/${w.counts.contracts} HĐ · ${local.events}/${w.counts.events} lịch`;
      el2.classList.toggle("bad", lech);
    }
    return w;
  } catch { return null; }
}

// ─── Xuất Excel ──────────────────────────────────────────────────────────────
async function runExports(manual = false) {
  if (busy("export") || !cfg.token || !cfg.dir) return;
  busyOn("export");
  try {
    // Dữ liệu offline trước, Excel sau: Excel hỏng thì cũng không được kéo theo
    // cache (cái quan trọng hơn nhiều).
    await refreshData(manual);
    const backup = await apiB64(`/api/desktop/export?type=backup`);
    await invoke("write_file_b64", { path: join(cfg.dir, "SaoLuu", `mstudo-backup-${today()}.json`), contentsB64: backup });
    for (const [type, folder] of EXPORTS) {
      const b64 = await apiB64(`/api/desktop/export?type=${type}`);
      await invoke("write_file_b64", { path: join(cfg.dir, folder, `${folder}_${today()}.xlsx`), contentsB64: b64 });
    }
    // Dọn file cũ hơn 30 ngày (KHÔNG đụng thư mục HopDong).
    for (const [, folder] of [...EXPORTS, ["", "SaoLuu"]]) {
      await invoke("cleanup_old", { dir: join(cfg.dir, folder), days: KEEP_DAYS }).catch(() => {});
    }
    cfg.lastExportDate = today(); saveCfg(); refreshStats();
    log("Đã xuất Excel + sao lưu JSON.");
  } catch (e) {
    if (manual) log("Không xuất được Excel: " + (e.message || e), "err");
  } finally {
    busyOff("export");
  }
}

// ─── Ghi cục bộ + đồng bộ ngầm (các module chạy local trong client) ──────────
// Thao tác tạo/sửa/xóa áp dụng NGAY vào dữ liệu trên máy (tức thì) rồi xếp hàng
// gửi lên server. Mất mạng vẫn lưu được, có mạng tự đồng bộ lại.
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); }));
const loadQueue = () => { try { return JSON.parse(localStorage.getItem("mstudo_pending") || "[]"); } catch { return []; } };
const saveQueue = (q) => { try { localStorage.setItem("mstudo_pending", JSON.stringify(q)); } catch { /* */ } };

// Áp thao tác vào bộ nhớ DB (data.js) + ghi cache đĩa + vẽ lại + xếp hàng đồng bộ.
window.localMutate = async function (table, op, row) {
  if (typeof DB === "undefined" || !DB.tables) return;
  const arr = DB.tables[table] || (DB.tables[table] = []);
  if (op === "insert") arr.unshift(row);
  else if (op === "update") { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr[i] = { ...arr[i], ...row }; else arr.unshift(row); }
  else if (op === "delete") { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr.splice(i, 1); }
  if (typeof renderData === "function") renderData();
  try { await invoke("write_file_b64", { path: cachePath(), contentsB64: textToB64(JSON.stringify(DB)) }); } catch { /* */ }
  const q = loadQueue(); q.push({ table, op, row, at: Date.now() }); saveQueue(q);
  flushQueue();
};

async function flushQueue() {
  if (busy("flush") || !cfg.server || !cfg.token) return;
  busyOn("flush");
  let q = loadQueue();
  while (q.length) {
    const item = q[0];
    try {
      const r = await invoke("http_post", { url: cfg.server + "/api/desktop/mutate", token: cfg.token, bodyJson: JSON.stringify(item) });
      if (r.status >= 200 && r.status < 300) { q.shift(); saveQueue(q); }
      else if (r.status === 400 || r.status === 403 || r.status === 404) {
        // Lỗi dữ liệu (không phải mạng) → bỏ để không kẹt hàng đợi, ghi log.
        let d = ""; try { d = JSON.parse(b64ToText(r.body_b64)).error || ""; } catch { /* */ }
        log(`Bỏ đồng bộ 1 thay đổi (${item.table}): ${d || r.status}`, "warn");
        q.shift(); saveQueue(q);
      } else break; // lỗi mạng/khác → dừng, thử lại lần sau
    } catch { break; }
  }
  const left = loadQueue().length;
  if (left) log(`Còn ${left} thay đổi chờ đồng bộ.`, "warn");
  busyOff("flush");
}

// ─── In hợp đồng PDF (dùng bản in A4 chuẩn từ server: logo, chữ ký, định dạng) ──
window.printContract = async function (id) {
  if (!cfg.server || !cfg.token || !cfg.dir) { alert("Cần kết nối máy chủ và chọn thư mục lưu trước."); return; }
  try {
    await flushQueue(); // đảm bảo hợp đồng (kể cả vừa tạo cục bộ) đã lên server
    const r = await invoke("http_get", { url: cfg.server + "/api/desktop/contracts/" + id + "?format=html", token: cfg.token });
    if (r.status !== 200) { alert("Chưa in được — hợp đồng đang chờ đồng bộ lên máy chủ. Thử lại sau vài giây."); return; }
    const dir = join(cfg.dir, "HopDong", ".in");
    const htmlPath = join(dir, "hopdong-" + id + ".html");
    const pdfPath = join(dir, "hopdong-" + id + ".pdf");
    await invoke("write_file_b64", { path: htmlPath, contentsB64: r.body_b64 });
    try {
      await invoke("edge_pdf", { htmlPath, pdfPath });
      await invoke("open_file", { path: pdfPath });
      log("Đã tạo PDF hợp đồng — mở ra để in.");
    } catch {
      await invoke("open_file", { path: htmlPath });
      log("Mở bản in (HTML) — bấm Ctrl+P để in ra giấy.", "warn");
    }
  } catch (e) { alert("Không in được: " + (e.message || e)); }
};

// ─── Tự cập nhật: phát hiện bản mới trên GitHub Releases (nhãn desktop-dev) ──
// So SỐ PHIÊN BẢN trong tên file cài (vd MStudo Desktop_0.2.1_x64-setup.exe) với
// APP_VERSION đang chạy; khác nhau → có bản mới. (Cách này không bị "kẹt" như so
// mốc thời gian: cài lỗi vẫn còn phát hiện, cài xong app mới có version khớp nên
// không lặp.)
const RELEASE_TAG = "desktop-dev";
// Repo chứa bản cài. Giữ repo CŨ vì nó công khai — GitHub API chỉ đọc được
// release của repo công khai mà không cần đăng nhập. Đổi ở ĐÚNG một dòng này.
const RELEASE_REPO = "vieetjk01/Studio";
const RELEASE_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/tags/${RELEASE_TAG}`;
const RELEASE_PAGE = `https://github.com/${RELEASE_REPO}/releases/tags/${RELEASE_TAG}`;
let _updateUrl = "";
const parseVer = (name) => { const m = /(\d+\.\d+\.\d+)/.exec(name || ""); return m ? m[1] : ""; };
// So sánh phiên bản kiểu semver: >0 nếu a mới hơn b.
const cmpVer = (a, b) => {
  const pa = (a || "0").split(".").map(Number), pb = (b || "0").split(".").map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};

async function checkUpdate(manual = false) {
  try {
    const r = await invoke("http_get", { url: RELEASE_API, token: null });
    if (r.status !== 200) { if (manual) alert("Không kiểm tra được (máy chủ trả lỗi HTTP " + r.status + "). Thử lại sau."); return; }
    const rel = JSON.parse(b64ToText(r.body_b64));
    // Bản phát hành desktop-dev có thể còn nhiều file cài cũ → CHỌN file có SỐ
    // PHIÊN BẢN CAO NHẤT (không lấy đại file đầu tiên, tránh "kẹt"/hạ cấp).
    const setups = (rel.assets || []).filter((a) => /-setup\.exe$/i.test(a.name));
    if (!setups.length) { if (manual) alert("Chưa tìm thấy file cài trong bản phát hành."); return; }
    const asset = setups.reduce((best, a) => (cmpVer(parseVer(a.name), parseVer(best.name)) > 0 ? a : best), setups[0]);
    _updateUrl = asset.browser_download_url;
    const ver = parseVer(asset.name);
    // Chỉ cập nhật khi bản trên mạng THỰC SỰ mới hơn (không bao giờ hạ cấp).
    if (ver && cmpVer(ver, APP_VERSION) > 0) {
      $("updateText").textContent = `Đã có bản mới ${ver} (đang dùng ${APP_VERSION}).`;
      $("updateBanner").classList.remove("hidden");
      $("btnUpdate").textContent = "Cập nhật ngay"; $("btnUpdate").disabled = false;
      $("btnUpdate").onclick = () => runSelfUpdate(false);
      if (manual) { runSelfUpdate(false); return; } // bấm tay → cập nhật luôn
      // TỰ CẬP NHẬT: chỉ cài tự động khi app đang RẢNH (không đồng bộ/tải/xuất/
      // còn hàng đợi) để không cắt ngang việc đang chạy; nếu bận thì để banner.
      if (!appBusy()) { log("Đang tự cập nhật MStudo Desktop…"); runSelfUpdate(true); }
      else log("Đã có bản cập nhật — sẽ tự cài khi rảnh (hoặc bấm “Cập nhật ngay”).", "warn");
    } else if (manual) {
      alert("Bạn đang dùng bản mới nhất (" + APP_VERSION + ").");
    }
  } catch (e) { if (manual) alert("Không kiểm tra được cập nhật: " + (e.message || e)); }
}
// App có đang bận không (chặn tự cập nhật giữa chừng để không hỏng việc đang chạy).
function appBusy() {
  return busy("sync") || busy("export") || busy("drive") || busy("data") || loadQueue().length > 0;
}
async function runSelfUpdate(auto = false) {
  if (!_updateUrl) return;
  if (!auto && !confirm("Tải và cài bản cập nhật mới? Ứng dụng sẽ đóng lại để cài đặt, rồi mở lại.")) return;
  $("btnUpdate").textContent = "Đang tải…"; $("btnUpdate").disabled = true;
  try {
    await invoke("download_and_run", { url: _updateUrl }); // tải xong app tự thoát để cài
  } catch (e) {
    $("btnUpdate").disabled = false; $("btnUpdate").textContent = "Cập nhật ngay";
    const msg = "Không tự cài được: " + (e.message || e);
    if (auto) { log(msg, "err"); return; }
    // Dự phòng: mở trang phát hành để tải & cài tay (VD SmartScreen chặn chạy ngầm).
    if (confirm(msg + "\n\nMở trang tải bản cài để cài thủ công?")) {
      invoke("open_url", { url: RELEASE_PAGE }).catch(() => {});
    }
  }
}

// ─── Tự đồng bộ khi mở/quay lại app (near-realtime, không cần bấm) ───────────
let _lastFocusSync = 0;
let _focusHooked = false;
function focusSync() {
  if (!cfg.token || !cfg.dir) return;
  const now = Date.now();
  if (now - _lastFocusSync < 8000) return; // tránh gọi dồn khi focus liên tục
  _lastFocusSync = now;
  runSync(false);      // runSync sẽ tự gọi runDriveSync nếu có hợp đồng mới
  runDriveSync(false); // quét thêm file ảnh/video mới bỏ vào thư mục
}
function hookFocusSync() {
  if (_focusHooked) return;
  _focusHooked = true;
  window.addEventListener("focus", focusSync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) focusSync(); });
}

// ─── Nhịp do Rust phát (chạy cả khi cửa sổ ẩn) ───────────────────────────────
// setInterval bên dưới bị Chromium bóp nghẹt khi cửa sổ bị ẩn xuống khay, nên
// KHÔNG tin được ở chế độ chạy ngầm. Rust gọi hàm này mỗi 60 giây; nó lo phần
// việc quan trọng nhất: tạo thư mục + tải ảnh cho hợp đồng đang thực hiện.
let _tickCount = 0;
window.__mstudoTick = () => {
  trayStatus();
  if (!cfg.token) return;
  _tickCount++;
  // Mỗi nhịp: hợp đồng ĐANG THỰC HIỆN (rẻ, chỉ vài hợp đồng).
  try { runDriveWatch(); } catch { /* nhịp sau thử lại */ }
  // Mỗi 5 nhịp (~5 phút): quét TOÀN BỘ hợp đồng đã chốt để bắt hợp đồng mới ký
  // và hợp đồng chưa có thư mục.
  if (_tickCount % 5 === 1) {
    try { runSync(false); } catch { /* nhịp sau thử lại */ }
    try { runDriveSync(false); } catch { /* nhịp sau thử lại */ }
    try { refreshData(false).then(checkAccount); } catch { /* nhịp sau thử lại */ }
  }
};

// Trạng thái đưa lên tooltip khay — cái duy nhất nhìn được khi bảng điều khiển
// đang ẩn. Thiếu đăng nhập hoặc thiếu thư mục gốc thì đồng bộ đứng im hoàn toàn,
// và đây là chỗ duy nhất nói ra điều đó.
function trayStatus() {
  let s;
  if (!cfg.token) s = "⚠ Chưa đăng nhập — mở bảng điều khiển để đăng nhập";
  else if (!cfg.mediaDir) s = "⚠ Chưa chọn thư mục gốc ảnh/video — thư mục hợp đồng KHÔNG được tạo";
  else if (cfg.lastDriveSync) s = "Đang chạy ngầm · Drive lần cuối " + new Date(cfg.lastDriveSync).toLocaleString("vi-VN");
  else s = "Đang chạy ngầm · chưa đồng bộ Drive lần nào";
  invoke("set_tray_tooltip", { text: "MStudo Desktop — " + s }).catch(() => {});
}

// ─── Lịch chạy ───────────────────────────────────────────────────────────────
function bootSync(first = false) {
  syncRoots(); // đặt thư mục gốc được phép cho Rust trước khi thao tác file
  hookFocusSync();
  runSync(first);
  // Giữ lại promise để openStudioApp() chờ xong rồi mới ẩn cửa sổ (xem lý do ở đó).
  window.__firstData = refreshData(false).then(checkAccount).catch(() => {});
  if (cfg.lastExportDate !== today()) runExports(); // xuất bù khi mở app
  flushQueue(); // đẩy các thay đổi cục bộ còn tồn khi mở app
  checkUpdate();
  runDriveSync(false); // tải ảnh/video hợp đồng lên Drive (nếu đã kết nối)
  setInterval(() => runSync(false), SYNC_EVERY_MS);
  setInterval(flushQueue, 60 * 1000); // thử đồng bộ thay đổi cục bộ mỗi phút
  // Dữ liệu offline làm mới mỗi 5 phút — KHÔNG chờ tới ngày hôm sau như trước.
  setInterval(() => refreshData(false).then(checkAccount), DATA_REFRESH_MS);
  setInterval(() => { if (cfg.lastExportDate !== today()) runExports(); }, 10 * 60 * 1000);
  setInterval(() => runDriveSync(false), DRIVE_FULL_SYNC_MS); // vòng chậm: toàn bộ HĐ đã ký
  setInterval(runDriveWatch, DRIVE_WATCH_MS);                 // vòng nhanh: HĐ đang thực hiện
  setInterval(checkUpdate, 2 * 3600 * 1000); // kiểm tra + tự cập nhật (khi rảnh) mỗi 2 giờ
}

// Nạp cache dữ liệu offline từ đĩa (để xem ngay khi mở app, kể cả chưa có mạng).
async function loadCacheFromDisk() {
  try {
    const t = await invoke("read_text", { path: cachePath() });
    setData(JSON.parse(t));
  } catch { /* chưa có cache */ }
}

// ─── Khởi động ───────────────────────────────────────────────────────────────
(async function init() {
  renderLog();
  if (!cfg.token) { show("setup"); return; }
  if (!cfg.dir) { show("folder"); return; }
  show("main"); refreshStats();
  await loadCacheFromDisk();  // hiển thị dữ liệu offline ngay lập tức
  gotoNav("overview");     // mặc định mở Tổng quan
  bootSync(false);
  openStudioApp();         // dùng desktop như app chính: mở thẳng giao diện studio đầy đủ
})();
