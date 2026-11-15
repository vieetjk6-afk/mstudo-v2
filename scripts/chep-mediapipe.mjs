/**
 * Chép gói MÔ HÌNH CHẠY TRONG TRÌNH DUYỆT từ node_modules ra public/.
 *
 *   • public/mediapipe/  — WASM của MediaPipe (tìm khuôn mặt, nhắm mắt)
 *
 *   • public/face-model/ — trọng số face-api (SSD + landmark 68 + nhận dạng 128
 *     chiều, thêm bộ dò nhỏ) và 3 file .wasm của TensorFlow. Việc quét khuôn
 *     mặt đã rời máy chủ sang TRÌNH DUYỆT STUDIO (@/lib/face-embed-browser) để
 *     không tốn CPU Vercel, nên trình duyệt phải tải được đúng những trọng số
 *     máy chủ từng dùng. Bản thân thư viện face-api thì bundler đóng thành
 *     chunk lười, không chép ở đây. Máy chủ (khi FACE_SERVER_SCAN=1) vẫn đọc
 *     trọng số thẳng từ node_modules.
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
 *
 * HAI CHẾ ĐỘ, và khác nhau ở chỗ quan trọng:
 *
 *   • `postinstall` (mặc định) — DỄ TÍNH. Thiếu nguồn thì báo rồi đi tiếp:
 *     `npm ci --omit=optional`, một lần cài dở dang, hay cài lại chỉ để chạy
 *     lint đều không đáng làm hỏng cả lệnh.
 *   • `prebuild` (`--required`) — KHẮT KHE, thiếu là DỪNG BUILD.
 *
 * Vì sao phải khắt khe ở nhánh build: không có nó, một bản triển khai thiếu sạch
 * 26 MB mô hình vẫn XANH. Trang dựng ra bình thường, chỉ có nút "Quét" là im
 * lặng không khởi động, và không ai biết cho tới khi một studio thật bấm vào nó.
 * Đúng loại hỏng âm thầm mà cả phần lọc ảnh này đã phải sửa mấy lần. Build đỏ ở
 * đây thì lý do nằm ngay trong log; build xanh thì tài sản CHẮC CHẮN có mặt.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** `--required`: thiếu nguồn thì hỏng cả lệnh. Xem ghi chú đầu file. */
const REQUIRED = process.argv.includes("--required");

/**
 * Chép một thư mục, hoặc một số file trong đó, ra public/. Thiếu nguồn chỉ là
 * lỗi khi có `--required`; không có cờ đó thì báo rồi đi tiếp, vì
 * `npm ci --omit=optional` hay một lần cài dở dang vẫn phải chạy được.
 */
function copy(label, from, to, only) {
  if (!existsSync(from)) {
    if (REQUIRED) {
      console.error(
        `THIẾU ${label}: không có ${from}.\n\n` +
          `Bản dựng này sẽ ra một trang KHÔNG có mô hình AI — chạy được, nhưng nút "Quét"\n` +
          `im lặng không khởi động và không ai biết cho tới khi một studio thật bấm vào.\n` +
          `Chạy \`npm install\` để có node_modules rồi dựng lại.`
      );
      process.exit(1);
    }
    console.log(`Bỏ qua ${label}: chưa có ${from}.`);
    return;
  }
  mkdirSync(to, { recursive: true });
  // Đếm những file THẬT SỰ chép lần này, không đếm cả thư mục đích: một thư mục
  // đích còn sót từ bản dựng cũ sẽ khiến hàng rào dưới đây tưởng là chép thành công.
  const copied = [];
  if (only) {
    for (const f of only) {
      if (!existsSync(join(from, f))) continue;
      cpSync(join(from, f), join(to, f));
      copied.push(f);
    }
  } else {
    cpSync(from, to, { recursive: true });
    copied.push(...readdirSync(from));
  }
  // Không chép được file nào nghĩa là `only` không khớp gì — tên file trong gói
  // đã đổi ở một bản mới. Cũng phải dừng: đúng kiểu thay đổi lặng lẽ mà không ai
  // để ý cho tới lúc tính năng chết trên production.
  if (REQUIRED && copied.length === 0) {
    console.error(
      `THIẾU ${label}: có ${from} nhưng không chép được file nào — tên file trong gói có thể đã đổi.`
    );
    process.exit(1);
  }
  const mb = copied.reduce((n, f) => n + statSync(join(to, f)).size, 0) / 1048576;
  console.log(`Đã chép ${copied.length} file ${label} (${mb.toFixed(1)} MB).`);
}

copy(
  "MediaPipe → public/mediapipe",
  join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm"),
  join(ROOT, "public", "mediapipe")
);

// Trọng số nhận dạng khuôn mặt cho trình duyệt (studio quét album, khách tìm
// bằng ảnh của mình). Chỉ chép đúng các mạng đang dùng — gói còn kèm mạng đoán
// tuổi / cảm xúc không ai gọi.
copy(
  "face-api (trọng số) → public/face-model",
  join(ROOT, "node_modules", "@vladmandic", "face-api", "model"),
  join(ROOT, "public", "face-model"),
  ["ssd_mobilenetv1_model", "face_landmark_68_model", "face_recognition_model", "tiny_face_detector_model"].flatMap((m) => [
    `${m}-weights_manifest.json`,
    `${m}.bin`,
  ])
);
// Nền WASM của TensorFlow — đường lùi khi máy không có WebGL. Cùng thư mục để
// một dòng .gitignore và một tiền tố URL là đủ.
copy(
  "TensorFlow WASM → public/face-model",
  join(ROOT, "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist"),
  join(ROOT, "public", "face-model"),
  ["tfjs-backend-wasm.wasm", "tfjs-backend-wasm-simd.wasm", "tfjs-backend-wasm-threaded-simd.wasm"]
);
