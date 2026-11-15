/* eslint-disable @typescript-eslint/no-explicit-any */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { quetRgba, SCAN_WIDTH, type ScannedFace } from "./face-scan-core";
// Ngưỡng dò, trần số mặt, chuẩn hoá khung, đo nét nằm ở @/lib/face-scan-core —
// MỘT chỗ cho cả máy chủ lẫn trình duyệt studio (@/lib/face-embed-browser).
export { SCAN_WIDTH } from "./face-scan-core";

/**
 * NHẬN DIỆN KHUÔN MẶT CHẠY TRÊN MÁY CHỦ.
 *
 * VÌ SAO CÓ FILE NÀY. Bản trước quét khuôn mặt trong TRÌNH DUYỆT CỦA STUDIO: mở
 * bảng điều khiển album thì nó chạy ngầm. Studio nói thẳng là bước đó thừa —
 * studio không cần tìm mặt, chỉ KHÁCH mới cần. Mà nếu studio không mở màn đó thì
 * album gửi đi vẫn chưa có khuôn mặt nào, và khách bấm vào chẳng thấy gì. Nên
 * việc quét phải rời khỏi máy studio hẳn: tạo album xong là máy chủ tự quét.
 *
 * VÌ SAO KHÔNG DÙNG LẠI MEDIAPIPE NHƯ BẢN TRÌNH DUYỆT. MediaPipe Tasks-Vision
 * nhận ảnh vào qua canvas/WebGL của trình duyệt; trên Node không có DOM lẫn
 * WebGL nên đường nạp ảnh của nó không tồn tại. face-api thì có sẵn bộ dò mặt
 * (SSD MobileNet V1) và bộ landmark 68 điểm chạy thuần TensorFlow — nạp được
 * bằng WASM trên Node, KHÔNG cần biên dịch gói native nào.
 *
 * ⚠️ HỆ QUẢ QUAN TRỌNG — ĐỪNG TRỘN VECTOR HAI ĐƯỜNG. Bản trình duyệt căn mặt
 * bằng góc mắt của MediaPipe (478 điểm); bản này để face-api tự căn theo 68 điểm
 * của nó. Hai cách căn cho ra hai ô ảnh mặt khác nhau, nên CÙNG MỘT NGƯỜI qua
 * hai đường sẽ ra hai vector xa nhau — gom nhóm sẽ tách đôi một người mà không
 * báo lỗi gì. Vì vậy máy chủ là NƠI DUY NHẤT sinh vector: cả ảnh trong album lẫn
 * ảnh khách tự tải lên (xem /api/album/[slug]/face-match) đều đi qua đây.
 *
 * Trọng số đọc thẳng từ `node_modules/@vladmandic/face-api/model` (đã kèm trong
 * gói npm, ~12 MB cho 3 mạng). Chúng KHÔNG nằm trong public/ — file trong public
 * được CDN phát ra ngoài, mà đây là thứ chỉ máy chủ cần. `next.config.js` khai
 * báo `outputFileTracingIncludes` để Vercel đóng gói kèm; thiếu khai báo đó thì
 * build vẫn xanh còn chạy thật thì "model not found".
 *
 * KHÔNG dùng `import "server-only"` ở đây, và đó là chủ ý: `server-only` chỉ
 * phân giải được bên trong Next, nên nó khoá luôn cả kiểm thử Node
 * (npm run test:face-may-chu) — mà chỗ dễ hỏng nhất của file này là phần NẠP
 * MÔ HÌNH, đúng thứ chỉ chạy thật mới biết. Ranh giới vẫn được canh, bằng thứ
 * còn ồn hơn: `node:module` và `node:fs` ngay đầu file khiến MỌI gói client nhập
 * nhầm file này chết ngay lúc build ("Can't resolve 'node:module'").
 */

export type ServerFace = ScannedFace;

type Nets = {
  faceapi: any;
  ready: true;
};

let loading: Promise<Nets> | null = null;

/**
 * Tìm một thư mục bên trong node_modules, bằng cách ĐI LÊN từ file này rồi từ
 * cwd, thay vì hỏi `require.resolve`.
 *
 * Vì sao không dùng `require.resolve` cho gọn: webpack ĐỌC ĐƯỢC lời gọi đó và
 * cố kéo file vào gói. Với một file `.wasm` thì `next build` chết ngay —
 * "module is not flagged as WebAssembly module". Đi tìm bằng đường dẫn thì
 * webpack không có gì để phân tích, mà kết quả vẫn đúng ở cả hai nơi: máy lập
 * trình (gốc repo) lẫn Vercel (thư mục của serverless function).
 */
function timTrongNodeModules(parts: string[], moc: string): string | null {
  const starts = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 12; i++) {
      const cand = join(dir, "node_modules", ...parts);
      if (existsSync(join(cand, moc))) return cand;
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

/** Thư mục chứa trọng số, hoặc `null` nếu gói npm không có (không nên xảy ra). */
export function modelDir(): string | null {
  return timTrongNodeModules(
    ["@vladmandic", "face-api", "model"],
    "ssd_mobilenetv1_model-weights_manifest.json"
  );
}

/** Thư mục chứa các file .wasm của nền TensorFlow. */
export function wasmDir(): string | null {
  return timTrongNodeModules(
    ["@tensorflow", "tfjs-backend-wasm", "dist"],
    "tfjs-backend-wasm.wasm"
  );
}

/**
 * Nạp TensorFlow (nền WASM) + ba mạng, MỘT LẦN cho mỗi tiến trình.
 *
 * Vercel giữ tiến trình sống giữa các lượt gọi liên tiếp, nên lượt đầu tốn vài
 * giây rồi những lượt sau dùng lại — đó là lý do bộ quét chạy theo MẺ LỚN thay
 * vì mỗi ảnh một lượt gọi.
 */
export function loadNets(): Promise<Nets> {
  if (loading) return loading;
  loading = (async () => {
    const dir = modelDir();
    if (!dir) throw new Error("khong_thay_trong_so_khuon_mat");

    const wdir = wasmDir();
    if (!wdir) throw new Error("khong_thay_file_wasm");

    const tf: any = await import("@tensorflow/tfjs");
    const wasm: any = await import("@tensorflow/tfjs-backend-wasm");
    // Nền WASM cần đúng mấy file .wasm nằm cạnh gói; không chỉ đường thì nó đi
    // tìm trên CDN và chết lặng trong môi trường không có mạng ra ngoài. Dấu "/"
    // cuối là BẮT BUỘC: thiếu nó thì tfjs coi đây là tên file, không phải thư mục.
    wasm.setWasmPaths(`${wdir}/`);
    await tf.setBackend("wasm");
    await tf.ready();

    // Bản `node-wasm` chứ không phải `main` của gói: `main` kéo theo
    // @tensorflow/tfjs-node (gói NATIVE, phải biên dịch) — không cài được trên
    // Vercel. Bản này thuần WASM.
    const faceapi: any = await import("@vladmandic/face-api/dist/face-api.node-wasm.js");
    const nets = faceapi.nets ?? faceapi.default?.nets;
    if (!nets) throw new Error("face_api_khong_nap_duoc");
    await nets.ssdMobilenetv1.loadFromDisk(dir);
    await nets.faceLandmark68Net.loadFromDisk(dir);
    await nets.faceRecognitionNet.loadFromDisk(dir);
    return { faceapi: faceapi.default ?? faceapi, ready: true as const };
  })();
  // Hỏng thì cho lượt sau thử lại — một lần mất mạng lúc nạp không được làm
  // chết bộ quét cho tới khi Vercel thay tiến trình.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * Quét MỘT ảnh JPEG.
 *
 * Nhận buffer thay vì URL để người gọi tự quyết cách lấy ảnh (thumbnail Drive
 * cho ảnh album, phần tải lên cho ảnh khách gửi).
 */
export async function scanJpeg(bytes: Uint8Array): Promise<ServerFace[]> {
  const { faceapi } = await loadNets();
  const tf: any = await import("@tensorflow/tfjs");
  const jpeg: any = await import("jpeg-js");
  const dec = (jpeg.default ?? jpeg).decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  const { width: W, height: H, data } = dec as { width: number; height: number; data: Uint8Array };
  return quetRgba(faceapi, tf, data, W, H);
}

/**
 * Lấy thumbnail của một file Drive về dạng JPEG.
 *
 * Cố ý gọi thẳng Google chứ không đi qua `/api/img` của chính app: một
 * serverless function tự gọi lại chính mình là thêm một lượt gọi và một vòng
 * mạng cho mỗi ảnh. Danh sách nguồn dự phòng lấy theo đúng route đó
 * (src/app/api/img/route.ts) — Drive trả 302/HTML tuỳ lúc nên phải thử vài cửa.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Kết quả tải một ảnh — kèm LÝ DO khi không tải được.
 *
 * Vì sao không chỉ trả `Uint8Array | null`: `null` gộp NĂM nguyên nhân khác nhau
 * làm một, và chúng cần năm cách sửa khác nhau:
 *
 *   • http-403 / http-404  → file chưa chia sẻ công khai, hoặc đã xoá khỏi Drive
 *   • http-429             → Google chặn vì gọi quá nhiều, phải giãn nhịp
 *   • khong-phai-anh       → Drive trả trang HTML (thường là trang xin quyền)
 *   • anh-giu-cho          → dưới 512 byte, file chưa xử lý xong bên Drive
 *   • khong-phai-jpeg      → PNG; bỏ qua được, KHÔNG phải lỗi hạ tầng
 *   • het-gio / mang-loi   → mạng
 *
 * Cái giá của việc gộp đã trả bằng tiền thật: log production 18:31 ngày 10/09 in
 * "lỗi tải 54 · lỗi mẫu: khong_tai_duoc_anh" tám lượt liền, ba album, 100% tấm
 * hỏng — biết là Drive từ chối, mà không biết Google từ chối bằng câu gì, nên
 * không biết phải sửa quyền chia sẻ, giãn nhịp gọi, hay chờ Drive xử lý xong.
 */
export type KetQuaTai = { bytes: Uint8Array; lyDo: null } | { bytes: null; lyDo: string };

export async function fetchThumbChiTiet(driveId: string, width = SCAN_WIDTH): Promise<KetQuaTai> {
  const sources = [
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`,
    `https://lh3.googleusercontent.com/d/${driveId}=w${width}`,
  ];
  // Lý do của nguồn ĐẦU TIÊN: nguồn hai là bản dự phòng, và khi cả hai đều hỏng
  // thì câu trả lời hữu ích là câu của đường chính.
  let lyDo = "khong-thu-duoc-nguon-nao";
  for (const [i, url] of sources.entries()) {
    let ly: string;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: { "User-Agent": UA },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok) ly = `http-${res.status}`;
      else if (!ct.startsWith("image/")) ly = `khong-phai-anh (${ct.split(";")[0] || "khong co content-type"})`;
      else {
        const buf = new Uint8Array(await res.arrayBuffer());
        // Dưới 512 byte là ảnh giữ chỗ của Drive, không phải ảnh thật.
        if (buf.length < 512) ly = `anh-giu-cho (${buf.length} byte)`;
        // jpeg-js CHỈ đọc JPEG. Drive trả PNG cho vài loại file (ảnh trong suốt,
        // poster video) — bỏ qua thay vì để bộ giải mã ném lỗi khó hiểu.
        else if (!(buf[0] === 0xff && buf[1] === 0xd8)) ly = "khong-phai-jpeg";
        else return { bytes: buf, lyDo: null };
      }
    } catch (e) {
      ly = e instanceof Error && e.name === "AbortError" ? "het-gio (12s)" : `mang-loi: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (i === 0) lyDo = ly;
  }
  return { bytes: null, lyDo };
}

/** Bản gọn cho những chỗ chỉ cần "có ảnh hay không". */
export async function fetchThumb(driveId: string, width = SCAN_WIDTH): Promise<Uint8Array | null> {
  return (await fetchThumbChiTiet(driveId, width)).bytes;
}
