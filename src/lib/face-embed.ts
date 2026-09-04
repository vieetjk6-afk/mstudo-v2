"use client";

/**
 * NHẬN DẠNG DANH TÍNH — biến một khuôn mặt thành vector đặc trưng.
 *
 * Đây là mảnh còn thiếu để gom ảnh theo từng người. @/lib/face-detect tìm ĐƯỢC
 * khuôn mặt nhưng không biết đó là AI; @/lib/face-group biết cách gom các vector
 * thành từng người nhưng không tự sinh ra vector. File này nối hai đầu lại.
 *
 * Mô hình: mạng nhận dạng 128 chiều của face-api (dòng dõi từ dlib ResNet). Chọn
 * nó vì ba lý do rất cụ thể, không phải vì tiện:
 *
 *  • Nó là mô hình NHẬN DẠNG DANH TÍNH thật. Cám dỗ ở đây là dùng một bộ nhúng
 *    ảnh chung chung (MediaPipe có sẵn `ImageEmbedder`) cho đỡ thêm phụ thuộc —
 *    nhưng bộ ấy đo "hai tấm ảnh trông giống nhau", chứ không đo "hai khuôn mặt
 *    là một người". Cùng một người dưới hai kiểu ánh sáng sẽ xa nhau hơn hai
 *    người khác nhau chụp cùng một góc. Kết quả là mục "ảnh của cô dâu" có ảnh
 *    người lạ — tệ hơn hẳn là không có tính năng.
 *  • Trọng số TỰ PHỤC VỤ được từ `/face-model` (6,2 MB, chép ở postinstall). CSP
 *    của repo chặn script/CDN ngoài, nên mô hình nào không tự phục vụ được thì
 *    coi như không dùng được.
 *  • Nó chỉ cần MỘT ô ảnh mặt đã căn chỉnh, không đòi chạy lại bộ dò mặt của
 *    riêng nó — nên ta dùng lại đúng khuôn mặt MediaPipe đã tìm ra, không tải và
 *    không chạy hai bộ dò.
 *
 * VÌ SAO NẠP BẰNG THẺ <script> CHỨ KHÔNG `import`. Gói npm có, và cám dỗ là
 * `import("@vladmandic/face-api")` cho gọn. Nhưng bản ESM của nó gọi `require()`
 * theo kiểu webpack không phân tích tĩnh được — Next báo "Critical dependency"
 * rồi kéo cả nhánh TensorFlow-cho-Node vào gói trình duyệt, và trang chết ngay ở
 * lượt dựng. Bản UMD nạp từ chính máy chủ của app không đụng tới bundler chút
 * nào, vẫn hợp CSP (`script-src 'self'`), và chỉ tải khi studio thật sự bật tính
 * năng. Gói npm vẫn nằm trong `dependencies` — nhưng CHỈ để `postinstall` chép
 * file ra public. ĐỪNG "dọn dẹp" bằng cách import lại.
 *
 * CĂN CHỈNH LÀ PHẦN DỄ SAI NHẤT, và sai thì hỏng âm thầm: vector vẫn ra 128 số
 * trông rất hợp lệ, chỉ là vô nghĩa. Mạng này được huấn luyện trên khuôn mặt đã
 * XOAY CHO HAI MẮT NẰM NGANG và cắt ở một tỉ lệ cố định. Đưa vào một ô cắt thô
 * theo khung bao thì cùng một người nghiêng đầu 15° sẽ ra hai vector khác hẳn.
 * Nên `alignFace` dựng đúng phép biến đổi đó từ hai tâm mắt.
 */

/** Cạnh ô ảnh mặt đưa vào mạng — đúng cỡ mà mạng này được huấn luyện. */
const CHIP = 150;

/**
 * Khoảng cách hai mắt CHIẾM bao nhiêu phần cạnh ô ảnh sau khi căn chỉnh.
 *
 * 0.42 đặt hai mắt ở khoảng 1/3 trên và chừa đủ trán, cằm — đúng bố cục mà bộ
 * căn chỉnh gốc của dlib tạo ra. Đây không phải con số thẩm mỹ: lệch tỉ lệ này
 * là đưa vào mạng một phân bố ảnh khác với lúc huấn luyện.
 */
const EYE_SPAN = 0.42;

/**
 * Chỉ số landmark của FaceMesh (MediaPipe, 478 điểm) cho bốn góc mắt.
 *
 * Dùng GÓC MẮT chứ không dùng tâm mống mắt: tâm mống mắt chỉ có khi bật
 * `refineLandmarks`, và nó DI CHUYỂN theo hướng nhìn — người liếc sang bên sẽ
 * bị căn lệch. Góc mắt đứng yên trên khuôn mặt.
 */
const EYE_L = [33, 133] as const; // mắt trái người xem
const EYE_R = [362, 263] as const;

export type Landmark = { x: number; y: number };

/* ─────────────────────────────────────────────────────────────────────────────
   Căn chỉnh
   ───────────────────────────────────────────────────────────────────────────── */

export type AlignPlan = {
  /** Tâm hai mắt, theo TỈ LỆ 0…1 của ảnh. */
  eyeL: { x: number; y: number };
  eyeR: { x: number; y: number };
  /** Góc nghiêng đầu (radian) — dương là nghiêng theo chiều kim đồng hồ. */
  angle: number;
  /** Khoảng cách hai mắt theo tỉ lệ ảnh. */
  span: number;
};

/**
 * Tính phép căn chỉnh từ landmark. `null` khi không đủ điểm hoặc hai mắt trùng
 * nhau (mặt nghiêng gần 90°, mô hình đoán bừa) — lúc đó thà không sinh vector
 * còn hơn sinh một vector rác rồi gom nhầm người.
 */
export function alignPlan(points: Landmark[]): AlignPlan | null {
  const need = Math.max(...EYE_L, ...EYE_R);
  if (!points || points.length <= need) return null;
  const mid = (a: number, b: number) => ({
    x: (points[a].x + points[b].x) / 2,
    y: (points[a].y + points[b].y) / 2,
  });
  const eyeL = mid(EYE_L[0], EYE_L[1]);
  const eyeR = mid(EYE_R[0], EYE_R[1]);
  const dx = eyeR.x - eyeL.x;
  const dy = eyeR.y - eyeL.y;
  const span = Math.hypot(dx, dy);
  if (!Number.isFinite(span) || span < 1e-4) return null;
  return { eyeL, eyeR, angle: Math.atan2(dy, dx), span };
}

/**
 * Vẽ ô ảnh mặt ĐÃ CĂN CHỈNH 150×150 từ ảnh gốc.
 *
 * Phép biến đổi, theo đúng thứ tự: đưa điểm giữa hai mắt về giữa ô, xoay ngược
 * góc nghiêng đầu, phóng sao cho khoảng cách hai mắt bằng `EYE_SPAN` cạnh ô, rồi
 * dịch lên một chút để mắt nằm ở khoảng 1/3 trên thay vì chính giữa.
 */
export function drawAlignedFace(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  plan: AlignPlan
): HTMLCanvasElement {
  // HTMLCanvasElement chứ KHÔNG phải OffscreenCanvas: `toNetInput` của face-api
  // chỉ nhận img / video / canvas của DOM hoặc tensor, và nó từ chối bằng một
  // câu dài không nhắc gì tới OffscreenCanvas. Phần còn lại của đường ống dùng
  // OffscreenCanvas (nhẹ hơn, chạy được trong worker) — chỗ này là ngoại lệ do
  // thư viện đòi, không phải do thiếu nhất quán.
  const chip = document.createElement("canvas");
  chip.width = CHIP;
  chip.height = CHIP;
  const g = chip.getContext("2d")!;
  // Nền xám trung tính cho phần lọt ra ngoài mép ảnh: đen hoặc trong suốt tạo ra
  // một mảng tương phản mạnh mà mạng chưa từng thấy lúc huấn luyện.
  g.fillStyle = "#808080";
  g.fillRect(0, 0, CHIP, CHIP);

  const eyeMidX = ((plan.eyeL.x + plan.eyeR.x) / 2) * srcW;
  const eyeMidY = ((plan.eyeL.y + plan.eyeR.y) / 2) * srcH;
  // `span` theo tỉ lệ ảnh và hai chiều ảnh khác nhau → quy về điểm ảnh thật.
  const spanPx = Math.hypot(plan.eyeR.x * srcW - plan.eyeL.x * srcW, plan.eyeR.y * srcH - plan.eyeL.y * srcH);
  const scale = (CHIP * EYE_SPAN) / spanPx;

  g.translate(CHIP / 2, CHIP * 0.38);
  g.rotate(-plan.angle);
  g.scale(scale, scale);
  g.translate(-eyeMidX, -eyeMidY);
  g.drawImage(source, 0, 0, srcW, srcH);
  return chip;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mô hình
   ───────────────────────────────────────────────────────────────────────────── */

type Recognizer = {
  computeFaceDescriptor: (input: unknown) => Promise<Float32Array | Float32Array[]>;
};

type FaceApiGlobal = {
  nets: { faceRecognitionNet: Recognizer & { loadFromUri: (uri: string) => Promise<void> } };
  tf: {
    setBackend: (name: string) => Promise<boolean>;
    ready: () => Promise<void>;
    getBackend: () => string;
  };
};

const LIB_URL = "/face-model/face-api.js";
const WEIGHTS_URI = "/face-model";

let loading: Promise<Recognizer> | null = null;

export function faceEmbedSupported(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Nạp thư viện bằng thẻ <script>, một lần. Gọi lại khi đã có thì trả về ngay. */
function loadLib(): Promise<FaceApiGlobal> {
  const w = window as unknown as { faceapi?: FaceApiGlobal };
  if (w.faceapi) return Promise.resolve(w.faceapi);
  return new Promise((resolve, reject) => {
    // Thẻ đã có sẵn (lượt nạp trước đang chạy dở) thì bám vào nó, đừng thêm thẻ
    // thứ hai — hai lần tải 1,3 MB cho cùng một thư viện.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIB_URL}"]`);
    const el = existing ?? document.createElement("script");
    const done = () => {
      const g = (window as unknown as { faceapi?: FaceApiGlobal }).faceapi;
      if (g) resolve(g);
      else reject(new Error("thư viện nạp xong nhưng không thấy đối tượng faceapi"));
    };
    el.addEventListener("load", done, { once: true });
    el.addEventListener("error", () => reject(new Error("không tải được thư viện nhận dạng")), { once: true });
    if (!existing) {
      el.src = LIB_URL;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

/**
 * Chọn nền tính toán cho TensorFlow — BẮT BUỘC gọi trước khi nạp trọng số.
 *
 * Bản UMD đăng ký sẵn nền `wasm` và xếp nó ưu tiên cao nhất, nhưng nền đó cần
 * thêm mấy file .wasm RIÊNG của tfjs mà ta không phục vụ. Không chọn nền tay thì
 * lượt nạp chết với đúng một câu: "The highest priority backend 'wasm' has not
 * yet been initialized" — và không có gì trong câu đó chỉ ra nguyên nhân.
 *
 * `webgl` trước (nhanh hơn nhiều lần trên máy studio), `cpu` là đường lùi cho máy
 * ảo hoặc trình duyệt tắt WebGL. Cả hai đều nằm sẵn trong bản UMD, không tải thêm.
 */
async function pickBackend(faceapi: FaceApiGlobal): Promise<void> {
  for (const name of ["webgl", "cpu"]) {
    try {
      if (await faceapi.tf.setBackend(name)) {
        await faceapi.tf.ready();
        return;
      }
    } catch {
      /* thử nền kế tiếp */
    }
  }
  throw new Error("không khởi tạo được nền tính toán (webgl lẫn cpu đều không dùng được)");
}

/** Nạp mạng nhận dạng (một lần cho cả phiên). */
export function loadRecognizer(): Promise<Recognizer> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const faceapi = await loadLib();
      await pickBackend(faceapi);
      await faceapi.nets.faceRecognitionNet.loadFromUri(WEIGHTS_URI);
      return faceapi.nets.faceRecognitionNet;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      throw new Error(
        `Không tải được mô hình nhận dạng khuôn mặt (${msg}). Thử tải lại trang; ` +
          `bỏ tick “Gom ảnh theo người” là các phần khác vẫn chạy.`
      );
    }
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * Vector đặc trưng của MỘT khuôn mặt, ĐỂ NGUYÊN như mô hình trả về.
 *
 * `null` khi không căn chỉnh được — xem `alignPlan`. Người gọi phải bỏ hẳn khuôn
 * mặt đó khỏi lượt gom, chứ đừng thay bằng vector 0: một vector 0 giống 0 với
 * mọi thứ nên nó sẽ đứng riêng, nhưng vẫn chiếm một chỗ và làm lệch các con số.
 */
export async function embedFace(
  model: Recognizer,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  points: Landmark[]
): Promise<number[] | null> {
  const plan = alignPlan(points);
  if (!plan) return null;
  const chip = drawAlignedFace(source, srcW, srcH, plan);
  const out = await model.computeFaceDescriptor(chip);
  const raw = Array.isArray(out) ? out[0] : out;
  if (!raw || raw.length === 0) return null;
  // KHÔNG chuẩn hoá: thước của mạng này là khoảng cách Euclid trên vector thô.
  // Xem ghi chú ở @/lib/face-group (FaceVector.v) — chuẩn hoá rồi lấy cosine cho
  // ra hai phân bố cách nhau 0,017 và gom cả đám cưới vào một cụm.
  return Array.from(raw);
}
