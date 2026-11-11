/* ═══════════════════════════════════════════════════════════════════════════
   TẠO BỘ LAYOUT từ lựa chọn của khách: ảnh đã chọn + khổ + số ảnh mỗi trang +
   phong cách + các nội dung chữ.

   Ba luật của tính năng (theo yêu cầu studio):
     1. Mỗi nội dung chữ nằm trên ĐÚNG MỘT trang, chọn ngẫu nhiên.
     2. Mỗi trang có TỐI ĐA MỘT nội dung; trang không được chia nội dung thì
        chỉ có ảnh.
     3. Bố cục ngẫu nhiên cho đa dạng: mỗi trang bốc một phương án trong nhóm
        tốt nhất (có trọng số), tránh lặp họ bố cục của trang ngay trước. Đổi
        seed ("Tạo lại") là ra một bộ khác — cả cách chia ảnh lẫn bố cục.

   Thuần, không đụng DOM — kiểm thử bằng node (desktop/test/album-collage.mjs).
   ═══════════════════════════════════════════════════════════════════════════ */
import type { CollageDoc, CollagePage, LayoutInput, PerPage, TextFrame } from "./types";
import { COLLAGE_LIMITS } from "./types";
import { formatById, type CollageFormat } from "./formats";
import { COLLAGE_STYLES, MIX_POOL, MIX_STYLE, styleById, type CollageStyle } from "./styles";
import { composeOptions, diverse, family, type ComposeResult } from "./compose";
import { buildText, presetById, TEXT_PRESETS } from "./typography";
import { hashString, rng, shuffle, uid, weightedPick } from "./rng";

/**
 * Số ảnh từng trang.
 *  • Số cố định: chia ĐỀU — số trang = trần(n / số ảnh mỗi trang), các trang
 *    chênh nhau tối đa 1 ảnh (10 ảnh, 4 ảnh/trang → 4·3·3 thay vì 4·4·2).
 *  • "mix": nhịp 2–5 ảnh ngẫu nhiên, không bao giờ để lẻ một ảnh ở trang cuối.
 * Không quá COLLAGE_LIMITS.pages trang: ảnh nhiều quá thì mỗi trang nhận thêm.
 */
export function pageSizes(n: number, perPage: PerPage, r: () => number): number[] {
  if (n <= 0) return [];
  const maxPages = COLLAGE_LIMITS.pages;
  if (perPage === "mix") {
    const out: number[] = [];
    let left = n;
    while (left > 0) {
      if (left <= 5) {
        out.push(left);
        break;
      }
      let k = 2 + Math.floor(r() * 4);
      if (left - k === 1) k = k === 5 ? 4 : k + 1;
      out.push(k);
      left -= k;
    }
    if (out.length <= maxPages) return out;
    return pageSizes(n, Math.ceil(n / maxPages), r);
  }
  const per = Math.max(1, Math.min(COLLAGE_LIMITS.pagePhotos, Math.round(perPage) || 1));
  const pages = Math.min(maxPages, Math.ceil(n / per));
  const fit = Math.ceil(n / pages);
  if (fit > COLLAGE_LIMITS.pagePhotos) {
    // Không chia nổi trong giới hạn trang × 9 ảnh: dừng ở mức tối đa (giao diện đã chặn trước).
    return Array.from({ length: pages }, () => COLLAGE_LIMITS.pagePhotos);
  }
  const base = Math.floor(n / pages);
  const extra = n % pages;
  return Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Chia ảnh vào trang. Mỗi trang có một "ảnh chính" (ảnh người có điểm cao —
 * cô dâu, chú rể, ảnh chung), trang đầu nhận ảnh đẹp nhất vì đó là ảnh đại diện
 * của bài đăng nhiều ảnh. Phần còn lại giữ gần đúng thứ tự khách chọn (ảnh cùng
 * khoảnh khắc đi cùng nhau), xáo nhẹ trong từng cụm 4 ảnh theo seed.
 */
export function distribute(photos: LayoutInput[], sizes: number[], r: () => number): LayoutInput[][] {
  const k = sizes.length;
  if (!k) return [];
  const pool = photos.slice(0, sizes.reduce((a, b) => a + b, 0));
  const ranked = [...pool].sort((a, b) => Number(!!b.hero) - Number(!!a.hero) || b.score - a.score);
  // Ảnh chính: tối đa một ảnh mỗi trang, chỉ lấy ảnh người khi có đủ.
  const anchors = ranked.slice(0, k);
  const anchorSet = new Set(anchors.map((p) => p.id));
  // Trang đầu: ảnh đẹp nhất; các trang sau: ảnh chính theo thứ tự khách chọn.
  const rest = anchors.slice(1).sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
  const ordered = [anchors[0], ...shuffleLight(rest, r)];
  const pages: LayoutInput[][] = ordered.map((p) => (p ? [p] : []));
  const others = shuffleLight(pool.filter((p) => !anchorSet.has(p.id)), r);
  let at = 0;
  for (let i = 0; i < k; i++) {
    while (pages[i].length < sizes[i] && at < others.length) pages[i].push(others[at++]);
  }
  // Dư (không xảy ra khi sizes khớp số ảnh) — dồn vào trang còn chỗ.
  for (let i = 0; at < others.length && i < k; i++) while (pages[i].length < COLLAGE_LIMITS.pagePhotos && at < others.length) pages[i].push(others[at++]);
  return pages.filter((p) => p.length > 0);
}

/** Xáo nhẹ: chỉ đổi chỗ trong từng cụm 4 phần tử liên tiếp — giữ nhịp kể chuyện. */
function shuffleLight<T>(arr: T[], r: () => number): T[] {
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += 4) out.push(...shuffle(arr.slice(i, i + 4), r));
  return out;
}

/**
 * Trang nào nhận nội dung nào: mỗi nội dung một trang ngẫu nhiên KHÁC NHAU.
 * Trả mảng theo trang: chỉ số nội dung, hoặc null (trang chỉ có ảnh). Nội dung
 * nhiều hơn số trang thì phần dư bị bỏ (giao diện không cho nhập quá số trang).
 */
export function assignTexts(pageCount: number, textCount: number, r: () => number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: pageCount }, () => null);
  const pages = shuffle(Array.from({ length: pageCount }, (_, i) => i), r);
  for (let t = 0; t < Math.min(textCount, pageCount); t++) out[pages[t]] = t;
  return out;
}

/** Nội dung hợp lệ: bỏ khoảng trắng thừa, bỏ dòng rỗng, cắt theo giới hạn. */
export function cleanTexts(texts: readonly string[]): string[] {
  return texts
    .map((t) => t.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, COLLAGE_LIMITS.textChars))
    .filter(Boolean)
    .slice(0, COLLAGE_LIMITS.texts);
}

/** Bốc một phương án: nhóm 8 phương án tốt nhất, trọng số giảm theo điểm, né họ bố cục vừa dùng. */
export function pickLayout(results: ComposeResult[], avoid: string[], r: () => number): ComposeResult | undefined {
  const top = results.slice(0, 8);
  if (!top.length) return undefined;
  const best = top[0].cost;
  return weightedPick(top, (x) => Math.exp(-(x.cost - best) / 0.3) * (avoid.includes(family(x.recipe)) ? 0.2 : 1), r);
}

/** Phong cách cho trang thứ i: cố định, hoặc "mix" — bốc trong nhóm hợp nhau, không trùng trang trước. */
function styleFor(styleId: string, prev: string | null, r: () => number): CollageStyle {
  if (styleId !== MIX_STYLE) return styleById(styleId);
  const pool = MIX_POOL.filter((id) => id !== prev);
  return styleById(pool[Math.floor(r() * pool.length)]);
}

function toPage(res: ComposeResult, style: CollageStyle): CollagePage {
  return {
    id: uid("p"),
    frames: res.frames,
    background: style.background,
    ...(res.bgPhoto ? { bgPhoto: res.bgPhoto } : {}),
    recipe: res.recipe,
    styleId: style.id,
  };
}

export interface GenerateOptions {
  photos: LayoutInput[];
  perPage: PerPage;
  formatId: string;
  styleId: string;
  texts: string[];
  seed: number;
  /**
   * Khách TỰ CHỌN ảnh cho từng layout: mỗi phần tử là id ảnh của một trang (theo
   * thứ tự trang). Có thì máy không tự chia ảnh nữa — chỉ dàn trang từng nhóm.
   */
  groups?: string[][];
}

/** Nhóm ảnh khách tự chọn → nhóm đầu vào cho bộ dàn (bỏ id lạ, nhóm rỗng; giữ giới hạn). */
function manualGroups(groups: string[][], photos: LayoutInput[]): LayoutInput[][] {
  const byId = new Map(photos.map((p) => [p.id, p]));
  return groups
    .map((g) => g.map((id) => byId.get(id)).filter((x): x is LayoutInput => !!x).slice(0, COLLAGE_LIMITS.pagePhotos))
    .filter((g) => g.length > 0)
    .slice(0, COLLAGE_LIMITS.pages);
}

/** Dựng cả bộ layout. */
export function generateDoc(o: GenerateOptions): CollageDoc {
  const format = formatById(o.formatId);
  const photos = o.photos.slice(0, COLLAGE_LIMITS.photos);
  const texts = cleanTexts(o.texts);
  const r = rng((o.seed >>> 0) * 2654435761 + photos.length);
  const manual = !!o.groups;
  const groups = manual ? manualGroups(o.groups!, photos) : distribute(photos, pageSizes(photos.length, o.perPage, r), r);
  const textOf = assignTexts(groups.length, texts.length, r);
  const pages: CollagePage[] = [];
  let prevStyle: string | null = null;
  const recent: string[] = [];
  groups.forEach((g, i) => {
    const style = styleFor(o.styleId, prevStyle, r);
    prevStyle = style.id;
    const t = textOf[i];
    const results = composeOptions({ photos: g, format, style, text: t == null ? null : texts[t], seed: (o.seed + i * 977) >>> 0 });
    const pick = pickLayout(results, recent.slice(-2), r);
    if (!pick) return;
    recent.push(family(pick.recipe));
    pages.push(toPage(pick, style));
  });
  return {
    v: 1,
    ...(manual ? { mode: "manual" as const } : {}),
    formatId: format.id,
    styleId: o.styleId,
    perPage: o.perPage,
    texts,
    photoIds: photos.map((p) => p.id),
    aspects: Object.fromEntries(photos.map((p) => [p.id, round3(p.aspect)])),
    pages,
    seed: o.seed >>> 0,
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/* ── Sửa từng trang ───────────────────────────────────────────────────────── */

/** Khung chữ của trang (mỗi trang tối đa một). */
export function pageText(page: CollagePage): TextFrame | null {
  return (page.frames.find((f) => f.kind === "text") as TextFrame | undefined) ?? null;
}

/** id ảnh trên trang, theo thứ tự khung. */
export function pagePhotoIds(page: CollagePage): string[] {
  return page.frames.flatMap((f) => (f.kind === "photo" ? [f.photoId] : []));
}

/**
 * Áp một phương án bố cục cho trang, GIỮ chữ khách đã sửa: nội dung và lựa chọn
 * phông của khách đi theo; vị trí, cỡ, màu lấy theo phương án mới (chữ đặt trên
 * ảnh cần màu khác chữ đặt trên nền).
 */
export function applyLayout(page: CollagePage, res: ComposeResult, style: CollageStyle, short: number): CollagePage {
  const old = pageText(page);
  const frames = res.frames.map((f) => {
    if (f.kind !== "text" || !old) return f;
    const keep: TextFrame = {
      ...f,
      text: old.text,
      style: { ...f.style, font: old.style.font, weight: old.style.weight, italic: old.style.italic, uppercase: old.style.uppercase, letterSpacing: old.style.letterSpacing, lineHeight: old.style.lineHeight },
    };
    // Cỡ chữ: theo phương án mới, nhưng giữ đúng tỉ lệ khách đã phóng / thu so với cỡ máy đặt.
    const ratio = old.style.size > 0 && f.style.size > 0 ? old.style.size / f.style.size : 1;
    keep.style.size = Math.max(short * 0.012, Math.min(short * 0.3, f.style.size * Math.max(0.5, Math.min(2, ratio))));
    return keep;
  });
  return { ...page, frames, background: style.background, bgPhoto: res.bgPhoto, recipe: res.recipe, styleId: style.id };
}

/** Một mẫu gợi ý cho trang: phương án bố cục + phong cách (màu nền, chữ) đi kèm. */
export interface Suggestion extends ComposeResult {
  styleId: string;
}

/**
 * MẪU GỢI Ý cho một trang — dải ngay dưới trang ở màn sửa.
 *
 * Mỗi lượt trộn nhiều PHONG CÁCH (nền trắng, kem, kraft, ảnh mờ…) và nhiều HỌ
 * bố cục (lưới, biên tập, ảnh in polaroid, vòm, tròn, ảnh rải…), mỗi họ một mẫu
 * trước rồi mới lấp thêm. Lượt 0 ưu tiên phong cách trang đang dùng. Mỗi lần
 * "Gợi ý khác" (round + 1) đổi bộ phong cách, đổi hạt ngẫu nhiên và thứ tự các
 * họ — ra một loạt mẫu MỚI, không phải xáo lại loạt cũ. Mẫu trùng đúng trang
 * hiện tại bị bỏ, nên áp mẫu đầu tiên là trang luôn đổi.
 */
export function pageSuggestions(page: CollagePage, inputs: Map<string, LayoutInput>, formatId: string, seed: number, round: number, n = 10): Suggestion[] {
  const format = formatById(formatId);
  const photos = pagePhotoIds(page).map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
  if (!photos.length) return [];
  const text = pageText(page);
  const presetId = presetForFrame(text);
  const cur = styleById(page.styleId);
  // Đỏ truyền thống lệch tông với phần còn lại — chỉ gợi ý khi trang đang dùng nó.
  const others = COLLAGE_STYLES.filter((x) => x.id !== cur.id && x.id !== "tradition");
  const pickOther = (k: number) => others[(round * 2 + k) % others.length];
  const styles = [cur, pickOther(0), pickOther(1)];
  const r = rng((seed >>> 0) * 31 + round * 7919 + 13);
  // Mỗi lượt đổi thêm hai thứ để mẫu thật sự khác, kể cả cùng phong cách:
  //  • ảnh được ưu tiên khung lớn (ảnh chính) xoay vòng qua từng ảnh của trang;
  //  • lượt 2–3, 6–7… lật ngang bố cục (chữ, góc xoay lật theo).
  const boosted = round > 0 && photos.length > 1 ? photos.map((x, i) => (i === (round - 1) % photos.length ? { ...x, score: x.score + 4 } : x)) : photos;
  const mirror = Math.floor(round / 2) % 2 === 1;

  // Nhóm theo (họ bố cục, phong cách), mỗi nhóm giữ 2 phương án tốt nhất.
  const groups = new Map<string, Suggestion[]>();
  styles.forEach((st, i) => {
    const raw = diverse(composeOptions({ photos: boosted, format, style: st, text: text?.text ?? null, presetId, seed: (seed + round * 104729 + i * 7) >>> 0 }), 40);
    const res = mirror ? raw.map((x) => mirrorResult(x, format.w)) : raw;
    if (!res.length) return;
    const best = Math.min(...res.map((x) => x.cost));
    for (const x of res) {
      if (x.cost > best + 0.9) continue; // phương án kém hẳn (ảnh cắt nhiều, chữ chật) — không gợi ý
      const key = `${family(x.recipe)}|${st.id}`;
      const arr = groups.get(key) ?? [];
      if (arr.length < 2) arr.push({ ...x, styleId: st.id });
      groups.set(key, arr);
    }
  });
  const shuffled = shuffle([...groups.keys()], r);
  const mine = shuffled.filter((k) => k.endsWith(`|${cur.id}`));
  const theirs = shuffled.filter((k) => !k.endsWith(`|${cur.id}`));
  // Lượt chẵn: phong cách trang đang dùng lên trước; lượt lẻ: phong cách khác lên trước.
  const keys = round % 2 === 0 ? [...mine, ...theirs] : [...theirs, ...mine];
  const isCurrent = (x: Suggestion) => x.recipe === page.recipe && x.styleId === page.styleId;
  const out: Suggestion[] = [];
  const famUsed = new Set<string>();
  // Vòng 1: mỗi họ bố cục một mẫu — đa dạng hình học trước.
  for (const k of keys) {
    if (out.length >= n) break;
    const fam = k.split("|")[0];
    if (famUsed.has(fam)) continue;
    const x = groups.get(k)!.find((y) => !isCurrent(y));
    if (!x) continue;
    out.push(x);
    famUsed.add(fam);
  }
  // Vòng 2: lấp đầy bằng cùng họ nhưng khác phong cách / khác biến thể.
  for (const k of keys) {
    if (out.length >= n) break;
    for (const x of groups.get(k)!) {
      if (out.length >= n) break;
      if (isCurrent(x) || out.includes(x)) continue;
      out.push(x);
    }
  }
  return out;
}

/** Lật ngang một phương án: khung đổi bên, góc xoay đổi chiều, chữ căn trái ↔ phải. */
function mirrorResult(x: ComposeResult, W: number): ComposeResult {
  return {
    ...x,
    recipe: `${x.recipe}~m`,
    frames: x.frames.map((f) => {
      const rect = { ...f.rect, x: W - f.rect.x - f.rect.w };
      if (f.kind === "photo") return { ...f, rect, ...(f.deco?.rotate ? { deco: { ...f.deco, rotate: -f.deco.rotate } } : {}) };
      const align = f.style.align === "left" ? "right" : f.style.align === "right" ? "left" : "center";
      return { ...f, rect, style: { ...f.style, align }, ...(f.rotate ? { rotate: -f.rotate } : {}) };
    }),
  };
}

/** Các phương án bố cục khác nhau cho một trang (dải "Bố cục" ở màn sửa). */
export function pageAlternatives(page: CollagePage, inputs: Map<string, LayoutInput>, formatId: string, seed: number, n = 12): ComposeResult[] {
  const format = formatById(formatId);
  const style = styleById(page.styleId);
  const photos = pagePhotoIds(page).map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
  const text = pageText(page);
  const presetId = presetForFrame(text);
  const res = composeOptions({ photos, format, style, text: text?.text ?? null, presetId, seed });
  return diverse(res, n);
}

/** Đoán lại kiểu chữ của một khung chữ (để dàn lại giữ đúng phông khách đang dùng). */
function presetForFrame(t: TextFrame | null): string | undefined {
  if (!t) return undefined;
  return (TEXT_PRESETS.find((p) => p.font === t.style.font && p.italic === t.style.italic && p.uppercase === t.style.uppercase) ?? TEXT_PRESETS.find((p) => p.font === t.style.font))?.id;
}

/** Dàn lại trang với bộ ảnh mới (thêm / bớt ảnh), giữ chữ. */
export function relayoutPage(page: CollagePage, photos: LayoutInput[], formatId: string, seed: number): CollagePage | null {
  if (!photos.length) return null;
  const format = formatById(formatId);
  const style = styleById(page.styleId);
  const text = pageText(page);
  const res = composeOptions({ photos, format, style, text: text?.text ?? null, presetId: presetForFrame(text), seed });
  const r = rng(seed + hashString(page.id));
  const pick = pickLayout(res, [], r);
  if (!pick) return null;
  return applyLayout(page, pick, style, Math.min(format.w, format.h));
}

/** Thêm nội dung chữ cho trang chưa có chữ — trang được dàn lại để chừa chỗ cho chữ. */
export function addTextToPage(page: CollagePage, text: string, inputs: Map<string, LayoutInput>, formatId: string, seed: number, presetId?: string): CollagePage {
  const clean = cleanTexts([text])[0];
  if (!clean || pageText(page)) return page;
  const format = formatById(formatId);
  const style = styleById(page.styleId);
  const photos = pagePhotoIds(page).map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
  const res = composeOptions({ photos, format, style, text: clean, presetId, seed });
  const pick = pickLayout(res, [], rng(seed + 17));
  if (pick) return { ...page, frames: pick.frames, bgPhoto: pick.bgPhoto, recipe: pick.recipe };
  // Không dàn được (hiếm): đặt chữ giữa phần dưới trang, giữ nguyên ảnh.
  const short = Math.min(format.w, format.h);
  const box = { x: format.w * 0.08, y: format.h * 0.7, w: format.w * 0.84, h: format.h * 0.22 };
  return { ...page, frames: [...page.frames, buildText(presetById(presetId), clean, box, short, "#ffffff", "center", true)] };
}

/** Bỏ chữ khỏi trang; trang dàn lại cho ảnh lấp chỗ trống. */
export function removeTextFromPage(page: CollagePage, inputs: Map<string, LayoutInput>, formatId: string, seed: number): CollagePage {
  const noText: CollagePage = { ...page, frames: page.frames.filter((f) => f.kind !== "text") };
  const photos = pagePhotoIds(page).map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
  return relayoutPage(noText, photos, formatId, seed) ?? noText;
}

/** Đổi khổ cả bộ: dàn lại từng trang với đúng ảnh và chữ đang có. */
export function changeFormat(doc: CollageDoc, formatId: string, inputs: Map<string, LayoutInput>): CollageDoc {
  const format = formatById(formatId);
  const pages = doc.pages.map((p, i) => {
    const photos = pagePhotoIds(p).map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
    return relayoutPage(p, photos, format.id, (doc.seed + i * 977) >>> 0) ?? p;
  });
  return { ...doc, formatId: format.id, pages };
}

/** Nội dung chữ đang có trên các trang (theo thứ tự trang). */
export function collectTexts(doc: CollageDoc): string[] {
  return doc.pages.map((p) => pageText(p)?.text ?? "").filter(Boolean);
}

/** Khổ của bộ layout. */
export function docFormat(doc: Pick<CollageDoc, "formatId">): CollageFormat {
  return formatById(doc.formatId);
}
