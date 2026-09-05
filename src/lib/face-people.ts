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
  position: number;
};
/** Hàng `album_photo_people`. */
export type PeopleLink = { person_id: string; photo_id: string };

export type PersonChip = {
  id: string;
  name: string;
  coverPhotoId: string | null;
  photoIds: string[];
};

/**
 * Chip lọc để hiện cho khách.
 *
 * Ba luật, cả ba đều để tránh một chip bấm vào ra lưới trống:
 *
 *  1. Chỉ người ĐÃ ĐẶT TÊN. Cụm "Người 3" không có nghĩa gì với khách.
 *  2. Chỉ ảnh CÒN TRONG album. Studio xoá ảnh khỏi album sau khi lưu là chuyện
 *     bình thường; khoá ngoại `on delete cascade` chỉ dọn khi hàng `photos` bị
 *     xoá thật, còn ảnh bị chuyển sang album khác thì hàng nối vẫn còn.
 *  3. Bỏ người không còn ảnh nào.
 *
 * Thứ tự: `position` studio đặt, rồi tên — để hai lần tải cùng ra một thứ tự.
 */
export function visibleChips(
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
    .filter((p) => p.name.trim() !== "" && (byPerson.get(p.id)?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => a.position - b.position || a.name.trim().localeCompare(b.name.trim(), "vi"))
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      coverPhotoId:
        p.cover_photo_id && albumPhotoIds.has(p.cover_photo_id) ? p.cover_photo_id : null,
      photoIds: byPerson.get(p.id)!,
    }));
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
