/* Kiểm thử CHIP LỌC THEO NGƯỜI trong album khách, chạy trong Chromium thật.
 *
 * Vì sao cần bài này khi đã có desktop/test/face-people.mjs: bài kia chứng minh
 * LUẬT (chip nào hiện, ảnh nào thuộc ai) đúng trên dữ liệu dựng sẵn. Nó không
 * trả lời được ba câu mà tính năng đứng hay đổ trên đó:
 *
 *   1. Hàng chip có hiện ra NGAY từ lượt vẽ đầu không. Hai lỗi hydrate trước đây
 *      trong chính repo này (nút "Quét" kẹt vô hiệu vĩnh viễn) đều là loại mà
 *      React 18 chỉ CẢNH BÁO rồi giữ nguyên HTML của máy chủ — mọi kiểm thử đơn
 *      vị vẫn xanh.
 *   2. Bấm chip có LỌC ĐƯỢC lưới không. Lọc theo người xen vào giữa một chuỗi
 *      lọc đã có (tab nguồn → người → đã chọn/không thích → ẩn ảnh trùng); xếp
 *      sai thứ tự thì lưới ra sai mà không ai báo lỗi.
 *   3. Bấm lại có TRỞ VỀ cả album không — một chip lọc mà không thoát ra được là
 *      một cái bẫy.
 *
 * Cách chạy:
 *   npx next dev -p 3333            # cửa sổ 1
 *   npm run test:people-chip        # cửa sổ 2
 *
 * Ảnh đi qua /api/img (Drive) nên bài này CHẶN đường đó lại và trả về một PNG
 * sinh tại chỗ — không cần Drive, không cần mạng.
 */
import { chromium } from "playwright";

const PAGE = `${process.env.UI_BASE || "http://localhost:3333"}/uipreview/loc-theo-nguoi`;

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const check = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `nhận ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`);

// PNG 1×1 xám — đủ để <img> có ảnh, không cần Drive.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

let browser;
try {
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
} catch {
  console.log("⏭  BỎ QUA: không mở được Chromium. Đặt CHROME_PATH trỏ tới trình duyệt.");
  process.exit(0);
}
const page = await browser.newPage();

// Ảnh Drive → PNG tại chỗ.
await page.route("**/api/img**", (route) =>
  route.fulfill({ status: 200, contentType: "image/png", body: PNG })
);

/* Lỗi console: React ghi cả cảnh báo hydrate ra console.error, nên gom cả hai. */
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});

let res;
try {
  res = await page.goto(PAGE, { waitUntil: "networkidle", timeout: 25_000 });
} catch {
  console.log(`⏭  BỎ QUA: chưa có server ở ${PAGE}. Chạy 'npx next dev -p 3333' trước.`);
  await browser.close();
  process.exit(0);
}
if (!res || !res.ok()) {
  console.log(`⏭  BỎ QUA: ${PAGE} trả về ${res?.status()}.`);
  await browser.close();
  process.exit(0);
}

const gridCount = () => page.locator('[aria-label^="Xem ảnh"]').count();
const chip = (name) => page.getByRole("button", { name: new RegExp(`^${name}`) });

/* ── 1. Hàng chip hiện ngay ────────────────────────────────────────────────── */
await page.waitForSelector("text=Xem ảnh của:", { timeout: 10_000 });
ok("hàng chip hiện ra (không kẹt ở HTML máy chủ)", true);

for (const name of ["Cô dâu", "Chú rể", "Mẹ cô dâu"]) {
  ok(`có chip "${name}"`, (await chip(name).count()) > 0);
}
ok('có chip "Cả album" để thoát ra', (await chip("Cả album").count()) > 0);

// Số trên chip phải là số ảnh của người đó, không phải tổng album.
const brideLabel = await chip("Cô dâu").first().innerText();
ok('chip "Cô dâu" mang số 4', brideLabel.includes("4"), `nhãn: ${JSON.stringify(brideLabel)}`);

/* ── 2. Bấm chip thì lọc lưới ─────────────────────────────────────────────── */
const all = await gridCount();
check("chưa lọc: lưới có cả 8 ảnh", all, 8);

await chip("Cô dâu").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 4,
  null,
  { timeout: 5000 }
).catch(() => {});
check("bấm Cô dâu → lưới còn 4 ảnh", await gridCount(), 4);

// Đúng NHỮNG tấm nào, không chỉ đúng số lượng.
const shown = await page.locator('[aria-label^="Xem ảnh"]').evaluateAll((els) =>
  els.map((e) => e.getAttribute("alt"))
);
check("…và là đúng bốn tấm của Cô dâu", shown, [
  "DSC_4470.JPG",
  "DSC_4471.JPG",
  "DSC_4472.JPG",
  "DSC_4473.JPG",
]);
ok("hiện dòng nhắc cách thoát khỏi bộ lọc", (await page.locator("text=Bấm lại vào chip").count()) > 0);
// Thanh công cụ phải báo số ảnh ĐANG THẤY, không phải tổng album: đang lọc còn
// 4 tấm mà vẫn ghi "8 ảnh" thì con số đó nói về một lưới khác.
ok(
  "thanh công cụ đếm theo lưới đang lọc, không theo tổng album",
  (await page.locator("text=4 ảnh của Cô dâu").count()) > 0
);

/* Chuyển sang người khác (không qua "Cả album") — chồng bộ lọc phải thay, không cộng. */
await chip("Mẹ cô dâu").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 2,
  null,
  { timeout: 5000 }
).catch(() => {});
check("đổi sang Mẹ cô dâu → còn 2 ảnh (bộ lọc THAY, không cộng dồn)", await gridCount(), 2);

/* ── 3. Thoát khỏi bộ lọc ─────────────────────────────────────────────────── */
await chip("Mẹ cô dâu").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 8,
  null,
  { timeout: 5000 }
).catch(() => {});
check("bấm lại chính chip đó → trở về cả 8 ảnh", await gridCount(), 8);

await chip("Chú rể").first().click();
await chip("Cả album").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 8,
  null,
  { timeout: 5000 }
).catch(() => {});
check('nút "Cả album" cũng thoát được', await gridCount(), 8);

/* ── 4. Không lỗi, không cảnh báo hydrate ─────────────────────────────────── */
/*
 * Lọc bỏ ba thứ tiếng ồn KHÔNG phải lỗi của trang, và nói rõ từng thứ là gì —
 * lọc mù cả console.error thì bài kiểm thử này mất hết giá trị:
 *
 *  • Ảnh: route ở trên trả PNG 1×1, nhưng favicon/manifest thì không đi qua đó.
 *  • `upgrade-insecure-requests` bị bỏ qua trong policy Report-Only: đúng như
 *    trình duyệt nói. next.config.mjs cố ý phát bản CSP siết chặt ở chế độ
 *    Report-Only trước khi enforce (xem ghi chú ở đó), và directive ấy phải nằm
 *    sẵn trong bản đó cho ngày đổi sang enforce. Bản ĐANG enforce cũng có nó,
 *    nên việc nâng cấp HTTPS vẫn có hiệu lực. Đây là thông báo, không phải lỗi.
 */
const real = errors.filter(
  (e) => !/Failed to load resource|favicon|manifest|upgrade-insecure-requests/i.test(e)
);
ok("không có lỗi JavaScript nào trên trang", real.length === 0, real.join("\n    "));
ok(
  "không có cảnh báo hydrate (React vứt HTML máy chủ)",
  !real.some((e) => /hydrat/i.test(e)),
  real.filter((e) => /hydrat/i.test(e)).join("\n    ")
);

await browser.close();
console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
