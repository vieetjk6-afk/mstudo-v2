/* MStudo Desktop — engine đồng bộ.
 * - Hợp đồng: tải bù từ mốc lần-đồng-bộ-cuối, lưu theo cấu trúc
 *   {Loại dịch vụ}/Thang N/{Tên hợp đồng}/, mỗi hợp đồng đúng 1 file PDF (qua
 *   Edge headless) + 1 Word; sửa/ký lại → GHI ĐÈ (không tạo nhiều bản).
 * - Excel: xuất mỗi mảng 1 file, hằng ngày + khi mở app; SaoLuu JSON đầy đủ;
 *   tự dọn file cũ hơn 30 ngày (không đụng thư mục hợp đồng).
 * - Ảnh/video: quét thư mục hợp đồng trên máy, tải file mới lên Google Drive.
 *
 * Chỉ giữ những việc webapp KHÔNG làm được (ghi file vào ổ máy, đọc thư mục ảnh
 * trên máy, chạy ngầm). Xem/sửa dữ liệu, lịch, in hợp đồng… đều làm trên webapp.
 */

const invoke = window.__TAURI__.core.invoke;

const APP_VERSION = "1.2.0"; // giữ khớp với src-tauri/tauri.conf.json

// ─── Cấu hình (localStorage) ─────────────────────────────────────────────────
const cfg = JSON.parse(localStorage.getItem("cfg") || "{}");
const saveCfg = () => localStorage.setItem("cfg", JSON.stringify(cfg));
// Khai báo cho Rust các thư mục gốc được phép thao tác (bảo mật: mọi lệnh file
// bị giới hạn trong đây). Gọi lúc khởi động + mỗi khi đổi thư mục.
const syncRoots = () => invoke("set_roots", { paths: [cfg.dir, cfg.mediaDir].filter(Boolean) }).catch(() => {});

// 5 phút (trước 60s): mỗi lần gọi là 1 lượt hàm trên Vercel + 3 truy vấn; khi
// mở/focus cửa sổ vẫn đồng bộ ngay (focusSync) nên người dùng không thấy chậm.
const SYNC_EVERY_MS = 5 * 60 * 1000;     // đồng bộ hợp đồng mỗi 5 phút
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
// Ngày theo giờ Việt Nam (UTC+7) — toISOString() là ngày UTC, nên từ 0h tới 7h
// sáng file xuất lại mang ngày hôm trước.
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

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

// ─── Hộp thoại của app (thay alert/confirm của webview) ──────────────────────
// alert()/confirm() sẵn có luôn kèm dòng "tauri.localhost says" — tên máy chủ
// nội bộ của WebView2. Dòng đó KHÔNG tắt hay đổi được vì hộp thoại là của
// trình duyệt chứ không phải của app; người dùng đọc chỉ thấy khó hiểu, trông
// như trang lạ hiện lên. Nên tự dựng hộp thoại bằng HTML, mang đúng tên và
// giao diện của app.
//
// Khác alert(): hàm này KHÔNG chặn luồng — chỗ nào cần biết người dùng chọn gì
// thì phải `await`.
function dialog(text, { title = "MStudo Desktop", ok = "OK", cancel = "" } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "dmodal-overlay msgbox";
    const box = document.createElement("div");
    box.className = "dmodal";
    const head = document.createElement("div");
    head.className = "dmodal-head";
    const h = document.createElement("div");
    h.className = "dmodal-title";
    h.textContent = title;
    head.appendChild(h);
    const body = document.createElement("div");
    body.className = "dmodal-body msgbox-text";
    // textContent chứ không innerHTML: nội dung hay kèm lỗi từ máy chủ / tên file.
    body.textContent = text;
    const foot = document.createElement("div");
    foot.className = "msgbox-actions";
    const okBtn = document.createElement("button");
    okBtn.className = "btn primary";
    okBtn.textContent = ok;
    let cancelBtn = null;
    if (cancel) {
      cancelBtn = document.createElement("button");
      cancelBtn.className = "btn";
      cancelBtn.textContent = cancel;
      foot.appendChild(cancelBtn);
    }
    foot.appendChild(okBtn);
    box.append(head, body, foot);
    ov.appendChild(box);
    document.body.appendChild(ov);
    const close = (v) => {
      document.removeEventListener("keydown", onKey, true);
      ov.remove();
      resolve(v);
    };
    // Enter = đồng ý, Esc = huỷ — bàn phím vẫn dùng được như hộp thoại thật.
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
      else if (e.key === "Enter") { e.preventDefault(); close(true); }
    };
    document.addEventListener("keydown", onKey, true);
    okBtn.onclick = () => close(true);
    if (cancelBtn) cancelBtn.onclick = () => close(false);
    ov.onclick = (e) => { if (e.target === ov) close(false); };
    okBtn.focus();
  });
}
/** Báo tin cho người dùng (thay alert). */
const say = (text, title) => dialog(text, { title });
/** Hỏi đồng ý (thay confirm) — nhớ `await` để lấy true/false. */
const ask = (text, title) => dialog(text, { title, cancel: "Huỷ" });

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
  // Màn chính có thanh tiêu đề riêng → ẩn thanh brand trên cùng.
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
  show("main"); refreshStats(); renderLog();
  bootSync(true); // lần đầu: tải TOÀN BỘ hợp đồng đã ký + xuất đủ bộ Excel
};

// ─── Mở mstudo (webapp) trên trình duyệt mặc định ────────────────────────────
// App desktop không còn nhúng giao diện studio: mọi thao tác quản lý làm trên
// webapp. App chỉ giữ những việc trình duyệt KHÔNG làm được (ghi file vào máy,
// quét thư mục ảnh trên máy để tải lên Drive, chạy ngầm dưới khay).
function openWebApp() {
  if (!cfg.server) return;
  invoke("open_url", { url: cfg.server + "/dashboard/studio" }).catch(() => {});
}
window.openWebApp = openWebApp; // để menu khay (Rust) gọi được
$("btnOpenWeb").onclick = openWebApp;
// Kiểm tra cập nhật thủ công (phòng khi app chưa tự báo).
$("btnCheckUpdate").onclick = () => checkUpdate(true);
$("appVer").textContent = "Phiên bản " + APP_VERSION;

// ─── Màn 3: hành động ────────────────────────────────────────────────────────
// "Đồng bộ ngay" (nút + menu khay): hợp đồng mới về máy rồi quét ảnh/video lên Drive.
function syncAllNow() {
  runSync(true);
  runDriveSync(true);
}
window.syncAllNow = syncAllNow;
$("btnSyncNow").onclick = syncAllNow;
$("btnExportNow").onclick = () => runExports(true);
$("btnDriveSync").onclick = () => runDriveSync(true);
$("btnPickMediaDir").onclick = async () => {
  const p = await invoke("pick_folder");
  if (!p) return;
  cfg.mediaDir = p; saveCfg(); syncRoots(); refreshStats();
  log("Đã chọn thư mục gốc ảnh/video: " + p);
  runDriveSync(true);
};
$("btnOpenFolder").onclick = () => invoke("open_folder", { path: cfg.dir }).catch(() => {});
$("btnChangeFolder").onclick = async () => {
  const p = await invoke("pick_folder");
  if (!p || p === cfg.dir) return;
  const move = await dialog("Di chuyển toàn bộ dữ liệu đã lưu sang thư mục mới?", { title: "Đổi thư mục lưu", ok: "Di chuyển", cancel: "Giữ nguyên chỗ cũ" });
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
$("btnDisconnect").onclick = async () => {
  if (!(await ask("Ngắt kết nối thiết bị này? Dữ liệu đã lưu trên máy vẫn giữ nguyên.", "Ngắt kết nối thiết bị"))) return;
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
    if (r.contracts.length) runDriveSync(false, true);
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
//  - Vòng CHẬM (2 phút): quét thư mục trên máy của toàn bộ hợp đồng đã ký — bắt
//    file bỏ vào muộn. Danh sách hợp đồng (?drive=1) cache 10 phút (có hợp đồng
//    mới ký thì runSync gọi lại với fresh=true để lấy ngay).
//  - Vòng NHANH (10s): CHỈ quét hợp đồng đang thực hiện / hậu kỳ — thợ đang đổ
//    ảnh vào máy là tải lên gần như tức thì. Danh sách lọc NGAY TRÊN MÁY từ danh
//    sách ?drive=1 đã cache, không gọi server riêng.
//  - Hợp đồng ĐÃ HOÀN THÀNH hơn 30 ngày: vòng tự động bỏ qua (bấm "Đồng bộ Drive
//    ngay" vẫn quét hết) — không quét đĩa hàng trăm hợp đồng cũ mỗi 2 phút.
//  - Cây thư mục Drive (plan) cache theo id + updated_at của hợp đồng, lưu cả vào
//    localStorage, hạn 30 ngày → chỉ gọi /drive/prepare khi hợp đồng thực sự đổi.
const DRIVE_FULL_SYNC_MS = 2 * 60 * 1000;   // quét (trên máy) toàn bộ hợp đồng đã ký
const DRIVE_LIST_TTL_MS = 10 * 60 * 1000;   // cache danh sách hợp đồng ?drive=1
const DRIVE_WATCH_MS = 10 * 1000;           // theo dõi nhanh hợp đồng đang thực hiện
const PLAN_TTL_MS = 30 * 24 * 3600 * 1000;  // cache cây thư mục Drive mỗi hợp đồng (đổi thì updated_at đổi)
const OLD_DONE_MS = 30 * 24 * 3600 * 1000;  // HĐ hoàn thành lâu hơn → vòng tự động bỏ qua
const SETTLE_MS = 60 * 1000;                // file sửa gần hơn → có thể đang chép dở, chờ vòng sau
const THUMB_MAX_BYTES = 16 * 1024 * 1024;   // ảnh lớn hơn → không tạo xem trước
// Số file tải SONG SONG cùng lúc (như app Google Drive) — chồng độ trễ mạng,
// một video lớn không còn chặn các ảnh phía sau. Mặc định 10; chỉnh qua
// cfg.driveConcurrency (2–16). Ảnh nhỏ dùng multipart 1-request ở Rust nên
// 10 luồng chạy rất nhanh mà vẫn nhẹ RAM.
const DRIVE_CONCURRENCY_DEFAULT = 10;
const DRIVE_UPLOAD_RETRIES = 2;             // thử lại file lỗi (tạm mạng) trước khi bỏ qua
let driveTok = { v: null, exp: 0 };
let driveWarned = false;
// contractId → { tree, folderId, folderName, pathSegments, updatedAt, at } — nạp
// lại từ localStorage để mở app lại không phải gọi prepare cho từng hợp đồng.
const planCache = new Map((() => { try { return Object.entries(JSON.parse(localStorage.getItem("planCache") || "{}")); } catch { return []; } })());
const savePlanCache = () => {
  try {
    const now = Date.now();
    const obj = {};
    for (const [k, v] of planCache) if (now - v.at < PLAN_TTL_MS) obj[k] = v;
    localStorage.setItem("planCache", JSON.stringify(obj));
  } catch { /* localStorage đầy → chỉ cache trong bộ nhớ */ }
};
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
// Lấy cây thư mục hợp đồng — cache theo updated_at: hợp đồng không đổi thì dùng
// lại plan cũ (tối đa 6 giờ), đổi (đổi tên/ngày/loại dịch vụ…) thì gọi lại server.
// force=true (bấm tay) → luôn hỏi lại server.
async function getPlan(id, updatedAt, force = false) {
  const c = planCache.get(id);
  if (!force && c && Date.now() - c.at < PLAN_TTL_MS && (!updatedAt || c.updatedAt === updatedAt)) return c;
  const plan = await prepareContract(id, false);
  if (plan.skip) return { skip: plan.skip };
  // pathSegments = [Gốc, Loại dịch vụ, Thang N, Tên hợp đồng]; bản server cũ chỉ
  // có folderName (+ rootFolderName) → dựng tạm để vẫn chạy.
  const segments = Array.isArray(plan.pathSegments) && plan.pathSegments.length
    ? plan.pathSegments
    : [plan.rootFolderName, plan.folderName].filter(Boolean);
  const entry = { tree: plan.tree, folderId: plan.folderId, folderName: plan.folderName, pathSegments: segments, updatedAt: updatedAt || null, at: Date.now() };
  planCache.set(id, entry);
  savePlanCache();
  return entry;
}

// Quét 1 hợp đồng: trả DANH SÁCH file cần tải (chưa tải) + tham chiếu manifest,
// để lõi đồng bộ gom tổng số ảnh/tổng dung lượng trước khi tải (tính % + ETA).
async function scanContract(c, manual = false) {
  const plan = await getPlan(c.id, c.updated_at, manual);
  if (plan.skip) throw new Error(plan.skip);
  // Cây thư mục local = mediaDir + [Loại dịch vụ, Thang N, Tên hợp đồng] — y hệt
  // cấu trúc trên Drive (không kèm thư mục gốc; mediaDir chính là gốc trên máy).
  const base = join(cfg.mediaDir, ...(plan.pathSegments && plan.pathSegments.length ? plan.pathSegments : [plan.folderName]));
  const manPath = join(base, "mstudo-drive.json");
  let man = { folderId: plan.folderId, uploaded: {} };
  let hadMan = false;
  try { man = JSON.parse(await invoke("read_text", { path: manPath })); hadMan = true; } catch { /* chưa có */ }
  man.uploaded = man.uploaded || {};
  // Tạo thư mục hợp đồng + MỌI nút con (kể cả loại trừ — để studio bỏ ảnh/raw vào).
  // Chỉ khi cần: lần đầu (chưa có manifest), khi cây thư mục đổi (hợp đồng sửa),
  // hoặc bấm tay — không gọi create_dir cho từng nút của mọi hợp đồng mỗi 2 phút.
  // KHÔNG nuốt lỗi tạo thư mục → nếu ổ đĩa/quyền có vấn đề, ghi rõ ra log.
  if (!hadMan || manual || man.treeAt !== (c.updated_at || null)) {
    let dirErr = null;
    try { await invoke("create_dir", { path: base }); } catch (e) { dirErr = e; }
    for (const node of plan.tree) {
      try { await invoke("create_dir", { path: join(base, node.path.replace(/\//g, "\\")) }); }
      catch (e) { dirErr = e; }
    }
    if (dirErr) log(`Lỗi tạo thư mục HĐ ${c.code || c.id} tại ${base}: ${dirErr.message || dirErr}`, "err");
    else {
      if (manual) log(`HĐ ${c.code || c.id}: đã tạo ${plan.tree.length} thư mục con tại ${base}`);
      man.treeAt = c.updated_at || null;
      await invoke("write_file_b64", { path: manPath, contentsB64: textToB64(JSON.stringify(man, null, 2)) }).catch(() => {});
    }
  }
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
      // Vừa ghi xong (< 1 phút): có thể đang chép dở từ thẻ nhớ — tải lúc này là
      // lên Drive một file cụt, rồi vòng sau lại tải thêm bản đủ thành file trùng.
      if (Date.now() - e.mtime_ms < SETTLE_MS) continue;
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
    busyOn("drive"); // gia hạn cờ: đợt tải dài hơn BUSY_TTL_MS không bị vòng khác chen vào
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
        busyOn("drive");
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
// fresh=true: bỏ qua cache danh sách (vừa có hợp đồng mới ký/sửa).
let _driveList = { at: 0, list: [] };
async function runDriveSync(manual = false, fresh = false) {
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
    if (manual || fresh || Date.now() - _driveList.at >= DRIVE_LIST_TTL_MS) {
      const list = await apiJson("/api/desktop/contracts?drive=1");
      _driveList = { at: Date.now(), list: list.contracts || [] };
    }
    // Vòng tự động bỏ qua hợp đồng đã hoàn thành lâu (bấm tay thì quét hết).
    const cutoff = Date.now() - OLD_DONE_MS;
    const list = manual ? _driveList.list
      : _driveList.list.filter((c) => c.status !== "completed" || Date.parse(c.updated_at) > cutoff);
    const uploaded = await driveSyncRun(list, manual);
    cfg.lastDriveSync = new Date().toISOString(); saveCfg();
    if (manual) log(uploaded ? `Đã tải ${uploaded} file lên Drive.` : "Không có file mới để tải lên Drive.");
    refreshStats();
  } catch (e) {
    if (manual) log("Không đồng bộ được Drive: " + (e.message || e), "err");
  } finally {
    busyOff("drive");
  }
}

// Vòng NHANH (10s): CHỈ hợp đồng đang thực hiện / hậu kỳ → tải ảnh mới gần như
// tức thì. Lọc từ danh sách ?drive=1 đã cache — không gọi server mỗi vòng.
const ACTIVE = new Set(["in_progress", "post_production"]);
async function runDriveWatch() {
  if (busy("drive") || !cfg.token || !cfg.mediaDir) return;
  const list = _driveList.list.filter((c) => ACTIVE.has(c.status));
  if (!list.length) return;                 // không có hợp đồng đang làm → khỏi quét
  busyOn("drive");                          // giữ cờ TRƯỚC mọi await — không để vòng khác chen vào
  try {
    let token;
    try { token = await getDriveToken(); } catch { token = null; }
    if (!token) return;                     // chưa nối Drive → im lặng (vòng chậm đã cảnh báo)
    const uploaded = await driveSyncRun(list, false);
    if (uploaded) {
      cfg.lastDriveSync = new Date().toISOString(); saveCfg(); refreshStats();
      log(`Tự tải ${uploaded} ảnh mới (hợp đồng đang thực hiện) lên Drive.`);
    }
  } catch { /* thử lại vòng sau */ } finally {
    busyOff("drive");
  }
}

// Tài khoản máy này đang gắn — hiện ở thanh trạng thái để biết ngay nếu gắn nhầm
// studio khác.
async function checkAccount() {
  try {
    const w = await apiJson("/api/desktop/whoami");
    cfg.acct = w.account?.name || w.account?.email || "";
    saveCfg();
    $("stAccount").textContent = cfg.acct || "—";
    return w;
  } catch { return null; }
}

// ─── Xuất Excel ──────────────────────────────────────────────────────────────
async function runExports(manual = false) {
  if (busy("export") || !cfg.token || !cfg.dir) return;
  busyOn("export");
  try {
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

// ─── Tự cập nhật: phát hiện bản mới trên GitHub Releases (nhãn desktop-dev) ──
// So SỐ PHIÊN BẢN trong tên file cài (vd MStudo Desktop_0.2.1_x64-setup.exe) với
// APP_VERSION đang chạy; khác nhau → có bản mới. (Cách này không bị "kẹt" như so
// mốc thời gian: cài lỗi vẫn còn phát hiện, cài xong app mới có version khớp nên
// không lặp.)
const RELEASE_TAG = "desktop-dev";
// Repo chứa bản cài. PHẢI là repo CÔNG KHAI: app hỏi GitHub API không kèm đăng
// nhập, nên release của repo riêng tư (kể cả repo mã nguồn) với nó là 404 —
// build bao nhiêu bản mới thì app vẫn báo "đang dùng bản mới nhất". Repo này
// chỉ chứa file cài, không chứa mã nguồn. Đổi thì đổi cả ba chỗ (xem
// desktop/README.md, mục "Kênh cập nhật"); npm run test:desktop-update giữ khớp.
const RELEASE_REPO = "vieetjk6-afk/mstudo-desktop";
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
    if (r.status !== 200) { if (manual) say("Không kiểm tra được (máy chủ trả lỗi HTTP " + r.status + "). Thử lại sau.", "Cập nhật"); return; }
    const rel = JSON.parse(b64ToText(r.body_b64));
    // Bản phát hành desktop-dev có thể còn nhiều file cài cũ → CHỌN file có SỐ
    // PHIÊN BẢN CAO NHẤT (không lấy đại file đầu tiên, tránh "kẹt"/hạ cấp).
    const setups = (rel.assets || []).filter((a) => /-setup\.exe$/i.test(a.name));
    if (!setups.length) { if (manual) say("Chưa tìm thấy file cài trong bản phát hành.", "Cập nhật"); return; }
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
      say("Bạn đang dùng bản mới nhất (" + APP_VERSION + ").", "Cập nhật");
    }
  } catch (e) { if (manual) say("Không kiểm tra được cập nhật: " + (e.message || e), "Cập nhật"); }
}
// App có đang bận không (chặn tự cập nhật giữa chừng để không hỏng việc đang chạy).
function appBusy() {
  return busy("sync") || busy("export") || busy("drive");
}
async function runSelfUpdate(auto = false) {
  if (!_updateUrl) return;
  if (!auto && !(await ask("Tải và cài bản cập nhật mới? Ứng dụng sẽ đóng lại để cài đặt, rồi mở lại.", "Cập nhật"))) return;
  $("btnUpdate").textContent = "Đang tải…"; $("btnUpdate").disabled = true;
  try {
    await invoke("download_and_run", { url: _updateUrl }); // tải xong app tự thoát để cài
  } catch (e) {
    $("btnUpdate").disabled = false; $("btnUpdate").textContent = "Cập nhật ngay";
    const msg = "Không tự cài được: " + (e.message || e);
    if (auto) { log(msg, "err"); return; }
    // Dự phòng: mở trang phát hành để tải & cài tay (VD SmartScreen chặn chạy ngầm).
    if (await ask(msg + "\n\nMở trang tải bản cài để cài thủ công?", "Cập nhật")) {
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
  checkAccount();
  if (cfg.lastExportDate !== today()) runExports(); // xuất bù khi mở app
  checkUpdate();
  runDriveSync(false); // tải ảnh/video hợp đồng lên Drive (nếu đã kết nối)
  setInterval(() => runSync(false), SYNC_EVERY_MS);
  setInterval(() => { if (cfg.lastExportDate !== today()) runExports(); }, 10 * 60 * 1000);
  setInterval(() => runDriveSync(false), DRIVE_FULL_SYNC_MS); // vòng chậm: toàn bộ HĐ đã ký
  setInterval(runDriveWatch, DRIVE_WATCH_MS);                 // vòng nhanh: HĐ đang thực hiện
  setInterval(checkUpdate, 2 * 3600 * 1000); // kiểm tra + tự cập nhật (khi rảnh) mỗi 2 giờ
}

// ─── Dọn hàng đợi sửa offline của bản cũ (≤ 1.1.3) ───────────────────────────
// Bản cũ có màn xem/sửa dữ liệu offline, thay đổi xếp hàng trong localStorage
// rồi đẩy lên /api/desktop/mutate. Màn đó đã bỏ (sửa trên webapp), nhưng máy vừa
// cập nhật có thể còn vài thay đổi chưa kịp gửi — đẩy nốt một lần cho khỏi mất.
async function flushLegacyQueue() {
  let q;
  try { q = JSON.parse(localStorage.getItem("mstudo_pending") || "[]"); } catch { q = []; }
  if (!q.length || !cfg.server || !cfg.token) return;
  while (q.length) {
    try {
      const r = await invoke("http_post", { url: cfg.server + "/api/desktop/mutate", token: cfg.token, bodyJson: JSON.stringify(q[0]) });
      // Lỗi máy chủ: thử lại ở lần mở app sau, nhưng tối đa 3 lần — một thay đổi
      // đã ghi được ở lần trước (máy chủ trả 500 vì trùng khoá) sẽ lỗi mãi và chặn
      // cả hàng đợi.
      if (r.status >= 500 && (q[0]._tries = (q[0]._tries || 0) + 1) < 3) {
        localStorage.setItem("mstudo_pending", JSON.stringify(q));
        break;
      }
      if (r.status >= 400) log(`Bỏ 1 thay đổi offline cũ (${q[0].table}): HTTP ${r.status}`, "warn");
      q.shift();
    } catch { break; } // mất mạng → lần mở app sau thử lại
    localStorage.setItem("mstudo_pending", JSON.stringify(q));
  }
  if (!q.length) localStorage.removeItem("mstudo_pending");
}

// ─── Khởi động ───────────────────────────────────────────────────────────────
(async function init() {
  renderLog();
  if (!cfg.token) { show("setup"); return; }
  if (!cfg.dir) { show("folder"); return; }
  show("main"); refreshStats();
  bootSync(false);
  flushLegacyQueue();
})();
