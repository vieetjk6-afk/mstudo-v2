/**
 * GOM ẢNH THEO TỪNG NGƯỜI — phần LUẬT THUẦN.
 *
 * Câu mà khách hỏi ngay khi mở album cưới 800 tấm là "ảnh của tôi đâu", và câu
 * studio hỏi lúc lọc là "còn tấm nào có mẹ cô dâu không". Cả hai đều không trả
 * lời được bằng thứ gì có sẵn: tên file không biết ai trong ảnh, và bộ nhận diện
 * ở @/lib/face-ai chỉ biết "có một khuôn mặt ở đây", không biết đó là ai.
 *
 * Việc đó cần một mô hình khác hẳn — mô hình NHẬN DẠNG DANH TÍNH, biến mỗi khuôn
 * mặt thành một vector đặc trưng sao cho hai tấm cùng một người thì hai vector
 * gần nhau. File này KHÔNG chạy mô hình đó (xem @/lib/face-embed); nó nhận vào
 * các vector rồi làm phần còn lại: gom thành từng người, chọn ảnh đại diện, và
 * cho phép sửa lại khi máy gom sai.
 *
 * VÌ SAO KHÔNG DÙNG "GOM THEO NGƯỠNG RỒI NỐI THÀNH PHẦN LIÊN THÔNG" (union-find,
 * đúng cách mà @/lib/photo-ai gom ảnh trùng). Với ảnh trùng thì được, vì hai tấm
 * bấm liên tiếp gần như giống hệt. Với khuôn mặt thì đó là cái bẫy kinh điển
 * mang tên DÂY CHUYỀN: A giống B, B giống C, nhưng A và C là hai người khác
 * nhau — nối liên thông sẽ gộp cả ba, rồi từ C nối sang D… và cuối cùng cả đám
 * cưới thành một người. Một cụm sai kiểu đó phá hỏng toàn bộ tính năng.
 *
 * Nên thuật toán ở đây là CHINESE WHISPERS: mỗi khuôn mặt lặp lại việc nhận nhãn
 * của NHÓM LÁNG GIỀNG MẠNH NHẤT quanh nó, chứ không phải của bất kỳ láng giềng
 * nào. A chỉ theo C nếu tổng độ giống của cả cụm C áp đảo — nên một cây cầu mỏng
 * giữa hai người không kéo được hai cụm vào nhau. Đây cũng là thuật toán dlib
 * dùng cho đúng bài toán này.
 *
 * Số học thuần, không đọc DOM, không gọi mạng. Kiểm thử: `npm run test:face-group`.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Dữ liệu vào
   ───────────────────────────────────────────────────────────────────────────── */

/** Một khuôn mặt đã được biến thành vector đặc trưng. */
export type FaceVector = {
  /** Khoá ảnh chứa khuôn mặt này. */
  key: string;
  /** Khuôn mặt thứ mấy TRONG tấm ảnh đó (một tấm có thể nhiều người). */
  at: number;
  /**
   * Vector đặc trưng 128 chiều, ĐỂ NGUYÊN như mô hình trả về.
   *
   * KHÔNG chuẩn hoá về độ dài 1. Vector của mạng này (dòng dõi dlib) nằm gọn
   * trong một hình nón, nên cosine giữa hai vector BẤT KỲ đã là ~0,94 — đo thử
   * ở /uipreview/gom-theo-nguoi: cùng người 0,996, khác người 0,939, cách nhau
   * đúng 0,017. Lấy cosine làm thước là gom cả đám cưới vào một cụm.
   * Thước đúng của mạng này là KHOẢNG CÁCH EUCLID trên vector thô — xem `euclidean`.
   */
  v: number[];
  /** Diện tích khung mặt (tỉ lệ khung ảnh) — để chọn ảnh đại diện. */
  area: number;
  /**
   * Khung khuôn mặt, đã chuẩn hoá 0…1 theo cạnh ảnh.
   *
   * Đi theo tới tận DB vì phía KHÁCH cần cắt ra ảnh mặt để bấm chọn, mà khách
   * thì không tải mô hình. Có khung này thì cắt bằng CSS ngay trên thumbnail
   * album đã có sẵn — không thêm một byte tải nào.
   */
  box?: { x: number; y: number; w: number; h: number };
  /** Điểm nét vùng mặt — cũng để chọn ảnh đại diện. */
  sharpness: number;
};

export const GROUP_DEFAULTS = {
  /**
   * Hai khuôn mặt được nối cạnh khi KHOẢNG CÁCH EUCLID dưới mức này.
   *
   * 0.6 là ngưỡng chuẩn của dòng mô hình này (dlib công bố nó, và `FaceMatcher`
   * của face-api cũng lấy đúng số đó). Cố ý KHÔNG nới rộng hơn: gom thiếu thì
   * studio bấm gộp hai cụm trong một giây; gom thừa thì họ phải ngồi tách từng
   * tấm, và tệ hơn là khách nhìn thấy ảnh người lạ trong mục "ảnh của tôi".
   */
  maxDistance: 0.6,

  /**
   * Cụm ít hơn ngần này khuôn mặt thì KHÔNG thành một người.
   *
   * Đám cưới có hàng trăm khách chỉ lọt vào một hai khung. Mỗi người như vậy một
   * thẻ riêng thì màn hình có hai trăm thẻ và không ai dùng được. Họ vẫn còn
   * nguyên trong lưới ảnh — chỉ là không có thẻ lọc riêng.
   */
  minFaces: 3,

  /** Số vòng lặp Chinese Whispers. Quá 20 vòng thì nhãn gần như không đổi nữa. */
  rounds: 20,
} as const;

/**
 * Ngưỡng ghi đè được.
 *
 * KHÔNG viết `Partial<typeof GROUP_DEFAULTS>`: bảng kia khai `as const` nên mỗi
 * trường mang KIỂU HẰNG (ví dụ đúng số 3), và người gọi truyền số khác sẽ bị
 * TypeScript từ chối — một cái bẫy im lặng cho tới lúc ai đó thật sự cần nới
 * một ngưỡng.
 */
export type GroupOptions = { -readonly [K in keyof typeof GROUP_DEFAULTS]?: number };

/* ─────────────────────────────────────────────────────────────────────────────
   Vector
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Khoảng cách Euclid giữa hai vector đặc trưng — THƯỚC ĐÚNG của mạng này.
 *
 * Càng NHỎ càng giống. Hai vector khác chiều dài (một lượt quét lẫn hai mô hình)
 * trả về `Infinity` chứ không phải 0: 0 nghĩa là "giống hệt" và sẽ gộp nhầm hai
 * người, còn Infinity thì tự loại chúng ra khỏi nhau — hỏng về phía an toàn.
 */
export function euclidean(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Gom cụm
   ───────────────────────────────────────────────────────────────────────────── */

/** Bộ sinh số giả ngẫu nhiên có hạt giống — để cùng đầu vào luôn ra cùng kết quả. */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Chinese Whispers.
 *
 * Trả về mảng nhãn cùng độ dài với `faces`: hai khuôn mặt cùng nhãn là cùng một
 * người. Nhãn chỉ là số, không có thứ tự ý nghĩa.
 *
 * CÓ HẠT GIỐNG CỐ ĐỊNH nên chạy hai lần trên cùng dữ liệu ra cùng kết quả. Không
 * có điều đó thì studio bấm quét lại và thấy các cụm nhảy lung tung — họ sẽ
 * không tin một cái gì tự đổi ý.
 */
export function chineseWhispers(faces: FaceVector[], opts: GroupOptions = {}): number[] {
  const o = { ...GROUP_DEFAULTS, ...opts };
  const n = faces.length;
  const label = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return label;

  // Đồ thị láng giềng. Trọng số là PHẦN CÒN THIẾU SO VỚI NGƯỠNG, không phải
  // nghịch đảo khoảng cách: một cạnh vừa sát ngưỡng gần như không có tiếng nói,
  // còn hai tấm giống hệt thì nói rất to. Lấy một trọng số đều nhau sẽ cho vô số
  // cạnh yếu cộng dồn lại lấn át một cạnh mạnh — đúng đường quay lại bẫy dây chuyền.
  const adj: { j: number; w: number }[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclidean(faces[i].v, faces[j].v);
      if (!(d < o.maxDistance)) continue; // `!(… < …)` để Infinity/NaN cũng rớt
      const w = o.maxDistance - d;
      adj[i].push({ j, w });
      adj[j].push({ j: i, w });
    }
  }

  const rnd = seeded(0x5eed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let r = 0; r < o.rounds; r++) {
    // Trộn thứ tự duyệt mỗi vòng — Chinese Whispers cần điều đó để thoát khỏi
    // các thế cân bằng cục bộ, nhưng trộn bằng bộ sinh CÓ HẠT GIỐNG.
    for (let i = n - 1; i > 0; i--) {
      const k = Math.floor(rnd() * (i + 1));
      [order[i], order[k]] = [order[k], order[i]];
    }
    let moved = 0;
    for (const i of order) {
      if (adj[i].length === 0) continue;
      const tally = new Map<number, number>();
      for (const e of adj[i]) tally.set(label[e.j], (tally.get(label[e.j]) ?? 0) + e.w);
      let best = label[i];
      let bestW = -1;
      for (const [lab, w] of tally) {
        // Hoà thì lấy nhãn NHỎ HƠN: giữ kết quả ổn định giữa các vòng.
        if (w > bestW || (w === bestW && lab < best)) {
          best = lab;
          bestW = w;
        }
      }
      if (best !== label[i]) {
        label[i] = best;
        moved++;
      }
    }
    if (moved === 0) break; // đã đứng yên, chạy thêm cũng thế
  }
  return label;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Kết quả
   ───────────────────────────────────────────────────────────────────────────── */

export type Person = {
  /** Khoá tạm trong phiên gom — KHÔNG bền, DB cấp id riêng khi lưu. */
  id: string;
  /** Số khuôn mặt gom được (một tấm nhiều người thì đếm nhiều lần). */
  faces: number;
  /** Ảnh có mặt người này, theo thứ tự thư mục, không trùng. */
  photoKeys: string[];
  /**
   * Chỉ số các khuôn mặt của người này TRONG mảng `faces` đã truyền vào.
   *
   * Không thể suy ra từ `photoKeys`: một tấm ảnh cưới có cả cô dâu và chú rể,
   * nên "ảnh này thuộc người này" không cho biết KHUÔN MẶT nào là của ai. Cần
   * đúng danh sách này để tính tâm cụm lưu xuống DB (xem `centroid`).
   */
  faceIdx: number[];
  /** Ảnh đại diện: khuôn mặt to nhất và nét nhất. */
  coverKey: string;
  /** Khuôn mặt thứ mấy trong ảnh đại diện — để cắt đúng mặt làm ảnh thẻ. */
  coverAt: number;
  /** Khung của chính khuôn mặt đại diện đó, chuẩn hoá 0…1. */
  coverBox?: { x: number; y: number; w: number; h: number };
};

export type GroupResult = {
  people: Person[];
  /**
   * Khuôn mặt KHÔNG thuộc người nào (cụm quá nhỏ). Không phải lỗi: đám cưới có
   * hàng trăm khách chỉ lọt một khung.
   */
  loose: number;
};

/**
 * Gom cả lô thành từng người.
 *
 * Thứ tự trả về: người có NHIỀU ảnh nhất lên đầu. Trong một album cưới, đó gần
 * như luôn là cô dâu và chú rể — đúng thứ studio và khách cần trước tiên, và
 * cũng đỡ cho họ việc đặt tên: hai thẻ đầu gần như chắc chắn là hai nhân vật chính.
 */
export function groupFaces(faces: FaceVector[], opts: GroupOptions = {}): GroupResult {
  const o = { ...GROUP_DEFAULTS, ...opts };
  if (faces.length === 0) return { people: [], loose: 0 };

  const labels = chineseWhispers(faces, o);
  // Gom theo CHỈ SỐ, không theo bản sao khuôn mặt: người nào gồm khuôn mặt thứ
  // mấy là thông tin phải giữ lại tới lúc lưu xuống DB (xem Person.faceIdx).
  const bucket = new Map<number, number[]>();
  labels.forEach((lab, i) => {
    const arr = bucket.get(lab);
    if (arr) arr.push(i);
    else bucket.set(lab, [i]);
  });

  const people: Person[] = [];
  let loose = 0;
  for (const idxs of bucket.values()) {
    const list = idxs.map((i) => faces[i]);
    if (list.length < o.minFaces) {
      loose += list.length;
      continue;
    }
    // Ảnh đại diện: mặt TO nhất, hoà thì mặt nét hơn. Mặt to nghĩa là chụp gần,
    // tức là tấm mà nhìn vào biết ngay đây là ai — thứ duy nhất ảnh thẻ cần làm.
    const cover = list.reduce((b, f) =>
      f.area !== b.area ? (f.area > b.area ? f : b) : f.sharpness > b.sharpness ? f : b
    );
    const seen = new Set<string>();
    const photoKeys: string[] = [];
    for (const f of list) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      photoKeys.push(f.key);
    }
    people.push({
      id: `p${people.length + 1}`,
      faces: list.length,
      photoKeys,
      faceIdx: idxs,
      coverKey: cover.key,
      coverAt: cover.at,
      coverBox: cover.box,
    });
  }

  // Nhiều ảnh nhất lên đầu; hoà thì theo ảnh đại diện để thứ tự ổn định.
  people.sort((a, b) => b.photoKeys.length - a.photoKeys.length || a.coverKey.localeCompare(b.coverKey));
  return { people: people.map((p, i) => ({ ...p, id: `p${i + 1}` })), loose };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sửa lại khi máy gom sai
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Gộp hai người thành một.
 *
 * PHẢI CÓ. Máy gom sai là chuyện chắc chắn xảy ra — cùng một người đội mũ và bỏ
 * mũ, chụp chính diện và chụp nghiêng, rất dễ thành hai cụm. Không có nút gộp
 * thì studio chỉ còn cách xoá hết làm lại, và họ sẽ thôi dùng.
 *
 * Người nhận (`intoId`) giữ tên và ảnh đại diện của mình.
 */
export function mergePeople(people: Person[], intoId: string, fromId: string): Person[] {
  if (intoId === fromId) return people;
  const from = people.find((p) => p.id === fromId);
  const into = people.find((p) => p.id === intoId);
  if (!from || !into) return people;
  const keys = new Set(into.photoKeys);
  for (const k of from.photoKeys) keys.add(k);
  return people
    .filter((p) => p.id !== fromId)
    .map((p) =>
      p.id === intoId
        ? {
            ...p,
            faces: p.faces + from.faces,
            photoKeys: [...keys].sort(),
            // Hai cụm rời nhau nên không cần lọc trùng. Sắp lại theo số để tâm
            // cụm tính ra giống nhau bất kể gộp theo chiều nào.
            faceIdx: [...p.faceIdx, ...from.faceIdx].sort((a, b) => a - b),
          }
        : p
    );
}

/**
 * Gỡ một tấm ra khỏi một người.
 *
 * Đây là cách sửa lỗi "gom thừa" — một tấm người lạ lọt vào cụm cô dâu. Gỡ tấm
 * cuối cùng thì người đó biến mất luôn: một thẻ lọc không còn ảnh nào chỉ là một
 * ô trống chờ ai đó bấm nhầm.
 *
 * Cần cả `faces` (đúng mảng đã truyền cho `groupFaces`) để bỏ luôn những khuôn
 * mặt nằm trên tấm đó khỏi `faceIdx`. Bỏ tấm mà để lại khuôn mặt của nó thì tâm
 * cụm lưu xuống DB vẫn mang theo người bị gỡ — sai âm thầm, và chỉ lộ ra ở lần
 * quét sau khi cụm mới ghép vào đúng người bị gỡ ấy.
 */
export function dropPhoto(
  people: Person[],
  personId: string,
  photoKey: string,
  faces: readonly Pick<FaceVector, "key" | "at" | "box">[]
): Person[] {
  return people
    .map((p) => {
      if (p.id !== personId) return p;
      const photoKeys = p.photoKeys.filter((k) => k !== photoKey);
      const faceIdx = p.faceIdx.filter((i) => faces[i]?.key !== photoKey);
      if (p.coverKey !== photoKey) return { ...p, photoKeys, faceIdx, faces: faceIdx.length };
      // Gỡ đúng tấm đại diện: phải chọn tấm khác VÀ lấy khung khuôn mặt của
      // chính khuôn mặt mới. Giữ nguyên khung cũ thì ảnh thẻ cắt ra một chỗ bất
      // kỳ trên tấm mới — rất có thể là mặt người khác.
      const next = faceIdx.map((i) => faces[i]).find((f) => f && f.key === photoKeys[0]);
      return {
        ...p,
        photoKeys,
        faceIdx,
        faces: faceIdx.length,
        coverKey: photoKeys[0] ?? "",
        coverAt: next?.at ?? 0,
        coverBox: next?.box,
      };
    })
    .filter((p) => p.photoKeys.length > 0);
}

/** Ảnh nào có người nào — bảng tra để lọc lưới ảnh. */
export function photoToPeople(people: Person[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of people) {
    for (const k of p.photoKeys) {
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(p.id);
    }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Nhận lại người đã lưu ở lần quét trước
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Tâm cụm: trung bình các vector của một người.
 *
 * Đây là thứ lưu xuống DB làm "chứng minh thư" của người đó. Lấy trung bình chứ
 * không lấy vector của một khuôn mặt đại diện, vì trung bình NẰM GẦN mọi thành
 * viên hơn là các thành viên gần nhau — nên đo với cùng ngưỡng 0,6 thì vừa ít
 * nhận nhầm người khác, vừa ít bỏ sót chính người đó.
 *
 * Bỏ qua vector sai chiều thay vì để nó kéo lệch tâm cụm. Không còn vector nào
 * dùng được thì trả `null`: người đó lưu xuống KHÔNG có descriptor, và lần quét
 * sau đơn giản là không nhận lại được — thà vậy hơn là nhận lại bằng một tâm cụm
 * rác rồi gán tên "Cô dâu" cho người khác.
 */
export function centroid(vectors: readonly (readonly number[])[]): number[] | null {
  const dim = vectors.find((v) => v.length > 0)?.length ?? 0;
  if (dim === 0) return null;
  const sum = new Array<number>(dim).fill(0);
  let n = 0;
  for (const v of vectors) {
    if (v.length !== dim) continue;
    for (let i = 0; i < dim; i++) sum[i] += v[i];
    n++;
  }
  if (n === 0) return null;
  return sum.map((s) => s / n);
}

/** Một người ĐÃ LƯU ở lần quét trước, đọc lên từ DB. */
export type KnownPerson = {
  id: string;
  name: string;
  /** Tâm cụm đã lưu. Rỗng/sai chiều thì người này không tham gia ghép. */
  descriptor: readonly number[];
};

/** Kết quả ghép một cụm mới với người cũ. `knownId` rỗng = người mới. */
export type PersonMatch = {
  /** Khoá cụm trong phiên quét này (Person.id). */
  personId: string;
  knownId: string | null;
  /** Tên kế thừa được, rỗng nếu là người mới. */
  name: string;
  /** Khoảng cách tới người cũ, `Infinity` nếu không ghép được. */
  distance: number;
};

/**
 * Ghép các cụm của lần quét này với những người studio đã đặt tên lần trước.
 *
 * Vì sao cần: studio thật không quét một lần rồi xong. Giao đợt đầu, chụp thêm,
 * quét đợt hai. Không ghép thì lần hai ra một bộ người hoàn toàn mới, studio
 * phải đặt lại tên từ đầu, và những chip khách đang dùng trỏ vào người cũ.
 *
 * GHÉP MỘT-ĐỐI-MỘT, tham lam theo khoảng cách tăng dần. Hai cụm mới KHÔNG được
 * cùng nhận một người cũ: khi một người bị tách thành hai cụm (ngưỡng quá chặt,
 * hoặc ảnh nửa mặt), chỉ cụm gần hơn thừa hưởng cái tên; cụm kia để trống cho
 * studio tự gộp. Cho cả hai cùng tên thì tạo ra hai "Cô dâu" trong một album —
 * đúng thứ mà chỉ mục `album_people_name_uk` từ chối, và cũng là dữ liệu sai.
 *
 * Thứ tự so sánh có phá hoà (theo chỉ số) nên cùng đầu vào luôn ra cùng kết quả.
 */
export function matchKnown(
  fresh: readonly { id: string; descriptor: readonly number[] | null }[],
  known: readonly KnownPerson[],
  opts: GroupOptions = {}
): PersonMatch[] {
  const o = { ...GROUP_DEFAULTS, ...opts };
  const pairs: { fi: number; ki: number; d: number }[] = [];
  for (let fi = 0; fi < fresh.length; fi++) {
    const fd = fresh[fi].descriptor;
    if (!fd || fd.length === 0) continue;
    for (let ki = 0; ki < known.length; ki++) {
      const d = euclidean(fd, known[ki].descriptor);
      if (d <= o.maxDistance) pairs.push({ fi, ki, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d || a.fi - b.fi || a.ki - b.ki);

  const takenFresh = new Set<number>();
  const takenKnown = new Set<number>();
  const out: PersonMatch[] = fresh.map((f) => ({
    personId: f.id,
    knownId: null,
    name: "",
    distance: Infinity,
  }));
  for (const { fi, ki, d } of pairs) {
    if (takenFresh.has(fi) || takenKnown.has(ki)) continue;
    takenFresh.add(fi);
    takenKnown.add(ki);
    out[fi] = { personId: fresh[fi].id, knownId: known[ki].id, name: known[ki].name, distance: d };
  }
  return out;
}

/**
 * Tìm người GẦN NHẤT với một khuôn mặt lẻ — dùng cho lúc khách tự tải ảnh mình
 * lên để hỏi "ảnh nào có tôi".
 *
 * Khác `matchKnown` ở chỗ đây là MỘT khuôn mặt hỏi NHIỀU người, nên không có
 * chuyện ghép một-đối-một: chỉ lấy người gần nhất, và chỉ khi đủ gần.
 *
 * Quá ngưỡng thì trả `null` chứ KHÔNG trả người gần nhất kèm lời cảnh báo. Đưa
 * nhầm album của người khác cho khách xem là hỏng nặng hơn nhiều so với việc nói
 * "không tìm thấy" — và khách vẫn còn đường chọn mặt bằng tay.
 */
export function nearestPerson(
  descriptor: readonly number[],
  people: readonly { id: string; descriptor: readonly number[] | null }[],
  opts: GroupOptions = {}
): { id: string; distance: number } | null {
  const o = { ...GROUP_DEFAULTS, ...opts };
  let best: { id: string; distance: number } | null = null;
  for (const p of people) {
    if (!p.descriptor || p.descriptor.length === 0) continue;
    const d = euclidean(descriptor, p.descriptor);
    // Phá hoà theo thứ tự để cùng đầu vào luôn ra cùng kết quả.
    if (d <= o.maxDistance && (best === null || d < best.distance)) best = { id: p.id, distance: d };
  }
  return best;
}
