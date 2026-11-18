/* TỰ QUÉT KHUÔN MẶT KHI STUDIO MỞ DASHBOARD — chạy THẬT trong Chromium.
 *
 * @/components/v2/FaceAutoScan chạy không người bấm, trên máy của studio, lên
 * dữ liệu thật. Bài này dựng nó ở màn xem trước `tu-quet-mat-that`, giả lập
 * các API (hàng đợi, giao việc, nhận kết quả, gom) và ảnh Drive bằng ảnh người
 * thật kèm trong @vladmandic/face-api, rồi kiểm cả vòng:
 *
 *   1. hỏi hàng đợi → quét đủ mọi ảnh của mọi album → gửi kết quả có khuôn mặt
 *      thật → gom từng album → báo "đã quét xong";
 *   2. ảnh 404 được báo bỏ qua vĩnh viễn, không làm dừng album;
 *   3. "Tắt tự quét trên máy này" → lần mở sau KHÔNG hỏi hàng đợi;
 *   4. máy kiểu điện thoại (màn nhỏ, cảm ứng) → không tự quét.
 *
 *   npx next dev -p 3333              # cửa sổ 1
 *   npm run test:face-auto-scan       # cửa sổ 2
 *
 * Thiếu Chromium / server / ảnh mẫu thì BỎ QUA (exit 0).
 */
// serviceWorkers: "block" — service worker của app (PWA) tự xử lý request
// /api/img, và request đi từ service worker KHÔNG qua page.route: ảnh giả lập
// bị bỏ qua, request rơi vào máy chủ dev thật (502). Chạy lẻ thì SW chưa kịp
// bật nên không lộ; chạy cùng các bài khác (máy chậm) mới lộ.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const mau = [1, 2, 3].map((i) => join(DEMO, `sample${i}.jpg`));
if (!mau.every((f) => existsSync(f))) skip("không có ảnh mẫu trong node_modules/@vladmandic/face-api/demo.");
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

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Hai album: A1 có 2 ảnh người thật + 1 ảnh 404; A2 có 1 ảnh. */
const ALBUMS = { A1: [1, 2, 99], A2: [3], G1: [] };

/** Gắn API giả vào một trang; trả về sổ ghi những gì trang đã gọi. */
async function giaLap(page, { googleCors = false } = {}) {
  const so = { hangDoi: 0, ketQua: [], gom: [], nhatKy: [], quaVercel: 0, thangGoogle: 0 };
  const t0 = Date.now();
  const ghi = (m) => so.nhatKy.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
  page.on("console", (m) => ghi(`console.${m.type()}: ${m.text().slice(0, 160)}`));
  page.on("framenavigated", (f) => f === page.mainFrame() && ghi(`điều hướng ${f.url()}`));
  const daQuet = new Set();
  await page.route("**/api/face-local/hang-doi", (r) => {
    so.hangDoi++;
    ghi("hàng đợi");
    const albums = Object.entries(ALBUMS)
      .map(([id, ps]) => ({ id, ten: `Album ${id}`, conLai: ps.filter((n) => !daQuet.has(n)).length }))
      .filter((a) => a.conLai > 0)
      // Album đã quét hết nhưng lượt gom trước hỏng: chỉ cần gom lại.
      .concat(so.gom.includes("G1") ? [] : [{ id: "G1", ten: "Album G1", conLai: 0, canGom: true }]);
    return r.fulfill({ json: { ok: true, albums } });
  });
  await page.route(/\/api\/albums\/([AG]\d)\/face-local/, async (r) => {
    const id = r.request().url().match(/albums\/([AG]\d)\//)[1];
    const ps = ALBUMS[id];
    const conLai = () => ps.filter((n) => !daQuet.has(n));
    ghi(`${r.request().method()} ${id} ${(r.request().postData() || "").slice(0, 60)}`);
    if (r.request().method() === "GET") {
      // Như máy chủ thật: `?so=` bỏ qua ngần ấy tấm đầu (tấm vừa hỏng tạm).
      const so0 = Number(new URL(r.request().url()).searchParams.get("so") || 0);
      const anh = conLai().slice(so0).map((n) => ({ id: uuid(n), drive_file_id: `d${n}`, name: `anh${n}.jpg` }));
      const canGom = id === "G1" && !so.gom.includes("G1");
      return r.fulfill({ json: { ok: true, mayChuQuet: false, tong: ps.length || 50, daQuet: ps.length ? ps.length - anh.length : 50, conLai: anh.length, nguoi: 0, canGom, anh } });
    }
    const body = JSON.parse(r.request().postData() || "{}");
    if (body.gom) {
      so.gom.push(id);
      return r.fulfill({ json: { ok: true, gom: true, nguoi: 2 } });
    }
    for (const k of body.ketQua) {
      so.ketQua.push({ album: id, ...k });
      daQuet.add(Number(k.photoId.slice(-12)));
    }
    return r.fulfill({ json: { ok: true, daGhi: body.ketQua.length, khuonMat: 0, boQuaDaQuet: 0, conLai: conLai().length, xong: conLai().length === 0 } });
  });
  // CDN Google: `googleCors` = Google có gửi header cho đọc chéo miền không.
  await page.route("https://lh3.googleusercontent.com/**", (r) => {
    const n = Number(r.request().url().match(/\/d\/d(\d+)=/)?.[1]);
    so.thangGoogle++;
    ghi(`google ${n}`);
    // Không đặt gì thì Playwright TỰ THÊM header cho phép → phải nói rõ "chỉ cho
    // miền khác" để trình duyệt chặn thật, như Google không gửi CORS.
    const cors = { "Access-Control-Allow-Origin": googleCors ? "*" : "https://mien-khac.example" };
    if (n === 99) return r.fulfill({ status: 404, headers: cors, body: "not found" });
    return r.fulfill({ status: 200, contentType: "image/jpeg", headers: cors, body: readFileSync(join(DEMO, `sample${n}.jpg`)) });
  });
  await page.route("**/api/img?*", (r) => {
    const n = Number(new URL(r.request().url()).searchParams.get("id").slice(1));
    so.quaVercel++;
    ghi(`ảnh ${n}`);
    if (n === 99) return r.fulfill({ status: 404, body: "not found" });
    return r.fulfill({ status: 200, contentType: "image/jpeg", body: readFileSync(join(DEMO, `sample${n}.jpg`)) });
  });
  return so;
}

/* ── 1 + 2. Cả vòng trên máy tính ──────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ serviceWorkers: "block",  viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  const so = await giaLap(page, { googleCors: true });
  await page.goto(`${BASE}/uipreview/tu-quet-mat-that`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  let thay = "";
  try {
    // Rộng tay: chạy song song với các bài trình duyệt khác (npm test) thì một
    // máy CI / laptop chậm đi nhiều lần. polling theo giờ, không theo khung hình.
    await page.waitForFunction(() => /Đã quét xong khuôn mặt/.test(document.body.innerText), null, { timeout: 420_000, polling: 500 });
    thay = await page.innerText("body");
  } catch {
    thay = await page.innerText("body").catch(() => "");
  }
  ok("hỏi hàng đợi", so.hangDoi >= 1);
  const theoAnh = new Map(so.ketQua.map((k) => [k.photoId, k]));
  ok("quét đủ 4 ảnh của 2 album", theoAnh.size === 4, `đã gửi ${[...theoAnh.keys()].join(", ")}`);
  const mat = (n) => theoAnh.get(uuid(n))?.faces?.length ?? -1;
  ok(`ảnh người thật có khuôn mặt (${mat(1)}, ${mat(2)}, ${mat(3)})`, mat(1) > 0 && mat(2) > 0 && mat(3) > 0);
  const f = theoAnh.get(uuid(1))?.faces?.[0];
  ok("mỗi khuôn mặt gửi đúng 128 số + khung 4 số", f && f.descriptor.length === 128 && f.box.length === 4);
  ok("ảnh 404 được báo bỏ qua vĩnh viễn, không làm dừng album", theoAnh.get(uuid(99))?.skip === "http-404");
  ok("gom từng album sau khi quét", so.gom.includes("A1") && so.gom.includes("A2"));
  ok("album đã quét mà chưa gom → được gom lại", so.gom.includes("G1"));
  ok("báo đã xong 3 album", /Đã quét xong khuôn mặt 3 album/.test(thay), thay.replace(/\s+/g, " ").slice(-300));
  ok("không lỗi JavaScript", errs.length === 0, errs.join(" | "));
  ok(`Google cho đọc chéo miền → ảnh quét KHÔNG đi qua Vercel (Google ${so.thangGoogle}, Vercel ${so.quaVercel} — chỉ ảnh 404 được hỏi lại máy chủ)`, so.thangGoogle >= 4 && so.quaVercel === 1);
  if (fail) console.log(so.nhatKy.filter((l) => !/HMR|React DevTools/.test(l)).join("\n"));

  /* ── 3. Tắt trên máy này → lần sau không hỏi gì ───────────────────────────── */
  await page.evaluate(() => localStorage.setItem("mstudo-face-tu-quet", "tat"));
  const truoc = so.hangDoi;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2_500);
  ok("đã tắt trên máy này → không hỏi hàng đợi nữa", so.hangDoi === truoc);
  await ctx.close();
}

/* ── 2b. Google CHẶN đọc chéo miền → tự lùi về đường cũ qua máy chủ ─────────── */
{
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const so = await giaLap(page, { googleCors: false });
  await page.goto(`${BASE}/uipreview/tu-quet-mat-that`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  let thay = "";
  try {
    await page.waitForFunction(() => /Đã quét xong khuôn mặt/.test(document.body.innerText), null, { timeout: 420_000, polling: 500 });
    thay = await page.innerText("body");
  } catch {
    thay = await page.innerText("body").catch(() => "");
  }
  const theoAnh = new Map(so.ketQua.map((k) => [k.photoId, k]));
  ok("Google chặn CORS → vẫn quét đủ 4 ảnh qua máy chủ, có khuôn mặt", theoAnh.size === 4 && (theoAnh.get(uuid(1))?.faces?.length ?? 0) > 0, `${theoAnh.size} ảnh`);
  ok(`…và thôi thử Google sau vài lần hỏng (Google ${so.thangGoogle} lượt, Vercel ${so.quaVercel})`, so.thangGoogle <= 3 && so.quaVercel >= 4);
  ok("…vẫn báo xong", /Đã quét xong khuôn mặt/.test(thay));
  await ctx.close();
}

/* ── 3b. Hai tab dashboard → chỉ MỘT tab quét; đóng tab đó thì tab kia tiếp quản ── */
{
  const ctx = await browser.newContext({ serviceWorkers: "block",  viewport: { width: 1280, height: 800 } });
  const t1 = await ctx.newPage();
  const t2 = await ctx.newPage();
  const so1 = await giaLap(t1);
  const so2 = await giaLap(t2);
  // Album dài để tab 1 còn đang quét khi tab 2 mở.
  await t1.goto(`${BASE}/uipreview/tu-quet-mat-that`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  // polling theo giờ, không theo khung hình: tab nằm sau không vẽ khung nào.
  await t1.waitForFunction(() => /Chuẩn bị quét|Đang quét khuôn mặt|Đã quét xong/.test(document.body.innerText), null, { timeout: 120_000, polling: 250 });
  await t2.goto(`${BASE}/uipreview/tu-quet-mat-that`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await t2.waitForTimeout(3_000);
  ok("tab thứ hai không quét trong lúc tab đầu đang giữ việc quét", so1.hangDoi >= 1 && so2.hangDoi === 0, `tab1 ${so1.hangDoi}, tab2 ${so2.hangDoi}`);
  await t1.close();
  await t2.waitForTimeout(3_000);
  ok("đóng tab đầu → tab thứ hai tiếp quản", so2.hangDoi >= 1);
  await ctx.close();
}

/* ── 4. Điện thoại → không tự quét ─────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ serviceWorkers: "block",  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const so = await giaLap(page);
  await page.goto(`${BASE}/uipreview/tu-quet-mat-that`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2_500);
  ok("điện thoại → không tự quét", so.hangDoi === 0);
  await ctx.close();
}

await browser.close();
console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} lỗi`);
process.exit(fail === 0 ? 0 : 1);
