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

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} MỤC SAI`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐỀU ĐÚNG");
