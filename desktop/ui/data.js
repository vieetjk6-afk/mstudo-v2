/* MStudo Desktop — trình duyệt dữ liệu OFFLINE.
 * Đọc bản cache (backup JSON tải từ server) và hiển thị/tìm kiếm hoàn toàn cục
 * bộ — không gọi server mỗi thao tác nên mượt hơn web app. Tạo/sửa vẫn mở app
 * online (nút "Mở ứng dụng quản lý"). setData() được app.js gọi sau mỗi lần sync.
 */

let DB = { tables: {} };
let dataTab = "overview";
let dataQuery = "";
// Máy chủ đang thấy gì (GET /api/desktop/whoami) — để đối chiếu ngay trên màn
// Tổng quan. app.js gọi setServerInfo() sau mỗi lần tải dữ liệu.
let SRV = null;
function setServerInfo(info) {
  SRV = info;
  if (typeof renderData === "function") renderData();
}
window.setServerInfo = setServerInfo;

// app.js gọi khi có dữ liệu mới (từ cache đĩa lúc mở, hoặc sau mỗi lần đồng bộ).
function setData(backup) {
  DB = backup && backup.tables ? backup : { tables: {} };
  if (typeof renderData === "function") renderData();
}
const T = (name) => (DB.tables && DB.tables[name]) || [];

// ─── Định dạng ───────────────────────────────────────────────────────────────
const vnd = (n) => (Number(n) || 0).toLocaleString("vi-VN") + " đ";
const D = (s) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const digits = (s) => String(s ?? "").replace(/\D/g, "");
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const monthKey = (s) => (s ? String(s).slice(0, 7) : "");
// Hôm nay theo giờ Việt Nam (UTC+7) — khớp todayVN() bên web. Dùng thẳng
// toISOString() là giờ UTC, buổi tối sẽ lệch một ngày so với web.
const todayVN = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const thisMonth = () => todayVN().slice(0, 7);

const CONTRACT_STATUS = { draft: "Nháp", sent: "Đã gửi", approved: "Đã duyệt", in_progress: "Đang thực hiện", completed: "Hoàn thành", cancelled: "Đã hủy" };
const QUOTE_STATUS = { draft: "Nháp", sent: "Đã gửi", viewed: "Đã xem", adjust_requested: "Xin chỉnh", accepted: "Đã chốt", converted: "Đã chuyển HĐ", expired: "Hết hạn", cancelled: "Đã hủy" };
const BOOKING_STATUS = { new: "Mới", handled: "Đã xử lý", archived: "Lưu trữ" };
const SHOOT_TYPE = { photo: "Chụp ảnh", video: "Quay phim", both: "Chụp & quay", psc: "Phóng sự cưới", makeup: "Trang điểm", rental: "Thuê đồ", prewedding: "Pre-wedding", wedding: "Ngày cưới", other: "Khác" };

// <option> trạng thái, đánh dấu mục đang chọn.
function statusOptions(map, cur) {
  return Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? " selected" : ""}>${v}</option>`).join("");
}

// ─── Tổng hợp ────────────────────────────────────────────────────────────────
function contractTotal(id) {
  return T("contract_items").filter((i) => i.contract_id === id).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
}
function contractPaid(id) {
  return T("contract_payments").filter((p) => p.contract_id === id).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

const DATA_TABS = [
  ["overview", "Tổng quan"], ["contracts", "Hợp đồng"], ["clients", "Khách hàng"],
  ["quotes", "Báo giá"], ["expenses", "Thu chi"], ["payroll", "Lương"], ["calendar", "Lịch"],
];

// Điều hướng do menu trái (app.js) gọi.
function gotoTab(tab) { dataTab = tab; dataQuery = ""; renderData(); }

function renderData() {
  const host = document.getElementById("dataView");
  if (!host) return;
  const needSearch = dataTab !== "overview";
  host.innerHTML =
    (needSearch ? `<input id="dataSearch" class="dsearch" placeholder="Tìm kiếm…" value="${esc(dataQuery)}" />` : "") +
    `<div id="dataBody">${renderTab()}</div>`;
  const s = document.getElementById("dataSearch");
  if (s) s.oninput = () => { dataQuery = s.value; document.getElementById("dataBody").innerHTML = renderTab(); bindRowClicks(); };
  bindRowClicks();
}

function bindRowClicks() {
  const body = document.getElementById("dataBody");
  if (!body) return;
  body.querySelectorAll("[data-contract]").forEach((r) => r.onclick = () => openContract(r.dataset.contract));
  body.querySelectorAll("[data-open-contract]").forEach((r) => r.onclick = () => openContract(r.dataset.openContract));
  body.querySelectorAll("[data-expense]").forEach((r) => r.onclick = () => openExpense(r.dataset.expense));
  body.querySelectorAll("[data-crew]").forEach((r) => r.onclick = () => openCrew(r.dataset.crew));
  body.querySelectorAll("[data-event]").forEach((r) => r.onclick = (e) => { e.stopPropagation(); openEvent(r.dataset.event); });
  // Đổi trạng thái hợp đồng / đặt lịch ngay tại chỗ (cục bộ + đồng bộ ngầm).
  body.querySelectorAll("[data-status-contract]").forEach((sel) => {
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = () => window.localMutate("studio_contracts", "update", { id: sel.dataset.statusContract, status: sel.value });
  });
  body.querySelectorAll("[data-status-booking]").forEach((sel) => {
    sel.onclick = (e) => e.stopPropagation();
    sel.onchange = () => window.localMutate("studio_bookings", "update", { id: sel.dataset.statusBooking, status: sel.value });
  });
  const add = document.getElementById("addExpense");
  if (add) add.onclick = () => openExpense();
  const addEv = document.getElementById("addEvent");
  if (addEv) addEv.onclick = () => openEvent();
  const addCt = document.getElementById("addContract");
  if (addCt) addCt.onclick = () => openContractEdit();
  body.querySelectorAll("[data-client]").forEach((r) => r.onclick = () => { const [n, p] = r.dataset.client.split("|"); openClient(n, p); });
  const addCl = document.getElementById("addClient");
  if (addCl) addCl.onclick = () => openContractEdit();
  // Báo giá
  body.querySelectorAll("[data-quote]").forEach((r) => r.onclick = () => openQuoteEdit(r.dataset.quote));
  const addQ = document.getElementById("addQuote"); if (addQ) addQ.onclick = () => openQuoteEdit();
  // Bảng giá / Thiết bị / Dịch vụ
  body.querySelectorAll("[data-price]").forEach((r) => r.onclick = () => openPrice(r.dataset.price));
  const addP = document.getElementById("addPrice"); if (addP) addP.onclick = () => openPrice();
  body.querySelectorAll("[data-equip]").forEach((r) => r.onclick = () => openEquip(r.dataset.equip));
  const addE = document.getElementById("addEquip"); if (addE) addE.onclick = () => openEquip();
  body.querySelectorAll("[data-service]").forEach((r) => r.onclick = () => openService(r.dataset.service));
  const addS = document.getElementById("addService"); if (addS) addS.onclick = () => openService();
  // Lịch tháng: chuyển tháng
  const prev = document.getElementById("calPrev"), next = document.getElementById("calNext");
  if (prev) prev.onclick = () => { _calMonth = shiftMonth(_calMonth || thisMonth(), -1); renderData(); };
  if (next) next.onclick = () => { _calMonth = shiftMonth(_calMonth || thisMonth(), 1); renderData(); };
  const tod = document.getElementById("calToday"); if (tod) tod.onclick = () => { _calMonth = null; renderData(); };
}
function shiftMonth(ym, delta) {
  let [y, m] = ym.split("-").map(Number);
  m += delta; if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function match(row, fields) {
  if (!dataQuery.trim()) return true;
  const q = norm(dataQuery);
  return fields.some((f) => norm(f).includes(q) || digits(f).includes(digits(dataQuery)));
}

function empty(msg) { return `<div class="dempty">${msg}</div>`; }

function renderTab() {
  if (!DB.tables || !Object.keys(DB.tables).length) return empty("Chưa có dữ liệu offline. Bấm “↻ Tải dữ liệu mới” ở góc trên để tải về máy.");
  switch (dataTab) {
    case "overview": return renderOverview();
    case "contracts": return renderContracts();
    case "clients": return renderClients();
    case "quotes": return renderQuotes();
    case "expenses": return renderExpenses();
    case "payroll": return renderPayroll();
    case "calendar": return renderCalendar();
    case "pricelist": return renderPricelist();
    case "equipment": return renderEquipment();
    case "services": return renderServices();
    default: return "";
  }
}

function stat(label, value, sub) {
  return `<div class="dstat"><div class="dstat-l">${label}</div><div class="dstat-v">${value}</div>${sub ? `<div class="dstat-s">${sub}</div>` : ""}</div>`;
}

/**
 * Tổng quan — CÙNG MỘT CÔNG THỨC với trang Tổng quan trên web
 * (src/app/dashboard/studio/page.tsx).
 *
 * Trước đây màn này tự nghĩ ra bộ chỉ số riêng ("Doanh thu tổng HĐ", "Lãi tháng
 * này", "Lương chưa trả" — web không có thẻ nào như vậy) và tính theo cách khác:
 * gộp cả hợp đồng đã huỷ, lấy ngày theo giờ UTC thay vì giờ VN, bù trừ công nợ
 * giữa các hợp đồng. Kết quả là hai bên không bao giờ khớp, kể cả khi dữ liệu đã
 * đồng bộ đúng. Sửa số liệu lệch phải bắt đầu từ chỗ này chứ không phải ở đồng bộ.
 *
 * Mọi thay đổi ở đây phải soi lại page.tsx để hai bên không lệch nhau lần nữa.
 */
function renderOverview() {
  // Web lọc `.neq("status","cancelled")` NGAY Ở TRUY VẤN, nên mọi con số dưới
  // đây đều không tính hợp đồng đã huỷ.
  const list = T("studio_contracts").filter((c) => c.status !== "cancelled");
  const liveIds = new Set(list.map((c) => c.id));
  const today0 = todayVN();
  const monthStart = today0.slice(0, 7) + "-01";

  // "Doanh thu tháng này" = tiền ĐÃ THU trong tháng (contract_payments.paid_at),
  // không phải tổng giá trị hợp đồng. Web dùng `gte monthStart` (không chặn trên)
  // nên khoản trả trước ngày tương lai cũng được tính — giữ y hệt.
  const revenueMonth = T("contract_payments")
    .filter((p) => (p.paid_at || "") >= monthStart)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const active = list.filter((c) => c.status !== "completed").length;
  const upcomingShoots = list
    .filter((c) => c.event_date && c.event_date >= today0 && ["approved", "in_progress", "completed"].includes(c.status))
    .slice(0, 6);
  const selectingAlbums = T("albums").filter((a) => a.phase === "selection" && a.status === "published" && !a.is_gallery).length;
  // Web đếm từ `list` (đã bỏ hợp đồng huỷ) — bám theo để không đếm dư.
  const openRequests = T("contract_edit_requests").filter((r) => r.status === "open" && liveIds.has(r.contract_id)).length;

  const totalValue = list.reduce((s, c) => s + contractTotal(c.id), 0);
  const avgValue = list.length ? Math.round(totalValue / list.length) : 0;
  // Công nợ: kẹp ở 0 THEO TỪNG hợp đồng — hợp đồng trả dư không bù cho hợp đồng
  // khác (web làm vậy; gộp tổng rồi mới kẹp sẽ ra số nhỏ hơn).
  const totalDue = list
    .map((c) => contractTotal(c.id) - contractPaid(c.id))
    .filter((d) => d > 0)
    .reduce((s, d) => s + d, 0);

  const bookings = T("studio_bookings");
  const newBookings = bookings.filter((b) => b.status === "new");
  const closeRate = bookings.length ? Math.min(100, Math.round((list.length / bookings.length) * 100)) : null;

  const uniqueClients = new Set(
    list.map((c) => digits(c.client_phone) || String(c.client_name || "").trim().toLowerCase()).filter(Boolean),
  ).size;

  const recent = list.slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 6);

  const statsHtml = `<div class="dstats">
    ${stat("Doanh thu tháng này", vnd(revenueMonth), "đã thu trong tháng")}
    ${stat("Hợp đồng đang hoạt động", String(active), `${list.length} tổng hợp đồng`)}
    ${stat("Album đang được khách chọn", String(selectingAlbums), "")}
    ${stat("Lịch sắp tới", String(upcomingShoots.length), `${uniqueClients} khách hàng`)}
    ${stat("Yêu cầu sửa đang chờ", String(openRequests), "")}
    ${stat("Giá trị HĐ trung bình", vnd(avgValue), "")}
    ${stat("Công nợ cần thu", vnd(totalDue), "")}
    ${closeRate != null ? stat("Tỉ lệ chốt (HĐ/đặt lịch)", `${closeRate}%`, "") : stat("Đặt lịch mới", String(newBookings.length), "")}
  </div>`;

  // Danh sách "Lịch sắp tới" gộp thêm ghi chú lịch — web không có bảng này nhưng
  // đây là danh sách, không phải con số đối chiếu.
  const upEvents = T("studio_events").filter((e) => (e.event_date || "") >= today0)
    .map((e) => ({ d: e.event_date, title: e.title, who: e.event_time || "", id: null }));
  const upcoming = [
    ...upcomingShoots.map((c) => ({ d: c.event_date, title: c.title, who: c.client_name, id: c.id })),
    ...upEvents,
  ].sort((a, b) => String(a.d).localeCompare(String(b.d))).slice(0, 6);

  const upcomingHtml = `<div class="osec"><div class="osec-h">Lịch sắp tới</div>${
    upcoming.length ? `<table class="dtable"><tbody>${upcoming.map((u) => `<tr${u.id ? ` data-open-contract="${u.id}" class="clickable"` : ""}><td style="width:110px">${D(u.d)}</td><td>${esc(u.title || "")}</td><td class="r" style="color:var(--muted)">${esc(u.who || "")}</td></tr>`).join("")}</tbody></table>`
      : `<div class="dempty">Không có lịch sắp tới.</div>`}</div>`;

  const recentHtml = `<div class="osec"><div class="osec-h">Hợp đồng gần đây</div>${
    recent.length ? `<table class="dtable"><tbody>${recent.map((c) => `<tr data-open-contract="${c.id}" class="clickable"><td>${esc(c.code || "")}</td><td>${esc(c.title || "")}</td><td class="r">${vnd(contractTotal(c.id))}</td></tr>`).join("")}</tbody></table>`
      : `<div class="dempty">Chưa có hợp đồng.</div>`}</div>`;

  const bookingsHtml = newBookings.length ? `<div class="osec"><div class="osec-h">Đặt lịch mới cần xử lý</div><table class="dtable"><tbody>${
    newBookings.slice(0, 6).map((b) => `<tr><td style="width:110px">${D(b.preferred_date)}</td><td>${esc(b.name || "")} · ${esc(b.service || "")}</td><td class="r" style="color:var(--muted)">${esc(b.phone || "")}</td></tr>`).join("")}</tbody></table></div>` : "";

  return serverDiffBanner() + statsHtml +
    `<div class="ogrid">${upcomingHtml}${recentHtml}</div>${bookingsHtml}` +
    cacheProvenance();
}

/**
 * Xuất xứ của bản dữ liệu đang hiển thị: máy chủ tạo lúc nào, cho TÀI KHOẢN NÀO,
 * và lần tải gần nhất có hỏng không.
 *
 * Bản backup mang sẵn `owner_id` + `exported_at`, nên chính tệp cache trả lời
 * được câu "số này của ai, cũ tới mức nào" — không cần đoán. Lỗi tải cũng đưa
 * lên đây: nằm trong nhật ký ở tab khác thì không ai thấy, và một bản cache cũ
 * đứng im trông y hệt một bản cache đúng.
 */
function cacheProvenance() {
  const err = window.cacheError ? window.cacheError() : null;
  const parts = [
    `Dữ liệu cập nhật lần cuối: ${window.cacheStamp ? window.cacheStamp() : "—"}`,
    DB.exported_at ? `bản xuất từ máy chủ lúc ${D(DB.exported_at)} ${String(DB.exported_at).slice(11, 16)}` : null,
    DB.owner_id ? `tài khoản trong bản dữ liệu: <code>${esc(String(DB.owner_id).slice(0, 8))}…</code>` : null,
  ].filter(Boolean);
  return `<p class="dnote">${parts.join(" · ")}. Tất cả tính từ dữ liệu đã lưu trên máy.</p>` +
    (err
      ? `<p class="dnote" style="color:#b4341f"><b>Lần tải dữ liệu gần nhất THẤT BẠI</b> (${esc(err.atText)}): ${esc(err.msg)}.
         Các con số ở trên là bản cũ còn lưu trên máy.</p>`
      : "");
}

/**
 * Cảnh báo khi dữ liệu trên máy KHÁC dữ liệu máy chủ, kèm luôn tài khoản đang gắn.
 *
 * Đặt ngay trên màn Tổng quan chứ không giấu trong tab Sao lưu: đây chính là chỗ
 * người dùng nhìn thấy số sai, nên câu trả lời phải ở cùng chỗ. Số máy chủ đếm
 * TOÀN BỘ hợp đồng (kể cả đã huỷ) nên so với T("studio_contracts") chưa lọc.
 */
function serverDiffBanner() {
  if (!SRV || !SRV.counts) return "";
  const local = T("studio_contracts").length;
  const server = SRV.counts.contracts;
  if (local === server) return "";
  const acct = esc(SRV.account?.name || SRV.account?.email || "(không rõ)");
  return `<div class="dwarn">
    <b>Dữ liệu trên máy không khớp máy chủ:</b> máy này có ${local} hợp đồng, máy chủ có ${server}.
    <br>Máy đang đồng bộ với tài khoản: <b>${acct}</b> · <code>${esc(String(SRV.ownerId || "").slice(0, 8))}…</code>
    <br>Nếu tên tài khoản này KHÔNG phải studio bạn đang mở trên web ⇒ máy đăng ký nhầm tài khoản: vào mstudo (web) ›
    Cài đặt › Thiết bị, thu hồi máy cũ rồi đăng ký lại bằng mã mới.
    Nếu đúng tài khoản mà số vẫn lệch ⇒ bấm <b>↻ Tải dữ liệu mới</b>; còn lệch nữa thì báo lại kèm hai con số này.
  </div>`;
}

function renderContracts() {
  const rows = T("studio_contracts")
    .filter((c) => match(c, [c.code, c.client_name, c.client_phone, c.title]))
    .sort((a, b) => String(b.event_date || b.created_at || "").localeCompare(String(a.event_date || a.created_at || "")));
  const bar = `<div class="dbar"><button class="btn small primary" id="addContract">＋ Hợp đồng mới</button><span class="dcap" style="margin:0">${rows.length} hợp đồng</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có hợp đồng khớp." : "Chưa có hợp đồng. Bấm ＋ để tạo.");
  const cards = rows.map((c) => {
    const tot = contractTotal(c.id), paid = contractPaid(c.id);
    return `<div class="ccard">
      <div class="ccard-main" data-contract="${c.id}">
        ${c.code ? `<div class="ccard-code">${esc(c.code)}</div>` : ""}
        <div class="ccard-title">${esc(c.title || "Hợp đồng")}</div>
        <div class="ccard-sub">${esc(c.client_name || "Chưa có khách")}${c.shoot_type ? " · " + (SHOOT_TYPE[c.shoot_type] || "") : ""}${c.event_date ? " · " + D(c.event_date) : ""}</div>
      </div>
      <div class="ccard-right">
        <div class="ccard-amt">${vnd(tot)}</div>
        <div class="ccard-paid">Đã thu ${vnd(paid)} · Còn ${vnd(Math.max(0, tot - paid))}</div>
        <select class="dsel" data-status-contract="${c.id}">${statusOptions(CONTRACT_STATUS, c.status)}</select>
      </div>
    </div>`;
  }).join("");
  return bar + `<div class="ccards">${cards}</div>`;
}

// Tạo/sửa hợp đồng đầy đủ (thông tin + hạng mục) — chạy cục bộ + đồng bộ ngầm.
let _editItems = [];
function itemsRows() {
  return _editItems.map((it, i) => `<div class="irow" data-i="${i}">
    <input class="in-name" placeholder="Hạng mục" value="${esc(it.name || "")}" />
    <input class="in-qty" type="number" placeholder="SL" value="${esc(it.qty ?? 1)}" />
    <input class="in-price" type="number" placeholder="Đơn giá" value="${esc(it.unit_price ?? 0)}" />
    <button class="btn small in-del" data-del="${i}">×</button>
  </div>`).join("");
}
function syncItems() {
  document.querySelectorAll("#itemsBox .irow").forEach((r) => {
    const i = +r.dataset.i;
    if (_editItems[i]) {
      _editItems[i].name = r.querySelector(".in-name").value;
      _editItems[i].qty = r.querySelector(".in-qty").value;
      _editItems[i].unit_price = r.querySelector(".in-price").value;
    }
  });
}
function drawItems() {
  const box = document.getElementById("itemsBox");
  box.innerHTML = itemsRows() + `<div class="itotal">Tổng: ${vnd(_editItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0))}</div>`;
  box.querySelectorAll(".in-del").forEach((b) => b.onclick = () => { syncItems(); _editItems.splice(+b.dataset.del, 1); drawItems(); });
  box.querySelectorAll(".in-qty,.in-price").forEach((inp) => inp.oninput = () => { syncItems(); const t = document.querySelector("#itemsBox .itotal"); if (t) t.textContent = "Tổng: " + vnd(_editItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)); });
}
function openContractEdit(id, prefill) {
  const c = id ? T("studio_contracts").find((x) => x.id === id) : null;
  const v = c || { status: "draft", shoot_type: "photo", event_date: "", client_name: prefill?.client_name || "", client_phone: prefill?.client_phone || "" };
  _editItems = id ? T("contract_items").filter((i) => i.contract_id === id).sort((a, b) => (a.position || 0) - (b.position || 0)).map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit_price: i.unit_price })) : [];
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div class="dmodal-title">${id ? "Sửa hợp đồng" : "Hợp đồng mới"}</div>
      <button id="dmClose" class="btn small">Đóng</button>
    </div>
    <div class="dmodal-body dform">
      <div class="fgrid">
        <div><label>Mã HĐ</label><input id="ctCode" value="${esc(v.code || "")}" placeholder="VD: HD-2026-001" /></div>
        <div><label>Trạng thái</label><select id="ctStatus" class="dsel" style="width:100%;height:40px">${statusOptions(CONTRACT_STATUS, v.status)}</select></div>
      </div>
      <label>Tiêu đề</label><input id="ctTitle" value="${esc(v.title || "")}" placeholder="VD: Chụp ảnh cưới" />
      <div class="fgrid">
        <div><label>Tên khách</label><input id="ctName" value="${esc(v.client_name || "")}" /></div>
        <div><label>SĐT khách</label><input id="ctPhone" value="${esc(v.client_phone || "")}" /></div>
      </div>
      <div class="fgrid">
        <div><label>Loại dịch vụ</label><select id="ctShoot" class="dsel" style="width:100%;height:40px">${statusOptions(SHOOT_TYPE, v.shoot_type)}</select></div>
        <div><label>Ngày chụp</label><input id="ctDate" type="date" value="${esc((v.event_date || "").slice(0, 10))}" /></div>
      </div>
      <label>Địa điểm</label><input id="ctLoc" value="${esc(v.location || "")}" />
      <label>Ghi chú</label><input id="ctNote" value="${esc(v.note || "")}" />
      <label style="margin-top:14px">Hạng mục</label>
      <div id="itemsBox" class="items-box"></div>
      <button id="ctAddItem" class="btn small" style="margin-top:8px">＋ Thêm hạng mục</button>
      <div class="dform-actions">
        ${id ? `<button id="ctDelete" class="btn small danger">Xóa HĐ</button>` : ""}
        <button id="ctSave" class="btn small primary" style="margin-left:auto">Lưu</button>
      </div>
    </div>`;
  ov.classList.remove("hidden");
  drawItems();
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("ctAddItem").onclick = () => { syncItems(); _editItems.push({ id: uuid(), name: "", qty: 1, unit_price: 0 }); drawItems(); };
  if (id) document.getElementById("ctDelete").onclick = async () => {
    if (!(await dialog("Xóa hợp đồng này và toàn bộ hạng mục?", { title: "Xóa hợp đồng", ok: "Xóa", cancel: "Huỷ" }))) return;
    for (const it of T("contract_items").filter((i) => i.contract_id === id)) await window.localMutate("contract_items", "delete", { id: it.id, contract_id: id });
    await window.localMutate("studio_contracts", "delete", { id });
    close();
  };
  document.getElementById("ctSave").onclick = async () => {
    syncItems();
    const title = document.getElementById("ctTitle").value.trim() || "Hợp đồng";
    const cid = id || uuid();
    const crow = {
      id: cid, code: document.getElementById("ctCode").value.trim(), title,
      client_name: document.getElementById("ctName").value.trim(),
      client_phone: document.getElementById("ctPhone").value.trim(),
      shoot_type: document.getElementById("ctShoot").value,
      event_date: document.getElementById("ctDate").value || null,
      location: document.getElementById("ctLoc").value.trim(),
      note: document.getElementById("ctNote").value.trim(),
      status: document.getElementById("ctStatus").value,
    };
    if (!id) crow.client_token = "c" + uuid().replace(/-/g, "").slice(0, 22);
    await window.localMutate("studio_contracts", id ? "update" : "insert", crow);
    const existing = T("contract_items").filter((i) => i.contract_id === cid);
    for (let idx = 0; idx < _editItems.length; idx++) {
      const it = _editItems[idx];
      const row = { id: it.id, contract_id: cid, name: (it.name || "").trim(), qty: Math.round(Number(it.qty) || 0), unit_price: Math.round(Number(it.unit_price) || 0), position: idx };
      await window.localMutate("contract_items", existing.find((e) => e.id === it.id) ? "update" : "insert", row);
    }
    for (const e of existing) if (!_editItems.find((it) => it.id === e.id)) await window.localMutate("contract_items", "delete", { id: e.id, contract_id: cid });
    close();
  };
}

function openContract(id) {
  const c = T("studio_contracts").find((x) => x.id === id);
  if (!c) return;
  const items = T("contract_items").filter((i) => i.contract_id === id).sort((a, b) => (a.position || 0) - (b.position || 0));
  const pays = T("contract_payments").filter((p) => p.contract_id === id);
  const crew = T("contract_crew").filter((x) => x.contract_id === id);
  const tot = contractTotal(id), paid = contractPaid(id);
  const rows = (arr, cols) => arr.map(cols).join("");
  const html = `
    <div class="dmodal-head">
      <div><div class="dmodal-title">${esc(c.title || "Hợp đồng")} · ${esc(c.code || "")}</div>
      <div class="muted">${esc(c.client_name || "")} · ${esc(c.client_phone || "")} · ${D(c.event_date)}</div></div>
      <div class="row-gap"><button id="dmPrint" class="btn small">🖨 In PDF</button><button id="dmEdit" class="btn small primary">Sửa</button><button id="dmClose" class="btn small">Đóng</button></div>
    </div>
    <div class="dmodal-body">
      <div class="drow"><span class="badge">${CONTRACT_STATUS[c.status] || esc(c.status) || ""}</span>
        ${c.client_signed_at ? `<span class="badge ok">Khách đã ký ${D(c.client_signed_at)}</span>` : `<span class="badge warn">Chưa ký</span>`}</div>
      ${c.location ? `<p><b>Địa điểm:</b> ${esc(c.location)}</p>` : ""}
      <h4>Hạng mục</h4>
      ${items.length ? `<table class="dtable"><thead><tr><th>Hạng mục</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>${rows(items, (i) => `<tr><td>${esc(i.name)}</td><td class="r">${i.qty}</td><td class="r">${vnd(i.unit_price)}</td><td class="r">${vnd((i.qty || 0) * (i.unit_price || 0))}</td></tr>`)}</tbody></table>` : `<p class="muted">Không có hạng mục.</p>`}
      <p class="dtotals"><b>Tổng:</b> ${vnd(tot)} · <b>Đã thu:</b> ${vnd(paid)} · <b>Còn lại:</b> ${vnd(Math.max(0, tot - paid))}</p>
      ${pays.length ? `<h4>Thanh toán</h4><table class="dtable"><thead><tr><th>Ngày</th><th>Loại</th><th class="r">Số tiền</th></tr></thead><tbody>${rows(pays, (p) => `<tr><td>${D(p.paid_at)}</td><td>${esc(p.kind || "")}</td><td class="r">${vnd(p.amount)}</td></tr>`)}</tbody></table>` : ""}
      ${crew.length ? `<h4>Đội ngũ</h4><table class="dtable"><thead><tr><th>Tên</th><th>Vai trò</th><th class="r">Lương</th><th>Đã trả</th></tr></thead><tbody>${rows(crew, (w) => `<tr><td>${esc(w.name)}</td><td>${esc(w.role || "")}</td><td class="r">${vnd(w.salary)}</td><td>${w.paid ? "Rồi" : "Chưa"}</td></tr>`)}</tbody></table>` : ""}
      ${c.note ? `<h4>Ghi chú</h4><p>${esc(c.note).replace(/\n/g, "<br/>")}</p>` : ""}
    </div>`;
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = html;
  ov.classList.remove("hidden");
  document.getElementById("dmClose").onclick = () => ov.classList.add("hidden");
  document.getElementById("dmEdit").onclick = () => { ov.classList.add("hidden"); openContractEdit(id); };
  document.getElementById("dmPrint").onclick = () => window.printContract(id);
  ov.onclick = (e) => { if (e.target === ov) ov.classList.add("hidden"); };
}

function renderClients() {
  const map = new Map();
  for (const c of T("studio_contracts")) {
    const key = digits(c.client_phone) || norm(c.client_name) || "?";
    const cur = map.get(key) || { name: c.client_name || "", phone: c.client_phone || "", n: 0, spent: 0, last: "" };
    cur.n++; cur.spent += contractTotal(c.id);
    const d = c.event_date || c.created_at || "";
    if (d > cur.last) cur.last = d;
    if (!cur.name && c.client_name) cur.name = c.client_name;
    map.set(key, cur);
  }
  let rows = [...map.values()].filter((c) => match(c, [c.name, c.phone]));
  rows.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  const bar = `<div class="dbar"><button class="btn small primary" id="addClient">＋ Khách + hợp đồng</button><span class="dcap" style="margin:0">${rows.length} khách hàng</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có khách hàng khớp." : "Khách hàng hình thành từ hợp đồng. Bấm ＋ để tạo hợp đồng cho khách mới.");
  const body = rows.map((c) => `<tr data-client="${esc(c.name)}|${esc(c.phone)}" class="clickable"><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td class="r">${c.n}</td><td class="r">${vnd(c.spent)}</td><td>${D(c.last)}</td></tr>`).join("");
  return bar + table(["Tên khách", "SĐT", "Số HĐ", "Tổng chi", "Gần nhất"], body, "");
}

// Chi tiết khách: các hợp đồng + tổng chi + tạo HĐ mới cho khách này.
function openClient(name, phone) {
  const dg = digits(phone);
  const cs = T("studio_contracts").filter((c) => (dg && digits(c.client_phone) === dg) || (!dg && (c.client_name || "") === name))
    .sort((a, b) => String(b.event_date || b.created_at || "").localeCompare(String(a.event_date || a.created_at || "")));
  const total = cs.reduce((s, c) => s + contractTotal(c.id), 0);
  const paid = cs.reduce((s, c) => s + contractPaid(c.id), 0);
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div><div class="dmodal-title">${esc(name || "Khách hàng")}</div><div class="muted">${esc(phone || "")} · ${cs.length} hợp đồng</div></div>
      <div class="row-gap"><button id="clNew" class="btn small primary">Tạo HĐ</button><button id="dmClose" class="btn small">Đóng</button></div>
    </div>
    <div class="dmodal-body">
      <p class="dtotals"><b>Tổng giá trị:</b> ${vnd(total)} · <b>Đã thu:</b> ${vnd(paid)} · <b>Còn:</b> ${vnd(Math.max(0, total - paid))}</p>
      ${cs.length ? `<table class="dtable"><thead><tr><th>Mã</th><th>Hợp đồng</th><th>Ngày</th><th>Trạng thái</th><th class="r">Giá trị</th></tr></thead><tbody>${cs.map((c) => `<tr data-open-contract="${c.id}" class="clickable"><td>${esc(c.code || "")}</td><td>${esc(c.title || "")}</td><td>${D(c.event_date)}</td><td>${CONTRACT_STATUS[c.status] || esc(c.status) || ""}</td><td class="r">${vnd(contractTotal(c.id))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Chưa có hợp đồng.</p>`}
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("clNew").onclick = () => { close(); openContractEdit(null, { client_name: name, client_phone: phone }); };
  ov.querySelectorAll("[data-open-contract]").forEach((r) => r.onclick = () => { close(); openContract(r.dataset.openContract); });
}

function quoteTotal(id) {
  return T("quote_items").filter((i) => i.quote_id === id && !(i.is_optional && i.selected === false))
    .reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
}
function renderQuotes() {
  const rows = T("studio_quotes").filter((q) => match(q, [q.code, q.client_name, q.client_phone, q.title]))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const bar = `<div class="dbar"><button class="btn small primary" id="addQuote">＋ Báo giá mới</button><span class="dcap" style="margin:0">${rows.length} báo giá</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có báo giá khớp." : "Chưa có báo giá. Bấm ＋ để tạo.");
  const body = rows.map((q) => `<tr data-quote="${q.id}" class="clickable"><td>${esc(q.code || "")}</td><td>${esc(q.client_name || "")}</td><td>${esc(q.client_phone || "")}</td><td>${D(q.event_date)}</td><td><span class="badge">${QUOTE_STATUS[q.status] || esc(q.status) || ""}</span></td><td class="r">${vnd(quoteTotal(q.id))}</td></tr>`).join("");
  return bar + table(["Mã", "Khách", "SĐT", "Ngày", "Trạng thái", "Tổng"], body, "");
}
// Tạo/sửa báo giá (dùng lại trình hạng mục _editItems như hợp đồng).
function openQuoteEdit(id) {
  const q = id ? T("studio_quotes").find((x) => x.id === id) : null;
  const v = q || { status: "draft", event_date: "" };
  _editItems = id ? T("quote_items").filter((i) => i.quote_id === id).sort((a, b) => (a.position || 0) - (b.position || 0)).map((i) => ({ id: i.id, name: i.name, qty: i.qty, unit_price: i.unit_price })) : [];
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div class="dmodal-title">${id ? "Sửa báo giá" : "Báo giá mới"}</div>
      <button id="dmClose" class="btn small">Đóng</button>
    </div>
    <div class="dmodal-body dform">
      <div class="fgrid">
        <div><label>Mã BG</label><input id="qCode" value="${esc(v.code || "")}" placeholder="VD: BG-2026-001" /></div>
        <div><label>Trạng thái</label><select id="qStatus" class="dsel" style="width:100%;height:40px">${statusOptions(QUOTE_STATUS, v.status)}</select></div>
      </div>
      <label>Tiêu đề</label><input id="qTitle" value="${esc(v.title || "")}" placeholder="Báo giá" />
      <div class="fgrid">
        <div><label>Tên khách</label><input id="qName" value="${esc(v.client_name || "")}" /></div>
        <div><label>SĐT khách</label><input id="qPhone" value="${esc(v.client_phone || "")}" /></div>
      </div>
      <label>Ngày sự kiện</label><input id="qDate" type="date" value="${esc((v.event_date || "").slice(0, 10))}" />
      <label>Ghi chú</label><input id="qNote" value="${esc(v.note || "")}" />
      <label style="margin-top:14px">Hạng mục</label>
      <div id="itemsBox" class="items-box"></div>
      <button id="qAddItem" class="btn small" style="margin-top:8px">＋ Thêm hạng mục</button>
      <div class="dform-actions">
        ${id ? `<button id="qDelete" class="btn small danger">Xóa</button>` : ""}
        <button id="qSave" class="btn small primary" style="margin-left:auto">Lưu</button>
      </div>
    </div>`;
  ov.classList.remove("hidden");
  drawItems();
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("qAddItem").onclick = () => { syncItems(); _editItems.push({ id: uuid(), name: "", qty: 1, unit_price: 0 }); drawItems(); };
  if (id) document.getElementById("qDelete").onclick = async () => {
    if (!(await dialog("Xóa báo giá này?", { title: "Xóa báo giá", ok: "Xóa", cancel: "Huỷ" }))) return;
    for (const it of T("quote_items").filter((i) => i.quote_id === id)) await window.localMutate("quote_items", "delete", { id: it.id, quote_id: id });
    await window.localMutate("studio_quotes", "delete", { id });
    close();
  };
  document.getElementById("qSave").onclick = async () => {
    syncItems();
    const qid = id || uuid();
    const qrow = { id: qid, code: document.getElementById("qCode").value.trim(), title: document.getElementById("qTitle").value.trim() || "Báo giá", client_name: document.getElementById("qName").value.trim(), client_phone: document.getElementById("qPhone").value.trim(), event_date: document.getElementById("qDate").value || null, note: document.getElementById("qNote").value.trim(), status: document.getElementById("qStatus").value };
    if (!id) qrow.client_token = "q" + uuid().replace(/-/g, "").slice(0, 22);
    await window.localMutate("studio_quotes", id ? "update" : "insert", qrow);
    const existing = T("quote_items").filter((i) => i.quote_id === qid);
    for (let idx = 0; idx < _editItems.length; idx++) {
      const it = _editItems[idx];
      const row = { id: it.id, quote_id: qid, name: (it.name || "").trim(), qty: Math.round(Number(it.qty) || 0), unit_price: Math.round(Number(it.unit_price) || 0), position: idx, is_optional: false, selected: true };
      await window.localMutate("quote_items", existing.find((e) => e.id === it.id) ? "update" : "insert", row);
    }
    for (const e of existing) if (!_editItems.find((it) => it.id === e.id)) await window.localMutate("quote_items", "delete", { id: e.id, quote_id: qid });
    close();
  };
}

function renderExpenses() {
  const rows = T("studio_expenses").filter((e) => match(e, [e.title, e.category]))
    .sort((a, b) => String(b.spent_at || "").localeCompare(String(a.spent_at || "")));
  const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const bar = `<div class="dbar"><button class="btn small primary" id="addExpense">＋ Thêm khoản chi</button><span class="dcap" style="margin:0">${rows.length} khoản · tổng ${vnd(total)}</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có khoản chi khớp." : "Chưa có khoản chi. Bấm ＋ để thêm — chạy cục bộ, lưu ngay, đồng bộ ngầm.");
  const body = rows.map((e) => `<tr data-expense="${e.id}" class="clickable"><td>${D(e.spent_at)}</td><td>${esc(e.title)}</td><td>${esc(e.category || "")}</td><td class="r">${vnd(e.amount)}</td></tr>`).join("");
  return bar + table(["Ngày", "Nội dung", "Danh mục", "Số tiền"], body, "");
}

// Form tạo/sửa khoản chi — chạy cục bộ, lưu tức thì + đồng bộ ngầm.
function openExpense(id) {
  const e = id ? T("studio_expenses").find((x) => x.id === id) : null;
  const v = e || { spent_at: todayVN(), title: "", amount: "", category: "", note: "" };
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div class="dmodal-title">${id ? "Sửa khoản chi" : "Thêm khoản chi"}</div>
      <button id="dmClose" class="btn small">Đóng</button>
    </div>
    <div class="dmodal-body dform">
      <label>Ngày chi</label><input id="exDate" type="date" value="${esc((v.spent_at || "").slice(0, 10))}" />
      <label>Nội dung</label><input id="exTitle" type="text" value="${esc(v.title || "")}" placeholder="VD: Mua đạo cụ" />
      <label>Danh mục</label><input id="exCat" type="text" value="${esc(v.category || "")}" placeholder="VD: Đạo cụ, Đi lại…" />
      <label>Số tiền (VND)</label><input id="exAmount" type="number" value="${esc(v.amount ?? "")}" placeholder="0" />
      <label>Ghi chú</label><input id="exNote" type="text" value="${esc(v.note || "")}" />
      <div class="dform-actions">
        ${id ? `<button id="exDelete" class="btn small danger">Xóa</button>` : ""}
        <button id="exSave" class="btn small primary" style="margin-left:auto">Lưu</button>
      </div>
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (ev2) => { if (ev2.target === ov) close(); };
  document.getElementById("exSave").onclick = async () => {
    const title = document.getElementById("exTitle").value.trim();
    const amount = Math.round(Number(document.getElementById("exAmount").value) || 0);
    if (!title) { document.getElementById("exTitle").focus(); return; }
    const row = {
      id: id || uuid(),
      title,
      amount,
      category: document.getElementById("exCat").value.trim(),
      spent_at: document.getElementById("exDate").value || todayVN(),
      note: document.getElementById("exNote").value.trim(),
    };
    await window.localMutate("studio_expenses", id ? "update" : "insert", row);
    close();
  };
  if (id) document.getElementById("exDelete").onclick = async () => {
    if (!(await dialog("Xóa khoản chi này?", { title: "Xóa khoản chi", ok: "Xóa", cancel: "Huỷ" }))) return;
    await window.localMutate("studio_expenses", "delete", { id });
    close();
  };
}

function renderPayroll() {
  const byId = new Map(T("studio_contracts").map((c) => [c.id, c]));
  const rows = T("contract_crew").map((w) => ({ ...w, c: byId.get(w.contract_id) }))
    .filter((w) => match(w, [w.name, w.phone, w.role, w.c?.code, w.c?.client_name]))
    .sort((a, b) => String(b.c?.event_date || "").localeCompare(String(a.c?.event_date || "")));
  if (!rows.length) return empty("Không có dòng lương khớp.");
  const total = rows.reduce((s, w) => s + (Number(w.salary) || 0), 0);
  const unpaid = rows.filter((w) => !w.paid).reduce((s, w) => s + (Number(w.salary) || 0), 0);
  const body = rows.map((w) => `<tr data-crew="${w.id}" class="clickable"><td>${esc(w.name)}</td><td>${esc(w.role || "")}</td><td>${esc(w.c?.code || "")}</td><td>${D(w.c?.event_date)}</td><td class="r">${vnd(w.salary)}</td><td>${w.paid ? "<span class='badge ok'>Đã trả</span>" : "<span class='badge warn'>Chưa</span>"}</td></tr>`).join("");
  return `<div class="dcap">${rows.length} dòng · tổng ${vnd(total)} · chưa trả ${vnd(unpaid)}</div>` + table(["Tên", "Vai trò", "Mã HĐ", "Ngày chụp", "Lương", "Trạng thái"], body, "");
}

// Sửa lương / đánh dấu đã trả — chạy cục bộ (bảng con contract_crew).
function openCrew(id) {
  const w = T("contract_crew").find((x) => x.id === id);
  if (!w) return;
  const c = T("studio_contracts").find((x) => x.id === w.contract_id);
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div><div class="dmodal-title">${esc(w.name || "Thợ")}</div><div class="muted">${esc(w.role || "")} · ${esc(c?.code || "")}</div></div>
      <button id="dmClose" class="btn small">Đóng</button>
    </div>
    <div class="dmodal-body dform">
      <label>Lương (VND)</label><input id="crSalary" type="number" value="${esc(w.salary ?? 0)}" />
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px"><input id="crPaid" type="checkbox" ${w.paid ? "checked" : ""} style="width:auto;height:auto" /> Đã trả lương</label>
      <div class="dform-actions"><button id="crSave" class="btn small primary" style="margin-left:auto">Lưu</button></div>
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("crSave").onclick = async () => {
    const paid = document.getElementById("crPaid").checked;
    const row = { id, contract_id: w.contract_id, salary: Math.round(Number(document.getElementById("crSalary").value) || 0), paid, paid_at: paid ? (w.paid_at || todayVN()) : null };
    await window.localMutate("contract_crew", "update", row);
    close();
  };
}

let _calMonth = null; // "YYYY-MM" đang xem; null = tháng hiện tại
const CAL_KIND_CLS = { shoot: "chip-shoot", booking: "chip-book", event: "chip-ev" };
// Lưới lịch tháng: mỗi ngày hiện các "chip" nội dung (ngày chụp/đặt lịch/lịch),
// tô màu theo loại — nhìn rõ ngày nào có lịch chụp, giống web app.
function monthGridHtml(byDate, ym) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7; // T2=0
  const days = new Date(y, m, 0).getDate();
  const todayS = todayVN();
  const wk = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  let cells = "";
  for (let i = 0; i < startDow; i++) cells += `<div class="mcell empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const items = byDate[ds] || [];
    const chips = items.slice(0, 3).map((it) => {
      const attr = it.kind === "shoot" ? `data-open-contract="${it.id}"` : it.kind === "event" ? `data-event="${it.id}"` : "";
      return `<span class="mchip ${CAL_KIND_CLS[it.kind]}" ${attr} title="${esc(it.title)}">${esc((it.t ? it.t + " " : "") + it.title)}</span>`;
    }).join("");
    const more = items.length > 3 ? `<span class="mmore">+${items.length - 3}</span>` : "";
    cells += `<div class="mcell${ds === todayS ? " today" : ""}${items.length ? " has" : ""}"><span class="mday">${d}</span>${chips}${more}</div>`;
  }
  return `<div class="mgrid-head">${wk.map((w) => `<div>${w}</div>`).join("")}</div><div class="mgrid">${cells}</div>`
    + `<div class="mlegend"><span class="mchip chip-shoot">Ngày chụp (HĐ)</span><span class="mchip chip-book">Đặt lịch</span><span class="mchip chip-ev">Lịch/ghi chú</span></div>`;
}
function renderCalendar() {
  const ev = T("studio_events").map((e) => ({ id: e.id, d: e.event_date, t: e.event_time, title: e.title, note: e.note, kind: "event" }));
  const bk = T("studio_bookings").map((b) => ({ id: b.id, d: b.preferred_date, t: "", title: `${b.name || ""} · ${b.service || ""}`, status: b.status, kind: "booking" }));
  const sh = T("studio_contracts").filter((c) => c.event_date && c.status !== "cancelled").map((c) => ({ id: c.id, d: c.event_date, t: c.event_time, title: c.title, kind: "shoot" }));
  const all = [...ev, ...bk, ...sh].filter((r) => r.d);
  const ym = _calMonth || thisMonth();
  const byDate = {};
  all.forEach((r) => { const k = String(r.d).slice(0, 10); (byDate[k] = byDate[k] || []).push(r); });
  Object.values(byDate).forEach((list) => list.sort((a, b) => (a.kind === "shoot" ? -1 : 1) - (b.kind === "shoot" ? -1 : 1)));
  const [yy, mm] = ym.split("-").map(Number);
  const nav = `<div class="mnav"><button class="btn small" id="calPrev">←</button><span class="mtitle">Tháng ${mm}/${yy}</span><button class="btn small" id="calNext">→</button><button class="btn small" id="calToday">Hôm nay</button><button class="btn small primary" id="addEvent" style="margin-left:auto">＋ Thêm lịch</button></div>`;
  const grid = monthGridHtml(byDate, ym);
  // Danh sách các mục trong tháng đang xem (kèm lọc tìm kiếm).
  let rows = all.filter((r) => String(r.d).slice(0, 7) === ym).filter((r) => match(r, [r.title]));
  rows.sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const KIND = { booking: "Đặt lịch", shoot: "Chụp (HĐ)", event: "Lịch" };
  const body = rows.map((r) => {
    const right = r.kind === "booking" ? `<select class="dsel" data-status-booking="${r.id}">${statusOptions(BOOKING_STATUS, r.status)}</select>`
      : r.kind === "event" ? `<button class="btn small" data-event="${r.id}">Sửa</button>`
      : `<button class="btn small" data-open-contract="${r.id}">Mở</button>`;
    return `<tr><td style="width:120px">${D(r.d)}${r.t ? " · " + esc(r.t) : ""}</td><td><span class="badge">${KIND[r.kind]}</span></td><td>${esc(r.title)}</td><td style="text-align:right">${right}</td></tr>`;
  }).join("");
  const list = rows.length ? table(["Ngày", "Loại", "Nội dung", ""], body, "") : empty("Không có mục nào trong tháng này.");
  return nav + `<div class="card" style="padding:14px">${grid}</div>` + `<div class="dcap">${rows.length} mục trong tháng</div>` + list;
}

// Thêm/sửa mục lịch (studio_events) — chạy cục bộ.
function openEvent(id) {
  const e = id ? T("studio_events").find((x) => x.id === id) : null;
  const v = e || { event_date: todayVN(), title: "", event_time: "", note: "" };
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head">
      <div class="dmodal-title">${id ? "Sửa lịch" : "Thêm lịch"}</div>
      <button id="dmClose" class="btn small">Đóng</button>
    </div>
    <div class="dmodal-body dform">
      <label>Ngày</label><input id="evDate" type="date" value="${esc((v.event_date || "").slice(0, 10))}" />
      <label>Giờ (không bắt buộc)</label><input id="evTime" type="text" value="${esc(v.event_time || "")}" placeholder="VD: 08:00" />
      <label>Nội dung</label><input id="evTitle" type="text" value="${esc(v.title || "")}" placeholder="VD: Chụp ngoại cảnh" />
      <label>Ghi chú</label><input id="evNote" type="text" value="${esc(v.note || "")}" />
      <div class="dform-actions">
        ${id ? `<button id="evDelete" class="btn small danger">Xóa</button>` : ""}
        <button id="evSave" class="btn small primary" style="margin-left:auto">Lưu</button>
      </div>
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (ev2) => { if (ev2.target === ov) close(); };
  document.getElementById("evSave").onclick = async () => {
    const title = document.getElementById("evTitle").value.trim();
    if (!title) { document.getElementById("evTitle").focus(); return; }
    const row = { id: id || uuid(), title, event_date: document.getElementById("evDate").value || todayVN(), event_time: document.getElementById("evTime").value.trim(), note: document.getElementById("evNote").value.trim(), remind: true };
    await window.localMutate("studio_events", id ? "update" : "insert", row);
    close();
  };
  if (id) document.getElementById("evDelete").onclick = async () => {
    if (!(await dialog("Xóa mục lịch này?", { title: "Xóa mục lịch", ok: "Xóa", cancel: "Huỷ" }))) return;
    await window.localMutate("studio_events", "delete", { id });
    close();
  };
}

function table(cols, body, caption) {
  return (caption ? `<div class="dcap">${caption}</div>` : "") + `<div class="dtable-wrap"><table class="dtable"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ─── Bảng giá ────────────────────────────────────────────────────────────────
function renderPricelist() {
  const rows = T("studio_pricelist").filter((p) => match(p, [p.name, p.category]))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const bar = `<div class="dbar"><button class="btn small primary" id="addPrice">＋ Thêm mục giá</button><span class="dcap" style="margin:0">${rows.length} mục</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có mục khớp." : "Chưa có bảng giá. Bấm ＋ để thêm.");
  const body = rows.map((p) => `<tr data-price="${p.id}" class="clickable"><td>${esc(p.name)}</td><td>${esc(p.category || "")}</td><td class="r">${vnd(p.price)}${p.unit ? " " + esc(p.unit) : ""}</td><td>${p.active === false ? "<span class='badge warn'>Ẩn</span>" : "<span class='badge ok'>Hiện</span>"}</td></tr>`).join("");
  return bar + table(["Tên dịch vụ", "Nhóm", "Giá", "Hiển thị"], body, "");
}
function openPrice(id) {
  const p = id ? T("studio_pricelist").find((x) => x.id === id) : null;
  const v = p || { name: "", price: 0, unit: "", category: "", active: true };
  simpleForm(id ? "Sửa mục giá" : "Thêm mục giá", [
    { k: "name", label: "Tên dịch vụ", val: v.name },
    { k: "category", label: "Nhóm", val: v.category },
    { k: "price", label: "Giá (VND)", val: v.price, type: "number" },
    { k: "unit", label: "Đơn vị (VD: / buổi)", val: v.unit },
  ], v.active !== false, async (vals, active, del) => {
    if (del) return window.localMutate("studio_pricelist", "delete", { id });
    const row = { id: id || uuid(), name: vals.name.trim() || "Dịch vụ", category: vals.category.trim(), price: Math.round(Number(vals.price) || 0), unit: vals.unit.trim(), active };
    return window.localMutate("studio_pricelist", id ? "update" : "insert", row);
  }, !!id);
}

// ─── Thiết bị ────────────────────────────────────────────────────────────────
function renderEquipment() {
  const rows = T("studio_equipment").filter((e) => match(e, [e.name, e.category]))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const bar = `<div class="dbar"><button class="btn small primary" id="addEquip">＋ Thêm thiết bị</button><span class="dcap" style="margin:0">${rows.length} thiết bị</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có thiết bị khớp." : "Chưa có thiết bị. Bấm ＋ để thêm.");
  const body = rows.map((e) => `<tr data-equip="${e.id}" class="clickable"><td>${esc(e.name)}</td><td>${esc(e.category || "")}</td><td>${esc(e.note || "")}</td><td>${e.active === false ? "<span class='badge warn'>Ngưng</span>" : "<span class='badge ok'>Dùng</span>"}</td></tr>`).join("");
  return bar + table(["Tên", "Nhóm", "Ghi chú", "Trạng thái"], body, "");
}
function openEquip(id) {
  const e = id ? T("studio_equipment").find((x) => x.id === id) : null;
  const v = e || { name: "", category: "", note: "", active: true };
  simpleForm(id ? "Sửa thiết bị" : "Thêm thiết bị", [
    { k: "name", label: "Tên thiết bị", val: v.name },
    { k: "category", label: "Nhóm", val: v.category },
    { k: "note", label: "Ghi chú", val: v.note },
  ], v.active !== false, async (vals, active, del) => {
    if (del) return window.localMutate("studio_equipment", "delete", { id });
    const row = { id: id || uuid(), name: vals.name.trim() || "Thiết bị", category: vals.category.trim(), note: vals.note.trim(), active };
    return window.localMutate("studio_equipment", id ? "update" : "insert", row);
  }, !!id);
}

// ─── Dịch vụ & điều khoản ────────────────────────────────────────────────────
function renderServices() {
  const rows = T("studio_services").filter((s) => match(s, [s.name, s.clauses]))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const bar = `<div class="dbar"><button class="btn small primary" id="addService">＋ Thêm dịch vụ</button><span class="dcap" style="margin:0">${rows.length} dịch vụ</span></div>`;
  if (!rows.length) return bar + empty(dataQuery ? "Không có dịch vụ khớp." : "Chưa có dịch vụ. Bấm ＋ để thêm.");
  const body = rows.map((s) => `<tr data-service="${s.id}" class="clickable"><td>${esc(s.name)}</td><td style="color:var(--muted)">${esc((s.clauses || "").slice(0, 80))}${(s.clauses || "").length > 80 ? "…" : ""}</td></tr>`).join("");
  return bar + table(["Dịch vụ", "Điều khoản"], body, "");
}
function openService(id) {
  const s = id ? T("studio_services").find((x) => x.id === id) : null;
  const v = s || { name: "", clauses: "" };
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head"><div class="dmodal-title">${id ? "Sửa dịch vụ" : "Thêm dịch vụ"}</div><button id="dmClose" class="btn small">Đóng</button></div>
    <div class="dmodal-body dform">
      <label>Tên dịch vụ</label><input id="svName" value="${esc(v.name || "")}" />
      <label>Điều khoản</label><textarea id="svClauses" style="width:100%;min-height:140px;padding:10px;border:1px solid var(--border);border-radius:10px;background:#faf8f3;font-size:14px">${esc(v.clauses || "")}</textarea>
      <div class="dform-actions">${id ? `<button id="svDelete" class="btn small danger">Xóa</button>` : ""}<button id="svSave" class="btn small primary" style="margin-left:auto">Lưu</button></div>
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("svSave").onclick = async () => {
    await window.localMutate("studio_services", id ? "update" : "insert", { id: id || uuid(), name: document.getElementById("svName").value.trim() || "Dịch vụ", clauses: document.getElementById("svClauses").value });
    close();
  };
  if (id) document.getElementById("svDelete").onclick = async () => { if (await dialog("Xóa dịch vụ này?", { title: "Xóa dịch vụ", ok: "Xóa", cancel: "Huỷ" })) { await window.localMutate("studio_services", "delete", { id }); close(); } };
}

// Form đơn giản dùng chung cho Bảng giá / Thiết bị (các trường text/number + bật/tắt).
function simpleForm(title, fields, active, onSave, canDelete) {
  const ov = document.getElementById("dataModal");
  ov.querySelector(".dmodal").innerHTML = `
    <div class="dmodal-head"><div class="dmodal-title">${esc(title)}</div><button id="dmClose" class="btn small">Đóng</button></div>
    <div class="dmodal-body dform">
      ${fields.map((f) => `<label>${esc(f.label)}</label><input id="sf_${f.k}" type="${f.type || "text"}" value="${esc(f.val ?? "")}" />`).join("")}
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px"><input id="sfActive" type="checkbox" ${active ? "checked" : ""} style="width:auto;height:auto" /> Đang hiển thị / sử dụng</label>
      <div class="dform-actions">${canDelete ? `<button id="sfDelete" class="btn small danger">Xóa</button>` : ""}<button id="sfSave" class="btn small primary" style="margin-left:auto">Lưu</button></div>
    </div>`;
  ov.classList.remove("hidden");
  const close = () => ov.classList.add("hidden");
  document.getElementById("dmClose").onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  document.getElementById("sfSave").onclick = async () => {
    const vals = {}; fields.forEach((f) => vals[f.k] = document.getElementById("sf_" + f.k).value);
    await onSave(vals, document.getElementById("sfActive").checked, false);
    close();
  };
  if (canDelete) document.getElementById("sfDelete").onclick = async () => { if (await dialog("Xóa mục này?", { title: "Xóa mục", ok: "Xóa", cancel: "Huỷ" })) { await onSave({}, false, true); close(); } };
}
