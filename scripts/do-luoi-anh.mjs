/**
 * ĐO LƯỚI ẢNH ALBUM — cuộn sâu có phình bộ nhớ không.
 *
 * Cái lag khách kêu ("kéo xuống càng nhiều ảnh càng giật") không phải lỗi thấy
 * được bằng mắt trên 20 tấm: nó chỉ hiện ra sau khi cuộn qua hàng nghìn tấm,
 * lúc số ảnh ĐÃ GIẢI MÃ nằm trong RAM vượt sức máy. Một tấm 400×600 tốn ~1MB
 * RAM, nên 1500 tấm là ~1,5GB — Safari trên iPhone tụt dần rồi tự tải lại trang.
 *
 * `useMasonry` (src/lib/masonry.ts) chống lại bằng cách NHẢ byte ảnh của những ô
 * đã cuộn qua xa. Bài này canh đúng điều đó trên màn /uipreview/luoi-anh (1200 ô
 * ảnh giả, KHÔNG có cửa sổ dựng dần như album thật):
 *
 *   1. Đo được tỉ lệ thật của ảnh (số dòng lưới phải khác nhau theo ảnh ngang/dọc).
 *   2. Cuộn hết 1200 ô mà số ảnh CÒN GIỮ byte vẫn đứng ở mức thấp.
 *   3. Cuộn ngược về đầu thì ảnh đã nhả phải gắn lại được (không để ô trắng).
 *   4. Nhả ảnh KHÔNG được làm đổi chiều cao trang (nhảy layout giữa lúc đang cuộn).
 *
 * Cách dùng — cần một máy chủ đang chạy, giống `npm run ui:test`:
 *   npx next dev -p 3333        # cửa sổ 1
 *   npm run ui:luoi-anh         # cửa sổ 2
 *
 * Máy đã có sẵn trình duyệt của Playwright thì đặt CHROME_PATH trỏ tới nó.
 */
import { chromium } from "playwright";

const URL_BASE = process.env.PREVIEW_URL || "http://127.0.0.1:3333";
const PAGE = `${URL_BASE}/uipreview/luoi-anh`;
const EXEC = process.env.CHROME_PATH || undefined;
/** Trần số ảnh được giữ cùng lúc. Cửa sổ giữ là ±150% màn hình nên thực tế
 *  ~30–60 tấm; 150 là mức "rõ ràng đã hỏng" chứ không phải mức chuẩn. */
const TRAN_GIU = 150;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const fails = [];
const ok = (m) => console.log("✓", m);
const bad = (m) => {
  fails.push(m);
  console.log("✗", m);
};

// Khổ điện thoại — chỗ duy nhất cái lag này thành vấn đề thật.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await page.goto(PAGE, { waitUntil: "load", timeout: 120000 });
await page.waitForSelector("#luoi-anh-demo img", { timeout: 60000 });
await page.waitForTimeout(2500); // lô ảnh đầu tải xong + đo tỉ lệ

const spans = await page.$$eval("#luoi-anh-demo > div > div", (els) =>
  els.slice(0, 20).map((e) => e.style.gridRowEnd)
);
const rieng = new Set(spans);
if (rieng.size >= 3) ok(`ô ảnh cao theo tỉ lệ thật (${rieng.size} cỡ khác nhau trong 20 ô đầu)`);
else bad(`ô ảnh KHÔNG theo tỉ lệ thật — 20 ô đầu chỉ có ${rieng.size} cỡ (${[...rieng].join(", ")})`);

let giuMax = 0;
for (let i = 0; i < 45; i++) {
  await page.evaluate(() => window.scrollBy(0, 1400));
  await page.waitForTimeout(130);
  const giu = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll("#luoi-anh-demo img").forEach((im) => {
      if (!im.dataset.mstSrc) n++;
    });
    return n;
  });
  if (giu > giuMax) giuMax = giu;
}
const { tong, caoCuoi } = await page.evaluate(() => ({
  tong: document.querySelectorAll("#luoi-anh-demo img").length,
  caoCuoi: document.documentElement.scrollHeight,
}));

if (giuMax <= TRAN_GIU) ok(`cuộn hết ${tong} ô mà chỉ giữ tối đa ${giuMax} ảnh trong bộ nhớ`);
else bad(`ẢNH KHÔNG ĐƯỢC NHẢ — cuộn hết ${tong} ô thì giữ tới ${giuMax} ảnh (trần ${TRAN_GIU})`);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);

// So chiều cao SAU khi đã cuộn hết (mọi ô đã đo được tỉ lệ thật) với chiều cao
// sau khi cuộn ngược về đầu. Đo sớm hơn là so nhầm: lúc mới vào, ô chưa tải còn
// dùng tỉ lệ tạm nên trang cao khác — đó là lưới đang đo, không phải nhả ảnh.
const caoVeDau = await page.evaluate(() => document.documentElement.scrollHeight);
if (caoVeDau === caoCuoi) ok(`nhả rồi gắn lại ảnh KHÔNG đổi chiều cao trang (${caoCuoi}px)`);
else bad(`NHẢ/GẮN ẢNH LÀM NHẢY LAYOUT — trang cao ${caoCuoi}px → ${caoVeDau}px`);
const trong = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("#luoi-anh-demo img")].slice(0, 8);
  return imgs.filter((im) => im.dataset.mstSrc || !im.complete || im.naturalWidth <= 1).length;
});
if (trong === 0) ok("cuộn ngược về đầu: ảnh đã nhả gắn lại đủ, không ô nào trắng");
else bad(`cuộn về đầu còn ${trong}/8 ô TRẮNG — ảnh nhả rồi không gắn lại được`);

await browser.close();
if (fails.length) {
  console.log(`\n${fails.length} MỤC SAI`);
  process.exit(1);
}
console.log("\nTẤT CẢ ĐỀU ĐÚNG");
