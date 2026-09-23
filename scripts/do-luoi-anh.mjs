/**
 * ĐO LƯỚI ẢNH ALBUM — cuộn album lớn có mượt không, và có ô trắng không.
 *
 * Cái lag khách kêu ("kéo xuống càng nhiều ảnh càng giật") không hiện ra trên 20
 * tấm; nó chỉ lòi ra ở album vài nghìn tấm. Đo trên chính màn /uipreview/luoi-anh
 * (ô ảnh giống hệt ô album thật: ảnh, watermark, nút tim) với 3000 ô:
 *
 *   1. Cuộn phải giữ được 60 hình/giây — đây là con số quyết định "mượt".
 *   2. Album 3000 ảnh thì DOM vẫn chỉ được có vài trăm thẻ (lưới chỉ dựng phần
 *      quanh khung nhìn). Đây là gốc của chuyện mượt: đo ra 3000 ô trong DOM là
 *      26 hình/giây, 300 ô là 60 hình/giây phẳng.
 *   3. Ô ảnh cao theo đúng tỉ lệ ảnh thật.
 *   4. Cuộn ngược lên vùng ĐÃ XEM thì không được có ô trắng.
 *
 * Cách dùng — cần một máy chủ đang chạy, giống `npm run ui:test`:
 *   npx next dev -p 3333        # cửa sổ 1
 *   npm run ui:luoi-anh         # cửa sổ 2
 *
 * Máy đã có sẵn trình duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";

const URL_BASE = process.env.PREVIEW_URL || "http://127.0.0.1:3333";
/** `?wm=1`: đo ô NẶNG NHẤT — album có watermark. `?n=`: cỡ album cưới lớn. */
const SO_O = 3000;
const PAGE = `${URL_BASE}/uipreview/luoi-anh?wm=1&n=${SO_O}`;
const EXEC = process.env.CHROME_PATH || undefined;
/** Trần số thẻ HTML. Lưới chỉ dựng quanh khung nhìn nên album 3000 ảnh cũng chỉ
 *  vài trăm thẻ; vượt 1500 nghĩa là cơ chế đó hỏng và máy khách sẽ giật lại. */
const TRAN_THE = 1500;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const fails = [];
const ok = (m) => console.log("✓", m);
const bad = (m) => {
  fails.push(m);
  console.log("✗", m);
};

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto(PAGE, { waitUntil: "load", timeout: 180000 });
await page.waitForSelector("#luoi-anh-demo img", { timeout: 120000 });
await page.waitForTimeout(3000);

/** Cuộn bằng rAF như ngón tay vuốt, ghi lại khoảng cách giữa các khung hình. */
const cuon = (huong, buoc, soKhung) =>
  page.evaluate(
    ([huong, buoc, soKhung]) =>
      new Promise((xong) => {
        const khung = [];
        let truoc = performance.now();
        let n = 0;
        function b() {
          const gio = performance.now();
          khung.push(gio - truoc);
          truoc = gio;
          window.scrollBy(0, huong * buoc);
          if (++n < soKhung) requestAnimationFrame(b);
          else xong(khung);
        }
        requestAnimationFrame(b);
      }),
    [huong, buoc, soKhung]
  );

const cao = await page.$$eval("#luoi-anh-demo div[style*='position: absolute']", (els) =>
  els.slice(0, 20).map((e) => e.style.height)
);
const rieng = new Set(cao.filter(Boolean));
if (rieng.size >= 3) ok(`ô ảnh cao theo tỉ lệ thật (${rieng.size} cỡ khác nhau trong 20 ô đầu)`);
else bad(`ô ảnh KHÔNG theo tỉ lệ thật — 20 ô đầu chỉ có ${rieng.size} cỡ (${[...rieng].join(", ")})`);

const xuong = await cuon(1, 90, 300);
const the = await page.evaluate(() => document.querySelectorAll("#luoi-anh-demo *").length);
await page.waitForTimeout(1200);
const len = await cuon(-1, 90, 300);
await page.waitForTimeout(1500);

const giat = (a) => a.filter((x) => x > 32).length;
const giua = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(1);

for (const [ten, a] of [["xuống", xuong], ["lên", len]]) {
  const g = giat(a);
  // 3% số khung là chỗ dung sai cho máy chạy test đang bận việc khác.
  if (g <= Math.ceil(a.length * 0.03)) ok(`cuộn ${ten} mượt: ${giua(a)}ms mỗi khung, ${g}/${a.length} khung vẽ quá 32ms`);
  else bad(`CUỘN ${ten.toUpperCase()} GIẬT: ${giua(a)}ms mỗi khung, ${g}/${a.length} khung vẽ quá 32ms`);
}

if (the <= TRAN_THE) ok(`album ${SO_O} ảnh chỉ dựng ${the} thẻ HTML`);
else bad(`DỰNG QUÁ NHIỀU — album ${SO_O} ảnh mà có ${the} thẻ HTML (trần ${TRAN_THE})`);

const trong = await page.evaluate(() => {
  const vh = window.innerHeight;
  let t = 0;
  document.querySelectorAll("#luoi-anh-demo img").forEach((im) => {
    const r = im.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh && (!im.complete || im.naturalWidth <= 1)) t++;
  });
  return t;
});
if (trong === 0) ok("cuộn ngược lên vùng đã xem: không ô nào trắng");
else bad(`CUỘN NGƯỢC LÊN CÒN ${trong} Ô TRẮNG — ảnh vùng đã xem phải hiện lại ngay`);

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} MỤC SAI`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐỀU ĐÚNG");
