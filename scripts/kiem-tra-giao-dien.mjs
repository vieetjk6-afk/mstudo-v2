/**
 * Kiểm tra phần GIAO DIỆN chỉ chạy được trong trình duyệt thật.
 *
 * Các bài test khác của repo (`desktop/test/*.mjs`) là test logic thuần: nạp
 * hàm vào Node rồi so kết quả. Nhưng ba thứ dưới đây không có hàm nào để gọi —
 * chúng chỉ tồn tại khi có DOM, localStorage và `prefers-color-scheme` thật:
 *
 *   1. Chế độ nền: sáng / tối / THEO MÁY, và mặc định khi chưa từng chọn.
 *   2. Đổi cài đặt sáng-tối của máy KHI ĐANG mở app thì nền phải đổi theo ngay.
 *   3. Không còn cảnh báo hydrate nào từ mấy thuộc tính theme trên <html>.
 *
 * Cách dùng — cần một máy chủ dev đang chạy, giống `npm run ui:shot`:
 *   npx next dev -p 3333        # cửa sổ 1
 *   npm run ui:test             # cửa sổ 2
 *
 * Máy đã có sẵn trình duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";

const URL_BASE = process.env.PREVIEW_URL || "http://127.0.0.1:3333";
const EXEC = process.env.CHROME_PATH || undefined;
// Trang công khai, nhẹ, và nằm trong layout gốc (nơi có script đặt nền) — đủ
// để đo, mà không cần đăng nhập hay Supabase chạy được.
const PAGE = `${URL_BASE}/login`;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const fails = [];
const ok = (m) => console.log("✓", m);
const bad = (m) => {
  fails.push(m);
  console.log("✗", m);
};

/** Nạp sẵn lựa chọn vào localStorage rồi tải lại, xem <html> ra nền nào. */
async function check(label, { pref, colorScheme, expect }) {
  const ctx = await browser.newContext({ colorScheme });
  const page = await ctx.newPage();
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.evaluate((p) => {
    if (p === null) localStorage.removeItem("mstudo_theme");
    else localStorage.setItem("mstudo_theme", p);
  }, pref);
  await page.reload({ waitUntil: "domcontentloaded" });
  const got = await page.evaluate(() => document.documentElement.dataset.theme);
  if (got === expect) ok(`${label} → ${got}`);
  else bad(`${label}: mong "${expect}", nhận "${got}"`);
  await ctx.close();
}

// Mặc định KHÔNG được đổi: studio chưa từng bấm chọn thì vẫn nền sáng, kể cả
// máy đang để chế độ tối. "Theo máy" là thứ người dùng chọn, không phải mặc định.
await check("chưa chọn + máy tối → vẫn sáng", { pref: null, colorScheme: "dark", expect: "light" });
await check("chọn nền sáng", { pref: "light", colorScheme: "dark", expect: "light" });
await check("chọn nền tối", { pref: "dark", colorScheme: "light", expect: "dark" });
await check("chọn theo máy + máy tối", { pref: "system", colorScheme: "dark", expect: "dark" });
await check("chọn theo máy + máy sáng", { pref: "system", colorScheme: "light", expect: "light" });
await check("giá trị rác trong localStorage → sáng", { pref: "banana", colorScheme: "dark", expect: "light" });

// Đang mở app ở chế độ "theo máy" mà người dùng đổi cài đặt của máy (hoặc trời
// tối và máy tự chuyển) thì nền phải đổi NGAY, không đợi tải lại trang.
{
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("mstudo_theme", "system"));
  await page.reload({ waitUntil: "networkidle" });
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.emulateMedia({ colorScheme: "dark" });
  try {
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", null, { timeout: 5000 });
    ok(`máy đổi sang tối khi đang mở: ${before} → dark (không tải lại)`);
  } catch {
    const now = await page.evaluate(() => document.documentElement.dataset.theme);
    bad(`máy đổi sang tối khi đang mở: vẫn là "${now}"`);
  }
  await ctx.close();
}

// Script đặt nền chạy TRƯỚC khi React hydrate nên nó luôn sửa <html>; nếu quên
// `suppressHydrationWarning` (hoặc lỡ ghi thêm một thuộc tính thứ hai) là React
// kêu ngay. Cảnh báo chỉ hiện ở bản dev, nên phải bắt ở đây chứ không đợi build.
{
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  const warns = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/Extra attributes|did not match|Hydration failed|hydrat/i.test(t)) warns.push(t.split("\n")[0]);
  });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("mstudo_theme", "system"));
  await page.reload({ waitUntil: "networkidle" });
  if (warns.length === 0) ok("không có cảnh báo hydrate từ thuộc tính theme");
  else bad(`cảnh báo hydrate: ${warns.join(" | ")}`);
  await ctx.close();
}

/* ── Bôi chọn chữ có NHÌN THẤY không ───────────────────────────────────────
   Studio báo: nền tối bôi đen mà không thấy vùng chọn. Đúng thật — bản cũ tô
   rgba(255,255,255,.20) lên nền #0a0a0c, ra chừng #3b3b3d, gần như trùng nền.
   Kiểu lỗi này không lộ ra ở tsc/eslint/build và mắt cũng dễ bỏ qua nếu màn
   hình sáng, nên đo bằng số: lấy màu ::selection mà trình duyệt THẬT SỰ áp
   dụng rồi tính tương phản theo WCAG.

   Hai ngưỡng, hai ý nghĩa khác nhau:
     • vùng chọn ↔ nền trang ≥ 3:1   — để NHẬN RA là đang bôi (thành phần giao diện)
     • chữ ↔ vùng chọn       ≥ 4.5:1 — để ĐỌC ĐƯỢC chữ đang bôi                  */

/** Đọc màu CSS về [r,g,b,a] — r,g,b theo 0–255, a theo 0–1.
 *  Chromium trả color-mix() dưới dạng `color(srgb 0–1 …)` chứ không phải
 *  `rgb(0–255 …)` — quên chỗ này là tính ra số tương phản đẹp giả, đúng cái bẫy
 *  đã mắc một lần khi dò lỗi này. */
function docMau(c) {
  const n = c.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const a = n.length > 3 ? n[3] : 1;
  return c.startsWith("color(") ? [...n.slice(0, 3).map((v) => v * 255), a] : [...n.slice(0, 3), a];
}

/** Trộn màu TRƯỚC lên màu SAU theo độ trong (alpha).
 *  Bỏ qua bước này là bẫy thứ hai: bản lỗi cũ tô rgba(255,255,255,.20), tính
 *  như màu đặc thì ra trắng tinh → tương phản cao giả, phép kiểm xanh oan.
 *  Trộn đúng mới thấy nó chỉ ra chừng #3b3b3d trên nền tối. */
function tronLen(truoc, sau) {
  const [r1, g1, b1, a] = docMau(truoc);
  const [r2, g2, b2] = docMau(sau);
  return [r1 * a + r2 * (1 - a), g1 * a + g2 * (1 - a), b1 * a + b2 * (1 - a)];
}
function doSangRGB([r, g, b]) {
  const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const doSang = (c) => doSangRGB(docMau(c).slice(0, 3));
const tuongPhan = (a, b) => {
  const [x, y] = [a, b].sort((p, q) => q - p);
  return +(((x + 0.05) / (y + 0.05)).toFixed(2));
};

// Tự kiểm bộ đo trước khi tin nó: cùng một màu viết hai kiểu phải ra cùng số.
{
  const a = doSang("rgb(162, 121, 51)");
  const b = doSang("color(srgb 0.635294 0.474510 0.200000)");
  if (Math.abs(a - b) < 0.002) ok("bộ đo màu đọc được cả rgb() lẫn color(srgb)");
  else bad(`bộ đo màu LỆCH giữa hai cách viết: ${a} vs ${b}`);
  // Trắng 20% trên nền gần đen phải ra màu TỐI, không phải trắng.
  const thu = doSangRGB(tronLen("rgba(255, 255, 255, 0.2)", "rgb(10, 10, 12)"));
  if (thu < 0.08) ok("bộ đo có tính độ trong (alpha), không coi rgba là màu đặc");
  else bad(`bộ đo BỎ QUA alpha — trắng 20% trên nền tối ra độ sáng ${thu.toFixed(3)}, đáng lẽ phải rất thấp`);
}

for (const nen of ["dark", "light"]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => localStorage.setItem("mstudo_theme", t), nen);
  await page.reload({ waitUntil: "domcontentloaded" });
  const d = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector("h1,h2,p,span,label,body"), "::selection");
    return { bg: cs.backgroundColor, ink: cs.color, page: getComputedStyle(document.body).backgroundColor };
  });
  // Nền vùng chọn có thể trong suốt → trộn lên nền trang rồi mới đo.
  const vungThat = tronLen(d.bg, d.page);
  const chuThat = tronLen(d.ink, d.bg);
  const cVung = tuongPhan(doSangRGB(vungThat), doSang(d.page));
  const cChu = tuongPhan(doSangRGB(chuThat), doSangRGB(vungThat));
  if (cVung >= 3) ok(`nền ${nen}: vùng chọn nổi trên nền trang (${cVung}:1)`);
  else bad(`nền ${nen}: vùng chọn MỜ, chỉ ${cVung}:1 (cần ≥3) — bôi xong không thấy`);
  if (cChu >= 4.5) ok(`nền ${nen}: chữ đang bôi vẫn đọc được (${cChu}:1)`);
  else bad(`nền ${nen}: chữ trên vùng chọn khó đọc, chỉ ${cChu}:1 (cần ≥4.5)`);
  await ctx.close();
}

/* ── Nút & ô nhập trong CÙNG một hàng phải cao bằng nhau ───────────────────
   "Nhìn rối / mất cân đối" là cảm giác, nhưng có một phần đo được: các điều
   khiển nằm cạnh nhau trong cùng một hàng mà cao khác nhau thì mắt thấy ngay.
   Đã tìm thấy thật ở tab Thanh toán của hợp đồng: ảnh 28px, nút chữ 25px, nút
   icon 22px — ba cỡ trong một hàng.

   BA LUẬT ĐO, học từ ba lần đo sai trước đó:
     · Gom theo PHẦN TỬ CHA THẬT, không theo tagName. Gom theo tagName thì nút
       ở hai khung khác nhau bị nhập làm một hàng → báo lệch oan (đã dính).
     · Bỏ qua <textarea> và ô nhiều dòng: chúng CỐ Ý cao hơn nút bên cạnh
       (nút "Bỏ" canh đỉnh ô mô tả là bố cục đúng, không phải lỗi).
     · Bỏ qua checkbox/radio/file: chúng có cỡ riêng của trình duyệt.

   Chỉ chạy được khi máy chủ là bản DEV, vì /uipreview cố ý không tồn tại trên
   production. Không mở được thì bỏ qua, đừng báo sai.                        */
{
  const thu = await fetch(`${URL_BASE}/uipreview`).then((r) => r.ok).catch(() => false);
  if (!thu) {
    console.log("• bỏ qua phép đo cân đối: /uipreview không mở được (không phải bản dev?)");
  } else {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const html = await (await fetch(`${URL_BASE}/uipreview`)).text();
    const mans = [...new Set([...html.matchAll(/\/uipreview\/([a-z0-9-]+)/g)].map((m) => m[1]))];
    const lech = [];
    const deLen = [];
    for (const man of mans) {
      await page.setViewportSize({ width: 1280, height: 1000 });
      const r = await page.goto(`${URL_BASE}/uipreview/${man}`, { waitUntil: "domcontentloaded" }).catch(() => null);
      if (!r || r.status() >= 400) continue;
      for (const w of [1280, 390]) {
        // Đổi khổ TẠI CHỖ thay vì tải lại: bố cục tính lại ngay, mà không phải
        // chờ server dev biên dịch màn đó thêm một lần nữa.
        await page.setViewportSize({ width: w, height: 1000 });
        await page.waitForTimeout(180);
        const xau = await page.evaluate(() => {
          const ra = [];
          for (const cha of document.querySelectorAll("div,li,td,th,nav,header,footer,section,form,label")) {
            const con = [...cha.children].filter(
              (e) => ["BUTTON", "INPUT", "SELECT"].includes(e.tagName) &&
                     !["checkbox", "radio", "hidden", "file"].includes(e.type)
            );
            if (con.length < 2) continue;
            const box = con
              .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || e.placeholder || "").trim().slice(0, 14) }))
              .filter((x) => x.r.width > 8 && x.r.height > 8);
            if (box.length < 2) continue;
            const top = Math.min(...box.map((x) => x.r.top));
            const hang = box.filter((x) => Math.abs(x.r.top - top) < 6);
            if (hang.length < 2) continue;
            const hs = hang.map((x) => Math.round(x.r.height));
            if (Math.max(...hs) - Math.min(...hs) > 4) {
              ra.push(`${hs.join("/")}px — ${hang.map((x) => x.t).filter(Boolean).slice(0, 3).join(", ") || "(nút icon)"}`);
            }
          }
          return ra;
        });
        for (const x of xau) lech.push(`${man} @${w}px: ${x}`);

        /* CHỒNG LẤN — tiêu chí quan trọng hơn cả lệch chiều cao, và là thứ
           phép đo đầu tiên KHÔNG có nên đã để lọt một lỗi thật: ở tab Thanh
           toán, cột nút không có shrink-0 nên khi hẹp nó co nhỏ hơn nội dung,
           các nút bên trong tràn ra ngoài khung và vì justify-end nên tràn
           SANG TRÁI, đè lên ô nhập tên đợt — khách nhìn thấy "ThaQRh toán t…".

           Bỏ qua lớp chồng CÓ CHỦ Ý: phần tử (hoặc tổ tiên) định vị
           absolute/fixed/sticky — vd nút lịch nằm trong ô ngày, huy hiệu góc
           thẻ, thanh dính. Không bỏ qua thì chúng báo sai liên tục. */
        const chong = await page.evaluate(() => {
          const coLop = (e) => {
            for (let p = e; p && p !== document.body; p = p.parentElement) {
              const po = getComputedStyle(p).position;
              if (po === "absolute" || po === "fixed" || po === "sticky") return true;
            }
            return false;
          };
          const ten = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/)[0] : "");
          /* Phần tử có bị khung cha CẮT HÌNH không.
             Nội dung rộng hơn một khung `overflow: hidden` thì mắt không thấy
             phần thừa, nhưng getBoundingClientRect vẫn trả toạ độ chưa cắt —
             10 mẫu thiệp trong /uipreview nằm trong khung 390px và dính đúng
             bẫy này, báo chồng lấn oan ở 11 chỗ. (Không dùng elementFromPoint
             để kiểm: hàm đó chỉ chạy trong khung nhìn, trả null với mọi thứ
             nằm dưới nếp gấp — tức gần hết nội dung.) */
          const biCat = (e) => {
            const r = e.getBoundingClientRect();
            for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
              const ov = getComputedStyle(p);
              if (ov.overflowX === "visible" && ov.overflowY === "visible") continue;
              const pr = p.getBoundingClientRect();
              if (r.right > pr.right + 1 || r.left < pr.left - 1 ||
                  r.bottom > pr.bottom + 1 || r.top < pr.top - 1) return true;
            }
            return false;
          };
          const el = [...document.querySelectorAll("button,input,select,textarea,a,label")]
            .filter((e) => !coLop(e) && !biCat(e))
            .map((e) => ({ e, r: e.getBoundingClientRect(), t: (e.textContent || e.placeholder || "").trim().slice(0, 16) }))
            .filter((x) => x.r.width > 4 && x.r.height > 4);
          const ra = new Set();
          for (let i = 0; i < el.length; i++) {
            for (let j = i + 1; j < el.length; j++) {
              const a = el[i], c = el[j];
              if (a.e.contains(c.e) || c.e.contains(a.e)) continue;
              const ox = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left);
              const oy = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
              if (ox <= 3 || oy <= 3) continue;
              ra.add(`${ten(a.e)}"${a.t}" ⨯ ${ten(c.e)}"${c.t}" (${Math.round(ox)}×${Math.round(oy)}px)`);
            }
          }
          return [...ra];
        });
        for (const x of chong) deLen.push(`${man} @${w}px: ${x}`);
      }
    }
    if (lech.length === 0) ok(`nút & ô nhập cùng hàng đều cao bằng nhau (${mans.length} màn × 2 khổ)`);
    else bad(`hàng điều khiển lệch chiều cao:\n      ${lech.slice(0, 8).join("\n      ")}`);
    if (deLen.length === 0) ok(`không điều khiển nào đè lên nhau (${mans.length} màn × 2 khổ)`);
    else bad(`điều khiển ĐÈ LÊN NHAU — chữ và nút chồng nhau, khách đọc không ra:\n      ${deLen.slice(0, 8).join("\n      ")}`);
    await ctx.close();
  }
}

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} MỤC SAI`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐỀU ĐÚNG");
