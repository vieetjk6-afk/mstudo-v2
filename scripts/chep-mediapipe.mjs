/**
 * Chép các gói MÔ HÌNH CHẠY TRONG TRÌNH DUYỆT từ node_modules ra public/.
 *
 *   • public/mediapipe/  — WASM của MediaPipe (tìm khuôn mặt, nhắm mắt)
 *   • public/face-model/ — trọng số nhận dạng danh tính của face-api (gom ảnh
 *                          theo từng người)
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
  // Đếm những file THẬT SỰ chép lần này, không đếm cả thư mục đích: hai lượt chép
  // dưới đây cùng ghi vào public/face-model, nên đọc thư mục sẽ báo cả file của
  // lượt trước. Quan trọng hơn: một thư mục đích còn sót từ bản dựng cũ sẽ khiến
  // hàng rào dưới đây tưởng là chép thành công.
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

// CHỈ lấy mô hình nhận dạng danh tính. Gói face-api còn kèm bộ dò mặt và bộ
// landmark riêng của nó, nhưng hai việc đó MediaPipe đã làm rồi — chép thêm là
// bắt studio tải hai lần cùng một thứ.
copy(
  "mô hình nhận dạng khuôn mặt → public/face-model",
  join(ROOT, "node_modules", "@vladmandic", "face-api", "model"),
  join(ROOT, "public", "face-model"),
  ["face_recognition_model-weights_manifest.json", "face_recognition_model.bin"]
);

// Và cả THƯ VIỆN, dưới dạng UMD tự phục vụ.
//
// Vì sao không `import` gói này như một phụ thuộc bình thường: bản ESM của nó gọi
// `require()` theo kiểu webpack không phân tích tĩnh được ("Critical dependency"),
// và kéo theo cả nhánh TensorFlow cho Node vào gói trình duyệt. Bản UMD nạp bằng
// thẻ <script> từ chính máy chủ của app thì không đụng tới bundler chút nào, vẫn
// hợp CSP (`script-src 'self'`), và chỉ tải khi studio thật sự bật tính năng.
// Xem ghi chú ở src/lib/face-embed.ts — ĐỪNG "dọn dẹp" bằng cách import lại.
copy(
  "thư viện nhận dạng (UMD) → public/face-model",
  join(ROOT, "node_modules", "@vladmandic", "face-api", "dist"),
  join(ROOT, "public", "face-model"),
  ["face-api.js"]
);
