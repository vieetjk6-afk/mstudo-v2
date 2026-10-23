/**
 * Xuất video "Chốt lịch cưới — nhận 2 quà" (src/components/WeddingGiftVideo.tsx)
 * ra MP4, khổ dọc 1080×1920 (mặc định) hoặc ngang 1920×1080 (--ngang).
 *
 * Cùng cách với scripts/xuat-video-sepay.mjs: không quay màn hình theo thời gian
 * thật (máy chậm là video giật) — mở màn /uipreview/video-qua-cuoi-xuat, đặt
 * thời gian từng khung qua window.__giftVideo.setTime(t), chụp, đẩy vào ffmpeg.
 *
 * Studio muốn bản có tên + SĐT của mình ở cảnh cuối thì truyền --studio, --phone.
 *
 * Cần: `npm run dev` đang chạy (uipreview chỉ có ở bản dev) và một ffmpeg có
 * libx264 (`FFMPEG=/đường/dẫn/ffmpeg`, mặc định lấy `ffmpeg` trong PATH).
 * Trình duyệt khác bản Playwright thì đặt CHROME_PATH.
 *
 *   node scripts/xuat-video-qua-cuoi.mjs [ra.mp4] [--ngang] [--studio "Mây Studio"] [--phone "0909 000 000"]
 *                                        [--fps 30] [--url http://localhost:3000]
 *   node scripts/xuat-video-qua-cuoi.mjs anh.png --khung 12.5   # chụp MỘT khung ở giây 12.5 để soát bố cục
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const FLAGS = new Set(["ngang"]);
const out = args.find((a, i) => !a.startsWith("--") && !(args[i - 1]?.startsWith("--") && !FLAGS.has(args[i - 1].slice(2)))) || "qua-cuoi.mp4";
const land = args.includes("--ngang");
const fps = Number(opt("fps", 30));
const base = opt("url", "http://localhost:3000");
const still = opt("khung", null);
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const [W, H] = land ? [1920, 1080] : [1080, 1920];

const q = new URLSearchParams();
if (opt("studio")) q.set("studio", opt("studio"));
if (opt("phone")) q.set("phone", opt("phone"));

const EXEC = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`${base}/uipreview/video-qua-cuoi-xuat${land ? "-ngang" : ""}?${q}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__giftVideo, null, { timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__giftVideo.duration);

const frameAt = async (t) => {
  await page.evaluate((x) => window.__giftVideo.setTime(x), t);
  // Chờ React vẽ xong khung vừa đặt.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
};

if (still !== null) {
  writeFileSync(out, await frameAt(Number(still)));
  await browser.close();
  console.log(`Đã chụp ${out} ở giây ${still}`);
  process.exit(0);
}

const ff = spawn(
  ffmpeg,
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", out],
  { stdio: ["pipe", "inherit", "inherit"] }
);
const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg thoát mã ${c}`)))));

const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  const png = await frameAt(i / fps);
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 5) === 0) process.stdout.write(`\r${Math.round((i / frames) * 100)}%`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\rĐã xuất ${out} · ${W}×${H} · ${frames} khung · ${duration}s @ ${fps}fps`);
