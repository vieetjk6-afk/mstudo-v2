/* ═══════════════════════════════════════════════════════════════════════════
   GỢI Ý ẢNH ĐỂ GHÉP — chia nhóm ảnh cưới MIỄN PHÍ, không gửi ảnh cho AI nào.

   Hai nguồn dữ liệu có sẵn:
     1. Khuôn mặt máy chủ đã quét (album_faces + album_people — tính năng tìm
        ảnh theo khuôn mặt, cùng gói Photographer Plus / Studio với tính năng
        này). Hai người xuất hiện nhiều nhất album cưới là cô dâu và chú rể
        (studio đặt tên "Cô dâu" / "Chú rể" thì theo tên). Từ đó:
          • không có mặt người          → Decor & chi tiết
          • có cả hai, ít người          → Ảnh chung
          • chỉ một trong hai, ít người  → Ảnh riêng cô dâu / chú rể
          • đông người                   → Gia đình & bạn bè
     2. Tên thư mục studio đặt trên Drive ("Bê quả", "Gia tiên", "Decor"…):
        khớp theo từ khoá, có dấu hay không dấu đều được.

   Một ảnh có thể ở nhiều nhóm (thư mục "Bê quả" + ảnh chung). Điểm ưu tiên
   0..10 dựa vào độ nét vùng mặt, cỡ mặt và vai trò trong ảnh — chỉ để XẾP
   ảnh trong một nhóm và chọn gợi ý, không phải chấm "đẹp / xấu".

   Thuần, không nhập gì — máy chủ (route /collage/photos) và máy khách (nút
   "Chọn giúp tôi") cùng dùng; kiểm thử bằng node.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CatKind = "couple" | "person" | "decor" | "moment" | "family" | "folder";

export interface PhotoCat {
  id: string;
  /** Tên hiện cho khách. Rỗng với người chưa được đặt tên → giao diện hiện ảnh mặt. */
  label: string;
  kind: CatKind;
  count: number;
  /** Nhóm ảnh riêng của một người: id trong album_people (để hiện ảnh mặt). */
  personId?: string;
  /** "bride" / "groom" khi biết chắc qua tên studio đặt. */
  role?: "bride" | "groom";
}

export interface PhotoInfo {
  tags: string[];
  /** 0..10 — để xếp ảnh trong nhóm và chọn gợi ý. */
  score: number;
  /** Ảnh người là nhân vật chính (cô dâu, chú rể, ảnh chung) — được làm ảnh chính của trang. */
  hero: boolean;
  /** Khung các khuôn mặt rõ [x, y, w, h] 0..1 — để cắt ảnh không mất mặt. */
  faces: number[][];
}

export interface CatInput {
  photos: { id: string; source_id: string | null; position: number }[];
  sources: { id: string; name: string }[];
  /** album_faces của album (chỉ ảnh còn trong album được dùng). */
  faces: { photo_id: string; box: number[]; sharpness?: number | null }[];
  /** Ảnh máy chủ đã quét mặt xong (photos.faces_scanned_at) — ảnh quét rồi mà 0 mặt mới là decor. */
  scanned: ReadonlySet<string>;
  people: { id: string; name: string }[];
  links: { person_id: string; photo_id: string }[];
}

export interface CatResult {
  cats: PhotoCat[];
  info: Record<string, PhotoInfo>;
}

export const CAT_COUPLE = "couple";
export const CAT_DECOR = "decor";
export const CAT_FAMILY = "family";

/** Bỏ dấu tiếng Việt + chữ thường, để "Bê quả", "be qua", "BÊ QUẢ" cùng khớp. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

/** Khoảnh khắc nhận theo tên thư mục — thứ tự = thứ tự hiện chip. */
export const MOMENT_RULES: { id: string; label: string; re: RegExp }[] = [
  { id: "m-bequa", label: "Bê quả · Ăn hỏi", re: /\b(be|bung)\s*qua\b|\bmam\s*qua|\btrap\b|\ban\s*hoi\b|\bdam\s*ngo\b|\bdinh\s*hon\b|engagement/ },
  { id: "m-giatien", label: "Lễ gia tiên · Rước dâu", re: /gia\s*tien|vu\s*quy|thanh\s*hon|\b(ruoc|don)\s*dau\b|\ble\s*cuoi\b|ceremony|nha\s*tho|church/ },
  { id: "m-tiec", label: "Tiệc cưới", re: /\btiec\b|nha\s*hang|reception|party|san\s*khau/ },
  { id: "m-pre", label: "Ảnh cưới ngoại cảnh", re: /pre[\s-]*wedding|ngoai\s*canh|outdoor|album\s*cuoi/ },
];

/* Thư mục gợi thẳng một nhóm có sẵn. Cố ý KHÔNG có từ ngắn trùng tên người
   ("nhẫn" → "nhan" trùng tên Nhân; "vợ" → "vo" trùng họ Võ). */
const FOLDER_DECOR = /decor|trang\s*tri|chi\s*tiet|detail|backdrop|cong\s*hoa|hoa\s*cuoi|do\s*vat/;
const FOLDER_FAMILY = /gia\s*dinh|family|ban\s*be|khach\s*moi|guest|ho\s*hang/;
const NAME_BRIDE = /co\s*dau|\bbride\b/;
const NAME_GROOM = /chu\s*re|\bgroom\b/;
/** Thư mục "Cô dâu" / "Chú rể" khi chưa biết ai là ai qua khuôn mặt. */
const FOLDER_ROLE: { id: string; label: string; re: RegExp; role: "bride" | "groom" }[] = [
  { id: "m-codau", label: "Cô dâu", re: /co\s*dau|\bbride\b|make\s*up|trang\s*diem/, role: "bride" },
  { id: "m-chure", label: "Chú rể", re: /chu\s*re|\bgroom\b/, role: "groom" },
];

/**
 * Những người có thể là cô dâu / chú rể: người studio đặt tên "Cô dâu" / "Chú
 * rể" + vài người nhiều khuôn mặt nhất. Máy chủ chỉ đọc ảnh của ĐÚNG những người
 * này (categorize chỉ cần hai nhân vật chính) thay vì mọi người khách trong album
 * — album cưới có hàng trăm cụm mặt khách mời.
 */
export function mainCandidates(people: readonly { id: string; name: string; face_count?: number | null }[], top = 3): string[] {
  const byCount = [...people].sort((a, b) => (Number(b.face_count) || 0) - (Number(a.face_count) || 0));
  const out: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };
  add(byCount.find((p) => NAME_BRIDE.test(fold(p.name || "")))?.id);
  add(byCount.find((p) => NAME_GROOM.test(fold(p.name || "")))?.id);
  for (const p of byCount.slice(0, top)) add(p.id);
  return out;
}

/** Mặt đủ lớn để tính là người trong ảnh (bỏ khách lấp ló phía xa). */
export function significant(box: readonly number[]): boolean {
  return box.length === 4 && (box[2] >= 0.04 || box[3] >= 0.04);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Chia nhóm + chấm điểm ưu tiên cho mọi ảnh của album. */
export function categorize(inp: CatInput): CatResult {
  const ids = new Set(inp.photos.map((p) => p.id));
  const info: Record<string, PhotoInfo> = {};
  for (const p of inp.photos) info[p.id] = { tags: [], score: 5, hero: false, faces: [] };

  /* ── Khuôn mặt từng ảnh ── */
  const facesOf = new Map<string, { box: number[]; sharp: number }[]>();
  for (const f of inp.faces) {
    if (!ids.has(f.photo_id) || !Array.isArray(f.box) || f.box.length !== 4) continue;
    const arr = facesOf.get(f.photo_id) ?? [];
    arr.push({ box: f.box.map(Number), sharp: Number(f.sharpness) || 0 });
    facesOf.set(f.photo_id, arr);
  }
  const peopleOf = new Map<string, Set<string>>();
  const photoCount = new Map<string, number>();
  for (const l of inp.links) {
    if (!ids.has(l.photo_id)) continue;
    const s = peopleOf.get(l.photo_id) ?? new Set<string>();
    if (!s.has(l.person_id)) photoCount.set(l.person_id, (photoCount.get(l.person_id) ?? 0) + 1);
    s.add(l.person_id);
    peopleOf.set(l.photo_id, s);
  }

  /* ── Cô dâu, chú rể: theo tên studio đặt, không có thì hai người nhiều ảnh nhất ── */
  const withFaces = inp.photos.filter((p) => facesOf.has(p.id)).length;
  const minCount = Math.max(3, Math.round(withFaces * 0.05));
  const ranked = inp.people
    .filter((p) => (photoCount.get(p.id) ?? 0) >= minCount)
    .sort((a, b) => (photoCount.get(b.id) ?? 0) - (photoCount.get(a.id) ?? 0));
  const bride = ranked.find((p) => NAME_BRIDE.test(fold(p.name)));
  const groom = ranked.find((p) => p !== bride && NAME_GROOM.test(fold(p.name)));
  const main: { id: string; name: string; role?: "bride" | "groom" }[] = [];
  if (bride) main.push({ ...bride, role: "bride" });
  if (groom) main.push({ ...groom, role: "groom" });
  for (const p of ranked) {
    if (main.length >= 2) break;
    if (!main.some((m) => m.id === p.id)) main.push(p);
  }
  const [pA, pB] = main;

  /* ── Độ nét vùng mặt so với cả album ── */
  const sharpMed = median([...facesOf.values()].flat().map((f) => f.sharp).filter((s) => s > 0)) || 1;

  /* ── Gắn nhóm theo khuôn mặt ── */
  const personTag = (id: string) => `p:${id}`;
  for (const p of inp.photos) {
    const it = info[p.id];
    const fs = (facesOf.get(p.id) ?? []).filter((f) => significant(f.box));
    it.faces = fs.map((f) => f.box.map(round3));
    const who = peopleOf.get(p.id) ?? new Set<string>();
    const hasA = !!pA && who.has(pA.id);
    const hasB = !!pB && who.has(pB.id);
    const n = fs.length;
    if (inp.scanned.has(p.id) || facesOf.has(p.id)) {
      if (n === 0 && !hasA && !hasB) it.tags.push(CAT_DECOR);
      else if (hasA && hasB && n <= 3) it.tags.push(CAT_COUPLE);
      else if ((hasA || hasB) && !(hasA && hasB) && n <= 2) it.tags.push(personTag(hasA ? pA!.id : pB!.id));
      // Chưa biết ai là cô dâu / chú rể (album chưa gom người): ảnh 1–3 mặt nhiều
      // khả năng chính là ảnh cặp đôi — đừng xếp nhầm vào "Gia đình & bạn bè".
      else if (n >= (pA ? 1 : 4)) it.tags.push(CAT_FAMILY);
    }
    // Điểm ưu tiên: vai trò + độ nét vùng mặt + cỡ mặt (ảnh cận rõ mặt lên trước).
    let score = 5;
    if (it.tags.includes(CAT_COUPLE)) score += 1.6;
    else if (it.tags.some((t) => t.startsWith("p:"))) score += 1.1;
    else if (it.tags.includes(CAT_FAMILY)) score += 0.2;
    if (fs.length) {
      const sharp = Math.max(...fs.map((f) => f.sharp));
      if (sharp > 0) score += clamp(Math.log2(sharp / sharpMed) * 0.8, -1, 1.5);
      const big = Math.max(...fs.map((f) => f.box[2]));
      score += clamp((big - 0.04) * 8, 0, 0.8);
    }
    it.score = round3(clamp(score, 0, 10));
  }

  /* ── Gắn nhóm theo tên thư mục ── */
  const folderTag = new Map<string, string[]>();
  const plainFolders: { id: string; name: string }[] = [];
  for (const s of inp.sources) {
    const n = fold(s.name || "");
    const tags: string[] = [];
    for (const m of MOMENT_RULES) if (m.re.test(n)) tags.push(m.id);
    if (FOLDER_DECOR.test(n)) tags.push(CAT_DECOR);
    if (FOLDER_FAMILY.test(n)) tags.push(CAT_FAMILY);
    // Thư mục cô dâu / chú rể: gộp vào nhóm ảnh riêng của người đó nếu đã biết
    // ai là ai (studio đặt tên); chưa biết thì thành một nhóm theo thư mục.
    for (const fr of FOLDER_ROLE) {
      if (!fr.re.test(n)) continue;
      const who = main.find((m) => m.role === fr.role);
      tags.push(who ? personTag(who.id) : fr.id);
    }
    if (tags.length) folderTag.set(s.id, tags);
    else plainFolders.push(s);
  }
  for (const p of inp.photos) {
    const extra = p.source_id ? folderTag.get(p.source_id) : undefined;
    if (!extra) continue;
    const it = info[p.id];
    for (const t of extra) if (!it.tags.includes(t)) it.tags.push(t);
    // Ảnh decor theo thư mục không còn là "gia đình" chỉ vì có người lấp ló.
    if (extra.includes(CAT_DECOR)) it.tags = it.tags.filter((t) => t !== CAT_FAMILY);
  }
  // Ảnh chính của trang: ảnh có cô dâu / chú rể (theo mặt hoặc theo thư mục).
  for (const p of inp.photos) {
    const it = info[p.id];
    it.hero = it.tags.some((t) => t === CAT_COUPLE || t.startsWith("p:") || FOLDER_ROLE.some((fr) => fr.id === t));
  }

  /* ── Danh sách nhóm (chip) ── */
  const count = (tag: string) => inp.photos.reduce((n, p) => n + (info[p.id].tags.includes(tag) ? 1 : 0), 0);
  const cats: PhotoCat[] = [];
  const add = (c: Omit<PhotoCat, "count">) => {
    const n = count(c.id);
    if (n > 0) cats.push({ ...c, count: n });
  };
  add({ id: CAT_COUPLE, label: "Ảnh chung", kind: "couple" });
  for (const m of [pA, pB]) {
    if (!m) continue;
    const label = m.role === "bride" ? "Cô dâu" : m.role === "groom" ? "Chú rể" : m.name.trim();
    add({ id: personTag(m.id), label, kind: "person", personId: m.id, ...(m.role ? { role: m.role } : {}) });
  }
  for (const fr of FOLDER_ROLE) add({ id: fr.id, label: fr.label, kind: "person", role: fr.role });
  add({ id: CAT_DECOR, label: "Decor & chi tiết", kind: "decor" });
  for (const m of MOMENT_RULES) add({ id: m.id, label: m.label, kind: "moment" });
  add({ id: CAT_FAMILY, label: "Gia đình & bạn bè", kind: "family" });
  // Thư mục studio đặt mà không khớp nhóm nào — vẫn cho lọc theo thư mục khi có từ 2 thư mục.
  if (inp.sources.length > 1) {
    for (const s of plainFolders) {
      const n = inp.photos.filter((p) => p.source_id === s.id).length;
      if (n > 0) {
        const id = `f:${s.id}`;
        for (const p of inp.photos) if (p.source_id === s.id) info[p.id].tags.push(id);
        cats.push({ id, label: s.name || "Thư mục", kind: "folder", count: n });
      }
    }
  }
  return { cats, info };
}

/* ── Chọn giúp khách ─────────────────────────────────────────────────────── */

/**
 * Chọn `k` ảnh trong `pool`, trải đều theo thứ tự album: chia thành `k` khúc,
 * mỗi khúc bốc NGẪU NHIÊN một tấm — tấm điểm cao dễ trúng hơn (trọng số theo
 * điểm) nhưng không lần nào giống lần nào. Trải đều nên không vớ hai tấm bấm
 * liên tiếp gần như giống hệt nhau.
 */
function spreadPick(pool: readonly string[], k: number, pos: ReadonlyMap<string, number>, scoreOf: (id: string) => number, picked: Set<string>, want: number, rand: () => number) {
  const list = pool.filter((id) => !picked.has(id) && pos.has(id)).sort((a, b) => pos.get(a)! - pos.get(b)!);
  if (k <= 0 || !list.length) return;
  const chunks = Math.min(k, list.length);
  // Lệch ranh giới khúc một đoạn ngẫu nhiên — hai lần chọn không cắt cùng chỗ.
  const shift = rand();
  for (let c = 0; c < chunks && picked.size < want; c++) {
    const a = Math.floor(((c + shift) * list.length) / chunks) % list.length;
    const len = Math.max(1, Math.floor(list.length / chunks));
    const part: string[] = [];
    for (let i = 0; i < len; i++) {
      const id = list[(a + i) % list.length];
      if (!picked.has(id)) part.push(id);
    }
    if (!part.length) continue;
    const top = Math.max(...part.map(scoreOf));
    const w = part.map((id) => Math.exp((scoreOf(id) - top) * 0.9));
    let r = rand() * w.reduce((x, y) => x + y, 0);
    let i = 0;
    while (i < part.length - 1 && (r -= w[i]) > 0) i++;
    picked.add(part[i]);
  }
}

/** Tỉ lệ trong bộ gợi ý: ảnh chung của hai bạn, ảnh riêng cô dâu, ảnh riêng chú rể. */
const SHARE = { couple: 0.4, person: 0.3 };

/** Ảnh không bao giờ được gợi ý: đông người (gia đình, khách mời) và ảnh không có người (decor). */
const isCrowd = (tags: readonly string[]) => tags.includes(CAT_FAMILY) || tags.includes(CAT_DECOR);
/** Thư mục lễ / tiệc — thường đông người; chỉ dùng khi album chưa quét mặt và không còn ảnh nào khác. */
const CROWD_FOLDERS = new Set(["m-bequa", "m-giatien", "m-tiec"]);

/**
 * Bộ ảnh gợi ý `count` tấm — CHỈ ảnh chung của cô dâu chú rể, ảnh riêng cô
 * dâu, ảnh riêng chú rể (theo khuôn mặt đã quét, hoặc thư mục "Cô dâu" / "Chú
 * rể" / "Ngoại cảnh"). Không gợi ý ảnh đông người, ảnh decor.
 *
 * NGẪU NHIÊN: mỗi lần gọi (mỗi lần bấm "Chọn giúp tôi", "Đổi gợi ý") ra một bộ
 * khác — ảnh rõ mặt dễ được chọn hơn nhưng không lần nào y hệt. Truyền `rand`
 * có seed (rng.ts) để kết quả lặp lại được (kiểm thử, lưới "Gợi ý").
 *
 * Album chưa quét mặt: không biết ai là ai nên lấy thư mục cô dâu / chú rể /
 * ngoại cảnh trước, rồi ảnh chưa xếp nhóm ngoài các thư mục lễ / tiệc. Ảnh khách
 * đã THẢ TIM (trong nhóm hợp lệ) được ưu tiên, tối đa nửa bộ. Kết quả xếp theo
 * thứ tự album.
 */
export function suggestPhotos(
  allOrder: readonly string[],
  res: CatResult,
  count: number,
  hearts: ReadonlySet<string> = new Set(),
  /** Ảnh không được gợi ý (đã chọn, đã nằm ở layout khác) — kết quả vẫn đủ `count` ảnh MỚI nếu album còn. */
  exclude: ReadonlySet<string> = new Set(),
  rand: () => number = Math.random,
): string[] {
  const order = exclude.size ? allOrder.filter((id) => !exclude.has(id)) : allOrder;
  const pos = new Map(order.map((id, i) => [id, i]));
  const tagsOf = (id: string) => res.info[id]?.tags ?? [];
  const scoreOf = (id: string) => (res.info[id]?.score ?? 5) + (hearts.has(id) ? 1.5 : 0);
  const picked = new Set<string>();
  const want = Math.max(1, Math.min(count, order.length));

  // Nhóm hợp lệ: ảnh chung + ảnh riêng từng người (cô dâu, chú rể).
  // Hai người: theo vai trò studio đặt tên / thư mục; người chưa đặt tên lấp chỗ còn trống.
  const slots: Set<string>[] = [new Set(), new Set()];
  const faceSlot = [false, false];
  const persons = res.cats.filter((c) => c.kind === "person");
  for (const c of persons) {
    if (!c.role) continue;
    const i = c.role === "bride" ? 0 : 1;
    slots[i].add(c.id);
    if (c.personId) faceSlot[i] = true;
  }
  for (const c of persons) {
    if (c.role) continue;
    const i = faceSlot[0] ? 1 : 0;
    faceSlot[i] = true;
    slots[i].add(c.id);
  }
  const inCat = (id: string, cats: ReadonlySet<string>) => tagsOf(id).some((t) => cats.has(t));
  const couple = order.filter((id) => !isCrowd(tagsOf(id)) && (tagsOf(id).includes(CAT_COUPLE) || tagsOf(id).includes("m-pre")));
  const bride = order.filter((id) => !isCrowd(tagsOf(id)) && inCat(id, slots[0]));
  const groom = order.filter((id) => !isCrowd(tagsOf(id)) && inCat(id, slots[1]));
  const main = new Set([...couple, ...bride, ...groom]);
  // Album đã quét mặt thì biết ảnh nào đông người; chưa quét thì đành dựa vào thư mục.
  const scannedAlbum = order.some((id) => (res.info[id]?.faces.length ?? 0) > 0 || tagsOf(id).includes(CAT_DECOR) || tagsOf(id).includes(CAT_FAMILY));
  const known = (id: string) => tagsOf(id).some((t) => t === CAT_COUPLE || t === CAT_FAMILY || t === CAT_DECOR || t.startsWith("p:"));
  const loose = order.filter((id) => !main.has(id) && !known(id) && !isCrowd(tagsOf(id)) && !tagsOf(id).some((t) => CROWD_FOLDERS.has(t)));
  const lastResort = scannedAlbum ? [] : order.filter((id) => !main.has(id) && !isCrowd(tagsOf(id)) && tagsOf(id).some((t) => CROWD_FOLDERS.has(t)));
  const allowed = new Set([...main, ...loose, ...lastResort]);

  // Ảnh đã thả tim (trong nhóm hợp lệ) lên trước, tối đa nửa bộ — bốc ngẫu nhiên nếu nhiều hơn.
  const liked = [...hearts].filter((id) => pos.has(id) && allowed.has(id));
  spreadPick(liked, Math.min(liked.length, Math.ceil(want / 2)), pos, scoreOf, picked, Math.ceil(want / 2), rand);

  // Chia phần còn lại theo tỉ lệ ảnh chung / cô dâu / chú rể; nhóm thiếu ảnh nhường cho nhóm khác.
  const buckets = [
    { ids: couple, w: SHARE.couple },
    { ids: bride, w: SHARE.person },
    { ids: groom, w: SHARE.person },
  ].filter((b) => b.ids.some((id) => !picked.has(id)));
  let left = want - picked.size;
  for (let round = 0; round < 3 && left > 0 && buckets.length; round++) {
    const total = buckets.reduce((s, b) => s + b.w, 0);
    let given = 0;
    buckets.forEach((b, i) => {
      const k = i === buckets.length - 1 ? left - given : Math.round((left * b.w) / total);
      given += k;
      spreadPick(b.ids, k, pos, scoreOf, picked, want, rand);
    });
    left = want - picked.size;
    for (let i = buckets.length - 1; i >= 0; i--) if (!buckets[i].ids.some((id) => !picked.has(id))) buckets.splice(i, 1);
  }
  // Còn thiếu (album chưa quét mặt / ít ảnh): ảnh chưa xếp nhóm, rồi mới tới thư mục lễ / tiệc.
  if (picked.size < want) spreadPick(loose, want - picked.size, pos, scoreOf, picked, want, rand);
  if (picked.size < want) spreadPick(lastResort, want - picked.size, pos, scoreOf, picked, want, rand);
  return [...picked].sort((a, b) => pos.get(a)! - pos.get(b)!).slice(0, want);
}

/* ── Bộ kể chuyện một chạm ────────────────────────────────────────────────── */

export interface StoryChapter {
  key: string;
  title: string;
  ids: string[];
}

/**
 * Chia ảnh thành các chương theo trình tự ngày cưới: bìa (ảnh chung đẹp nhất)
 * → chuẩn bị (cô dâu) → lễ (bê quả / gia tiên) → decor → hai bạn (ảnh chung,
 * ngoại cảnh) → tiệc → gia đình & bạn bè → lời cảm ơn. Mỗi ảnh một chương,
 * trong chương xếp theo thứ tự album (kể theo thời gian), ảnh thả tim ưu tiên.
 * Album chưa có nhóm (chưa quét mặt, thư mục không đặt tên): chia đều theo thứ
 * tự album, mỗi chương 3 ảnh.
 */
export function storyChapters(order: readonly string[], res: CatResult, hearts: ReadonlySet<string> = new Set(), rand: () => number = Math.random): StoryChapter[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  const used = new Set<string>();
  const score = (id: string) => (res.info[id]?.score ?? 5) + (hearts.has(id) ? 3 : 0);
  const tagged = (pred: (tags: string[]) => boolean) => order.filter((id) => !used.has(id) && pred(res.info[id]?.tags ?? []));
  // Mỗi chương bốc ngẫu nhiên (ảnh rõ mặt, ảnh thả tim dễ trúng hơn) — mỗi lần tạo ra một bộ khác.
  const take = (pool: string[], k: number) => {
    const got = new Set<string>();
    const free = pool.filter((id) => !used.has(id));
    const liked = free.filter((id) => hearts.has(id));
    spreadPick(liked, Math.min(liked.length, Math.ceil(k / 2)), pos, score, got, Math.ceil(k / 2), rand);
    spreadPick(free, k - got.size, pos, score, got, k, rand);
    const picked = [...got].slice(0, k);
    picked.forEach((id) => used.add(id));
    return picked.sort((a, b) => pos.get(a)! - pos.get(b)!);
  };
  const isCouple = (t: string[]) => t.includes(CAT_COUPLE);
  const bride = res.cats.find((c) => c.role === "bride");
  const chapters: StoryChapter[] = [];
  const add = (key: string, title: string, ids: string[]) => {
    if (ids.length) chapters.push({ key, title, ids });
  };
  // Bìa: ảnh chung (không có thì ảnh "nhân vật chính").
  const coverPool = tagged(isCouple).length ? tagged(isCouple) : order.filter((id) => res.info[id]?.hero);
  // Bìa: bốc trong nhóm ảnh điểm cao (không phải lần nào cũng đúng một tấm).
  const coverTop = [...(coverPool.length ? coverPool : order)].sort((a, b) => score(b) - score(a)).slice(0, 6);
  add("cover", "Bìa", take(coverTop, 1));
  add("prep", "Chuẩn bị", take(tagged((t) => t.includes("m-codau") || (!!bride && t.includes(bride.id) && !isCouple(t))), 3));
  add("ceremony", "Lễ gia tiên · Bê quả", take(tagged((t) => t.includes("m-bequa") || t.includes("m-giatien")), 4));
  add("decor", "Decor & chi tiết", take(tagged((t) => t.includes(CAT_DECOR)), 3));
  add("couple", "Hai bạn", take(tagged((t) => isCouple(t) || t.includes("m-pre")), 4));
  add("party", "Tiệc cưới", take(tagged((t) => t.includes("m-tiec")), 4));
  add("family", "Gia đình & bạn bè", take(tagged((t) => t.includes(CAT_FAMILY)), 3));
  // Không có nhóm nào ngoài bìa: chia đều phần còn lại theo thứ tự album.
  if (chapters.length <= 1) {
    // Chừa lại một ảnh cho trang lời cảm ơn.
    const left = order.filter((id) => !used.has(id));
    const rest = take(left, Math.max(0, Math.min(12, left.length - 1)));
    for (let i = 0; i < rest.length; i += 3) add(`part${i / 3 + 1}`, `Phần ${i / 3 + 1}`, rest.slice(i, i + 3));
  }
  // Lời cảm ơn: một ảnh chung khác ảnh bìa (không có thì ảnh đẹp còn lại).
  const thanks = take(tagged(isCouple).length ? tagged(isCouple) : order.filter((id) => !used.has(id)), 1);
  add("thanks", "Lời cảm ơn", thanks);
  return chapters;
}
