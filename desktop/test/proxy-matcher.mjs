/* Kiểm thử: matcher của src/proxy.ts bỏ qua đúng tài nguyên tĩnh.
 *
 * Vì sao: file trọng số nhận diện khuôn mặt (/face-model/*.json|bin|wasm) từng
 * lọt vào proxy; trên tên miền riêng của studio (vieetjk.com) proxy rewrite nó
 * sang /site/<host>/face-model/… → 404 và khách không tìm được ảnh theo khuôn
 * mặt ("failed to fetch: (404)"). Trên tên miền chính vẫn chạy nên không ai thấy.
 *
 * Đọc chuỗi matcher thật trong proxy.ts và áp như Next (neo cả đường dẫn).
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");
const m = /matcher:\s*\[\s*"([^"]+)"/.exec(src);
if (!m) throw new Error("không tìm thấy matcher trong proxy.ts");
const re = new RegExp(`^${m[1].replace(/\\\\/g, "\\")}$`);

let fail = 0;
const check = (path, chayProxy) => {
  const got = re.test(path);
  const ok = got === chayProxy;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${path} → ${chayProxy ? "qua proxy" : "bỏ qua proxy"}${ok ? "" : "  (SAI)"}`);
};

// Trọng số nhận diện: KHÔNG được qua proxy (bị rewrite trên tên miền riêng).
check("/face-model/ssd_mobilenetv1_model-weights_manifest.json", false);
check("/face-model/face_recognition_model.bin", false);
check("/face-model/tfjs-backend-wasm-simd.wasm", false);
check("/mediapipe/face_landmarker.task", false);
check("/mediapipe/vision_wasm_internal.wasm", false);
// Tài nguyên tĩnh khác vẫn bỏ qua như cũ.
check("/favicon.svg", false);
check("/_next/static/chunks/app.js", false);
// Trang thật vẫn phải qua proxy (rewrite tên miền riêng, phiên đăng nhập).
check("/album/abc", true);
check("/a/abc", true);
check("/", true);
check("/cuoi", true);
check("/dashboard/studio", true);

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
