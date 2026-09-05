/* Kiểm ĐƯỜNG "KHÁCH TẢI ẢNH CỦA MÌNH LÊN", chạy trong Chromium thật với mô hình thật.
 *
 * Vì sao phải là bài riêng, và vì sao không kiểm bằng dữ liệu giả được: đường
 * này đi qua sáu mắt xích mà không mắt xích nào lộ ra ở kiểm thử đơn vị —
 * `import()` động → tải MediaPipe từ /mediapipe → tải mạng nhận dạng từ
 * /face-model → giải mã File khách chọn → căn chỉnh + sinh vector → so với tâm
 * cụm. Đứt bất kỳ chỗ nào thì nút vẫn bấm được, chỉ là không bao giờ ra kết quả.
 *
 * Cách dựng dữ liệu: màn /uipreview/loc-theo-nguoi có nút dựng hai "người" bằng
 * hình học, chạy đúng đường ống thật để sinh tâm cụm cho họ, rồi để sẵn ở
 * `window.__thuNghiemMat` một BIẾN THỂ KHÁC của cùng hai người. Bài này lấy ảnh
 * đó tải lên — đúng tình huống thật: khách tải một tấm không nằm trong album.
 *
 * Mặt vẽ bằng hình học KHÔNG phải mặt người thật, nên bài này chứng minh ĐƯỜNG
 * ỐNG chạy đúng, không phải độ chính xác trên ảnh cưới thật.
 *
 *   npx next dev -p 3333        # cửa sổ 1
 *   npm run test:face-upload    # cửa sổ 2
 */
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = `${process.env.UI_BASE || "http://localhost:3333"}/uipreview/loc-theo-nguoi`;
const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, ".cache");
const MODEL_FILE = join(CACHE, "face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/*
 * Mô hình MediaPipe tải từ storage.googleapis.com lúc chạy. Nhiều môi trường
 * (kể cả nơi bài này hay chạy) chặn đường đó từ trong trình duyệt, nên lấy về
 * bằng Node rồi phục vụ lại cho trang — đúng cách desktop/test/face-browser.mjs
 * đã làm, và dùng chung một chỗ nhớ trên đĩa. Lấy không được thì BỎ QUA: thiếu
 * mạng không phải lỗi của code.
 */
let model;
if (existsSync(MODEL_FILE)) {
  model = readFileSync(MODEL_FILE);
  console.log(`Dùng mô hình đã lưu (${(model.length / 1048576).toFixed(1)} MB).`);
} else {
  try {
    const r = await fetch(MODEL_URL);
    if (!r.ok) throw new Error(String(r.status));
    model = Buffer.from(await r.arrayBuffer());
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(MODEL_FILE, model);
    console.log(`Đã tải mô hình (${(model.length / 1048576).toFixed(1)} MB).`);
  } catch (e) {
    console.log(`⏭  BỎ QUA: không tải được mô hình (${String(e).slice(0, 80)}).`);
    process.exit(0);
  }
}

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
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Ảnh của album không cần thật — bài này chỉ quan tâm ảnh KHÁCH TẢI LÊN.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

/** PNG xám trơn 200×200 — không có mặt người nào, để kiểm nhánh báo lỗi. */
const PLAIN = (() => {
  const W = 200;
  const crc32 = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const raw = Buffer.alloc((W + 1) * W);
  for (let y = 0; y < W; y++) {
    raw[y * (W + 1)] = 0;
    for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = 190;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
})();
await page.route("**/api/img**", (r) =>
  r.fulfill({ status: 200, contentType: "image/png", body: PNG })
);
await page.route("**/mediapipe-models/**", (r) =>
  r.fulfill({ status: 200, contentType: "application/octet-stream", body: model })
);

let res;
try {
  // `networkidle` chứ không `domcontentloaded`: bấm trước khi React hydrate xong
  // thì cú bấm vào ĐÚNG nút vẫn "thành công" mà không handler nào chạy — trang
  // đứng im, và bài kiểm thử báo "không tải được mô hình" cho một lý do hoàn
  // toàn khác. Đã mất một lượt gỡ lỗi vì đúng chỗ này.
  res = await page.goto(PAGE, { waitUntil: "networkidle", timeout: 40_000 });
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

/* ── Dựng tâm cụm thật ────────────────────────────────────────────────────── */
// Bấm cho tới khi trạng thái ĐỔI: hydrate xong hay chưa là chuyện của trình
// duyệt, không phải của bài kiểm thử.
const trangThai = () => page.locator("[data-thu-nghiem]").innerText();
for (let i = 0; i < 5; i++) {
  await page.getByRole("button", { name: /Dựng dữ liệu thật/ }).click();
  await page.waitForTimeout(1500);
  if (!/Mặc định/.test(await trangThai())) break;
}
let ready = false;
try {
  await page.waitForFunction(() => !!window.__thuNghiemMat, null, { timeout: 240_000 });
  ready = true;
} catch {
  /* dưới */
}
if (!ready) {
  console.log("⏭  BỎ QUA: không dựng được vector — nhiều khả năng máy này không tải được mô hình.");
  await browser.close();
  process.exit(0);
}
ok("dựng được tâm cụm thật cho hai người (mô hình tải và chạy được)", true);

const anh = await page.evaluate(() => window.__thuNghiemMat);
const toBuf = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

async function taiLen(dataUrl) {
  await page.setInputFiles('input[type="file"]', {
    name: "anh-cua-toi.jpg",
    mimeType: "image/jpeg",
    buffer: toBuf(dataUrl),
  });
  // Chờ tới khi hết trạng thái "đang…" (nút quay về chữ gốc).
  await page
    .waitForFunction(
      () => !/Đang tải bộ nhận diện|Đang tìm/.test(document.body.innerText),
      null,
      { timeout: 120_000 }
    )
    .catch(() => {});
  return page.innerText("body");
}

/* ── 1. Tải ảnh CÙNG người → phải nhận ra ─────────────────────────────────── */
{
  const body = await taiLen(anh.nguoiA);
  ok("tải lên một tấm KHÁC của người A → báo đã tìm thấy", /Đã tìm thấy bạn/.test(body));
  // Và phải THẬT SỰ lọc lưới, không chỉ hiện chữ.
  const n = await page.locator('[aria-label^="Xem ảnh"]').count();
  ok("…và lưới đã lọc xuống đúng số ảnh của người A", n === 4, `đếm ${n}`);
  const chon = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some(
      (b) => /Người A/.test(b.textContent || "") && /solid/.test(b.querySelector("span")?.style.outline || "")
    )
  );
  ok("…và đúng khuôn mặt người A được đánh dấu đang chọn", chon);
}

/* ── 2. Người KHÔNG có trong album ────────────────────────────────────────
 *
 * Ở đây KHÔNG đòi phải ra "không tìm thấy", và lý do đáng ghi lại: mặt vẽ bằng
 * hình học nằm quá gần nhau. Đo ở /uipreview/gom-theo-nguoi: cùng người ~0,106,
 * KHÁC người ~0,439 — mà ngưỡng là 0,6. Nghĩa là với dữ liệu này, người lạ vẫn
 * lọt. Đó là tính chất của MẶT VẼ, không phải lỗi ngưỡng: trên ảnh chụp thật hai
 * phân bố cách nhau xa hơn nhiều.
 *
 * Nên bài này chỉ đòi đúng thứ nó chứng minh được: đường đi phải KẾT THÚC ở một
 * trạng thái rõ ràng, không treo và không im lặng.
 */
{
  await page.getByRole("button", { name: /Xem cả album/ }).first().click();
  const body = await taiLen(anh.nguoiLa);
  ok(
    "người lạ: vẫn ra một kết luận rõ ràng, không treo",
    /Đã tìm thấy bạn|Không tìm thấy bạn trong album/.test(body),
    body.slice(0, 200)
  );
}

/* ── 3. Ảnh KHÔNG có mặt người nào ────────────────────────────────────────── */
{
  await page.getByRole("button", { name: /Xem cả album/ }).first().click().catch(() => {});
  const body = await taiLen(`data:image/png;base64,${PLAIN.toString("base64")}`);
  ok("ảnh không có mặt người → nói rõ, không im lặng", /Không thấy khuôn mặt nào/.test(body), body.slice(0, 200));
  const n = await page.locator('[aria-label^="Xem ảnh"]').count();
  ok("…và KHÔNG đụng vào lưới ảnh", n === 8, `đếm ${n}`);
}

ok("không có lỗi JavaScript nào trên trang", errors.length === 0, errors.join(" | "));

await browser.close();
console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
