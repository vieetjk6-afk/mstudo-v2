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

/* ── Nút "Chép SQL" phải đưa NỘI DUNG, không phải một cái link ────────────── */
/*
 * Đây là chỗ tính năng thật sự tắc, sáu vòng liền: bảng báo đúng, studio đọc
 * hiểu, nhưng nút chỉ chép một đường dẫn GitHub — họ vẫn phải rời app, tìm nút
 * raw, bôi đen cả file. Bài này đòi đúng thứ phải nằm trong clipboard.
 */
{
  const page = await browser.newPage();
  await page.route("**/rest/v1/album_faces*", gone("album_faces"));
  await page.route("**/rest/v1/album_people*", gone("album_people"));
  // Máy chủ thật đòi đăng nhập, nên ở màn xem trước ta giả nội dung file.
  // Phải DÀI thật: `chepSql` coi dưới 100 ký tự là "không lấy được" (một trang
  // lỗi HTML ngắn cũng trả 200 được). Bản đầu của bài kiểm thử dùng chuỗi 70 ký
  // tự và đỏ — đúng ra là hàng rào đó đang làm việc.
  const SQL_GIA =
    "-- mstudo — khuon-mat.sql (bản giả cho kiểm thử)\n".repeat(3) +
    "create table if not exists public.album_people (id uuid primary key);\n" +
    "create table if not exists public.album_faces (photo_id uuid, at int);\n";
  await page.route("**/api/setup-sql/khuon-mat", (r) =>
    r.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: SQL_GIA })
  );
  /*
   * Thay `navigator.clipboard.writeText` bằng bản ghi lại, thay vì xin quyền
   * clipboard thật: quyền clipboard trong Chromium không cửa sổ vừa phải xin
   * vừa hay trả về chuỗi rỗng, nên bài kiểm sẽ đỏ vì trình duyệt chứ không phải
   * vì code. Cái cần kiểm là NGƯỜI GỌI truyền gì vào — đúng chỗ này ghi lại được.
   */
  await page.addInitScript(() => {
    const w = window;
    w.__daChep = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (t) => {
          w.__daChep = t;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForTimeout(9_000);
  await page.getByRole("button", { name: /Chép SQL/i }).click();
  await page.waitForTimeout(1_500);
  const trongClipboard = (await page.evaluate(() => window.__daChep)) ?? "";
  ok(
    "bấm 'Chép SQL' thì clipboard chứa NỘI DUNG SQL, không phải đường dẫn",
    trongClipboard.includes("create table") && !/^https?:/.test(trongClipboard.trim()),
    `nhận: ${JSON.stringify(trongClipboard.slice(0, 80))}`
  );
  await page.close();
}

/* ── Mắt xích vô hình: thiếu CRON_SECRET ──────────────────────────────────── */
/*
 * Bảng đủ, code đúng, mà không album nào được quét — vì app tự trả 401 cho cron
 * của Vercel. Không có cảnh báo này thì studio lại rơi đúng vào vòng "chạy SQL
 * rồi mà vẫn không thấy gì", lần này không còn manh mối nào.
 */
async function bangCron(faceStatus) {
  const page = await browser.newPage();
  await page.route("**/rest/v1/album_faces*", okEmpty);
  await page.route("**/rest/v1/album_people*", okEmpty);
  await page.route("**/api/face-status", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(faceStatus) })
  );
  await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForTimeout(9_000);
  const co = (await page.innerText("body")).includes("CRON_SECRET");
  await page.close();
  return co;
}
ok("đủ bảng nhưng thiếu CRON_SECRET → báo đúng mắt xích đó", await bangCron({ ok: true, cronSecret: false }));
ok("đủ bảng và có CRON_SECRET → im lặng", !(await bangCron({ ok: true, cronSecret: true })));

await browser.close();
console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
