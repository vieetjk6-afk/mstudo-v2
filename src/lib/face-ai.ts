/**
 * LỌC ẢNH THEO KHUÔN MẶT — phần LUẬT THUẦN.
 *
 * Bộ lọc ở @/lib/photo-ai đo CẢ KHUNG ẢNH: nét trung bình, sáng trung bình, mã
 * nhận dạng khung. Nó trả lời tốt câu "hai tấm này có phải một chuỗi bấm không"
 * nhưng mù trước đúng hai thứ khiến studio phải xem lại từng tấm bằng mắt:
 *
 *   1. AI ĐÓ NHẮM MẮT. Một tấm nét căng, bố cục đẹp, cô dâu chớp mắt — bộ đo cả
 *      khung chấm nó điểm cao nhất chuỗi và chọn nó làm bản nên giữ. Đây là lỗi
 *      số một của mọi công cụ lọc ảnh tự động, và là lý do studio không tin
 *      chúng.
 *   2. MẶT NHOÈ TRONG KHI NỀN NÉT. Lấy nét trượt ra sau lưng là chuyện xảy ra
 *      hằng buổi. Điểm nét cả khung của tấm đó vẫn CAO — cạnh của lá cây, của
 *      hoa văn tường đều sắc — nên bộ đo cũ không những không bắt được, mà còn
 *      xếp nó trên tấm lấy nét đúng.
 *
 * Nên file này KHÔNG chấm lại chất lượng ảnh. Nó nhận vào những gì bộ nhận diện
 * khuôn mặt tìm được (@/lib/face-detect, phần chỉ trình duyệt làm được) và trả
 * lời đúng hai câu trên, cộng một câu thứ ba rẻ tiền mà hữu ích: "tấm này KHÔNG
 * có mặt người nào" — ảnh thử sáng, ảnh chụp nhầm, ảnh chi tiết.
 *
 * Số học thuần, không đọc DOM, không gọi mạng. Kiểm thử: `npm run test:face-ai`.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Dữ liệu vào
   ───────────────────────────────────────────────────────────────────────────── */

/** Khung mặt, toạ độ theo TỈ LỆ 0…1 của ảnh (không phụ thuộc cỡ đã thu nhỏ). */
export type FaceBox = { x: number; y: number; w: number; h: number };

export type FaceInfo = {
  box: FaceBox;
  /**
   * Mức NHẮM MẮT, 0…1 — lấy mắt nhắm nhiều hơn trong hai mắt.
   *
   * Cố ý lấy mắt NHẮM NHIỀU HƠN chứ không lấy trung bình: người nháy một bên,
   * người bị đèn flash làm nhíu một mắt — trung bình hai mắt sẽ kéo một tấm hỏng
   * xuống dưới ngưỡng và nó lọt qua.
   */
  blink: number;
  /**
   * Điểm nét đo RIÊNG trên vùng mặt (cùng phép variance-of-Laplacian với
   * @/lib/photo-ai, chỉ khác là chạy trên ô cắt khuôn mặt).
   */
  sharpness: number;
};

/** Kết quả nhận diện của MỘT tấm ảnh. */
export type FaceMetrics = {
  key: string;
  name: string;
  /** Thứ tự trong thư mục — dùng để so trong cùng một chuỗi bấm. */
  index: number;
  faces: FaceInfo[];
  /** Điểm nét CẢ KHUNG của chính tấm đó, để so mặt với nền. */
  frameSharpness: number;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Ngưỡng
   ───────────────────────────────────────────────────────────────────────────── */

export const FACE_DEFAULTS = {
  /**
   * Trên mức này coi là NHẮM. 0.5 là chỗ blendshape `eyeBlink` của MediaPipe
   * chuyển từ "hơi nhíu" sang "đã khép" trên phần lớn khuôn mặt.
   *
   * Cố ý KHÔNG hạ thấp hơn: nhíu mắt khi cười là biểu cảm đẹp, không phải lỗi.
   * Hạ ngưỡng xuống 0.35 thì mọi tấm cười tươi đều bị gắn nhãn "nhắm mắt" và
   * studio sẽ tắt cả tính năng.
   */
  blinkClosed: 0.5,

  /**
   * Mặt nhỏ hơn ngần này phần khung thì BỎ QUA hoàn toàn.
   *
   * Khách qua đường phía sau, người bàn tiệc thứ tư — họ nhắm mắt hay không thì
   * cũng không ai loại tấm ảnh vì thế. Xét cả họ là mọi tấm chụp đám đông đều
   * dính nhãn "có người nhắm mắt", tức là nhãn ấy thành vô nghĩa.
   */
  minFaceArea: 0.008,

  /**
   * Mặt được coi là NHOÈ khi điểm nét vùng mặt thấp hơn ngần này lần điểm nét cả
   * khung. Đây là phép so TƯƠNG ĐỐI có chủ ý: mặt người vốn ít cạnh hơn lá cây
   * hay gạch tường, nên so tuyệt đối sẽ báo động giả trên mọi ảnh nền chi tiết.
   */
  faceSoftRatio: 0.4,

  /** Và phải nhoè THẬT: dưới mức tuyệt đối này nữa mới tính. Xem `judgeFaces`. */
  faceSoftFloor: 90,

  /** Khung nét dưới mức này thì bỏ qua luật "mặt nhoè" — cả tấm vốn đã mềm. */
  frameFloor: 60,
} as const;

export type FaceOptions = Partial<typeof FACE_DEFAULTS>;

/* ─────────────────────────────────────────────────────────────────────────────
   Kết luận cho MỘT tấm
   ───────────────────────────────────────────────────────────────────────────── */

export type FaceVerdict =
  /** Có mặt, mắt mở, mặt nét — không có gì để nói. */
  | "ok"
  /** Có ít nhất một người (mặt đủ lớn) đang nhắm mắt. */
  | "blink"
  /** Mặt nhoè rõ so với nền — gần như chắc chắn lấy nét trượt. */
  | "soft_face"
  /** Không tìm thấy khuôn mặt nào. */
  | "no_face";

export type FaceJudgement = {
  key: string;
  name: string;
  verdict: FaceVerdict;
  reason: string;
  /** Số mặt ĐỦ LỚN để xét (đã bỏ người phía xa). */
  subjects: number;
  /** Mức nhắm cao nhất trong các mặt đủ lớn. */
  worstBlink: number;
  /** Điểm nét của mặt lớn nhất — thứ dùng để so trong một chuỗi. */
  faceSharpness: number;
};

/** Diện tích khung mặt theo tỉ lệ khung ảnh. */
export const faceArea = (f: FaceInfo) => Math.max(0, f.box.w) * Math.max(0, f.box.h);

/** Những mặt ĐỦ LỚN để một quyết định loại ảnh được phép dựa vào. */
export function subjectFaces(m: FaceMetrics, opts: FaceOptions = {}): FaceInfo[] {
  const o = { ...FACE_DEFAULTS, ...opts };
  return (m.faces ?? []).filter((f) => faceArea(f) >= o.minFaceArea);
}

/** Mặt LỚN NHẤT trong các mặt đủ lớn — coi như chủ thể của tấm ảnh. */
export function mainFace(m: FaceMetrics, opts: FaceOptions = {}): FaceInfo | null {
  const list = subjectFaces(m, opts);
  if (list.length === 0) return null;
  return list.reduce((best, f) => (faceArea(f) > faceArea(best) ? f : best));
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Kết luận cho một tấm. Thứ tự xét: thứ nào khớp trước thì thắng.
 *
 * "Nhắm mắt" đứng TRƯỚC "mặt nhoè" vì nó chắc chắn hơn: mắt khép là mắt khép,
 * còn "nhoè" là một phép so tương đối luôn có vùng xám.
 */
export function judgeFaces(m: FaceMetrics, opts: FaceOptions = {}): FaceJudgement {
  const o = { ...FACE_DEFAULTS, ...opts };
  const subjects = subjectFaces(m, o);
  const main = subjects.length
    ? subjects.reduce((b, f) => (faceArea(f) > faceArea(b) ? f : b))
    : null;
  const worstBlink = subjects.reduce((n, f) => Math.max(n, f.blink ?? 0), 0);
  const faceSharpness = main?.sharpness ?? 0;
  const base = { key: m.key, name: m.name, subjects: subjects.length, worstBlink, faceSharpness };

  if (subjects.length === 0) {
    return {
      ...base,
      verdict: "no_face",
      reason:
        (m.faces ?? []).length > 0
          ? "Chỉ có mặt ở rất xa — có thể là ảnh phong cảnh hoặc chụp chi tiết."
          : "Không thấy khuôn mặt nào — có thể là ảnh thử sáng hoặc chụp chi tiết.",
    };
  }

  if (worstBlink >= o.blinkClosed) {
    const who = subjects.length > 1 ? `${subjects.length} người trong khung, có người` : "Người trong ảnh";
    return { ...base, verdict: "blink", reason: `${who} đang nhắm mắt (mức khép ${pct(worstBlink)}).` };
  }

  // Mặt nhoè phải đạt CẢ HAI: kém hẳn so với nền, VÀ thấp tuyệt đối. Chỉ xét
  // tương đối thì một tấm chân dung nền trơn (nền ít cạnh → điểm khung thấp) sẽ
  // bị báo oan; chỉ xét tuyệt đối thì mọi ảnh chụp thiếu sáng đều dính.
  if (
    m.frameSharpness >= o.frameFloor &&
    faceSharpness < o.faceSoftFloor &&
    faceSharpness < m.frameSharpness * o.faceSoftRatio
  ) {
    return {
      ...base,
      verdict: "soft_face",
      reason: `Mặt nhoè hơn hẳn nền (nét mặt ${Math.round(faceSharpness)} so với nét khung ${Math.round(
        m.frameSharpness
      )}) — có thể lấy nét trượt ra sau.`,
    };
  }

  return {
    ...base,
    verdict: "ok",
    reason: subjects.length > 1 ? `${subjects.length} người, mắt đều mở.` : "Mắt mở, mặt nét.",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Chọn bản nên giữ trong MỘT chuỗi bấm
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * ĐÂY LÀ LÝ DO CẢ TÍNH NĂNG NÀY TỒN TẠI.
 *
 * `pickKeeper` của @/lib/photo-ai chọn tấm NÉT NHẤT CẢ KHUNG. Trong một chuỗi
 * bấm liên tiếp, tấm nét nhất rất hay là tấm có người chớp mắt — chớp mắt không
 * làm ảnh kém nét chút nào. Studio mở kết quả ra, thấy máy đề xuất giữ đúng tấm
 * cô dâu nhắm tịt, và không bao giờ dùng công cụ đó nữa.
 *
 * Nên thứ tự ưu tiên ở đây là:
 *
 *   1. KHÔNG AI NHẮM MẮT. Một tấm mắt mở luôn thắng mọi tấm có người nhắm mắt,
 *      dù kém nét bao nhiêu. Ảnh hơi mềm còn cứu được bằng hậu kỳ; mắt nhắm thì
 *      không.
 *   2. Cùng hạng đó rồi thì MẶT NÉT HƠN thắng — không phải khung nét hơn. Lấy
 *      nét đúng vào mặt mới là tấm dùng được.
 *   3. Vẫn ngang nhau thì mới xét nét cả khung, rồi tới tấm bấm trước.
 *
 * `null` khi danh sách rỗng. Danh sách không có mặt nào thì luật này không nói
 * được gì hơn bộ đo cũ — người gọi phải tự lùi về `pickKeeper` (xem `betterKeeper`).
 */
export function pickFaceKeeper(group: FaceMetrics[], opts: FaceOptions = {}): FaceMetrics | null {
  if (group.length === 0) return null;
  const o = { ...FACE_DEFAULTS, ...opts };
  const rank = (m: FaceMetrics) => {
    const subjects = subjectFaces(m, o);
    const worstBlink = subjects.reduce((n, f) => Math.max(n, f.blink ?? 0), 0);
    const main = subjects.length ? subjects.reduce((b, f) => (faceArea(f) > faceArea(b) ? f : b)) : null;
    return {
      openEyes: subjects.length > 0 && worstBlink < o.blinkClosed ? 1 : 0,
      faceSharp: main?.sharpness ?? 0,
      frameSharp: m.frameSharpness,
      index: m.index,
    };
  };
  return group.reduce((best, m) => {
    const a = rank(m);
    const b = rank(best);
    if (a.openEyes !== b.openEyes) return a.openEyes > b.openEyes ? m : best;
    if (a.faceSharp !== b.faceSharp) return a.faceSharp > b.faceSharp ? m : best;
    if (a.frameSharp !== b.frameSharp) return a.frameSharp > b.frameSharp ? m : best;
    return a.index < b.index ? m : best;
  });
}

/**
 * Chuỗi này CÓ đáng để khuôn mặt quyết định bản nên giữ không?
 *
 * Chỉ khi ít nhất một tấm trong chuỗi có mặt đủ lớn. Chuỗi ảnh phong cảnh, ảnh
 * chi tiết váy, ảnh bàn tiệc — khuôn mặt không nói được gì, và ép nó nói sẽ ra
 * một thứ tự tuỳ tiện. Lúc đó giữ nguyên kết quả của bộ đo cũ.
 */
export function faceDecides(group: FaceMetrics[], opts: FaceOptions = {}): boolean {
  return group.some((m) => subjectFaces(m, opts).length > 0);
}

/**
 * Bản nên giữ SAU KHI xét khuôn mặt — hoặc `null` nếu khuôn mặt không có ý kiến.
 *
 * Người gọi dùng `null` để giữ nguyên lựa chọn của `pickKeeper` cũ.
 */
export function betterKeeper(group: FaceMetrics[], opts: FaceOptions = {}): FaceMetrics | null {
  if (!faceDecides(group, opts)) return null;
  return pickFaceKeeper(group, opts);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Tổng kết cho màn hình
   ───────────────────────────────────────────────────────────────────────────── */

export type FaceSummary = {
  scanned: number;
  /** Số tấm có ít nhất một mặt đủ lớn. */
  withFaces: number;
  blink: number;
  softFace: number;
  noFace: number;
  /** Số chuỗi mà khuôn mặt ĐỔI bản nên giữ so với bộ đo cũ. */
  keepersChanged: number;
};

export function summarizeFaces(
  judgements: FaceJudgement[],
  keepersChanged = 0
): FaceSummary {
  const count = (v: FaceVerdict) => judgements.filter((j) => j.verdict === v).length;
  return {
    scanned: judgements.length,
    withFaces: judgements.filter((j) => j.subjects > 0).length,
    blink: count("blink"),
    softFace: count("soft_face"),
    noFace: count("no_face"),
    keepersChanged,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ghép kết quả khuôn mặt vào kết luận của bộ đo cũ
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Trộn những gì khuôn mặt biết vào bảng kết luận của `judge()` (@/lib/photo-ai).
 *
 * KHÔNG chấm lại từ đầu. Bộ đo cũ đã trả lời tốt "tấm nào trùng tấm nào", "tấm
 * nào đen thui" — khuôn mặt không có ý kiến gì hơn về những câu đó. Nó chỉ sửa
 * đúng hai chỗ mà bộ đo cũ sai được:
 *
 *   1. TRONG MỘT CHUỖI: đổi bản nên giữ sang tấm mắt mở / mặt nét (xem
 *      `betterKeeper`). Đây là lý do cả tính năng tồn tại.
 *   2. TẤM ĐỨNG RIÊNG đang được xếp "giữ" mà có người nhắm mắt hoặc mặt nhoè:
 *      hạ xuống "xem lại".
 *
 * CỐ Ý KHÔNG hạ tấm đứng riêng xuống "nên loại", dù nó nhắm mắt rõ. Tấm đứng
 * riêng nghĩa là KHÔNG có bản nào khác của khoảnh khắc đó — loại nó đi là mất
 * hẳn khoảnh khắc. "Xem lại" đặt nó trước mắt studio và để họ quyết.
 *
 * Và không bao giờ NÂNG hạng: một khung đen thui vẫn là "nên loại" kể cả khi mô
 * hình tình cờ thấy một khuôn mặt trong đó.
 */
export type MergeablePhoto = {
  key: string;
  name: string;
  group: number | null;
  keeper: boolean;
  verdict: string;
  reason: string;
  sharpness: number;
};

export function applyFaces<T extends MergeablePhoto>(
  judgements: T[],
  faces: FaceMetrics[],
  opts: FaceOptions = {}
): { judgements: T[]; faceJudgements: FaceJudgement[]; keepersChanged: number } {
  const byKey = new Map(faces.map((f) => [f.key, f]));
  const faceJudgements = faces.map((f) => judgeFaces(f, opts));
  const faceVerdict = new Map(faceJudgements.map((j) => [j.key, j]));

  // Chuỗi nào có mặt thì khuôn mặt được quyền chọn lại bản nên giữ.
  const nextKeeper = new Map<number, string>();
  const groups = new Map<number, FaceMetrics[]>();
  for (const j of judgements) {
    if (j.group === null) continue;
    const m = byKey.get(j.key);
    if (!m) continue;
    if (!groups.has(j.group)) groups.set(j.group, []);
    groups.get(j.group)!.push(m);
  }
  for (const [g, list] of groups) {
    const pick = betterKeeper(list, opts);
    if (pick) nextKeeper.set(g, pick.key);
  }

  let keepersChanged = 0;
  const out = judgements.map((j) => {
    const fv = faceVerdict.get(j.key);

    // ── Trong một chuỗi ────────────────────────────────────────────────────
    if (j.group !== null && nextKeeper.has(j.group)) {
      const shouldKeep = nextKeeper.get(j.group) === j.key;
      if (shouldKeep === j.keeper) {
        // Không đổi vai, nhưng nếu tấm này bị bỏ vì nhắm mắt thì phải NÓI RA —
        // studio cần biết vì sao bản đề xuất không phải tấm nét nhất.
        if (!shouldKeep && fv && fv.verdict !== "ok") {
          return { ...j, reason: `${fv.reason} ${j.reason}` };
        }
        return j;
      }
      keepersChanged++;
      if (shouldKeep) {
        return {
          ...j,
          keeper: true,
          verdict: "keep",
          reason: fv
            ? `Bản nên giữ theo khuôn mặt: ${fv.reason.toLowerCase()}`
            : "Bản nên giữ theo khuôn mặt.",
        } as T;
      }
      return {
        ...j,
        keeper: false,
        verdict: "duplicate",
        reason: fv && fv.verdict !== "ok" ? `${fv.reason} Trùng chuỗi.` : "Trùng chuỗi — bản khác hợp hơn về khuôn mặt.",
      } as T;
    }

    // ── Tấm đứng riêng ─────────────────────────────────────────────────────
    if (j.verdict === "keep" && fv && (fv.verdict === "blink" || fv.verdict === "soft_face")) {
      return { ...j, verdict: "review", reason: fv.reason } as T;
    }
    return j;
  });

  return { judgements: out, faceJudgements, keepersChanged };
}
