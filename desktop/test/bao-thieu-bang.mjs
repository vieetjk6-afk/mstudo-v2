/* Kiểm BÁO "CHƯA BẬT ĐƯỢC TÌM ẢNH THEO KHUÔN MẶT", trong Chromium thật.
 *
 * Vì sao bài này quan trọng hơn vẻ ngoài của nó: một migration chưa chạy là thứ
 * HOÀN TOÀN VÔ HÌNH trong app này — bảng thiếu thì màn liên quan chỉ trống, hoặc
 * tệ hơn là nói sai. Chủ studio đã mất NĂM VÒNG qua lại đi tìm lý do ở chỗ khác.
 * Cái banner này là thứ cắt đứt chuyện đó, nên nó phải đúng ở cả hai chiều:
 *
 *  • Thiếu bảng mà KHÔNG báo → vô dụng đúng lúc cần nhất.
 *  • Mất mạng hay bị RLS chặn mà LẠI báo "chưa chạy SQL" → đẩy studio đi sai
 *    hướng thêm một lần nữa, và lần này là do chính công cụ chẩn đoán.
 *
 * Bài này từng bắt được một lỗi thật trong chính nó: bản đầu dùng `head: true`,
 * mà PostgREST trả phản hồi KHÔNG CÓ THÂN cho HEAD — nên câu lỗi rỗng và banner
 * không bao giờ hiện.
 *
 *   npx next dev -p 3333       # cửa sổ 1
 *   npm run test:bao-thieu-bang # cửa sổ 2
 */
import { chromium } from "playwright";

const PAGE = `${process.env.UI_BASE || "http://localhost:3333"}/uipreview/bao-chua-chay-sql`;

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

let browser;
try {
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
} catch {
  console.log("⏭  BỎ QUA: không mở được Chromium. Đặt CHROME_PATH trỏ tới trình duyệt.");
  process.exit(0);
}

const gone = (tbl) => (r) =>
  r.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ code: "42P01", message: `relation "public.${tbl}" does not exist` }),
  });
const okEmpty = (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
const denied = (r) =>
  r.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ code: "42501", message: "permission denied for table album_faces" }),
  });

/** Trả về tên các bảng banner nói là thiếu, hoặc null nếu không có banner. */
async function chay(routes) {
  const page = await browser.newPage();
  for (const [pat, fn] of routes) await page.route(pat, fn);
  let res;
  try {
    res = await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 25_000 });
  } catch {
    await page.close();
    return "SKIP";
  }
  if (!res || !res.ok()) {
    await page.close();
    return "SKIP";
  }
  await page.waitForTimeout(12_000);
  // Chuỗi này CHỈ có trong banner — lời dẫn của màn cũng nhắc tới "thiếu bảng",
  // và bản đầu của bài kiểm thử đã khớp nhầm vào đó rồi báo đạt hết.
  const m = (await page.innerText("body")).match(/Database còn thiếu bảng ([^.]*?)\./);
  await page.close();
  return m ? m[1].trim() : null;
}

const a = await chay([]);
if (a === "SKIP") {
  console.log(`⏭  BỎ QUA: chưa có server ở ${PAGE}. Chạy 'npx next dev -p 3333' trước.`);
  await browser.close();
  process.exit(0);
}
// Ở màn xem trước, Supabase trỏ vào địa chỉ dự phòng nên mọi câu đều hỏng vì MẤT
// MẠNG. Đây là phép quan trọng nhất: đừng đổ cho SQL khi lỗi là mạng.
ok("mất mạng → KHÔNG báo (đừng đổ cho SQL khi lỗi là mạng)", a === null, `nhận: ${a}`);

ok(
  "thiếu một bảng → báo, và gọi ĐÚNG TÊN bảng đó",
  (await chay([["**/rest/v1/album_faces*", gone("album_faces")], ["**/rest/v1/album_people*", okEmpty]])) ===
    "album_faces"
);
ok(
  "thiếu cả hai → kể đủ cả hai",
  (await chay([
    ["**/rest/v1/album_faces*", gone("album_faces")],
    ["**/rest/v1/album_people*", gone("album_people")],
  ])) === "album_people, album_faces"
);
ok(
  "đủ bảng → KHÔNG hiện gì (không nhắc người đã làm xong)",
  (await chay([["**/rest/v1/album_faces*", okEmpty], ["**/rest/v1/album_people*", okEmpty]])) === null
);
ok(
  "bị RLS chặn → KHÔNG báo (đó là chuyện quyền, không phải thiếu bảng)",
  (await chay([["**/rest/v1/album_faces*", denied], ["**/rest/v1/album_people*", okEmpty]])) === null
);

await browser.close();
console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
