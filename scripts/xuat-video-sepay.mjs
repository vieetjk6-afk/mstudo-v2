/**
 * Xuất video hướng dẫn SePay (src/components/SepayGuideVideo.tsx) ra MP4
 * 1280×720, để gửi Zalo / đăng Facebook / YouTube cho studio.
 *
 * Không quay màn hình theo thời gian thật (máy chậm là video giật): mở màn
 * /uipreview/video-sepay-xuat, đặt thời gian từng khung một qua
 * window.__sepayGuide.setTime(t), chụp, rồi đẩy thẳng vào ffmpeg.
 *
 * Cần: `npm run dev` đang chạy (uipreview chỉ có ở bản dev) và một ffmpeg có
 * libx264 (`FFMPEG=/đường/dẫn/ffmpeg`, mặc định lấy `ffmpeg` trong PATH).
 * Trình duyệt khác bản Playwright thì đặt CHROME_PATH.
 *
 *   node scripts/xuat-video-sepay.mjs [ra.mp4] [--fps 30] [--url http://localhost:3000]
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) || "huong-dan-sepay.mp4";
const fps = Number(opt("fps", 30));
const base = opt("url", "http://localhost:3000");
const ffmpeg = process.env.FFMPEG || "ffmpeg";

// Như các script chụp giao diện khác: CHROME_PATH khi bản Playwright cài sẵn
// không khớp trình duyệt có trên máy.
const EXEC = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/uipreview/video-sepay-xuat`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__sepayGuide, null, { timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__sepayGuide.duration);

const ff = spawn(
  ffmpeg,
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", out],
  { stdio: ["pipe", "inherit", "inherit"] }
);
const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg thoát mã ${c}`)))));

const frames = Math.round(duration * fps);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.__sepayGuide.setTime(t), i / fps);
  // Chờ React vẽ xong khung vừa đặt.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 720 } });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % (fps * 5) === 0) process.stdout.write(`\r${Math.round((i / frames) * 100)}%`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\rĐã xuất ${out} · ${frames} khung · ${duration}s @ ${fps}fps`);
