/**
 * Quay video giới thiệu HỢP ĐỒNG: tạo hợp đồng tự động bằng AI → chỉnh hạng mục
 * (thêm / bớt / chính-phụ / gắn mốc lịch / sửa tên mốc) → phụ lục sau khi ký.
 *
 * Khác video SePay (dựng bằng React), video này quay GIAO DIỆN THẬT: mở các màn
 * /uipreview (dữ liệu giả), Playwright điều khiển con trỏ + bàn phím, máy chủ và
 * Supabase được giả lập ngay trong trình duyệt nên bấm Lưu vẫn chạy trọn vẹn.
 * Phụ đề, con trỏ và thẻ tiêu đề là một lớp phủ gắn thêm vào trang.
 *
 * Ghi hình bằng CDP screencast (mỗi khung kèm mốc thời gian) rồi ghép thành MP4
 * 30fps — máy chậm cũng không làm video nhanh/chậm bất thường.
 *
 * Cần: `npm run dev` đang chạy và ffmpeg có libx264.
 *
 *   node scripts/quay-video-hop-dong.mjs [--dir ra/] [--only ngang|doc] [--url http://localhost:3000]
 *
 * Ra: <dir>/hop-dong-ngang.mp4 (1920×1080) và <dir>/hop-dong-doc.mp4 (1080×1920).
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const base = opt("url", "http://localhost:3000");
const outDir = resolve(opt("dir", "."));
const only = opt("only", "");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const EXEC = process.env.CHROME_PATH || undefined;

const FORMATS = {
  // Viewport CSS × deviceScaleFactor = khung video.
  ngang: { viewport: { width: 1280, height: 720 }, dsf: 1.5, out: [1920, 1080] },
  doc: { viewport: { width: 432, height: 768 }, dsf: 2.5, out: [1080, 1920] },
};

// ── Giả lập máy chủ ────────────────────────────────────────────────────────
const QUICK_TEXT =
  "Chị Mai Anh, SĐT 0938 556 172\n" +
  "Chốt gói combo chụp + quay 13tr5, thêm phóng sự x1 bên nhà trai\n" +
  "Cưới 20/12 từ 6h đến 14h tại White Palace Phạm Văn Đồng\n" +
  "Anh Quân đi chụp. Cọc 3tr trước 30/10";

const QUICK_DRAFT = {
  clientName: "Mai Anh",
  clientPhone: "0938556172",
  serviceId: "sv-cuoi",
  mainPkgId: "g3",
  mainPrice: 13_500_000,
  extraIds: ["g1"],
  eventDate: "2026-12-20",
  startTime: "06:00",
  endTime: "14:00",
  location: "White Palace Phạm Văn Đồng",
  crewIds: ["sc1"],
  deposit: 3_000_000,
  depositDue: "2026-10-30",
  title: "Cưới Mai Anh — combo chụp + quay",
};

async function mockNetwork(page) {
  const db = { contract_items: [], studio_events: [] };
  let seq = 1;
  const json = (route, status, body) =>
    route.fulfill({ status, contentType: "application/json", body: body === undefined ? "" : JSON.stringify(body) });

  // Supabase (bản dev không cấu hình → client trỏ tới placeholder.supabase.co).
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = url.pathname.match(/\/rest\/v1\/([a-z_]+)/);
    if (!m) return json(route, 200, {});
    const table = m[1];
    const single = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    const method = req.method();
    if (method === "POST") {
      let rows = req.postDataJSON();
      rows = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `mock-${seq++}`, created_at: new Date().toISOString(), ...r }));
      (db[table] ||= []).push(...rows);
      return json(route, 201, single ? rows[0] : rows);
    }
    if (method === "DELETE") {
      if (table === "contract_items") db.contract_items = [];
      return json(route, 204);
    }
    if (method === "PATCH") return json(route, 204);
    const rows = db[table] || [];
    return json(route, 200, single ? rows[0] ?? null : rows);
  });

  await page.route("**/api/studio/contract-quick", async (route) => {
    await new Promise((r) => setTimeout(r, 1400)); // cho thấy nút "đang phân tích"
    json(route, 200, { draft: QUICK_DRAFT, source: "ai" });
  });
  await page.route("**/api/gcal/sync", (route) => json(route, 200, { synced: false, reason: "chưa kết nối Google Lịch" }));

  // Phụ lục: giữ danh sách trong bộ nhớ, trả đúng dạng route thật trả.
  const addenda = [];
  await page.route("**/api/studio/contracts/*/addenda", async (route) => {
    const b = route.request().postDataJSON();
    await new Promise((r) => setTimeout(r, 500));
    if (b.action === "create") {
      addenda.push({ id: `ad${addenda.length + 1}`, contract_id: "demo", no: addenda.length + 1, title: b.title, note: b.note || null,
        lines: b.lines.filter((l) => l.name), signed_at: null, signed_by: null, signed_name: null, created_at: new Date().toISOString() });
    } else if (b.action === "confirm") {
      const a = addenda.find((x) => x.id === b.addendumId);
      if (a) Object.assign(a, { signed_at: new Date().toISOString(), signed_by: "studio", signed_name: b.name });
    }
    const addendumItems = addenda.filter((a) => a.signed_at).flatMap((a, ai) =>
      a.lines.map((l, i) => ({ id: `ai${ai}-${i}`, contract_id: "demo", name: l.name, description: l.description, qty: l.qty,
        unit_price: l.unit_price, position: 100 + i, addendum_id: a.id, created_at: "" })));
    json(route, 200, { addenda, addendumItems });
  });
}

// ── Lớp phủ: con trỏ, phụ đề, thẻ tiêu đề, danh sách đổ xuống giả ────────────
const OVERLAY = String.raw`(() => {
  if (window.__ov) return;
  const css = document.createElement("style");
  css.textContent = ${"`"}
    nextjs-portal{display:none!important}
    #__ov *{box-sizing:border-box;font-family:'Be Vietnam Pro','Manrope',system-ui,sans-serif}
    #__ov{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
    #__ov .cur{position:absolute;left:0;top:0;width:26px;height:30px;transition:transform .08s;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))}
    #__ov .rip{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #1f9d63;animation:rip .55s ease-out forwards}
    @keyframes rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.5);opacity:0}}
    #__ov .cap{position:absolute;left:50%;transform:translate(-50%,16px);opacity:0;transition:opacity .35s,transform .35s;
      background:rgba(12,20,28,.88);color:#fff;border-radius:16px;padding:14px 22px 14px 14px;display:flex;align-items:center;gap:14px;
      box-shadow:0 18px 40px rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.12)}
    #__ov .cap.on{opacity:1;transform:translate(-50%,0)}
    #__ov .cap .no{flex:none;width:44px;height:44px;border-radius:12px;background:#1f9d63;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px}
    #__ov .cap .t{font-weight:800;letter-spacing:-.01em;line-height:1.2}
    #__ov .cap .s{color:rgba(255,255,255,.75);margin-top:3px;line-height:1.35}
    #__ov .card{position:absolute;inset:0;background:linear-gradient(140deg,#0b1f17,#14402f);color:#fff;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;opacity:0;transition:opacity .45s;padding:0 7%}
    #__ov .card.on{opacity:1}
    #__ov .card .k{color:#7fe0b0;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
    #__ov .card .h{font-weight:800;letter-spacing:-.03em;line-height:1.1;margin-top:14px}
    #__ov .card .p{color:rgba(255,255,255,.75);margin-top:16px;line-height:1.45}
    #__ov .card ul{list-style:none;padding:0;margin:26px 0 0;display:flex;flex-direction:column;gap:12px;text-align:left}
    #__ov .card li{display:flex;gap:12px;align-items:center;font-weight:600}
    #__ov .card li b{flex:none;width:34px;height:34px;border-radius:10px;background:#1f9d63;display:flex;align-items:center;justify-content:center}
    #__ov .card .brand{position:absolute;bottom:6%;font-weight:800;letter-spacing:-.02em;color:rgba(255,255,255,.9)}
    #__ov .dd{position:absolute;background:#fff;border:1px solid #d9dde3;border-radius:12px;box-shadow:0 18px 40px rgba(0,0,0,.18);overflow:hidden;
      opacity:0;transform:translateY(-6px);transition:opacity .2s,transform .2s;font-size:14px;color:#14171c}
    #__ov .dd.on{opacity:1;transform:none}
    #__ov .dd .g{padding:7px 14px 3px;font-size:11px;font-weight:700;color:#8a9099;text-transform:uppercase;letter-spacing:.06em}
    #__ov .dd .o{padding:8px 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #__ov .dd .o.hi{background:#1f9d63;color:#fff}
  ${"`"};
  document.head.appendChild(css);
  const root = document.createElement("div");
  root.id = "__ov";
  root.innerHTML = '<div class="card"></div><div class="cap"><div class="no"></div><div><div class="t"></div><div class="s"></div></div></div><div class="dd"></div>' +
    '<svg class="cur" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12.2 17 L20 17 Z" fill="#fff" stroke="#14171c" stroke-width="2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const cur = $(".cur");
  let cx = -60, cy = -60;
  const place = () => (cur.style.transform = "translate(" + cx + "px," + cy + "px)");
  place();
  const W = () => window.innerWidth;
  const portrait = () => window.innerHeight > window.innerWidth;
  window.__ov = {
    pos: () => [cx, cy],
    set(x, y) { cx = x; cy = y; place(); },
    press(on) { cur.style.transform = "translate(" + cx + "px," + cy + "px) scale(" + (on ? 0.86 : 1) + ")"; },
    ripple() {
      const r = document.createElement("div");
      r.className = "rip"; r.style.left = cx + 4 + "px"; r.style.top = cy + 4 + "px";
      root.appendChild(r); setTimeout(() => r.remove(), 600);
    },
    caption(no, t, s) {
      const c = $(".cap");
      if (!t) { c.classList.remove("on"); return; }
      const P = portrait();
      c.style.bottom = P ? "18px" : "22px";
      c.style.width = P ? (W() - 24) + "px" : "auto";
      c.style.maxWidth = P ? "none" : "82%";
      $(".cap .no").textContent = no; $(".cap .no").style.display = no ? "flex" : "none";
      $(".cap .t").textContent = t; $(".cap .t").style.fontSize = (P ? 17 : 22) + "px";
      $(".cap .s").textContent = s || ""; $(".cap .s").style.fontSize = (P ? 12.5 : 14.5) + "px";
      $(".cap .s").style.display = s ? "block" : "none";
      c.classList.remove("on"); void c.offsetWidth; c.classList.add("on");
    },
    card(html) {
      const c = $(".card");
      // Con trỏ không được nằm đè lên thẻ tiêu đề.
      cur.style.opacity = html ? "0" : "1";
      if (!html) { c.classList.remove("on"); return; }
      const P = portrait();
      c.innerHTML = html;
      c.querySelectorAll(".k").forEach((e) => (e.style.fontSize = (P ? 13 : 15) + "px"));
      c.querySelectorAll(".h").forEach((e) => (e.style.fontSize = (P ? 34 : 58) + "px"));
      c.querySelectorAll(".p").forEach((e) => (e.style.fontSize = (P ? 16 : 21) + "px"));
      c.querySelectorAll("li").forEach((e) => (e.style.fontSize = (P ? 16 : 20) + "px"));
      c.querySelectorAll(".brand").forEach((e) => (e.style.fontSize = (P ? 20 : 24) + "px"));
      c.classList.add("on");
    },
    cardInstant(html) { const c = $(".card"); c.style.transition = "none"; this.card(html); void c.offsetWidth; c.style.transition = ""; },
    dropdown(rect, groups, hi) {
      const d = $(".dd");
      if (!rect) { d.classList.remove("on"); return; }
      let k = 0, h = "";
      for (const g of groups) {
        if (g.label) h += '<div class="g">' + g.label + "</div>";
        for (const o of g.options) h += '<div class="o' + (k++ === hi ? " hi" : "") + '">' + o + "</div>";
      }
      d.innerHTML = h;
      d.style.left = rect.x + "px"; d.style.top = rect.y + rect.height + 4 + "px"; d.style.width = rect.width + "px";
      d.classList.add("on");
    },
  };
})()`;

// ── Máy quay ───────────────────────────────────────────────────────────────
async function startRecorder(page, fmt, dir) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let paused = false;
  let offset = 0;
  let pausedAt = 0;
  const now = () => Date.now() / 1000;
  cdp.on("Page.screencastFrame", async (f) => {
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    if (paused) return;
    const t = (f.metadata.timestamp ?? now()) - offset;
    const file = join(dir, `f${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, t });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: fmt.out[0], maxHeight: fmt.out[1], everyNthFrame: 1 });
  return {
    pause() { paused = true; pausedAt = now(); },
    resume() { offset += now() - pausedAt; paused = false; },
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => {});
      // Màn hình đứng yên thì screencast không gửi khung mới — khung cuối phải
      // kéo tới đúng lúc dừng quay, không thì thẻ kết thúc chỉ lóe lên 1 giây.
      return { frames, end: now() - offset };
    },
  };
}

async function encode({ frames, end }, out, [w, h]) {
  const list = join(frames[0].file, "..", "list.txt");
  let txt = "";
  for (let i = 0; i < frames.length; i++) {
    const d = Math.max(0.001, (i < frames.length - 1 ? frames[i + 1].t : end) - frames[i].t);
    txt += `file '${frames[i].file}'\nduration ${d.toFixed(4)}\n`;
  }
  txt += `file '${frames[frames.length - 1].file}'\n`;
  writeFileSync(list, txt);
  await new Promise((res, rej) => {
    const ff = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0xf3f2ef,fps=30,format=yuv420p`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", out], { stdio: "inherit" });
    ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg thoát mã ${c}`))));
  });
}

// ── Diễn viên: con trỏ, bấm, gõ, cuộn ──────────────────────────────────────
function actor(page) {
  const wait = (ms) => page.waitForTimeout(ms);
  const ov = (fn, ...a) => page.evaluate(([fn, a]) => window.__ov[fn](...a), [fn, a]);

  async function ensureOverlay() {
    await page.evaluate(OVERLAY);
  }

  /** Cuộn mượt để phần tử nằm trong khung (chừa chỗ cho phụ đề ở đáy). */
  async function reveal(loc, where = 0.38) {
    const box = await loc.boundingBox();
    if (!box) throw new Error("không thấy phần tử để cuộn tới");
    const vh = page.viewportSize().height;
    const topSafe = vh * 0.12;
    const botSafe = vh * 0.72;
    if (box.y >= topSafe && box.y + box.height <= botSafe) return;
    const delta = box.y - vh * where;
    await smoothScroll(delta);
  }

  async function smoothScroll(delta, ms = 700) {
    const steps = Math.max(8, Math.round(ms / 16));
    const start = await page.evaluate(() => window.scrollY);
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      await page.evaluate((y) => window.scrollTo(0, y), start + delta * e);
      await wait(16);
    }
    await wait(150);
  }

  async function moveTo(loc, { dx = 0.5, dy = 0.5, ms = 650 } = {}) {
    await reveal(loc);
    const box = await loc.boundingBox();
    const tx = box.x + box.width * dx;
    const ty = box.y + box.height * dy;
    const [sx, sy] = await page.evaluate(() => window.__ov.pos());
    const fx = sx < 0 ? tx + 120 : sx;
    const fy = sy < 0 ? ty + 160 : sy;
    const steps = Math.max(10, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const x = fx + (tx - fx) * e;
      const y = fy + (ty - fy) * e;
      await page.evaluate(([x, y]) => window.__ov.set(x, y), [x, y]);
      if (i % 3 === 0 || i === steps) await page.mouse.move(x, y);
      await wait(16);
    }
    return { x: tx, y: ty };
  }

  async function click(loc, opts = {}) {
    const { x, y } = await moveTo(loc, opts);
    await wait(120);
    await ov("press", true);
    await ov("ripple");
    await page.mouse.click(x, y);
    await wait(90);
    await ov("press", false);
    await wait(opts.after ?? 350);
  }

  async function type(loc, text, { delay = 55, clear = false } = {}) {
    await click(loc, { after: 150 });
    if (clear) {
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      await wait(120);
    }
    await page.keyboard.type(text, { delay });
    await wait(300);
  }

  /** Mở ô chọn: vẽ danh sách giả (ô chọn gốc của hệ điều hành không lên hình). */
  async function pickFromSelect(loc, value, label) {
    await click(loc, { after: 200 });
    const info = await loc.evaluate((sel, value) => {
      const r = sel.getBoundingClientRect();
      const groups = [];
      let hi = -1, k = 0;
      for (const node of sel.children) {
        const opts = node.tagName === "OPTGROUP" ? [...node.children] : [node];
        const g = { label: node.tagName === "OPTGROUP" ? node.label : "", options: [] };
        for (const o of opts) {
          if (!o.value) continue;
          if (o.value === value) hi = k;
          g.options.push(o.textContent);
          k++;
        }
        if (g.options.length) groups.push(g);
      }
      return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, groups, hi };
    }, value);
    for (let i = 0; i <= info.hi; i++) {
      await ov("dropdown", info.rect, info.groups, i);
      await wait(i === 0 ? 700 : 170);
    }
    await wait(450);
    await ov("dropdown", null);
    await loc.selectOption(value);
    await wait(500);
    void label;
  }

  return {
    wait, ov, ensureOverlay, reveal, smoothScroll, moveTo, click, type, pickFromSelect,
    caption: (no, t, s) => ov("caption", no, t, s),
    card: (html) => ov("card", html),
    cardInstant: (html) => ov("cardInstant", html),
  };
}

const CARD = {
  intro: `<div class="k">mstudo · Quản lý studio</div><div class="h">Hợp đồng<br/>làm trong 1 phút</div>
    <ul><li><b>1</b>Tạo hợp đồng tự động bằng AI</li><li><b>2</b>Chỉnh sửa, thêm bớt hạng mục</li><li><b>3</b>Phụ lục sau khi khách ký</li></ul>`,
  s1: `<div class="k">Phần 1</div><div class="h">Tạo hợp đồng<br/>tự động</div><div class="p">Dán tin nhắn chốt với khách — AI điền sẵn cả 6 bước.</div>`,
  s2: `<div class="k">Phần 2</div><div class="h">Chỉnh sửa<br/>hạng mục</div><div class="p">Chọn từ bảng giá, chia chính / phụ, gắn mốc lịch, thêm bớt tuỳ ý.</div>`,
  s3: `<div class="k">Phần 3</div><div class="h">Phụ lục<br/>hợp đồng</div><div class="p">Khách đã ký thì bảng giá khoá — thêm bớt dịch vụ bằng phụ lục.</div>`,
  outro: `<div class="k">mstudo</div><div class="h">Hợp đồng gọn gàng<br/>khách ký online</div>
    <div class="p">Tạo nhanh bằng AI · Hạng mục linh hoạt · Phụ lục minh bạch</div><div class="brand">mstudo.com</div>`,
};

// ── Kịch bản ───────────────────────────────────────────────────────────────
async function record(name, fmt) {
  const tmp = join(outDir, `.frames-${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const portrait = fmt.viewport.height > fmt.viewport.width;

  const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
  const ctx = await browser.newContext({ viewport: fmt.viewport, deviceScaleFactor: fmt.dsf, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await mockNetwork(page);
  const A = actor(page);

  /** Mở màn uipreview, ẩn thanh công cụ dev, gắn lớp phủ. */
  async function open(screen) {
    await page.goto(`${base}/uipreview/${screen}`, { waitUntil: "networkidle", timeout: 180_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const bar = [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Tất cả màn"))?.parentElement;
      if (bar) bar.style.display = "none";
    });
    await A.ensureOverlay();
    await page.waitForTimeout(400);
  }

  // Làm nóng: lần đầu dev server biên dịch mất vài chục giây — không quay đoạn đó.
  for (const s of ["hop-dong-moi", "video-hop-dong-hang-muc", "video-hop-dong-phu-luc"]) await open(s);

  await open("hop-dong-moi");
  await A.cardInstant(CARD.intro);
  const rec = await startRecorder(page, fmt, tmp);
  await A.wait(3800);

  // ── PHẦN 1: tạo hợp đồng tự động ─────────────────────────────────────────
  await A.card(CARD.s1);
  await A.wait(2600);
  await A.card(null);
  await A.wait(600);
  const box = page.locator("textarea").first();
  await A.caption("1", "Dán tin nhắn chốt với khách", "Tên, SĐT, gói, ngày giờ, địa điểm, tiền cọc… viết tự nhiên là được");
  await A.type(box, QUICK_TEXT, { delay: portrait ? 22 : 26 });
  await A.wait(700);
  await A.caption("1", "Các mục nhận ra được tự đánh dấu ✓", "Nhìn là biết còn thiếu thông tin gì");
  await A.moveTo(page.getByText("Tên khách", { exact: false }).first(), { ms: 800 });
  await A.wait(1600);
  await A.caption("1", "Bấm “Phân tích & điền hợp đồng”", "AI đọc tin nhắn và điền sẵn cả 6 bước");
  await A.click(page.getByRole("button", { name: /Phân tích/ }), { after: 2200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await A.caption("1", "Hợp đồng đã điền sẵn — chỉ cần soát lại", "Khách, gói dịch vụ, lịch chụp, nhân sự, các đợt thanh toán");
  await A.wait(1800);
  const vh = fmt.viewport.height;
  for (let i = 0; i < 4; i++) {
    await A.smoothScroll(vh * 0.55, 1100);
    await A.wait(900);
  }
  await A.caption("1", "Bấm vào dòng bất kỳ để sửa, xong bấm “Tạo & gửi khách ký”", "Khách ký online ngay trên điện thoại");
  await A.moveTo(page.getByRole("button", { name: /Tạo & gửi khách ký/ }).filter({ visible: true }).first(), { ms: 900 });
  await A.wait(2600);
  await A.caption(null);
  await A.card(CARD.s2);
  await A.wait(700);

  // ── PHẦN 2: chỉnh sửa hạng mục ───────────────────────────────────────────
  rec.pause();
  await open("video-hop-dong-hang-muc");
  await A.cardInstant(CARD.s2);
  rec.resume();
  await A.wait(2200);
  await A.card(null);
  await A.wait(600);

  const sel = page.getByLabel("Chọn hạng mục");
  await A.caption("2", "Chọn hạng mục từ danh sách đổ xuống", "Lấy thẳng từ bảng giá của studio — không phải gõ lại");
  await A.pickFromSelect(sel, "pl:0");
  await A.wait(600);
  // Dòng vừa thêm là dòng cuối cùng (chưa có giảm giá).
  const rows = page.locator('input[placeholder="VD: Chụp phóng sự cả ngày"]');
  const newRow = rows.last();
  await A.reveal(newRow, 0.3);
  await A.caption("2", "Hạng mục mới tự vào nhóm “phụ”", "Mỗi hợp đồng có một hạng mục chính, còn lại là phụ");
  await A.wait(1600);
  await A.caption("2", "Đánh dấu hạng mục chính / phụ", "Bấm một cái là đổi");
  await A.click(page.getByRole("radio", { name: "Hạng mục phụ" }).nth(2), { after: 900 });

  await A.caption("2", "Tick “Thêm vào mốc lịch” rồi chọn ngày", "Hạng mục tự thành một mốc trên lịch studio và lịch thợ");
  await A.click(page.getByRole("checkbox", { name: /Thêm vào mốc lịch/ }).nth(3), { after: 500 });
  const dateBox = newRow.locator("xpath=ancestor::div[contains(@class,'grid-cols-12')][1]").locator('input[placeholder="dd/mm/yyyy"]');
  await A.type(dateBox, "18/12/2026", { delay: 90 });
  await A.wait(1500);

  // Mốc vừa tạo nằm trong thẻ "Lịch & mốc thời gian" — cuộn xuống xem, rồi sửa tên.
  const msCard = page.getByText("Lịch & mốc thời gian").first();
  await A.caption("2", "Mốc lịch đã có — tên lấy theo hạng mục", "Hiện luôn trên Lịch, Google Calendar và cổng khách");
  await A.reveal(msCard, 0.12);
  await A.wait(1800);
  await A.caption("2", "Nút sửa tên mốc thời gian", "Đổi tên, ngày, giờ ngay tại chỗ — lịch thợ đổi theo");
  const pencils = page.getByRole("button", { name: "Sửa tên mốc" });
  await A.click(pencils.last(), { after: 500 });
  await A.type(page.getByPlaceholder("Tên mốc", { exact: true }), "Đãi trước nhà gái", { clear: true, delay: 70 });
  await A.click(page.getByRole("button", { name: "Lưu", exact: true }), { after: 1800 });

  // Thêm / bớt / sửa số lượng.
  await A.caption("2", "Thêm, bớt, sửa số lượng và giá", "Tổng hợp đồng tự cộng lại");
  const qty = page.locator('input[type="number"]').nth(2);
  await A.type(qty, "3", { clear: true, delay: 100 });
  await A.wait(500);
  await A.click(page.getByRole("button", { name: /Thêm giảm giá/ }).first(), { after: 500 });
  const disc = page.locator('input[placeholder="Tên khoản giảm giá"]').last();
  await A.type(disc, " khách quen", { delay: 55 });
  const discPrice = disc.locator("xpath=ancestor::div[contains(@class,'grid-cols-12')][1]").locator("input").nth(1);
  await A.type(discPrice, "1000000", { clear: true, delay: 70 });
  await A.wait(500);
  await A.caption("2", "Bỏ hạng mục khách không lấy", "Bấm thùng rác ở cuối dòng");
  await A.click(page.getByRole("button", { name: "Xoá" }).nth(1), { after: 900 });
  await A.caption("2", "Bấm “Lưu hạng mục” là xong", "");
  await A.click(page.getByRole("button", { name: "Lưu hạng mục" }), { after: 2200 });
  await A.caption(null);
  await A.card(CARD.s3);
  await A.wait(700);

  // ── PHẦN 3: phụ lục ──────────────────────────────────────────────────────
  rec.pause();
  await open("video-hop-dong-phu-luc");
  await A.cardInstant(CARD.s3);
  rec.resume();
  await A.wait(2200);
  await A.card(null);
  await A.wait(500);
  await A.caption("3", "Khách đã ký — bảng giá gốc tự khoá", "Không ai sửa lén được giá đã thoả thuận");
  await A.moveTo(page.getByTestId("items-locked"), { ms: 800 });
  await A.wait(2200);
  await A.caption("3", "Thêm / bớt dịch vụ bằng phụ lục", "");
  await A.click(page.getByRole("button", { name: /Tạo phụ lục/ }).first(), { after: 500 });
  await A.type(page.getByPlaceholder(/Tiêu đề \(vd/), "Thêm quay phim & flycam", { delay: 45 });
  const addBox = page.getByTestId("contract-addenda");
  await A.type(addBox.getByPlaceholder("Tên dịch vụ").first(), "Quay phim highlight 5 phút", { delay: 40 });
  await A.type(addBox.locator("input[inputmode], input.text-right").first(), "6000000", { clear: true, delay: 60 });
  await A.click(addBox.getByRole("button", { name: /Thêm dòng/ }), { after: 400 });
  await A.type(addBox.getByPlaceholder("Tên dịch vụ").last(), "Flycam quay toàn cảnh", { delay: 40 });
  await A.type(addBox.locator("input.text-right").nth(1), "2500000", { clear: true, delay: 60 });
  await A.click(addBox.getByRole("button", { name: /Thêm giảm giá/ }), { after: 400 });
  await A.type(addBox.locator("input.text-right").nth(2), "500000", { clear: true, delay: 60 });
  await A.caption("3", "Tổng phụ lục tự tính — cộng, trừ rõ ràng", "");
  await A.moveTo(addBox.getByText("Tổng phụ lục"), { ms: 700 });
  await A.wait(1400);
  await A.click(addBox.getByRole("button", { name: "Tạo phụ lục" }).last(), { after: 1400 });
  await A.caption("3", "Khách ký phụ lục ngay trên trang hợp đồng", "Hoặc studio “Xác nhận thay khách” khi đã chốt qua điện thoại / Zalo");
  await A.wait(2000);
  await A.click(addBox.getByRole("button", { name: /Xác nhận thay khách/ }), { after: 300 });
  await A.type(addBox.getByPlaceholder(/Tên người đồng ý/), "Mai Anh", { delay: 70 });
  await A.click(addBox.getByRole("button", { name: "Xác nhận", exact: true }), { after: 1400 });
  await A.caption("3", "Đã ký — phụ lục cộng thẳng vào tổng hợp đồng", "Lưu vết ai xác nhận, lúc nào");
  await A.reveal(page.getByText("Tổng giá trị hợp đồng").first(), 0.45);
  await A.wait(2800);
  await A.caption(null);

  await A.card(CARD.outro);
  await A.wait(4200);

  const shot = await rec.stop();
  await browser.close();
  const out = join(outDir, `hop-dong-${name}.mp4`);
  await encode(shot, out, fmt.out);
  rmSync(tmp, { recursive: true, force: true });
  const { frames } = shot;
  const secs = frames.length ? (shot.end - frames[0].t).toFixed(1) : "0";
  console.log(`Đã xuất ${out} · ${frames.length} khung · ~${secs}s`);
}

mkdirSync(outDir, { recursive: true });
for (const [name, fmt] of Object.entries(FORMATS)) {
  if (only && only !== name) continue;
  await record(name, fmt);
}
