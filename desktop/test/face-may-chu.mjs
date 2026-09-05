/* Kiểm thử BỘ QUÉT KHUÔN MẶT CHẠY TRÊN MÁY CHỦ — chạy code thật, không giả lập.
 *
 * Vì sao bài này tồn tại. Toàn bộ tính năng "khách tìm ảnh có mặt mình" giờ
 * đứng trên một giả định hạ tầng: face-api chạy được trên Node bằng nền WASM,
 * KHÔNG cần gói native nào. Nếu giả định đó sai thì mọi kiểm thử đơn vị vẫn
 * xanh, `next build` vẫn xanh, và tính năng chết lặng trên production — đúng
 * kiểu hỏng đã làm mất mấy vòng trước đó.
 *
 * Bài này trả lời đúng những câu chỉ chạy thật mới biết:
 *   1. Trọng số có nằm trong gói npm và tìm ra được không.
 *   2. Nền WASM khởi động được trên Node này không, và mất bao lâu.
 *   3. Ba mạng nạp từ đĩa được không.
 *   4. `scanJpeg` nuốt được một JPEG thật và trả về đúng hình dạng dữ liệu.
 *   5. MỘT ẢNH TỐN BAO NHIÊU MILI GIÂY — con số quyết định cron chia mẻ ra sao.
 *
 * KHÔNG kiểm được ở đây: bộ dò có tìm ra MẶT NGƯỜI THẬT hay không. Hộp cát này
 * không tải được ảnh người thật về, còn mặt vẽ bằng canvas thì không đại diện
 * cho phân bố mà SSD MobileNet được huấn luyện. Đó là lý do có
 * /api/face/selftest: studio bấm một cái là biết trên ảnh THẬT của họ.
 */
import { modelDir, loadNets, scanJpeg, fetchThumb, SCAN_WIDTH } from "../../src/lib/face-node.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/* ── 1. Trọng số ─────────────────────────────────────────────────────────── */
const dir = modelDir();
ok("tìm được thư mục trọng số trong gói npm", typeof dir === "string" && dir.length > 0, String(dir));
if (!dir) {
  console.log(`\n${fail} lỗi`);
  process.exit(1);
}

/* ── 2 + 3. Nạp nền tính toán và ba mạng ─────────────────────────────────── */
const t0 = Date.now();
let nets = null;
try {
  nets = await loadNets();
} catch (e) {
  ok("nạp được TensorFlow (WASM) + 3 mạng", false, String(e?.message ?? e));
}
const napMs = Date.now() - t0;
ok("nạp được TensorFlow (WASM) + 3 mạng", !!nets?.ready, `mất ${napMs} ms`);
if (!nets) {
  console.log(`\n${fail} lỗi`);
  process.exit(1);
}
// Lượt nạp là chi phí một lần cho mỗi tiến trình. Trên 30 giây thì cron sẽ hết
// giờ trước khi quét được tấm nào — đó là hỏng, không phải chậm.
ok(`nạp mô hình dưới 30 giây (thật: ${(napMs / 1000).toFixed(1)}s)`, napMs < 30_000);

// Gọi lần hai phải trả về ĐÚNG đối tượng cũ: nếu không, mỗi ảnh nạp lại 12 MB
// trọng số và một mẻ 300 ảnh không bao giờ xong.
ok("gọi loadNets() lần hai dùng lại mô hình đã nạp", (await loadNets()) === nets);

/* ── 4 + 5. Quét một JPEG thật ───────────────────────────────────────────── */
const jpeg = (await import("jpeg-js")).default;
const W = SCAN_WIDTH;
const H = Math.round((SCAN_WIDTH * 2) / 3);
const rgba = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const p = i * 4;
  const x = i % W;
  const y = (i / W) | 0;
  rgba[p] = 90 + ((x * 37 + y * 11) % 120);
  rgba[p + 1] = 80 + ((x * 13 + y * 29) % 120);
  rgba[p + 2] = 70 + ((x * 7 + y * 53) % 120);
  rgba[p + 3] = 255;
}
const bytes = jpeg.encode({ data: rgba, width: W, height: H }, 90).data;

let faces = null;
const times = [];
for (let k = 0; k < 3; k++) {
  const s = Date.now();
  try {
    faces = await scanJpeg(bytes);
  } catch (e) {
    ok("scanJpeg chạy không ném lỗi", false, String(e?.message ?? e));
    break;
  }
  times.push(Date.now() - s);
}
ok("scanJpeg chạy không ném lỗi và trả về mảng", Array.isArray(faces));
// Ảnh nhiễu KHÔNG được sinh ra khuôn mặt: ngưỡng 0.35 đã thấp, nếu nó còn nhận
// cả nhiễu thì mỗi album sẽ đầy "người" rác và khách không tìm nổi mình.
ok(`ảnh nhiễu không sinh ra mặt giả (thấy ${faces?.length ?? "?"})`, (faces?.length ?? 0) === 0);

if (times.length) {
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)];
  console.log(`   ⏱  mỗi ảnh ${med} ms (${times.join(", ")}) → 800 ảnh ≈ ${((med * 800) / 60000).toFixed(1)} phút CPU`);
  // Trần rất rộng: chỉ để bắt trường hợp nền tính toán tụt về CPU thuần, lúc đó
  // một ảnh mất hàng chục giây và cron không bao giờ quét hết album.
  ok(`một ảnh dưới 10 giây (thật: ${med} ms)`, med < 10_000);
}

/* ── Hình dạng dữ liệu trả về ────────────────────────────────────────────── */
// Không có mặt thật để kiểm, nhưng vẫn phải chắc HỢP ĐỒNG dữ liệu đúng, vì bảng
// album_faces có ràng buộc độ dài 128 và 4 — sai là INSERT chết cả mẻ.
for (const f of faces ?? []) {
  ok("descriptor đúng 128 chiều", f.descriptor.length === 128, String(f.descriptor.length));
  ok(
    "khung nằm trong 0…1",
    [f.box.x, f.box.y, f.box.w, f.box.h].every((v) => v >= 0 && v <= 1)
  );
}

/* ── Lấy ảnh từ Drive ────────────────────────────────────────────────────── */
// Không có mạng ra ngoài trong hộp cát này, nên chỉ kiểm phần HỎNG PHẢI ÊM:
// id rác phải trả `null` chứ không được ném — một ảnh hỏng không được chặn mẻ.
const bad = await fetchThumb("khong-phai-id-that-0000000000", 200);
ok("fetchThumb với id sai trả null, không ném lỗi", bad === null);

console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} lỗi`);
process.exit(fail === 0 ? 0 : 1);
