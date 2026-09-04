/**
 * LỌC ẢNH BẰNG AI — phần chấm điểm & gom nhóm.
 *
 * Việc tốn giờ nhất của hậu kỳ là ngồi qua 3.000 tấm để loại ảnh nhoè và chọn
 * một bản trong mỗi chuỗi bấm liên tiếp. File này làm đúng ba việc đó:
 *
 *   1. Điểm nét — phương sai của Laplacian. Ảnh nhoè (rung tay, lấy nét sai) có
 *      rất ít cạnh, nên phương sai tụt hẳn.
 *   2. Phơi sáng — trung bình sáng + tỉ lệ điểm cháy trắng / mất chi tiết đen.
 *      Bắt được cả những khung chụp lỡ (đen thui, hoặc flash loè trắng xoá).
 *   3. Gom ảnh trùng — dHash hai chiều 128 bit + khoảng cách Hamming, rồi chọn
 *      bản NÉT NHẤT trong mỗi nhóm.
 *
 * CHẠY TRÊN MÁY, KHÔNG UPLOAD. Ảnh cưới là dữ liệu riêng của khách, và một buổi
 * chụp 3.000 file thì gửi lên máy chủ là không khả thi. Nên toàn bộ tính toán ở
 * đây là số học thuần trên mảng điểm ảnh, chạy trong trình duyệt của studio
 * (giải mã ảnh ở @/lib/photo-ai-scan). Không có API nào, không byte ảnh nào rời
 * khỏi máy.
 *
 * ĐÂY LÀ GỢI Ý, KHÔNG PHẢI QUYẾT ĐỊNH. Không có mô hình nào ở đây "hiểu" ảnh
 * đẹp; nó chỉ đo cạnh, độ sáng và độ giống nhau. Bố cục cố ý xoá nét (bokeh dày,
 * lia máy) sẽ bị chấm điểm nét thấp — nên mọi kết luận đều mở ra cho studio xem
 * lại, và ngưỡng "loại" đòi ảnh phải TỆ CẢ TUYỆT ĐỐI LẪN TƯƠNG ĐỐI so với chính
 * lô ảnh đó (xem `judge`). Thà bỏ sót vài tấm nhoè còn hơn xoá một tấm studio
 * chọn có chủ ý.
 *
 * Ba việc CỐ Ý CHƯA làm, vì cả ba đòi một mô hình học sâu (vài chục MB tải về,
 * và một lớp phụ thuộc mới cho cả dự án) chứ không phải số học:
 *   - phát hiện nhắm mắt,
 *   - gom ảnh theo từng người (nhận diện mặt),
 *   - chấm "ảnh nào đẹp hơn".
 * Xem docs/goi-y-hoan-thien-app.md.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Hình dữ liệu
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Cạnh dài mà mọi ảnh PHẢI được thu về trước khi đo.
 *
 * Đây là một hợp đồng, không phải tuỳ chọn: phương sai Laplacian phụ thuộc vào
 * kích thước ảnh (ảnh to có nhiều cạnh hơn ⇒ điểm cao hơn), nên trộn ảnh đo ở
 * 480px với ảnh đo ở 1600px là so hai thang điểm khác nhau và mọi ngưỡng dưới
 * đây thành vô nghĩa. 480px đủ để thấy nhoè do rung/sai nét, mà giải mã 3.000
 * ảnh vẫn xong trong vài phút.
 */
export const SAMPLE_EDGE = 480;

/** Ảnh xám đã thu nhỏ — thứ duy nhất mà phần đo cần biết về một tấm ảnh. */
export type PhotoSample = {
  key: string;
  name: string;
  /** Thứ tự trong thư mục. Dùng để gom chuỗi bấm liên tiếp — xem `groupDuplicates`. */
  index: number;
  /** Mức xám 0–255, xếp theo hàng: gray[y * width + x]. */
  gray: Uint8Array;
  width: number;
  height: number;
};

export type PhotoMetrics = {
  key: string;
  name: string;
  index: number;
  /** Phương sai Laplacian. Càng cao càng nét. */
  sharpness: number;
  /** Trung bình sáng 0–255. */
  brightness: number;
  /** Tỉ lệ điểm cháy trắng (≥250) — 0..1. */
  clipHigh: number;
  /** Tỉ lệ điểm mất chi tiết đen (≤5) — 0..1. */
  clipLow: number;
  /** dHash hai chiều 128 bit, 32 ký tự hex — xem `hashDetail`. */
  hash: string;
  /**
   * Số bit 1 trong mã hash (0–128). Quá gần 0 hoặc 128 = mã SUY BIẾN, không đáng
   * tin để gom ảnh trùng — xem `hashDetail`.
   */
  hashBits: number;
};

export type Verdict = "keep" | "review" | "duplicate" | "reject";

export type PhotoJudgement = {
  key: string;
  name: string;
  verdict: Verdict;
  /** Lý do bằng tiếng Việt, hiện thẳng cho studio đọc. */
  reason: string;
  /** Số nhóm ảnh trùng (1, 2, 3…). `null` = ảnh đứng một mình. */
  group: number | null;
  /** Bản NÊN GIỮ của nhóm. Ảnh đứng một mình luôn là `false`. */
  keeper: boolean;
  sharpness: number;
};

export type ScanSummary = {
  total: number;
  keep: number;
  review: number;
  duplicate: number;
  reject: number;
  /** Số nhóm ảnh trùng tìm được (nhóm ≥ 2 ảnh). */
  groups: number;
  /** Trung vị điểm nét của lô — mốc để so tương đối. */
  medianSharpness: number;
};

export type JudgeResult = { judgements: PhotoJudgement[]; summary: ScanSummary };

/** Ngưỡng mặc định. Tách ra để kiểm thử ghim được, và để màn hình cho studio nới. */
export const AI_DEFAULTS = {
  /** Dưới mức này là nhoè, bất kể lô ảnh thế nào. */
  blurFloor: 60,
  /** …VÀ dưới 35% trung vị lô. Phải thoả CẢ HAI mới bị xếp "loại". */
  blurRatio: 0.35,
  /** Dưới 60% trung vị lô → "nên xem lại" (mềm hơn phần còn lại). */
  softRatio: 0.6,
  /**
   * Khoảng cách Hamming tối đa (trên 128 bit của mã hai chiều) để coi là cùng một
   * khung. 16/128 = 12,5%, giữ đúng tỉ lệ của mốc 8/64 quen dùng cho dHash.
   */
  dupDistance: 16,
  /** Chỉ so một ảnh với N ảnh kế tiếp. 0 = so tất cả với tất cả. */
  dupWindow: 12,
  /**
   * Mã hash phải có ít nhất N bit 1 VÀ ít nhất N bit 0 (trên 128) mới được dùng
   * để gom ảnh trùng. Với mã hai chiều thì đây chỉ còn là CHỐT CUỐI cho những
   * khung phẳng thật (đen thui, trắng xoá, chụp lỡ) — xem `hashDetail`.
   */
  minHashBits: 10,
  /** Tối / cháy: cần cả trung bình sáng lệch VÀ nhiều điểm bị kẹp. */
  darkMean: 45,
  darkClip: 0.35,
  brightClip: 0.22,
  /** Khung chụp lỡ: gần như đen thui hoặc trắng xoá. */
  deadFrameMean: 12,
  blownFrameMean: 243,
};

export type JudgeOptions = Partial<typeof AI_DEFAULTS>;

/* ─────────────────────────────────────────────────────────────────────────────
   Đo từng ảnh
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Phương sai của Laplacian — thước đo độ nét kinh điển.
 *
 * Nhân chập với [[0,1,0],[1,-4,1],[0,1,0]] rồi lấy phương sai của kết quả. Ảnh
 * nét có nhiều cạnh ⇒ giá trị Laplacian dao động mạnh ⇒ phương sai lớn. Ảnh
 * nhoè gần như phẳng ⇒ phương sai nhỏ.
 *
 * Chỉ chạy trên vùng TRONG (bỏ một hàng/cột viền) để khỏi phải xử lý biên; viền
 * của ảnh thu nhỏ không mang thông tin gì về độ nét.
 */
export function laplacianVariance(gray: Uint8Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const up = row - width;
    const down = row + width;
    for (let x = 1; x < width - 1; x++) {
      const lap = 4 * gray[row + x] - gray[up + x] - gray[down + x] - gray[row + x - 1] - gray[row + x + 1];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  // Kẹp ở 0: sai số dấu phẩy động có thể cho ra -1e-12 và một điểm nét ÂM lọt ra
  // ngoài thì mọi so sánh tỉ lệ bên dưới sẽ đảo chiều.
  return Math.max(0, sumSq / n - mean * mean);
}

/** Trung bình sáng + tỉ lệ điểm bị kẹp ở hai đầu. */
export function histogramStats(gray: Uint8Array): { brightness: number; clipLow: number; clipHigh: number } {
  if (gray.length === 0) return { brightness: 0, clipLow: 0, clipHigh: 0 };
  let sum = 0;
  let low = 0;
  let high = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    sum += v;
    if (v <= 5) low++;
    else if (v >= 250) high++;
  }
  return {
    brightness: sum / gray.length,
    clipLow: low / gray.length,
    clipHigh: high / gray.length,
  };
}

/**
 * Thu ảnh xám về kích thước khác bằng trung bình ô (box average).
 *
 * Trung bình ô chứ không lấy điểm gần nhất: dHash so hai ô cạnh nhau sáng hơn
 * hay tối hơn, mà lấy điểm gần nhất trên ảnh nhiều chi tiết thì một hạt nhiễu
 * cũng đảo được một bit — hai tấm trong cùng một chuỗi bấm sẽ ra hai mã khác
 * nhau và tính năng gom ảnh trùng coi như không hoạt động.
 */
export function resampleGray(
  gray: Uint8Array,
  width: number,
  height: number,
  tw: number,
  th: number
): Uint8Array {
  const out = new Uint8Array(tw * th);
  if (width <= 0 || height <= 0) return out;
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * height) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * width) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / tw));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        const row = y * width;
        for (let x = x0; x < x1 && x < width; x++) {
          sum += gray[row + x];
          n++;
        }
      }
      out[ty * tw + tx] = n > 0 ? Math.round(sum / n) : 0;
    }
  }
  return out;
}

/**
 * Mã hash nhận dạng khung ảnh (128 bit, 32 ký tự hex). Bất biến với đổi độ
 * sáng/tương phản toàn ảnh — đúng thứ cần cho việc gom ảnh trùng, vì hai tấm
 * liên tiếp trong một chuỗi bấm hay lệch nhau một chút phơi sáng. Chi tiết và lý
 * do dùng mã HAI CHIỀU ở `hashDetail`.
 */
export function dhash(gray: Uint8Array, width: number, height: number): string {
  return hashDetail(gray, width, height).hash;
}

/**
 * dHash HAI CHIỀU, 128 bit (32 ký tự hex), kèm số bit 1 của chính nó.
 *
 * Vì sao hai chiều. dHash cổ điển chỉ so hai điểm CẠNH NHAU THEO HÀNG — "trái có
 * sáng hơn phải không". Với một ảnh mà độ sáng đổi đều một chiều từ trái sang
 * phải (nền trời lúc chiều, một mảng tường, hắt sáng từ cửa sổ) thì KHÔNG cặp
 * nào có bên trái sáng hơn, và mã ra toàn số 0. Hai tấm ảnh HOÀN TOÀN KHÁC NHAU
 * nhưng cùng kiểu chuyển sáng đó đều cho mã 0000…, khoảng cách Hamming bằng 0,
 * và bị kết luận là trùng — rồi công cụ đề nghị studio xoá một tấm không hề
 * trùng. Đó là chiều sai đắt nhất của tính năng này: mất một tấm ảnh cưới không
 * có bản thứ hai.
 *
 * Thêm 64 bit so theo CỘT ("trên có sáng hơn dưới không") chữa đúng gốc bệnh:
 * một dải chuyển sáng ngang thì nửa ngang suy biến nhưng nửa dọc vẫn đầy thông
 * tin, và ngược lại. Chỉ ảnh PHẲNG THẬT (khung đen thui, chụp lỡ) mới suy biến ở
 * cả hai nửa — mà loại đó đã bị `judge` gạt ra từ bước đầu.
 *
 * `hashBits` vẫn được giữ làm chốt cuối cho đúng những khung phẳng đó.
 *
 * LƯU Ý về hai chốt SAI đã thử trước khi tới đây:
 *  - "Đếm số cặp điểm chênh nhau đủ nhiều" KHÔNG bắt được ca này: một dải chuyển
 *    sáng tương phản cao thì mọi cặp đều chênh rõ mà mã vẫn toàn số 0 — cái hỏng
 *    không phải thiếu tương phản, mà là mọi phép so đều cùng một chiều.
 *  - Chỉ nâng ngưỡng `minHashBits` trên mã một chiều thì phải nâng cao đến mức
 *    gạt luôn cả ảnh thật ra khỏi việc gom chuỗi bấm.
 * (Bài kiểm thử trong Chromium ở desktop/test/photo-ai-browser.mjs là chỗ lộ ra
 * cả hai: một khung đen thui và một ảnh nền chuyển dần cùng ra mã 0000…0000.)
 */
export function hashDetail(
  gray: Uint8Array,
  width: number,
  height: number
): { hash: string; hashBits: number } {
  let bits = 0;
  let hex = "";

  // Nửa NGANG: 9×8, mỗi hàng so 8 cặp trái–phải.
  const h = resampleGray(gray, width, height, 9, 8);
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      if (h[y * 9 + x] > h[y * 9 + x + 1]) {
        byte |= 1 << (7 - x);
        bits++;
      }
    }
    hex += byte.toString(16).padStart(2, "0");
  }

  // Nửa DỌC: 8×9, mỗi cột so 8 cặp trên–dưới.
  const v = resampleGray(gray, width, height, 8, 9);
  for (let x = 0; x < 8; x++) {
    let byte = 0;
    for (let y = 0; y < 8; y++) {
      if (v[y * 8 + x] > v[(y + 1) * 8 + x]) {
        byte |= 1 << (7 - y);
        bits++;
      }
    }
    hex += byte.toString(16).padStart(2, "0");
  }

  return { hash: hex, hashBits: bits };
}

function popcount32(v: number): number {
  let x = v - ((v >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >>> 24;
}

/**
 * Số bit khác nhau giữa hai mã hash. Hai mã dài khác nhau (bản cũ 64 bit lẫn với
 * bản 128 bit) → trả khoảng cách TỐI ĐA, tức là "khác hẳn": thà bỏ sót một chuỗi
 * trùng còn hơn gom hai ảnh dựa trên hai thang mã khác nhau.
 */
export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Math.max(a?.length ?? 0, b?.length ?? 0, 16) * 4;
  let d = 0;
  for (let i = 0; i < a.length; i += 8) {
    const x = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0;
    d += popcount32(x);
  }
  return d;
}

/** Đo một ảnh: nét, sáng, mã hash. */
export function measure(s: PhotoSample): PhotoMetrics {
  const { brightness, clipLow, clipHigh } = histogramStats(s.gray);
  const { hash, hashBits } = hashDetail(s.gray, s.width, s.height);
  return {
    key: s.key,
    name: s.name,
    index: s.index,
    sharpness: laplacianVariance(s.gray, s.width, s.height),
    brightness,
    clipLow,
    clipHigh,
    hash,
    hashBits,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Gom ảnh trùng
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Gom các ảnh gần như giống nhau thành nhóm (hợp-tìm / union-find).
 *
 * `dupWindow` chỉ so một ảnh với N ảnh KẾ TIẾP theo thứ tự thư mục. Chuỗi bấm
 * liên tiếp nằm cạnh nhau trong thư mục (tên file tăng dần theo lúc bấm), nên
 * cửa sổ này vừa nhanh hơn O(n²) vừa CHÍNH XÁC hơn: hai tấm chụp cùng một góc
 * phòng cưới cách nhau hai tiếng có thể có hash gần nhau, mà chúng không phải
 * một chuỗi để chọn ra một bản.
 *
 * Đặt `dupWindow: 0` để so tất cả với tất cả — dùng khi danh sách KHÔNG theo thứ
 * tự lúc bấm (ví dụ studio đã trộn nhiều thư mục vào một lượt quét).
 */
export function groupDuplicates(metrics: PhotoMetrics[], opts: JudgeOptions = {}): number[] {
  const o = { ...AI_DEFAULTS, ...opts };
  const n = metrics.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    while (parent[i] !== r) {
      const next = parent[i];
      parent[i] = r;
      i = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // Ảnh có mã hash SUY BIẾN thì KHÔNG tham gia gom nhóm (xem `hashDetail`): mã
  // toàn 0 / toàn 1 va nhau với mọi ảnh chuyển sáng một chiều khác.
  const trusted = (i: number) => {
    const bits = metrics[i].hashBits ?? 64;
    const total = (metrics[i].hash?.length ?? 32) * 4;
    return bits >= o.minHashBits && bits <= total - o.minHashBits;
  };

  // So theo thứ tự đã sắp: `order` là chỉ số vào `metrics`, sắp theo index thư mục.
  const order = metrics.map((_, i) => i).sort((a, b) => metrics[a].index - metrics[b].index || a - b);
  for (let a = 0; a < order.length; a++) {
    if (!trusted(order[a])) continue;
    for (let b = a + 1; b < order.length; b++) {
      if (o.dupWindow > 0) {
        // HAI mốc chặn, đều là `dupWindow`, và cái nào chặt hơn thì thắng:
        //  - cách nhau quá N tấm TRONG LÔ QUÉT, và
        //  - cách nhau quá N vị trí TRONG THƯ MỤC (`index`).
        // Quét cả thư mục thì hai mốc trùng nhau — đó là trường hợp thường. Hai
        // mốc chỉ tách ra khi lô quét là một PHẦN của thư mục (studio chỉ chọn
        // mấy trăm tấm giữa): lúc đó hai tấm giống nhau ở vị trí 4 và 99 của
        // thư mục vẫn phải bị coi là hai lần chụp khác nhau, dù trong lô quét
        // chúng nằm cạnh nhau. `order` đã sắp theo index nên vượt mốc là dừng
        // hẳn, không cần xét tiếp.
        if (b - a > o.dupWindow) break;
        if (metrics[order[b]].index - metrics[order[a]].index > o.dupWindow) break;
      }
      if (!trusted(order[b])) continue;
      if (hamming(metrics[order[a]].hash, metrics[order[b]].hash) <= o.dupDistance) {
        union(order[a], order[b]);
      }
    }
  }

  // Đổi gốc union-find thành số nhóm 1,2,3… theo thứ tự xuất hiện; ảnh đứng một
  // mình nhận -1 (dễ đọc hơn "nhóm một phần tử" ở phía màn hình).
  const size = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    size.set(r, (size.get(r) ?? 0) + 1);
  }
  const label = new Map<number, number>();
  let next = 1;
  const out = new Array<number>(n).fill(-1);
  for (const i of order) {
    const r = find(i);
    if ((size.get(r) ?? 0) < 2) continue;
    if (!label.has(r)) label.set(r, next++);
    out[i] = label.get(r)!;
  }
  return out;
}

/**
 * Bản nên giữ của một nhóm: nét nhất. Bằng điểm nét thì lấy tấm phơi sáng lành
 * hơn (ít điểm bị kẹp hơn), rồi tới tấm bấm trước.
 */
export function pickKeeper(group: PhotoMetrics[]): PhotoMetrics | null {
  if (group.length === 0) return null;
  return group.reduce((best, m) => {
    if (m.sharpness !== best.sharpness) return m.sharpness > best.sharpness ? m : best;
    const clipM = m.clipHigh + m.clipLow;
    const clipB = best.clipHigh + best.clipLow;
    if (clipM !== clipB) return clipM < clipB ? m : best;
    return m.index < best.index ? m : best;
  });
}

/**
 * Ô vuông ĐIỂM ẢNH GỐC để cắt ra soi 1:1, quanh một điểm trên ảnh.
 *
 * Nằm ở đây (chứ không trong `makePixelCrop`) vì đây là số học thuần và là chỗ
 * dễ sai: kẹp thiếu một đầu thì Chrome trả về ô cắt có viền trong suốt, mà lỗi
 * đó chỉ lộ ra khi người dùng kéo con trỏ ra sát mép ảnh — tức là muộn.
 *
 * `cx`/`cy` là tâm theo tỉ lệ 0…1. Ô cắt luôn NẰM TRỌN trong ảnh: gặp mép thì
 * trượt vào, không thu nhỏ. Ảnh nhỏ hơn `edge` thì lấy trọn chiều đó.
 */
export function cropRect(
  iw: number,
  ih: number,
  cx: number,
  cy: number,
  edge: number
): { sx: number; sy: number; w: number; h: number } {
  const w = Math.max(1, Math.min(Math.round(edge), Math.max(1, Math.round(iw))));
  const h = Math.max(1, Math.min(Math.round(edge), Math.max(1, Math.round(ih))));
  const clamp = (v: number, max: number) => Math.min(Math.max(Math.round(v), 0), Math.max(0, max));
  return {
    sx: clamp((Number.isFinite(cx) ? cx : 0.5) * iw - w / 2, iw - w),
    sy: clamp((Number.isFinite(cy) ? cy : 0.5) * ih - h / 2, ih - h),
    w,
    h,
  };
}

/**
 * Chỉ GOM NHÓM TRÙNG, không chấm ảnh nào là xấu.
 *
 * `judge()` trả về cả kết luận "nhoè", "chụp lỡ", "nên loại" — đúng cho studio
 * đang dọn thư mục. Nhưng màn CHỌN ẢNH CỦA KHÁCH thì không được nói câu đó: chê
 * ảnh của khách xấu là việc của studio nếu họ muốn, không phải của phần mềm, và
 * một khách nhìn thấy "ảnh này nhoè" bên dưới tấm ảnh cưới của mình sẽ mất vui
 * ngay giữa việc đáng ra là vui nhất.
 *
 * Nên tách riêng phần khách cần: các tấm gần như giống hệt nhau (một lần bấm
 * liên tiếp), và trong mỗi chuỗi thì tấm nào nét nhất. Không nhãn, không lý do.
 *
 * Nhóm trả về đã sắp theo thứ tự bấm, và mỗi nhóm luôn có ít nhất hai tấm.
 */
export type DuplicateGroup = {
  /** Khoá các tấm trong nhóm, theo thứ tự bấm. */
  keys: string[];
  /** Tấm nét nhất — bản đề xuất. Luôn nằm trong `keys`. */
  bestKey: string;
};

export function duplicateGroups(metrics: PhotoMetrics[], opts: JudgeOptions = {}): DuplicateGroup[] {
  const groups = groupDuplicates(metrics, opts);
  const byGroup = new Map<number, PhotoMetrics[]>();
  metrics.forEach((m, i) => {
    const g = groups[i];
    if (g < 0) return;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  });

  const out: DuplicateGroup[] = [];
  for (const [, list] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
    // `groupDuplicates` gán -1 cho tấm đứng một mình, nên tới đây mọi nhóm đều
    // có ≥ 2 tấm; vẫn chặn lại để hàm này an toàn nếu luật kia đổi.
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => a.index - b.index);
    const keeper = pickKeeper(ordered);
    if (!keeper) continue;
    out.push({ keys: ordered.map((m) => m.key), bestKey: keeper.key });
  }
  return out;
}

/**
 * Những tấm nên ẨN khi khách bật "chỉ hiện bản đẹp nhất": mọi tấm trong nhóm
 * TRỪ bản đề xuất.
 *
 * `keep` là các tấm KHÔNG được ẩn dù có trùng — khách đã tự chọn tấm đó rồi, và
 * một tấm biến mất khỏi lưới ngay sau khi khách bấm chọn là lỗi khó chịu nhất mà
 * tính năng này có thể gây ra.
 */
export function duplicatesToHide(groups: DuplicateGroup[], keep: ReadonlySet<string> = new Set()): Set<string> {
  const out = new Set<string>();
  for (const g of groups) {
    for (const k of g.keys) {
      if (k === g.bestKey || keep.has(k)) continue;
      out.add(k);
    }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Kết luận
   ───────────────────────────────────────────────────────────────────────────── */

/** Trung vị (không phải trung bình): một tấm chụp lỡ đen thui không được kéo mốc. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round = (v: number) => Math.round(v);

/**
 * Chấm kết luận cho cả lô. Thứ tự xét (điều đầu tiên khớp thì thắng):
 *
 *  1. Khung chụp lỡ (đen thui / trắng xoá) → loại. Chắc chắn nhất, xét trước.
 *  2. Nhoè — phải TỆ CẢ TUYỆT ĐỐI (dưới `blurFloor`) LẪN TƯƠNG ĐỐI (dưới
 *     `blurRatio` × trung vị lô) → loại. Đòi cả hai là điều giữ cho một lô ảnh
 *     cố ý mềm (chụp phim, bokeh dày) không bị loại sạch, và cũng giữ cho một lô
 *     siêu nét không loại oan tấm 300 điểm chỉ vì cả lô ở 900.
 *  3. Trùng, mà không phải bản nét nhất của nhóm → trùng.
 *  4. Mềm hơn phần còn lại của lô → xem lại.
 *  5. Tối / cháy sáng → xem lại. Chỉ "xem lại", không loại: ảnh ngược sáng và
 *     ảnh high-key là bố cục có thật, không phải lỗi.
 *  6. Còn lại → giữ.
 */
export function judge(metrics: PhotoMetrics[], opts: JudgeOptions = {}): JudgeResult {
  const o = { ...AI_DEFAULTS, ...opts };
  const med = median(metrics.map((m) => m.sharpness));
  const groups = groupDuplicates(metrics, o);

  // Bản nên giữ của từng nhóm.
  const byGroup = new Map<number, PhotoMetrics[]>();
  metrics.forEach((m, i) => {
    const g = groups[i];
    if (g < 0) return;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  });
  const keeperKey = new Map<number, string>();
  for (const [g, list] of byGroup) {
    const k = pickKeeper(list);
    if (k) keeperKey.set(g, k.key);
  }

  const judgements: PhotoJudgement[] = metrics.map((m, i) => {
    const group = groups[i] >= 0 ? groups[i] : null;
    const keeper = group !== null && keeperKey.get(group) === m.key;
    const base = { key: m.key, name: m.name, group, keeper, sharpness: m.sharpness };

    if (m.brightness <= o.deadFrameMean) {
      return { ...base, verdict: "reject" as Verdict, reason: "Khung gần như đen hoàn toàn — có thể là ảnh chụp lỡ." };
    }
    if (m.brightness >= o.blownFrameMean) {
      return { ...base, verdict: "reject" as Verdict, reason: "Khung gần như trắng xoá — có thể là ảnh chụp lỡ." };
    }
    if (m.sharpness < o.blurFloor && m.sharpness < med * o.blurRatio) {
      return {
        ...base,
        verdict: "reject" as Verdict,
        reason: `Nhoè — điểm nét ${round(m.sharpness)}, trung vị cả lô ${round(med)}.`,
      };
    }
    if (group !== null && !keeper) {
      const kName = byGroup.get(group)?.find((x) => x.key === keeperKey.get(group))?.name;
      return {
        ...base,
        verdict: "duplicate" as Verdict,
        reason: kName
          ? `Trùng khung với “${kName}” — bản đó nét hơn (${round(m.sharpness)} so với bản giữ).`
          : `Trùng khung với ảnh khác trong nhóm ${group}.`,
      };
    }
    if (med > 0 && m.sharpness < med * o.softRatio) {
      return {
        ...base,
        verdict: "review" as Verdict,
        reason: `Mềm hơn phần còn lại — điểm nét ${round(m.sharpness)}, trung vị ${round(med)}.`,
      };
    }
    if (m.brightness < o.darkMean && m.clipLow > o.darkClip) {
      return { ...base, verdict: "review" as Verdict, reason: `Tối, mất chi tiết vùng đen (${Math.round(m.clipLow * 100)}% điểm ảnh).` };
    }
    if (m.clipHigh > o.brightClip) {
      return { ...base, verdict: "review" as Verdict, reason: `Cháy sáng ${Math.round(m.clipHigh * 100)}% điểm ảnh.` };
    }
    return {
      ...base,
      verdict: "keep" as Verdict,
      reason: keeper ? `Bản nét nhất của nhóm ${group} — điểm nét ${round(m.sharpness)}.` : `Điểm nét ${round(m.sharpness)}.`,
    };
  });

  const count = (v: Verdict) => judgements.filter((j) => j.verdict === v).length;
  return {
    judgements,
    summary: {
      total: metrics.length,
      keep: count("keep"),
      review: count("review"),
      duplicate: count("duplicate"),
      reject: count("reject"),
      groups: byGroup.size,
      medianSharpness: med,
    },
  };
}

/**
 * Tên file của những ảnh AI đề nghị loại (trùng + nhoè/chụp lỡ). Đây là thứ nối
 * vào công cụ Lọc ảnh sẵn có: nó nhận danh sách TÊN FILE rồi tách/xoá đúng những
 * file đó (xem @/components/FilterTool). Cố ý KHÔNG gồm nhóm "xem lại" — chưa
 * chắc thì không đưa vào danh sách xoá.
 */
export function namesToRemove(judgements: PhotoJudgement[]): string[] {
  return judgements.filter((j) => j.verdict === "duplicate" || j.verdict === "reject").map((j) => j.name);
}
