/**
 * Chép bộ WASM của MediaPipe từ node_modules ra public/mediapipe/.
 *
 * VÌ SAO PHẢI TỰ PHỤC VỤ, không nạp thẳng từ CDN như hướng dẫn của MediaPipe:
 * CSP của repo (next.config.mjs) chỉ cho `script-src 'self'` cộng vài host của
 * Google. jsdelivr/unpkg bị chặn — và chặn ÂM THẦM: bộ nhận diện đơn giản không
 * bao giờ khởi động, không có lỗi nào dễ đọc.
 *
 * Hai file .wasm nặng ~9,5 MB mỗi cái nên KHÔNG commit vào git (xem .gitignore);
 * script này chạy ở `postinstall`, tức là cả máy lập trình lẫn Vercel đều có.
 * Trình duyệt chỉ tải MỘT trong hai (bản SIMD nếu máy hỗ trợ), và tải một lần
 * rồi nằm trong cache.
 *
 * Bản thân MÔ HÌNH (face_landmarker.task) không nằm ở đây: nó tải từ
 * storage.googleapis.com lúc chạy — khớp `connect-src https://*.googleapis.com`
 * của CSP siết chặt, và không phải thêm 3,7 MB nữa vào mỗi lần triển khai.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FROM = join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const TO = join(ROOT, "public", "mediapipe");

if (!existsSync(FROM)) {
  // Không phải lỗi: `npm ci --omit=optional` hoặc cài dở dang vẫn phải chạy tiếp.
  console.log("Bỏ qua: chưa có @mediapipe/tasks-vision/wasm.");
  process.exit(0);
}
mkdirSync(TO, { recursive: true });
cpSync(FROM, TO, { recursive: true });
const files = readdirSync(TO);
const mb = files.reduce((n, f) => n + statSync(join(TO, f)).size, 0) / 1048576;
console.log(`Đã chép ${files.length} file MediaPipe vào public/mediapipe (${mb.toFixed(1)} MB).`);
