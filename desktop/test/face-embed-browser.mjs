/* VECTOR TRÌNH DUYỆT CÓ SO ĐƯỢC VỚI VECTOR MÁY CHỦ KHÔNG — đo thật, không suy luận.
 *
 * Việc quét khuôn mặt đã dời từ máy chủ (@/lib/face-node, TensorFlow nền WASM)
 * sang trình duyệt studio (@/lib/face-embed-browser, nền WebGL/WASM). Cả tính
 * năng đứng trên một giả định: CÙNG một ảnh qua hai nơi ra CÙNG khuôn mặt và
 * vector gần như trùng nhau — nếu không, khuôn mặt quét trên máy studio không
 * gom được với dữ liệu cũ và ảnh khách gửi không khớp ai cả, mà không có lỗi
 * nào hiện ra. Bài này cho cả hai chạy trên ảnh người thật (ảnh mẫu kèm sẵn
 * trong gói @vladmandic/face-api, không cần mạng) rồi so:
 *
 *   1. cùng số khuôn mặt, khung gần trùng;
 *   2. khoảng cách Euclid giữa hai vector của cùng một mặt « ngưỡng 0,6;
 *   3. bộ dò NHỎ (tiny) cho ảnh khách tự chụp lệch bao nhiêu so với SSD — con
 *      số quyết định có dám dùng nó để khách tải nhẹ hơn 5,4 MB hay không.
 *
 *   npx next dev -p 3333            # cửa sổ 1
 *   npm run test:face-embed-browser # cửa sổ 2
 *
 * Thiếu Chromium / server / ảnh mẫu thì BỎ QUA (exit 0), không báo hỏng.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanJpeg } from "../../src/lib/face-node.ts";
import { euclidean, GROUP_DEFAULTS } from "../../src/lib/face-group.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO = join(HERE, "..", "..", "node_modules", "@vladmandic", "face-api", "demo");
const BASE = process.env.UI_BASE || "http://localhost:3333";
const skip = (why) => {
  console.log(`⏭  BỎ QUA: ${why}`);
  process.exit(0);
};
let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

const files = [1, 2, 3, 4, 5, 6].map((i) => join(DEMO, `sample${i}.jpg`)).filter((f) => existsSync(f));
if (files.length === 0) skip("không có ảnh mẫu trong node_modules/@vladmandic/face-api/demo.");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  skip("chưa cài playwright.");
}
try {
  const r = await fetch(`${BASE}/uipreview`);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  skip(`chưa có server ở ${BASE}. Chạy 'npx next dev -p 3333' trước.`);
}
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
} catch {
  skip("không mở được Chromium. Đặt CHROME_PATH trỏ tới trình duyệt.");
}

const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
/* Đếm byte mô hình + thư viện THẬT SỰ đi qua mạng — con số in trên màn hình khách. */
const tai = { model: 0, wasm: 0 };
page.on("response", async (r) => {
  const u = r.url();
  if (!u.includes("/face-model/")) return;
  try {
    const n = (await r.body()).length;
    if (u.endsWith(".wasm")) tai.wasm += n;
    else tai.model += n;
  } catch {}
});
try {
  await page.goto(`${BASE}/uipreview/dang-quet-mat`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__faceEmbed === "function", null, { timeout: 30_000 });
} catch (e) {
  await browser.close();
  skip(`không mở được màn xem trước (${String(e).split("\n")[0]}).`);
}

const b64 = (f) => readFileSync(f).toString("base64");
const inPage = (data, mode) =>
  page.evaluate(
    async ({ data, mode }) => {
      const m = await window.__faceEmbed();
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const t = performance.now();
      if (mode === "album") {
        const { backend } = await m.napMoHinh("ssd");
        const t1 = performance.now();
        const faces = await m.scanJpegBrowser(bytes);
        return { backend, faces, ms: performance.now() - t1, napMs: t1 - t };
      }
      const r = await m.vectorAnhKhach(new Blob([bytes], { type: "image/jpeg" }), { boDo: mode });
      return { ...r, ms: performance.now() - t };
    },
    { data, mode }
  );

const NGUONG = GROUP_DEFAULTS.maxDistance;
let dMax = 0;
const msB = [];
const msN = [];
const tinyD = [];
const ssdSelfD = [];
let backend = "";
let napMs = 0;
for (const f of files) {
  const ten = f.split("/").pop();
  const bytes = new Uint8Array(readFileSync(f));
  const t0 = Date.now();
  const node = await scanJpeg(bytes);
  msN.push(Date.now() - t0);
  let br;
  try {
    br = await inPage(b64(f), "album");
  } catch (e) {
    ok(`${ten}: trình duyệt quét được`, false, String(e).split("\n")[0]);
    continue;
  }
  backend = br.backend;
  if (br.napMs > napMs) napMs = br.napMs;
  msB.push(br.ms);
  ok(`${ten}: cùng số khuôn mặt (máy chủ ${node.length}, trình duyệt ${br.faces.length})`, node.length === br.faces.length && node.length > 0);
  if (node.length !== br.faces.length) continue;
  let d = 0;
  let lechKhung = 0;
  node.forEach((a, i) => {
    const b = br.faces[i];
    d = Math.max(d, euclidean(a.descriptor, b.descriptor));
    lechKhung = Math.max(lechKhung, ...["x", "y", "w", "h"].map((k) => Math.abs(a.box[k] - b.box[k])));
  });
  dMax = Math.max(dMax, d);
  ok(`${ten}: cùng thứ tự, khung lệch ≤ 0,01 (thật ${lechKhung.toFixed(5)})`, lechKhung <= 0.01);
  ok(`${ten}: vector lệch ≤ 0,05 (thật ${d.toFixed(5)}; ngưỡng gom ${NGUONG})`, d <= 0.05);

  // Ảnh khách tự chọn: mặt TO NHẤT theo máy chủ, so với đường của khách (trình
  // duyệt tự giải mã + thu nhỏ) bằng SSD và bằng bộ dò nhỏ.
  const me = node.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a));
  for (const mode of ["ssd", "tiny"]) {
    try {
      const r = await inPage(b64(f), mode);
      if (!r.descriptor) {
        console.log(`   · ${ten} [${mode}] không thấy mặt`);
        if (mode === "tiny") tinyD.push(Infinity);
        continue;
      }
      // So với MỌI mặt máy chủ thấy: bộ dò nhỏ có thể chọn mặt "to nhất" khác.
      const gan = Math.min(...node.map((n) => euclidean(n.descriptor, r.descriptor)));
      const dMe = euclidean(me.descriptor, r.descriptor);
      (mode === "tiny" ? tinyD : ssdSelfD).push(dMe);
      console.log(`   · ${ten} [${mode}] tới mặt to nhất ${dMe.toFixed(3)} · tới mặt gần nhất ${gan.toFixed(3)} · ${r.soMat} mặt`);
    } catch (e) {
      console.log(`   · ${ten} [${mode}] lỗi: ${String(e).split("\n")[0]}`);
    }
  }
}
await browser.close();

const tb = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
console.log(`\nNền trình duyệt: ${backend} · nạp mô hình ${Math.round(napMs)} ms`);
console.log(`Mỗi ảnh (1920px mẫu): trình duyệt ${tb(msB)} ms · Node WASM ${tb(msN)} ms`);
console.log(`Tải về: trọng số ${(tai.model / 1048576).toFixed(1)} MB${tai.wasm ? ` + wasm ${(tai.wasm / 1048576).toFixed(1)} MB` : ""} (gồm cả bộ dò nhỏ dùng cho phép đo)`);
console.log(`Lệch vector lớn nhất trình duyệt ↔ máy chủ (ảnh album): ${dMax.toFixed(5)}`);
console.log(`Ảnh khách, SSD : ${ssdSelfD.map((d) => d.toFixed(3)).join(" ")}`);
console.log(`Ảnh khách, tiny: ${tinyD.map((d) => d.toFixed(3)).join(" ")}`);
ok("ảnh khách qua SSD khớp đúng người (mọi ảnh < ngưỡng/2)", ssdSelfD.length > 0 && ssdSelfD.every((d) => d < NGUONG / 2), ssdSelfD.join(" "));
ok("không có lỗi JavaScript trên trang", errs.length === 0, errs.join(" | "));
console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} lỗi`);
process.exit(fail === 0 ? 0 : 1);
