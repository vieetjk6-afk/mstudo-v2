/**
 * Chụp ảnh màn hình trang xem trước giao diện (/uipreview) ở cả khổ máy tính và
 * điện thoại, rồi báo hai thứ hay hỏng nhất mà mắt dễ bỏ sót:
 *   • trang có bị TRÀN NGANG không (lỗi bố cục số một trên điện thoại),
 *   • có lỗi JavaScript / console nào khi dựng không.
 *
 * Vì sao cần: gần hết màn hình của app nằm sau đăng nhập + Supabase nên không
 * mở được để nhìn. /uipreview dựng thẳng component bằng dữ liệu giả (đủ các
 * trạng thái hiếm: lỗi, rỗng, chưa cấu hình), còn script này biến nó thành ảnh.
 *
 * Cách dùng:
 *   npx next dev -p 3333                     # cửa sổ 1
 *   node scripts/chup-giao-dien.mjs          # cửa sổ 2 → anh-giao-dien/*.png
 *   node scripts/chup-giao-dien.mjs thu-chi  # chỉ chụp một màn
 *
 * Cần `playwright` (devDependency) và một bản Chromium. Trên máy đã có sẵn
 * trình duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";

const URL_BASE = process.env.PREVIEW_URL || "http://127.0.0.1:3333";
const EXEC = process.env.CHROME_PATH || undefined;
const OUT_DIR = process.env.SHOT_DIR || "anh-giao-dien";
await (await import("node:fs/promises")).mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const problems = [];

// Danh sách màn lấy thẳng từ trang chỉ mục, để thêm màn mới ở screens.tsx là
// script tự chụp theo, không phải sửa hai chỗ.
const listPage = await browser.newPage();
await listPage.goto(`${URL_BASE}/uipreview`, { waitUntil: "domcontentloaded", timeout: 120_000 });
const screens = await listPage.evaluate(() =>
  [...document.querySelectorAll('a[href^="/uipreview/"]')].map((a) => a.getAttribute("href").split("/").pop()),
);
await listPage.close();
const only = process.argv[2];
const targets = only ? screens.filter((s) => s === only) : screens;
if (!targets.length) {
  console.error(only ? `Không có màn "${only}". Có: ${screens.join(", ")}` : "Không tìm thấy màn nào ở /uipreview");
  process.exit(1);
}

for (const [name, width] of [["desktop", 1280], ["mobile", 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => problems.push(`[${name}] lỗi JS: ${e.message}`));
  page.on("console", (m) => {
    const t = m.text();
    // Ảnh QR tải từ img.vietqr.io — máy không ra được mạng thì bỏ qua.
    if (m.type() === "error" && !t.includes("ERR_") && !t.includes("Content Security Policy")) {
      problems.push(`[${name}] console: ${t}`);
    }
  });
  for (const screen of targets) {
    await page.goto(`${URL_BASE}/uipreview/${screen}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.screenshot({ path: `${OUT_DIR}/${screen}-${name}.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) problems.push(`[${screen} · ${name}] TRÀN NGANG ${overflow}px — có phần tử vượt khổ màn hình`);
    console.log(`${screen} · ${name}: ${overflow ? `TRÀN ${overflow}px` : "ok"}`);
  }
  await page.close();
}

await browser.close();
console.log(problems.length ? `\nVẤN ĐỀ:\n${problems.join("\n")}` : "\nKhông thấy lỗi console và không tràn ngang.");
process.exit(problems.length ? 1 : 0);
