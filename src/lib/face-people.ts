/**
 * NGƯỜI TRONG ALBUM — phần luật thuần, không phụ thuộc React hay Supabase.
 *
 * Cầu nối giữa hai thế giới không dùng cùng một cách gọi tên ảnh:
 *
 *   • Lúc studio QUÉT, ảnh là file trên đĩa hoặc trên Drive. Thứ duy nhất chắc
 *     chắn có là TÊN FILE.
 *   • Trong DB, ảnh của album là một hàng `photos` có id uuid.
 *
 * Nên mọi thứ ở đây xoay quanh một luật ghép duy nhất: `matchKey`. Cùng luật mà
 * công cụ Lọc ảnh đã dùng để đối chiếu danh sách khách gửi — cố ý dùng CHUNG một
 * hàm, vì hai luật ghép tên file gần giống nhau sẽ lệch nhau lúc nào không biết.
 *
 * Bảng: supabase/migrations/album_people.sql
 */

/**
 * Khoá ghép hai tên file: bỏ phần mở rộng, cắt trắng hai đầu, hạ chữ thường.
 *
 * Bỏ phần mở rộng vì studio giao khách JPG nhưng lọc trên RAW — `IMG_2841.CR3`
 * và `IMG_2841.jpg` là cùng một tấm. Hạ chữ thường vì Windows không phân biệt
 * hoa/thường trong tên file còn Drive thì có.
 */
export function matchKey(name: string): string {
  return name.replace(/\.[^./\\]+$/, "").trim().toLowerCase();
}

/** Một hàng `photos` — chỉ hai cột cần cho việc ghép. */
export type PhotoRef = { id: string; name: string };

/**
 * Bảng tra `matchKey` → id ảnh.
 *
 * Trùng khoá thì BẢN ĐẦU THẮNG: `photos` xếp theo `position`, nên bản đầu là bản
 * studio đưa vào album trước. Trùng tên trong một album là chuyện có thật (hai
 * thư mục nguồn), và chọn bừa bản sau thì mỗi lần lưu lại ra một kết quả khác.
 */
export function indexByKey(photos: readonly PhotoRef[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of photos) {
    const k = matchKey(p.name);
    if (k && !out.has(k)) out.set(k, p.id);
  }
  return out;
}

/**
 * Đổi danh sách tên file thành id ảnh trong album.
 *
 * `missing` KHÔNG phải lỗi cần chặn — nó là câu trả lời cho tình huống thường
 * gặp nhất: studio quét một thư mục rộng hơn album (cả buổi chụp) rồi lưu vào
 * album chỉ có ảnh đã lọc. Nhưng nó cũng là dấu hiệu của lỗi thật (quét sai
 * thư mục), nên màn hình phải HIỆN con số này ra chứ không im lặng bỏ bớt.
 */
export function resolvePhotoIds(
  names: readonly string[],
  index: ReadonlyMap<string, string>
): { ids: string[]; missing: string[] } {
  const ids: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const id = index.get(matchKey(n));
    if (!id) {
      missing.push(n);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids, missing };
}

/** Giới hạn khớp với `check (char_length(name) <= 60)` trong migration. */
export const NAME_MAX = 60;

/**
 * Vấn đề về tên TRƯỚC khi gửi lên DB.
 *
 * Chỉ mục `album_people_name_uk` sẽ từ chối tên trùng, nhưng lúc đó studio nhận
 * một lỗi Postgres thô ở giữa một lượt lưu đã ghi được nửa. Kiểm ở đây để nói
 * bằng tiếng Việt và không ghi gì cả.
 *
 * Tên rỗng KHÔNG phải vấn đề: nhiều cụm chưa đặt tên là chuyện thường, chúng lưu
 * xuống để giữ tâm cụm cho lần quét sau và chỉ không hiện chip cho khách.
 */
export function nameProblems(names: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, number>();
  for (const raw of names) {
    const n = raw.trim();
    if (!n) continue;
    if (n.length > NAME_MAX) out.push(`"${n.slice(0, 20)}…" dài quá ${NAME_MAX} ký tự.`);
    const k = n.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) out.push(`Có ${n} người cùng tên "${k}".`);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Phía khách: chip lọc
   ───────────────────────────────────────────────────────────────────────────── */

/** Hàng `album_people` đọc lên cho trang khách. */
export type PeopleRow = {
  id: string;
  name: string;
  cover_photo_id: string | null;
  /** [x, y, rộng, cao] chuẩn hoá 0…1 — khung khuôn mặt trên ảnh bìa. */
  cover_box: number[] | null;
  /**
   * Tâm cụm 128 chiều. Gửi xuống máy khách để phép so ảnh khách tự tải lên chạy
   * NGAY TRÊN MÁY HỌ: ảnh của khách không rời khỏi thiết bị, và không tốn một
   * lượt gọi hàm serverless nào. Đổi lại, ai có link album cũng nhận được vector
   * của những người TRONG CHÍNH album đó — mà ảnh của họ thì link ấy vốn đã cho
   * xem. Đánh đổi đó đáng hơn là bắt khách gửi ảnh mặt mình lên máy chủ.
   */
  descriptor: number[] | null;
  face_count: number;
  position: number;
};
/** Hàng `album_photo_people`. */
export type PeopleLink = { person_id: string; photo_id: string };

export type PersonChip = {
  id: string;
  /** Rỗng = studio chưa đặt tên. Vẫn hiện, vì khách nhận ra bằng MẶT. */
  name: string;
  coverPhotoId: string | null;
  coverBox: number[] | null;
  descriptor: number[] | null;
  faceCount: number;
  photoIds: string[];
};

/**
 * Danh sách KHUÔN MẶT hiện cho khách chọn.
 *
 * Khách nhận ra người bằng MẶT, không bằng tên — nên khác với bản đầu, người
 * studio chưa kịp đặt tên vẫn hiện. Chính họ mới là phần lớn: studio đặt tên cô
 * dâu chú rể là cùng, còn mẹ cô dâu, cô bạn thân, đứa cháu thì không ai ngồi đặt
 * tên hết. Bỏ họ đi là bỏ đúng những người cần chức năng này nhất.
 *
 * Hai luật còn lại giữ nguyên, cả hai để tránh một mặt bấm vào ra lưới trống:
 *  • Chỉ ảnh CÒN TRONG album. Studio xoá ảnh sau khi lưu là chuyện bình thường;
 *    `on delete cascade` chỉ dọn khi hàng `photos` bị xoá thật, còn ảnh bị đổi
 *    sang album khác thì hàng nối vẫn còn.
 *  • Bỏ người không còn ảnh nào.
 *
 * Thứ tự: người ĐÃ ĐẶT TÊN lên trước (theo `position` studio xếp), rồi tới các
 * mặt chưa đặt tên xếp theo số ảnh giảm dần. Người studio đã bỏ công đặt tên gần
 * như luôn là nhân vật chính; còn trong đám còn lại thì ai xuất hiện nhiều nhất
 * là ai đáng bấm trước.
 */
export function faceChips(
  people: readonly PeopleRow[],
  links: readonly PeopleLink[],
  albumPhotoIds: ReadonlySet<string>
): PersonChip[] {
  const byPerson = new Map<string, string[]>();
  for (const l of links) {
    if (!albumPhotoIds.has(l.photo_id)) continue;
    const arr = byPerson.get(l.person_id);
    if (arr) arr.push(l.photo_id);
    else byPerson.set(l.person_id, [l.photo_id]);
  }
  return people
    .filter((p) => (byPerson.get(p.id)?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const na = a.name.trim();
      const nb = b.name.trim();
      if (!!na !== !!nb) return na ? -1 : 1;
      if (na && nb) return a.position - b.position || na.localeCompare(nb, "vi");
      const ca = byPerson.get(a.id)!.length;
      const cb = byPerson.get(b.id)!.length;
      return cb - ca || a.position - b.position;
    })
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      coverPhotoId:
        p.cover_photo_id && albumPhotoIds.has(p.cover_photo_id) ? p.cover_photo_id : null,
      coverBox: p.cover_box && p.cover_box.length === 4 ? p.cover_box : null,
      descriptor: p.descriptor && p.descriptor.length > 0 ? p.descriptor : null,
      faceCount: p.face_count,
      photoIds: byPerson.get(p.id)!,
    }));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cắt ảnh mặt
   ───────────────────────────────────────────────────────────────────────────── */

/** Khung mặt sau khi nới thêm lề, vẫn nằm trong ảnh. */
export function padBox(
  box: readonly number[],
  pad: number
): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = box;
  const nw = Math.min(1, w * (1 + 2 * pad));
  const nh = Math.min(1, h * (1 + 2 * pad));
  // Giữ nguyên TÂM khi nới, rồi đẩy vào trong nếu tràn mép — cắt cụt một bên
  // thì mặt lệch hẳn sang một góc ảnh thẻ.
  const nx = Math.min(Math.max(x + w / 2 - nw / 2, 0), 1 - nw);
  const ny = Math.min(Math.max(y + h / 2 - nh / 2, 0), 1 - nh);
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Kiểu CSS để cắt đúng một khuôn mặt ra khỏi ảnh, dùng cho ảnh thẻ VUÔNG.
 *
 * Đặt lên một `<img>` có `width: 100%`, `height: auto`, nằm trong ô vuông
 * `overflow: hidden`. Không cần biết tỉ lệ ảnh gốc — và đó là điểm mấu chốt:
 * trình duyệt chưa tải xong ảnh thì cũng chưa biết tỉ lệ, nên mọi cách tính cần
 * tới nó đều nhảy khi ảnh về.
 *
 * Vì sao đúng: `translate` theo phần trăm ăn theo KÍCH THƯỚC CHÍNH ẢNH, nên
 * `-x%` dịch đúng `x × chiều rộng ảnh` và `-y%` dịch đúng `y × chiều cao ảnh` —
 * tức là đưa góc trên-trái của khuôn mặt về gốc toạ độ, bất kể ảnh ngang hay
 * dọc. Rồi `scale(1/w)` phóng cho bề ngang khuôn mặt vừa đúng bề ngang ô.
 *
 * Phóng theo MỘT hệ số cho cả hai chiều nên mặt không bị bóp méo. Chiều cao
 * khuôn mặt trong ô thì tuỳ tỉ lệ ảnh, nhưng luôn xấp xỉ vuông: khuôn mặt vốn
 * gần vuông tính bằng ĐIỂM ẢNH, mà `h` chuẩn hoá trên ảnh ngang thì lớn hơn `w`
 * đúng bằng tỉ lệ ấy.
 */
export function faceCrop(
  box: readonly number[] | null,
  pad = 0.45
): { transform: string; transformOrigin: string } | null {
  if (!box || box.length !== 4 || box.some((n) => !Number.isFinite(n))) return null;
  const b = padBox(box, pad);
  if (b.w <= 0 || b.h <= 0) return null;
  return {
    transform: `scale(${(1 / b.w).toFixed(4)}) translate(${(-b.x * 100).toFixed(3)}%, ${(-b.y * 100).toFixed(3)}%)`,
    transformOrigin: "0 0",
  };
}

/** Lọc lưới ảnh theo người đang chọn. `null` = không lọc. */
export function filterByPerson<T extends { id: string }>(
  photos: readonly T[],
  chip: PersonChip | null
): T[] {
  if (!chip) return photos as T[];
  const want = new Set(chip.photoIds);
  return photos.filter((p) => want.has(p.id));
}
