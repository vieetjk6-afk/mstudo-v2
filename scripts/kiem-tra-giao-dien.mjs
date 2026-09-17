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

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} MỤC SAI`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐỀU ĐÚNG");
