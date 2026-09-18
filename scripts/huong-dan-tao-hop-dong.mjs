/**
 * HƯỚNG DẪN TẠO HỢP ĐỒNG — quay video + chụp bộ ảnh từ GIAO DIỆN THẬT.
 *
 * Vì sao làm thế này thay vì vẽ lại bằng tay: hướng dẫn vẽ tay chết ngay lần
 * đầu ai đó đổi một cái nút. Script này mở đúng component `NewContractForm`
 * của app (qua màn xem trước /uipreview/tao-hop-dong, dữ liệu giả), rồi BẤM
 * qua đủ 5 bước như một người dùng thật — nên video và ảnh luôn khớp giao diện
 * đang chạy. Sửa form thì chạy lại script một lần là có bộ hướng dẫn mới.
 *
 * Cách dùng:
 *   npx next dev -p 3333                    # cửa sổ 1
 *   npm run huong-dan:hop-dong              # cửa sổ 2
 *
 * Kết quả (ghi đè mỗi lần chạy) vào public/huong-dan/tao-hop-dong/:
 *   huong-dan-tao-hop-dong.mp4    video liền mạch, có con trỏ giả + lời thuyết minh
 *                                 (thành .webm nếu máy không có ffmpeg — xem doiSangMp4)
 *   buoc-0…buoc-5.png             ảnh từng bước, có khung vàng chỉ vào chỗ cần bấm
 *
 * Trang /huong-dan/tao-hop-dong đọc đúng thư mục này, nên chạy script xong là
 * trang tự có bộ mới — không phải sửa gì trong mã trang.
 *
 * Cần `playwright` (devDependency) + một bản Chromium. Máy đã có sẵn trình
 * duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
// Nạp thẳng file .ts (`node --experimental-strip-types`, xem package.json).
// Đường dẫn tương đối + đuôi .ts: node không hiểu alias `@/` của tsconfig.
import { chiaDam, HUONG_DAN_TAO_HOP_DONG } from "../src/lib/huong-dan-hop-dong.ts";

/* `localhost`, KHÔNG phải `127.0.0.1`: `next dev` coi 127.0.0.1 là nguồn khác
   và chặn tài nguyên dev (allowedDevOrigins), nên trang vẫn hiện đủ HTML nhưng
   KHÔNG hydrate — mọi cú bấm rơi vào hư không và script chạy tới nút "Chọn gói"
   thì đứng vì nút còn mờ. Ảnh chụp tĩnh (scripts/chup-giao-dien.mjs) không cần
   hydrate nên không dính lỗi này; script ở đây thì cần. */
const URL_BASE = process.env.PREVIEW_URL || "http://localhost:3333";
const MAN = `${URL_BASE}/uipreview/tao-hop-dong`;
const EXEC = process.env.CHROME_PATH || undefined;
const OUT = process.env.OUT_DIR || "public/huong-dan/tao-hop-dong";
const KHO_MAN = { width: 1280, height: 880 };

/** Ngày trong ví dụ: luôn ở TƯƠNG LAI (ô ngày của app chặn ngày quá khứ), nên
 *  tính theo lúc chạy chứ không ghi cứng — ghi cứng thì sang năm chạy lại là ô
 *  ngày trả về rỗng và cả bước 3 trống trơn mà không ai biết vì sao. */
function ngaySau(soNgay) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  const p = (n) => String(n).padStart(2, "0");
  // Chỉ chữ số: ô ngày tự chèn dấu "/" khi gõ, gõ sẵn dấu vào là thành "01//11".
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}`;
}
const NGAY_CHUP = ngaySau(45);
// Hai đợt thu phải có HAI hạn khác nhau: bài học của bước 4 là "mỗi đợt một hạn
// riêng", mà ví dụ điền cùng một ngày cho cả hai thì nói ngược lại.
const HAN_COC = ngaySau(7);
const HAN_CUOI = NGAY_CHUP;

/* ── Lớp phủ hướng dẫn ───────────────────────────────────────────────────────
   Nạp vào trang trước khi trang chạy, để mọi cảnh đều gọi được. Ba thứ:
     • khung vàng (`soi`) quây quanh phần tử đang nói tới,
     • biển đầu trang (`bien`) cho ẢNH — nằm trong luồng nên ảnh full-page có nó,
     • thanh thuyết minh đáy màn (`loi`) cho VIDEO — cố định nên luôn đọc được,
     • con trỏ giả (`troChuot`) vì video của Playwright KHÔNG quay con trỏ thật. */
const LOP_PHU = () => {
  const NS = "http://www.w3.org/2000/svg";
  const css = `
    #hd-bien, #hd-loi, #hd-tro { font-family: inherit; }
    .hd-khung { position: absolute; border-radius: 14px; pointer-events: none; z-index: 2147483000;
      box-shadow: 0 0 0 3px #f0b21b, 0 0 0 9px rgba(240,178,27,.28); }
    .hd-so { position: absolute; z-index: 2147483001; display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 999px; background: #f0b21b; color: #1b1400;
      font-size: 13px; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,.28); }
    #hd-bien { background: #16161a; color: #f6f5f2; padding: 20px 26px 22px; }
    #hd-bien .hd-tag { display: inline-block; background: #f0b21b; color: #1b1400; font-size: 12px;
      font-weight: 800; letter-spacing: .6px; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; }
    #hd-bien h2 { margin: 10px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -.4px; }
    #hd-bien ol { margin: 10px 0 0; padding-left: 20px; }
    #hd-bien li { font-size: 14.5px; line-height: 1.65; color: rgba(246,245,242,.82); }
    #hd-bien li b { color: #f0b21b; font-weight: 700; }
    #hd-loi { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483002;
      background: linear-gradient(to top, rgba(10,10,12,.97), rgba(10,10,12,.88));
      color: #f6f5f2; padding: 14px 26px 16px; display: flex; align-items: center; gap: 14px; }
    #hd-loi .hd-tag { flex: none; background: #f0b21b; color: #1b1400; font-size: 12px; font-weight: 800;
      padding: 5px 11px; border-radius: 999px; white-space: nowrap; }
    #hd-loi p { margin: 0; font-size: 16px; line-height: 1.45; font-weight: 600; }
    #hd-tro { position: fixed; z-index: 2147483003; width: 22px; height: 22px; margin: -3px 0 0 -3px;
      pointer-events: none; transition: left .38s cubic-bezier(.4,0,.2,1), top .38s cubic-bezier(.4,0,.2,1);
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); opacity: 0; }
    #hd-tro.hien { opacity: 1; }
    #hd-tro.bam { transform: scale(.82); }
  `;
  /* Script này chạy TRƯỚC mọi script của trang, lúc đó `document.documentElement`
     có thể chưa tồn tại — đụng vào là cả khối ném lỗi và `window.__hd` không bao
     giờ được gán (chỉ lộ ra ở cảnh đầu tiên, dưới dạng "__hd is undefined").
     Nên chèn thẻ <style> lúc dùng lần đầu, không phải lúc nạp. */
  let daCss = false;
  function capCss() {
    if (daCss || !document.head) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    daCss = true;
  }

  const khungs = [];

  function xoaKhung() {
    for (const k of khungs.splice(0)) k.remove();
  }

  /* Tìm phần tử để quây khung. Trong trang chỉ có CSS thuần — `:has-text()` là
     cú pháp riêng của Playwright và ném lỗi ở đây — nên thêm tiền tố "nut:" để
     tìm NÚT theo chữ trên nút. Bỏ nút đang ẩn: thanh hành động được dựng hai
     bản (máy tính / điện thoại) và bản kia lúc nào cũng có một cái trùng tên. */
  function tim(chon) {
    if (!chon.startsWith("nut:")) return document.querySelector(chon);
    const chu = chon.slice(4);
    return [...document.querySelectorAll("button")].find((b) => b.textContent.includes(chu) && b.offsetParent) || null;
  }

  window.__hd = {
    /** Ô nhập/nút đang được nói tới — khung vàng + số thứ tự. */
    soi(danhSach) {
      capCss();
      xoaKhung();
      danhSach.forEach(([chon, so], i) => {
        const el = tim(chon);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        const k = document.createElement("div");
        k.className = "hd-khung";
        k.style.left = `${r.left + scrollX - 5}px`;
        k.style.top = `${r.top + scrollY - 5}px`;
        k.style.width = `${r.width + 10}px`;
        k.style.height = `${r.height + 10}px`;
        document.body.appendChild(k);
        khungs.push(k);
        const n = document.createElement("div");
        n.className = "hd-so";
        n.textContent = String(so ?? i + 1);
        n.style.left = `${r.left + scrollX - 18}px`;
        n.style.top = `${r.top + scrollY - 14}px`;
        document.body.appendChild(n);
        khungs.push(n);
      });
    },
    xoaKhung,
    /** Biển đầu trang — chỉ dùng cho ảnh tĩnh. */
    bien(tag, tieuDe, y) {
      capCss();
      document.getElementById("hd-bien")?.remove();
      const b = document.createElement("div");
      b.id = "hd-bien";
      b.innerHTML =
        `<span class="hd-tag">${tag}</span><h2>${tieuDe}</h2>` +
        (y?.length ? `<ol>${y.map((t) => `<li>${t}</li>`).join("")}</ol>` : "");
      document.body.insertBefore(b, document.body.firstChild);
    },
    xoaBien() {
      document.getElementById("hd-bien")?.remove();
    },
    /** Thanh thuyết minh đáy màn — chỉ dùng cho video. */
    loi(tag, chu) {
      capCss();
      let t = document.getElementById("hd-loi");
      if (!t) {
        t = document.createElement("div");
        t.id = "hd-loi";
        document.body.appendChild(t);
      }
      t.innerHTML = `<span class="hd-tag">${tag}</span><p>${chu}</p>`;
    },
    xoaLoi() {
      document.getElementById("hd-loi")?.remove();
    },
    /** Con trỏ giả: video của Playwright không có con trỏ thật nào để quay. */
    troChuot(x, y, bam) {
      capCss();
      let c = document.getElementById("hd-tro");
      if (!c) {
        c = document.createElementNS(NS, "svg");
        c.id = "hd-tro";
        c.setAttribute("viewBox", "0 0 24 24");
        c.innerHTML =
          '<path d="M5 2.5 L5 19 L9.2 15.2 L11.8 21 L14.6 19.8 L12 14.2 L18 14.2 Z" fill="#fff" stroke="#16161a" stroke-width="1.4" stroke-linejoin="round"/>';
        document.body.appendChild(c);
      }
      c.classList.add("hien");
      c.classList.toggle("bam", !!bam);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    },
    anTro() {
      document.getElementById("hd-tro")?.classList.remove("hien");
    },
  };
};

/* ── Tiện ích điều khiển trang ───────────────────────────────────────────── */

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kéo phần tử vào giữa màn rồi đưa con trỏ giả tới đó. */
async function nhamToi(page, chon, { cham }) {
  const o = page.locator(chon).first();
  await o.scrollIntoViewIfNeeded();
  if (cham) await cho(260);
  const box = await o.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(([x, y]) => window.__hd.troChuot(x, y, false), [x, y]);
    await page.mouse.move(x, y);
    if (cham) await cho(420);
  }
  return o;
}

/** Bấm: con trỏ giả nhấn xuống một nhịp cho người xem thấy cú bấm. */
async function bam(page, chon, opt = {}) {
  const o = await nhamToi(page, chon, opt);
  if (opt.cham) {
    await page.evaluate(() => {
      const c = document.getElementById("hd-tro");
      if (c) c.classList.add("bam");
    });
    await cho(180);
  }
  await o.click();
  await page.evaluate(() => document.getElementById("hd-tro")?.classList.remove("bam"));
  if (opt.cham) await cho(330);
  return o;
}

/** Gõ từng ký tự khi quay video (nhìn ra là đang gõ), điền thẳng khi chụp ảnh. */
async function go(page, chon, chu, opt = {}) {
  const o = await nhamToi(page, chon, opt);
  await o.click();
  // XOÁ TRƯỚC, kể cả khi quay video. Vài ô đã có sẵn số (giá gói lấy từ bảng
  // giá, tiền cọc app chia sẵn) — gõ đè lên mà không xoá thì hai số dính vào
  // nhau: 13.500.000 + "12500000" ra "1.350.100.000" ngay giữa video, và không
  // ai phát hiện cho tới lúc xem lại bản đã quay xong.
  await o.fill("");
  if (opt.cham) {
    await o.pressSequentially(chu, { delay: 55 });
    await cho(260);
  } else {
    await o.pressSequentially(chu, { delay: 0 });
  }
  return o;
}

async function chon(page, chonCss, giaTri, opt = {}) {
  const o = await nhamToi(page, chonCss, opt);
  await o.selectOption(giaTri);
  if (opt.cham) await cho(420);
  return o;
}

/* ── Kịch bản: 6 cảnh = mở màn + 5 bước ──────────────────────────────────────
   Chữ (tiêu đề, các ý, lời thuyết minh) KHÔNG nằm ở đây mà ở
   src/lib/huong-dan-hop-dong.ts, dùng chung với trang /huong-dan/tao-hop-dong.
   Ở đây chỉ còn phần Playwright không chia sẻ được: bấm vào đâu (`soi`) và làm
   gì (`dien`). Ghép hai nửa theo khoá `ten`. */
const THAO_TAC = {
  "buoc-0-mo-man": {
    tiep: null,
    soi: () => [['[aria-current="step"]', 1]],
    async dien() {},
  },
  "buoc-1-khach-hang": {
    tiep: "Chọn gói",
    soi: () => [["#nc-name", 1], ["#nc-phone", 2], ['input[placeholder="Tìm theo tên hoặc số điện thoại…"]', 3]],
    async dien(page, o) {
      await bam(page, 'button:has-text("Nguyễn Thị Lan Phương")', o);
    },
  },
  "buoc-2-goi-dich-vu": {
    tiep: "Đặt lịch",
    soi: () => [["#nc-svc", 1], ["#nc-shoot", 2], ['[aria-label^="Giá gói"]', 3]],
    async dien(page, o) {
      await chon(page, "#nc-shoot", "wedding", o);
      await bam(page, 'button[aria-pressed]:has-text("Gói combo chụp + quay")', o);
      await go(page, '[aria-label="Giá gói Gói combo chụp + quay"]', "12500000", o);
      await bam(page, 'p:has-text("Hạng mục thêm") + div button:has-text("Album in 30x30")', o);
      await bam(page, 'button:has-text("Nhập gói riêng")', o);
      await go(page, '[aria-label="Tên gói riêng 1"]', "Chụp thêm buổi ở Đà Lạt", o);
      await go(page, '[aria-label="Đơn giá gói riêng 1"]', "4500000", o);
    },
  },
  "buoc-3-lich-nhan-su": {
    tiep: "Chia tiền",
    soi: () => [['input[placeholder="dd/mm/yyyy"]', 1], ['[aria-label="Giờ bắt đầu"]', 2], ["#nc-loc", 3]],
    async dien(page, o) {
      await go(page, 'input[placeholder="dd/mm/yyyy"]', NGAY_CHUP, o);
      await go(page, '[aria-label="Giờ bắt đầu"]', "0630", o);
      await go(page, '[aria-label="Giờ kết thúc"]', "1800", o);
      await go(page, "#nc-loc", "Nhà gái Q.7 → Nhà hàng Riverside", o);
      await bam(page, 'button:has-text("Trần Minh Quân")', o);
      await go(page, 'input[placeholder="Tiền công"] >> nth=0', "1500000", o);
      await bam(page, 'button:has-text("Vũ Đức Anh")', o);
      await go(page, 'input[placeholder="Tiền công"] >> nth=1', "1200000", o);
    },
  },
  "buoc-4-thanh-toan": {
    tiep: "Xem lại",
    // `soi` chạy bằng document.querySelector trong trang, nên chỉ nhận CSS
    // thuần — cú pháp `>> nth=` của Playwright ném lỗi ở đây. Không cần nth:
    // querySelector vốn đã lấy phần tử khớp ĐẦU TIÊN, tức đợt 1.
    soi: () => [['[aria-label="Tên đợt 1"]', 1], ['input[placeholder="Số tiền"]', 2], ['input[placeholder="dd/mm/yyyy"]', 3]],
    async dien(page, o) {
      await go(page, 'input[placeholder="Số tiền"] >> nth=0', "6000000", o);
      await go(page, 'input[placeholder="dd/mm/yyyy"] >> nth=0', HAN_COC, o);
      await go(page, 'input[placeholder="dd/mm/yyyy"] >> nth=1', HAN_CUOI, o);
    },
  },
  "buoc-5-kiem-tra": {
    tiep: null,
    soi: () => [["#nc-title", 1], ["nut:Tạo & gửi khách ký", 2]],
    async dien(page, o) {
      await go(page, "#nc-title", "Hợp đồng cưới Lan Phương — Riverside", o);
      // KHÔNG bấm nút tạo thật: màn xem trước chạy với Supabase giả, bấm vào là
      // ra thông báo lỗi đỏ ngay giữa ảnh hướng dẫn.
      await nhamToi(page, 'button:has-text("Tạo & gửi khách ký")', o);
    },
  },
};

/** Chữ đi vào innerHTML của lớp phủ, nên phải rào &, < trước khi đổi ** thành <b>. */
const rao = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const dam = (s) => chiaDam(s).map((p) => (p.dam ? `<b>${rao(p.chu)}</b>` : rao(p.chu))).join("");

const CANH = HUONG_DAN_TAO_HOP_DONG.map((b) => {
  const t = THAO_TAC[b.ten];
  if (!t) throw new Error(`Thiếu thao tác cho bước "${b.ten}" trong scripts/huong-dan-tao-hop-dong.mjs`);
  return { ...b, ...t, tieuDe: rao(b.tieuDe), tag: rao(b.tag), y: b.y.map(dam), loi: dam(b.loi) };
});

async function moMan(context) {
  const page = await context.newPage();
  await page.addInitScript(LOP_PHU);
  await page.goto(MAN, { waitUntil: "networkidle", timeout: 120_000 });
  await page.addStyleTag({
    content: [
      // Thanh 5 bước dính theo `--topbar-h` của khung studio; màn xem trước
      // không có thanh trên cùng nên biến rỗng → `top: var(--topbar-h)` hỏng và
      // thanh không dính. Cho nó số 0 để đúng như trong app.
      ".studio-shell { --topbar-h: 0px; }",
      // Nút tròn của Next DevTools nổi đè lên trang; ảnh full-page bắt trọn nó
      // thành một chấm đen vô nghĩa giữa hướng dẫn.
      "nextjs-portal { display: none !important; }",
    ].join("\n"),
  });
  // Dải "← Tất cả màn · dữ liệu giả · bản dev" là của route xem trước, KHÔNG có
  // trong app thật — để lại thì hướng dẫn chỉ vào một thanh mà người dùng sẽ
  // không bao giờ thấy.
  await page.evaluate(() => document.querySelector('a[href="/uipreview"]')?.parentElement?.remove());
  await page.waitForSelector("#nc-name");
  return page;
}

/* ── Lượt 1: bộ ẢNH từng bước ────────────────────────────────────────────── */
async function chupAnh(browser) {
  const context = await browser.newContext({ viewport: KHO_MAN, deviceScaleFactor: 2 });
  const page = await moMan(context);
  const loi = [];
  page.on("pageerror", (e) => loi.push(`lỗi JS: ${e.message}`));

  for (let i = 0; i < CANH.length; i++) {
    const c = CANH[i];
    await c.dien(page, { cham: false });
    await page.evaluate(() => window.scrollTo(0, 0));
    await cho(150);
    await page.evaluate(([tag, tieuDe, y]) => window.__hd.bien(tag, tieuDe, y), [c.tag, c.tieuDe, c.y]);
    await page.evaluate((ds) => window.__hd.soi(ds), c.soi());
    await page.evaluate(() => window.__hd.anTro());
    await cho(120);
    await page.screenshot({ path: path.join(OUT, `${c.ten}.png`), fullPage: true });
    console.log(`ảnh · ${c.ten}.png`);
    await page.evaluate(() => {
      window.__hd.xoaBien();
      window.__hd.xoaKhung();
    });
    // `tiep` rỗng = cảnh này KHÔNG sang bước mới (cảnh mở màn và bước 5 đều
    // đứng yên tại chỗ) — bấm bừa thì trúng cái nút còn đang mờ.
    if (c.tiep) await page.locator(`button:has-text("${c.tiep}")`).first().click();
  }

  await context.close();
  return loi;
}

/* ── Lượt 2: VIDEO chạy liền mạch ────────────────────────────────────────── */
async function quayVideo(browser) {
  const tam = path.join(OUT, "_tam-video");
  await rm(tam, { recursive: true, force: true });
  const context = await browser.newContext({
    viewport: KHO_MAN,
    recordVideo: { dir: tam, size: KHO_MAN },
  });
  const page = await moMan(context);
  const cham = { cham: true };

  for (let i = 0; i < CANH.length; i++) {
    const c = CANH[i];
    await page.evaluate(([tag, chu]) => window.__hd.loi(tag, chu), [c.tag, c.loi]);
    // Một nhịp đọc lời thuyết minh trước khi tay bắt đầu chạy.
    await cho(c.ten === "buoc-0-mo-man" ? 3200 : 1900);
    await page.evaluate((ds) => window.__hd.soi(ds), c.soi());
    await cho(900);
    await page.evaluate(() => window.__hd.xoaKhung());
    await c.dien(page, cham);
    await cho(1100);
    if (c.tiep) {
      await bam(page, `button:has-text("${c.tiep}")`, cham);
      await cho(600);
    }
  }
  // Dừng lại ở nút cuối một nhịp dài cho người xem kịp đọc.
  await page.evaluate(() => window.__hd.soi([["nut:Tạo & gửi khách ký", 1]]));
  await cho(2600);

  const video = page.video();
  await context.close();
  if (video) {
    const webm = path.join(OUT, "huong-dan-tao-hop-dong.webm");
    await rename(await video.path(), webm);
    await doiSangMp4(webm);
  }
  // Playwright để lại thư mục rỗng + có thể vài file thừa nếu chạy hỏng giữa chừng.
  for (const f of await readdir(tam).catch(() => [])) await rm(path.join(tam, f), { force: true });
  await rm(tam, { recursive: true, force: true });
}

/* ── WebM → MP4 ──────────────────────────────────────────────────────────────
   Playwright CHỈ quay được .webm. Trên máy tính thì trình duyệt nào cũng mở
   được, nhưng người nhận hướng dẫn phần lớn xem bằng ĐIỆN THOẠI — và Safari
   trên iPhone đời cũ (trước iOS 17.4) không mở webm: bấm vào chỉ thấy một ô
   đen. MP4 H.264 thì máy nào cũng phát, lại nhẹ hơn khoảng bốn lần.

   Không thêm ffmpeg vào devDependencies (gói nhị phân ~80 MB, cả đội phải tải
   cho một việc chạy vài tháng một lần): tìm ffmpeg đang có sẵn, không thấy thì
   giữ nguyên .webm — trang hướng dẫn khai CẢ HAI nguồn nên vẫn xem được. */
function timFfmpeg() {
  const ungVien = [process.env.FFMPEG_PATH, "ffmpeg"];
  try {
    // ffmpeg-static nếu ai đó đã cài; không có thì bỏ qua, không phải lỗi.
    ungVien.push(createRequire(import.meta.url)("ffmpeg-static"));
  } catch {}
  for (const f of ungVien) {
    if (!f) continue;
    // Bản ffmpeg đi kèm Playwright CÓ trên máy nhưng chỉ biết webm — hỏi thẳng
    // xem có libx264 không, đừng đoán theo tên file.
    const r = spawnSync(f, ["-hide_banner", "-encoders"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.includes("libx264")) return f;
  }
  return null;
}

async function doiSangMp4(webm) {
  const ff = timFfmpeg();
  if (!ff) {
    console.log("video · huong-dan-tao-hop-dong.webm (không tìm thấy ffmpeg có libx264 — bỏ qua bản MP4)");
    console.log("        Muốn có MP4 cho iPhone: npx -y ffmpeg-static-bin || đặt FFMPEG_PATH trỏ tới ffmpeg của máy.");
    return;
  }
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const r = spawnSync(ff, [
    "-hide_banner", "-loglevel", "error", "-i", webm,
    "-c:v", "libx264", "-preset", "slow", "-crf", "26",
    // yuv420p + profile high: kiểu duy nhất mọi máy đều giải mã được. Bỏ ra là
    // ffmpeg chọn yuv444p theo nguồn, và Safari/iPhone lại không mở được.
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
    // Đẩy phần mô tả lên đầu file để trình duyệt phát được ngay khi tải dở.
    "-movflags", "+faststart",
    "-an", "-y", mp4,
  ], { encoding: "utf8" });
  if (r.status !== 0) {
    console.log(`video · huong-dan-tao-hop-dong.webm (đổi sang MP4 hỏng: ${(r.stderr || "").trim().split("\n").pop()})`);
    return;
  }
  await rm(webm, { force: true });
  console.log("video · huong-dan-tao-hop-dong.mp4");
}

/* ── Chạy ────────────────────────────────────────────────────────────────── */
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
let loi = [];
try {
  loi = await chupAnh(browser);
  await quayVideo(browser);
} finally {
  await browser.close();
}
console.log(loi.length ? `\nVẤN ĐỀ:\n${loi.join("\n")}` : `\nXong — xem trong ${OUT}/`);
process.exit(loi.length ? 1 : 0);
