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
 *   npx next dev -p 3333        # cửa sổ 1
 *   node scripts/chup-giao-dien.mjs   # cửa sổ 2 → ui-desktop.png, ui-mobile.png
 *
 * Cần `playwright` (devDependency) và một bản Chromium. Trên máy đã có sẵn
 * trình duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";

const URL_BASE = process.env.PREVIEW_URL || "http://127.0.0.1:3333";
const EXEC = process.env.CHROME_PATH || undefined;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const problems = [];

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
  await page.goto(`${URL_BASE}/uipreview`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.screenshot({ path: `ui-${name}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 0) problems.push(`[${name}] TRÀN NGANG ${overflow}px — có phần tử vượt khổ màn hình`);
  console.log(`${name}: đã ghi ui-${name}.png (tràn ngang ${overflow}px)`);
  await page.close();
}

await browser.close();
console.log(problems.length ? `\nVẤN ĐỀ:\n${problems.join("\n")}` : "\nKhông thấy lỗi console và không tràn ngang.");
process.exit(problems.length ? 1 : 0);
