/* Kiểm thử ĐẦU-CUỐI bộ nhận diện khuôn mặt, chạy trong Chromium thật.
 *
 * Vì sao cần thêm bài này khi đã có desktop/test/face-ai.mjs: bài kia chứng minh
 * LUẬT đúng trên dữ liệu dựng sẵn. Nó không trả lời được hai câu mà cả tính năng
 * đứng hay đổ trên đó:
 *
 *   1. Mô hình có TẢI VÀ CHẠY được trong đúng cấu hình repo này không — WASM tự
 *      phục vụ từ /mediapipe (CSP chỉ cho `script-src 'self'`), mô hình lấy từ
 *      storage.googleapis.com. Sai một mắt xích là bộ nhận diện im lặng không
 *      khởi động, mà mọi kiểm thử đơn vị vẫn xanh.
 *   2. Blendshape `eyeBlink` có THẬT SỰ phân biệt mắt mở với mắt nhắm không, và
 *      ngưỡng 0.5 ở @/lib/face-ai có nằm giữa hai giá trị đó không. Ngưỡng chọn
 *      sai thì luật "ưu tiên tấm mắt mở" vẫn chạy mà chọn bừa.
 *
 * Cách chạy: mở /uipreview/khuon-mat (màn vẽ hai khuôn mặt bằng canvas rồi cho
 * chạy qua đúng `detectOne()` của code thật), đọc số đo in ra.
 *
 *   npx next dev -p 3333     # cửa sổ 1
 *   npm run test:face-browser # cửa sổ 2
 *
 * Cần Chromium VÀ mạng (để lấy mô hình một lần). Không có thì bài này báo BỎ QUA
 * chứ không báo hỏng — thiếu mạng không phải lỗi của code.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FACE_DEFAULTS } from "../../src/lib/face-ai.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".cache");
const MODEL_FILE = join(CACHE, "face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const PAGE = process.env.UI_BASE || "http://localhost:3333";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const skip = (why) => {
  console.log(`⏭  BỎ QUA: ${why}`);
  process.exit(0);
};

/* ── Mô hình: tải một lần rồi nhớ trên đĩa ─────────────────────────────────── */

let model;
if (existsSync(MODEL_FILE)) {
  model = readFileSync(MODEL_FILE);
  console.log(`Dùng mô hình đã lưu (${(model.length / 1048576).toFixed(1)} MB).`);
} else {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`http ${res.status}`);
    model = Buffer.from(await res.arrayBuffer());
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(MODEL_FILE, model);
    console.log(`Đã tải mô hình (${(model.length / 1048576).toFixed(1)} MB).`);
  } catch (e) {
    skip(`không tải được mô hình (${e.message}). Cần mạng vào storage.googleapis.com.`);
  }
}

/* ── Trang xem trước phải đang chạy ────────────────────────────────────────── */

try {
  const r = await fetch(`${PAGE}/uipreview`);
  if (!r.ok) throw new Error(`http ${r.status}`);
} catch {
  skip(`chưa có server ở ${PAGE}. Chạy 'npx next dev -p 3333' trước.`);
}

/* ── Chạy ─────────────────────────────────────────────────────────────────── */

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ["--use-gl=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0]));

// Trình duyệt trong môi trường kiểm thử có thể không ra được internet; đưa thẳng
// mô hình vào đúng địa chỉ mà code thật xin. Phần CÒN LẠI của đường đi — WASM
// từ /mediapipe, khởi tạo, nhận diện — vẫn chạy y như thật.
const served = [];
await page.route("**/mediapipe-models/**", (r) => {
  served.push(r.request().url());
  return r.fulfill({ status: 200, contentType: "application/octet-stream", body: model });
});
const wasm = [];
page.on("response", (r) => {
  if (r.url().includes("/mediapipe/")) wasm.push(`${r.status()} ${r.url().split("/").pop()}`);
});

await page.goto(`${PAGE}/uipreview/khuon-mat`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /Chạy thử/ }).click();
try {
  await page.waitForSelector('[data-testid="face-closed"], [data-testid="face-error"]', { timeout: 300000 });
} catch {
  /* rơi xuống phần kiểm dưới, sẽ báo không đạt */
}

const text = async (id) =>
  (await page.locator(`[data-testid="${id}"]`).count())
    ? (await page.locator(`[data-testid="${id}"]`).textContent()).trim()
    : null;

const err = await text("face-error");
const open = await text("face-open");
const closed = await text("face-closed");
await browser.close();

console.log(`\nWASM tự phục vụ: ${wasm.join(" · ") || "(không thấy)"}`);
console.log(`Mô hình xin về : ${served.length} lượt`);
console.log(`Mắt mở  : ${open}`);
console.log(`Mắt nhắm: ${closed}\n`);

ok("mô hình khởi tạo được, không báo lỗi", err === null, String(err));
ok("WASM lấy từ chính máy chủ của app (/mediapipe), không phải CDN ngoài",
  wasm.some((w) => w.startsWith("200") && w.endsWith(".wasm")), wasm.join(" · "));
ok("code thật có xin mô hình từ storage.googleapis.com", served.length > 0);

const parse = (s) => {
  if (!s) return null;
  const faces = Number(/^(\d+) mặt/.exec(s)?.[1] ?? -1);
  const blink = Number(/nhắm ([\d.]+)/.exec(s)?.[1] ?? NaN);
  const verdict = /→ (\w+)/.exec(s)?.[1] ?? "";
  return { faces, blink, verdict };
};
const a = parse(open);
const b = parse(closed);

ok("tìm được khuôn mặt trong ảnh mắt mở", a?.faces === 1, String(open));
ok("tìm được khuôn mặt trong ảnh mắt nhắm", b?.faces === 1, String(closed));

// Đây là điều đáng giá nhất của cả bài: con số phân biệt hai trạng thái mắt.
ok("mức nhắm của ảnh MẮT MỞ nằm DƯỚI ngưỡng",
  Number.isFinite(a?.blink) && a.blink < FACE_DEFAULTS.blinkClosed,
  `nhắm=${a?.blink} ngưỡng=${FACE_DEFAULTS.blinkClosed}`);
ok("mức nhắm của ảnh MẮT NHẮM nằm TRÊN ngưỡng",
  Number.isFinite(b?.blink) && b.blink >= FACE_DEFAULTS.blinkClosed,
  `nhắm=${b?.blink} ngưỡng=${FACE_DEFAULTS.blinkClosed}`);
// Ngưỡng phải nằm GIỮA hai giá trị với biên rộng, không sát mép — sát mép thì
// một bản mô hình mới hay một khuôn mặt khác là kết quả lật.
ok("hai trạng thái cách nhau rõ rệt (biên ≥ 0,3)",
  Number.isFinite(a?.blink) && Number.isFinite(b?.blink) && b.blink - a.blink >= 0.3,
  `mở=${a?.blink} nhắm=${b?.blink}`);

check("ảnh mắt mở → kết luận 'ok'", a?.verdict, "ok");
check("ảnh mắt nhắm → kết luận 'blink'", b?.verdict, "blink");
ok("không có lỗi JavaScript nào trên trang", pageErrors.length === 0, pageErrors.join(" | "));

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
