/* Kiểm thử ghép layout ảnh (src/lib/collage/*).
 *
 * Vì sao đáng test: ba luật studio đặt cho tính năng này đều là luật đếm, sai
 * là khách thấy ngay —
 *   • mỗi nội dung chữ nằm trên ĐÚNG MỘT layout, mỗi layout tối đa MỘT nội dung;
 *   • chỉ dùng ảnh studio đã giao (máy chủ từ chối id ảnh lạ);
 *   • bộ layout ngẫu nhiên, đa dạng — nhưng mọi ảnh khách chọn đều có mặt.
 * Cộng phần gợi ý ảnh (cô dâu / chú rể / ảnh chung / decor / bê quả) chạy trên
 * dữ liệu khuôn mặt, dễ trôi khi ai đó sửa ngưỡng.
 *
 * Chạy: npm run test:album-collage
 */
import { assignTexts, cleanTexts, distribute, generateDoc, pageSizes, pageText, pagePhotoIds, relayoutPage, addTextToPage, removeTextFromPage, changeFormat, pageAlternatives } from "../../src/lib/collage/generate.ts";
import { sanitizeDoc, docPhotoIds } from "../../src/lib/collage/validate.ts";
import { categorize, suggestPhotos, fold, mainCandidates, CAT_COUPLE, CAT_DECOR, CAT_FAMILY } from "../../src/lib/collage/categories.ts";
import { focusCrop, placePhoto, DEFAULT_CROP } from "../../src/lib/collage/crop.ts";
import { formatById } from "../../src/lib/collage/formats.ts";
import { rng } from "../../src/lib/collage/rng.ts";
import { COLLAGE_LIMITS } from "../../src/lib/collage/types.ts";
import { collageEnabledFor } from "../../src/lib/collage/enabled.ts";
import { readByIds, runPool, withDeadline } from "../../src/lib/collage/batch-read.ts";
import { blurRGBA, boxSizes, workScale } from "../../src/lib/collage/blur.ts";
import { photoArea, shapeRadii } from "../../src/lib/collage/frame-geom.ts";
import { pageSuggestions } from "../../src/lib/collage/generate.ts";
import { composeOptions, family } from "../../src/lib/collage/compose.ts";
import { styleById } from "../../src/lib/collage/styles.ts";
import { LOCKUPS, fillLine, lockupFor, lockDate, lockNames, lockupExtraHeight, docFontKeys } from "../../src/lib/collage/lockups.ts";
import { ornamentPrims, stampPath, dividerPrims, ORN_KINDS } from "../../src/lib/collage/ornaments.ts";
import { quantize, paletteStyle, contrast, paletteSwatches } from "../../src/lib/collage/palette.ts";
import { composePanorama, cutPenalty, panoramaMax } from "../../src/lib/collage/carousel.ts";
import { layoutLockup } from "../../src/lib/collage/text-layout.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${note}`}`);
};

/* ── Chia trang ─────────────────────────────────────────────────────────── */
check("10 ảnh, 4 ảnh/trang → chia đều 4·3·3", pageSizes(10, 4, rng(1)), [4, 3, 3]);
check("9 ảnh, 3 ảnh/trang → 3·3·3", pageSizes(9, 3, rng(1)), [3, 3, 3]);
check("1 ảnh → 1 trang", pageSizes(1, 4, rng(1)), [1]);
check("0 ảnh → không trang nào", pageSizes(0, 4, rng(1)), []);
check("60 ảnh, 1 ảnh/trang → kẹp 30 trang", pageSizes(60, 1, rng(1)).length, COLLAGE_LIMITS.pages);
{
  let good = true;
  for (let s = 1; s <= 200; s++) {
    const n = 2 + (s % 40);
    const sz = pageSizes(n, "mix", rng(s));
    if (sz.reduce((a, b) => a + b, 0) !== n || sz.some((k) => k < 1 || k > 5) || (n > 1 && sz.some((k) => k === 1))) {
      good = false;
      console.log("    mix lỗi", n, sz);
      break;
    }
  }
  ok("nhịp ngẫu nhiên: đủ ảnh, 2–5 ảnh mỗi trang, không lẻ 1 ảnh", good);
}
check("cùng seed → cùng cách chia", pageSizes(23, "mix", rng(7)), pageSizes(23, "mix", rng(7)));

/* ── Nội dung chữ: mỗi nội dung đúng một trang ──────────────────────────── */
{
  let good = true;
  for (let s = 1; s <= 300; s++) {
    const pages = 1 + (s % 9);
    const texts = s % 7;
    const a = assignTexts(pages, texts, rng(s));
    const used = a.filter((x) => x !== null);
    const want = Math.min(pages, texts);
    if (a.length !== pages || used.length !== want || new Set(used).size !== want || used.some((x) => x < 0 || x >= texts)) {
      good = false;
      console.log("    lỗi", pages, texts, a);
      break;
    }
  }
  ok("mỗi nội dung một trang khác nhau, không trang nào hai nội dung", good);
}
check("bỏ nội dung rỗng + khoảng trắng thừa", cleanTexts(["  Just   married ", "", "  ", "A\n\n\n\nB"]), ["Just married", "A\n\nB"]);
check("cắt nội dung quá dài", cleanTexts(["x".repeat(400)])[0].length, COLLAGE_LIMITS.textChars);

/* ── Dựng bộ layout ─────────────────────────────────────────────────────── */
const photos = Array.from({ length: 14 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  aspect: i % 3 === 0 ? 2 / 3 : 3 / 2,
  score: 5 + (i % 4),
  hero: i % 4 === 0,
  faces: i % 2 ? [[0.2, 0.15, 0.1, 0.12]] : [],
}));
const ids = new Set(photos.map((p) => p.id));
const inputs = new Map(photos.map((p) => [p.id, p]));

for (const formatId of ["4x5", "1x1", "9x16", "16x9", "3x4"]) {
  for (const styleId of ["white", "film", "blur", "mix", "tight"]) {
    const doc = generateDoc({ photos, perPage: 4, formatId, styleId, texts: ["Chúng mình cưới rồi!", "Thank you", "Hạnh phúc là được ở bên nhau mỗi ngày, cảm ơn mọi người đã đến chung vui"], seed: 42 });
    const f = formatById(formatId);
    const label = `${formatId}/${styleId}`;
    const textPages = doc.pages.filter((p) => pageText(p));
    const allTexts = doc.pages.flatMap((p) => p.frames.filter((x) => x.kind === "text").map((x) => x.text));
    const used = doc.pages.flatMap(pagePhotoIds);
    ok(`${label}: 14 ảnh / 4 mỗi trang → 4 trang`, doc.pages.length === 4, `được ${doc.pages.length}`);
    ok(`${label}: 3 nội dung nằm trên đúng 3 trang`, textPages.length === 3 && allTexts.length === 3 && new Set(allTexts).size === 3, JSON.stringify(allTexts));
    ok(`${label}: mỗi ảnh khách chọn có mặt đúng một lần`, used.length === 14 && new Set(used).size === 14 && used.every((x) => ids.has(x)));
    const inside = doc.pages.every((p) =>
      p.frames.every((fr) => fr.rect.x >= -1 && fr.rect.y >= -1 && fr.rect.x + fr.rect.w <= f.w + 1 && fr.rect.y + fr.rect.h <= f.h + 1 && fr.rect.w > 0 && fr.rect.h > 0),
    );
    ok(`${label}: mọi khung nằm trong trang`, inside);
    if (f.safeTop) {
      const safeOk = doc.pages.every((p) => p.frames.every((fr) => fr.kind !== "text" || (fr.rect.y >= f.safeTop - 1 && fr.rect.y + fr.rect.h <= f.h - f.safeBottom + 1)));
      ok(`${label}: chữ nằm ngoài vùng Story bị che`, safeOk);
    }
    const check2 = sanitizeDoc(JSON.parse(JSON.stringify(doc)), ids);
    ok(`${label}: bộ layout vừa dựng qua được bộ kiểm của máy chủ`, check2.ok, JSON.stringify(check2));
  }
}

{
  const a = generateDoc({ photos, perPage: "mix", formatId: "4x5", styleId: "white", texts: [], seed: 1 });
  const b = generateDoc({ photos, perPage: "mix", formatId: "4x5", styleId: "white", texts: [], seed: 2 });
  const sig = (d) => d.pages.map((p) => `${p.recipe}:${pagePhotoIds(p).join(",")}`).join("|");
  ok("đổi seed → ra bộ layout khác (Tạo lại ngẫu nhiên)", sig(a) !== sig(b));
  check("cùng seed → lặp lại y hệt", sig(generateDoc({ photos, perPage: "mix", formatId: "4x5", styleId: "white", texts: [], seed: 1 })), sig(a));
  const many = new Set();
  for (let s = 1; s <= 12; s++) for (const p of generateDoc({ photos, perPage: 3, formatId: "4x5", styleId: "white", texts: [], seed: s }).pages) many.add(p.recipe.split(":")[0]);
  ok("nhiều kiểu bố cục khác nhau qua các lần tạo", many.size >= 3, [...many].join(", "));
}

{
  const g = distribute(photos, [4, 4, 3, 3], rng(3));
  ok("chia ảnh: trang đầu có ảnh điểm cao nhất (ảnh đại diện bài đăng)", g[0].some((p) => p.hero));
  check("chia ảnh: đúng số ảnh từng trang", g.map((x) => x.length), [4, 4, 3, 3]);
}

/* ── Sửa trang ──────────────────────────────────────────────────────────── */
{
  const doc = generateDoc({ photos: photos.slice(0, 6), perPage: 3, formatId: "4x5", styleId: "white", texts: ["Just married"], seed: 9 });
  const withText = doc.pages.find((p) => pageText(p));
  const plain = doc.pages.find((p) => !pageText(p));
  const re = relayoutPage(withText, pagePhotoIds(withText).slice(0, 2).map((id) => inputs.get(id)), "4x5", 5);
  ok("bỏ bớt ảnh: trang dàn lại, giữ nguyên nội dung chữ", re && pagePhotoIds(re).length === 2 && pageText(re)?.text === "Just married");
  const added = addTextToPage(plain, "Save the date", inputs, "4x5", 3);
  ok("thêm chữ cho trang chưa có: đúng một khung chữ", added.frames.filter((f) => f.kind === "text").length === 1);
  check("trang đã có chữ: không thêm được nội dung thứ hai", addTextToPage(withText, "Khác", inputs, "4x5", 3).frames.filter((f) => f.kind === "text").length, 1);
  const removed = removeTextFromPage(withText, inputs, "4x5", 4);
  ok("bỏ chữ: trang còn nguyên ảnh, không còn chữ", !pageText(removed) && pagePhotoIds(removed).length === pagePhotoIds(withText).length);
  const story = changeFormat(doc, "9x16", inputs);
  ok("đổi khổ: giữ ảnh và chữ từng trang", story.formatId === "9x16" && story.pages.every((p, i) => pagePhotoIds(p).length === pagePhotoIds(doc.pages[i]).length) && story.pages.filter((p) => pageText(p)).length === 1);
  const alts = pageAlternatives(doc.pages[0], inputs, "4x5", 1);
  ok("gợi ý bố cục khác cho một trang", alts.length >= 3 && new Set(alts.map((a) => a.recipe)).size === alts.length);
}

/* ── Máy chủ kiểm dữ liệu ───────────────────────────────────────────────── */
{
  const doc = generateDoc({ photos: photos.slice(0, 4), perPage: 2, formatId: "1x1", styleId: "white", texts: ["A"], seed: 3 });
  const foreign = JSON.parse(JSON.stringify(doc));
  foreign.pages[0].frames.find((f) => f.kind === "photo").photoId = "ffffffff-0000-4000-8000-000000000000";
  check("ảnh ngoài album → từ chối", sanitizeDoc(foreign, ids), { ok: false, error: "bad_photo" });
  const twoTexts = JSON.parse(JSON.stringify(doc));
  const p0 = twoTexts.pages[0];
  const t = { kind: "text", id: "t_x1", rect: { x: 10, y: 10, w: 300, h: 80 }, text: "B", style: { font: "playfair", size: 40, weight: 500, italic: true, color: "#222222", align: "center", letterSpacing: 0, lineHeight: 1.2, uppercase: false } };
  p0.frames.push(t, { ...t, id: "t_x2" });
  check("hai nội dung trên một trang → từ chối", sanitizeDoc(twoTexts, ids), { ok: false, error: "one_text_per_page" });
  const badColor = JSON.parse(JSON.stringify(doc));
  badColor.pages[0].background = "red;background:url(x)";
  check("màu nền lạ → từ chối", sanitizeDoc(badColor, ids).ok, false);
  const badFont = JSON.parse(JSON.stringify(doc));
  const tf = badFont.pages.flatMap((p) => p.frames).find((f) => f.kind === "text");
  if (tf) tf.style.font = "Comic Sans";
  check("phông ngoài danh sách → từ chối", sanitizeDoc(badFont, ids).ok, false);
  const extra = JSON.parse(JSON.stringify(doc));
  extra.evil = "<script>";
  extra.pages[0].onload = "x";
  const clean = sanitizeDoc(extra, ids);
  ok("trường lạ bị bỏ khi dựng lại bản sạch", clean.ok && !("evil" in clean.doc) && !("onload" in clean.doc.pages[0]));
  check("liệt kê mọi ảnh bộ layout dùng", docPhotoIds(doc).sort(), [...new Set(photos.slice(0, 4).map((p) => p.id))].sort());
}

/* ── Gợi ý ảnh theo khuôn mặt + thư mục ─────────────────────────────────── */
check("bỏ dấu tiếng Việt", fold("Bê Quả · Đón Dâu"), "be qua · don dau");
{
  const P = (i) => `p${i}`;
  const albumPhotos = Array.from({ length: 12 }, (_, i) => ({ id: P(i), source_id: i >= 10 ? "s-bequa" : "s-main", position: i }));
  const people = [
    { id: "A", name: "Cô dâu" },
    { id: "B", name: "Chú rể" },
    { id: "C", name: "" },
  ];
  const big = (x) => [x, 0.2, 0.12, 0.15];
  const faces = [];
  const links = [];
  const face = (pid, person, x = 0.2) => {
    faces.push({ photo_id: pid, box: big(x), sharpness: 100 });
    if (person) links.push({ person_id: person, photo_id: pid });
  };
  // p0–p3: ảnh chung; p4, p5: cô dâu; p6: chú rể; p7: decor (quét rồi, 0 mặt); p8: đông người; p9: chưa quét.
  for (const i of [0, 1, 2, 3]) { face(P(i), "A"); face(P(i), "B", 0.5); }
  for (const i of [4, 5]) face(P(i), "A");
  face(P(6), "B");
  for (let k = 0; k < 5; k++) face(P(8), k === 0 ? "A" : k === 1 ? "B" : k === 2 ? "C" : null, 0.1 + k * 0.15);
  face(P(10), "A"); face(P(10), "B", 0.5);
  face(P(11), "C");
  for (const i of [3, 4, 5, 6]) links.push({ person_id: "C", photo_id: P(i + 100) }); // link ảnh không thuộc album → bỏ qua
  const scanned = new Set(albumPhotos.map((p) => p.id).filter((id) => id !== P(9)));
  const res = categorize({
    photos: albumPhotos,
    sources: [{ id: "s-main", name: "File ChinhSua" }, { id: "s-bequa", name: "Be qua" }],
    faces,
    scanned,
    people,
    links,
  });
  const tags = (i) => res.info[P(i)].tags;
  ok("ảnh có cả cô dâu và chú rể → Ảnh chung", tags(0).includes(CAT_COUPLE));
  ok("ảnh riêng cô dâu → nhóm của cô dâu", tags(4).includes("p:A") && !tags(4).includes(CAT_COUPLE));
  ok("ảnh riêng chú rể → nhóm của chú rể", tags(6).includes("p:B"));
  ok("quét rồi, không có mặt người → Decor & chi tiết", tags(7).includes(CAT_DECOR));
  ok("đông người → Gia đình & bạn bè", tags(8).includes(CAT_FAMILY));
  check("chưa quét mặt → chưa xếp nhóm mặt (chỉ còn nhóm theo thư mục)", tags(9), ["f:s-main"]);
  ok("thư mục 'Be qua' (không dấu) → Bê quả · Ăn hỏi", tags(10).includes("m-bequa") && tags(11).includes("m-bequa"));
  const labels = Object.fromEntries(res.cats.map((c) => [c.id, c.label]));
  check("nhãn nhóm theo tên studio đặt", [labels["p:A"], labels["p:B"], labels[CAT_COUPLE]], ["Cô dâu", "Chú rể", "Ảnh chung"]);
  ok("ảnh chung được làm ảnh chính của trang", res.info[P(0)].hero && !res.info[P(7)].hero);
  ok("ảnh chung điểm cao hơn ảnh decor", res.info[P(0)].score > res.info[P(7)].score);

  const order = albumPhotos.map((p) => p.id);
  const pick = suggestPhotos(order, res, 6);
  ok("gợi ý đúng số ảnh, không trùng", pick.length === 6 && new Set(pick).size === 6, JSON.stringify(pick));
  ok("gợi ý có ảnh chung, ảnh riêng và decor", pick.some((id) => res.info[id].tags.includes(CAT_COUPLE)) && pick.some((id) => res.info[id].tags.some((t) => t.startsWith("p:"))) && pick.includes(P(7)));
  check("gợi ý xếp theo thứ tự album", pick, [...pick].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  ok("ảnh khách đã thả tim được ưu tiên", suggestPhotos(order, res, 4, new Set([P(9)])).includes(P(9)));

  // Studio chưa đặt tên: hai người nhiều ảnh nhất vẫn được nhận là cặp đôi.
  const unnamed = categorize({ photos: albumPhotos, sources: [], faces, scanned, people: people.map((p) => ({ ...p, name: "" })), links });
  ok("chưa đặt tên: hai người nhiều ảnh nhất là cặp đôi", unnamed.info[P(0)].tags.includes(CAT_COUPLE));
  ok("chưa đặt tên: nhóm ảnh riêng có id người để hiện ảnh mặt", unnamed.cats.some((c) => c.kind === "person" && c.personId === "A" && c.label === ""));
  // Album chưa quét mặt: vẫn gợi ý được (trải đều album).
  const none = categorize({ photos: albumPhotos, sources: [], faces: [], scanned: new Set(), people: [], links: [] });
  check("album chưa quét mặt: vẫn gợi ý đủ ảnh", suggestPhotos(order, none, 5).length, 5);
}

/* ── Đặt ảnh vào khung ──────────────────────────────────────────────────── */
{
  const p = placePhoto(400, 300, 3000, 2000, DEFAULT_CROP);
  ok("ảnh luôn phủ kín khung", p.left <= 0 && p.top <= 0 && p.left + p.width >= 400 - 1e-6 && p.top + p.height >= 300 - 1e-6);
  const zoomed = placePhoto(400, 300, 3000, 2000, { zoom: 4, cx: 1, cy: 1 });
  ok("phóng to + kéo tới mép: không lộ nền", zoomed.left + zoomed.width >= 400 - 1e-6 && zoomed.top + zoomed.height >= 300 - 1e-6);
  const c = focusCrop([[0.05, 0.2, 0.1, 0.1]], 1, 1.5);
  ok("mặt nằm bên trái → khung dịch về trái", c.cx < 0.5);
  check("không có mặt → điểm mặc định", focusCrop([], 1, 1.5), DEFAULT_CROP);
}

/* ── Bật / tắt: hợp đồng hay album lẻ ───────────────────────────────────── */
check("album của hợp đồng đang bật", collageEnabledFor([{ collage_enabled: true }], false), true);
check("album của hợp đồng đã tắt — cột của album không có tác dụng", collageEnabledFor([{ collage_enabled: false }], true), false);
check("hai hợp đồng dùng chung album: một cái bật là bật", collageEnabledFor([{ collage_enabled: false }, { collage_enabled: true }], undefined), true);
check("album lẻ mặc định bật", collageEnabledFor([], true), true);
check("album lẻ studio đã tắt", collageEnabledFor([], false), false);
check("album lẻ, cột chưa có (chưa chạy SQL) → tắt", collageEnabledFor([], undefined), false);
check("đọc hợp đồng lỗi (chưa chạy SQL) → tắt", collageEnabledFor(null, true), false);

/* ── Gợi ý khi chưa biết ai là cô dâu / chú rể ───────────────────────────── */
{
  const photos = [0, 1, 2].map((i) => ({ id: `q${i}`, source_id: null, position: i }));
  const box = (x) => [x, 0.2, 0.12, 0.15];
  const faces = [
    { photo_id: "q0", box: box(0.1), sharpness: 50 },
    { photo_id: "q0", box: box(0.5), sharpness: 50 },
    ...[0.05, 0.25, 0.45, 0.65].map((x) => ({ photo_id: "q1", box: box(x), sharpness: 50 })),
  ];
  const r = categorize({ photos, sources: [], faces, scanned: new Set(["q0", "q1", "q2"]), people: [], links: [] });
  ok("chưa gom người: ảnh 2 mặt không bị xếp nhầm vào Gia đình", !r.info.q0.tags.includes(CAT_FAMILY));
  ok("chưa gom người: ảnh 4 mặt vẫn là Gia đình & bạn bè", r.info.q1.tags.includes(CAT_FAMILY));
  ok("chưa gom người: quét rồi 0 mặt vẫn là decor", r.info.q2.tags.includes(CAT_DECOR));
}
{
  const people = [
    { id: "g1", name: "", face_count: 400 },
    { id: "g2", name: "Khách", face_count: 380 },
    { id: "cd", name: "Cô Dâu", face_count: 120 },
    { id: "cr", name: "chu re", face_count: 90 },
    { id: "g3", name: "", face_count: 300 },
    { id: "g4", name: "", face_count: 10 },
  ];
  check("ứng viên cô dâu chú rể: người đặt tên + nhiều mặt nhất", mainCandidates(people), ["cd", "cr", "g1", "g2", "g3"]);
  check("ứng viên: không có người nào", mainCandidates([]), []);
}

/* ── Đọc theo lô có hạn giờ (route /collage/photos) ─────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
{
  // runPool: không bao giờ quá n lượt cùng lúc, chạy đủ mọi phần tử.
  let now = 0, peak = 0;
  const seen = [];
  await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    now++;
    peak = Math.max(peak, now);
    await sleep(5);
    seen.push(x);
    now--;
  });
  check("chạy song song tối đa 3 lượt, đủ 7 phần tử", [peak, seen.sort((a, b) => a - b)], [3, [1, 2, 3, 4, 5, 6, 7]]);
}
{
  // 250 ảnh, mỗi ảnh 3 mặt; trần 100 dòng/lượt → lô 50 ảnh (150 dòng) phải tự chia đôi tới khi đủ.
  const ids = Array.from({ length: 250 }, (_, i) => `ph${i}`);
  const db = new Map(ids.map((id) => [id, [0, 1, 2].map((at) => ({ photo_id: id, at }))]));
  let calls = 0;
  const q = async (part) => {
    calls++;
    return { data: part.flatMap((id) => db.get(id)).slice(0, 100), error: null };
  };
  const ctl = new AbortController();
  const r = await readByIds(ids, q, ctl.signal, { size: 50, cap: 100 });
  check("đọc đủ mọi dòng dù chạm trần max-rows (tự chia lô)", [r.rows.length, r.done.size], [750, 250]);
  ok("có chia lô thật", calls > 5, `calls=${calls}`);
}
{
  // Lô lỗi → ảnh của lô đó KHÔNG được tính là đã đọc (kẻo thành decor vì "0 mặt").
  const ids = ["a", "b", "c", "d"];
  const q = async (part) => (part.includes("c") ? { data: null, error: { message: "boom" } } : { data: part.map((id) => ({ photo_id: id })), error: null });
  const r = await readByIds(ids, q, new AbortController().signal, { size: 2 });
  check("lô lỗi không được tính là đã đọc xong", [...r.done].sort(), ["a", "b"]);
}
{
  // DB treo hẳn (không nghe signal): vẫn trả đúng hạn, kèm phần đã đọc xong.
  const ids = Array.from({ length: 6 }, (_, i) => `x${i}`);
  const q = (part) => (part[0] === "x0" ? Promise.resolve({ data: [{ photo_id: "x0" }], error: null }) : new Promise(() => {}));
  const t0 = Date.now();
  const none = { rows: [], done: new Set() };
  const r = await withDeadline(150, (signal) => readByIds(ids, q, signal, { size: 1, parallel: 2 }), none);
  const ms = Date.now() - t0;
  ok("DB treo: trả về đúng hạn (không quay vòng mãi)", ms < 1000, `${ms}ms`);
  check("DB treo: báo đã cắt vì hết giờ, giữ phần đã đọc xong", [r.cut, [...r.value.done]], [true, ["x0"]]);
}
{
  // DB chậm nhưng NGHE signal: dừng ngay khi hết giờ, giữ phần đã xong.
  const ids = Array.from({ length: 8 }, (_, i) => `y${i}`);
  const q = (part, signal) =>
    new Promise((resolve) => {
      const t = setTimeout(() => resolve({ data: part.map((id) => ({ photo_id: id })), error: null }), part[0] === "y0" ? 10 : 5000);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        resolve({ data: null, error: { message: "AbortError" } });
      });
    });
  const r = await withDeadline(200, (signal) => readByIds(ids, q, signal, { size: 1, parallel: 8 }), { rows: [], done: new Set() });
  check("hết giờ: giữ đúng phần đã đọc xong", [r.cut, [...r.value.done]], [true, ["y0"]]);
}
{
  const r = await withDeadline(1000, async () => "xong", "dự phòng");
  check("xong trước hạn: không bị cắt", [r.value, r.cut], ["xong", false]);
  const e = await withDeadline(1000, async () => {
    throw new Error("x");
  }, "dự phòng");
  check("lỗi: trả giá trị dự phòng", e.value, "dự phòng");
}

/* ── Nền mờ khi xuất: làm mờ bằng tay (Safari iPhone bỏ qua ctx.filter) ───── */
{
  const sizes = boxSizes(6);
  ok("3 hộp lẻ xấp xỉ Gauss", sizes.length === 3 && sizes.every((b) => b % 2 === 1 && b >= 7 && b <= 13), JSON.stringify(sizes));
  const w = 41, h = 21;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set([0, 0, 0, 255], i * 4);
  px.set([255, 255, 255, 255], (10 * w + 20) * 4); // một điểm sáng giữa ảnh
  blurRGBA(px, w, h, 3);
  const at = (x, y) => px[(y * w + x) * 4];
  ok("điểm sáng loang ra xung quanh (ảnh mờ thật)", at(20, 10) < 255 && at(22, 10) > 0 && at(20, 12) > 0, `${at(20, 10)} ${at(22, 10)} ${at(20, 12)}`);
  ok("loang đều hai phía", Math.abs(at(17, 10) - at(23, 10)) <= 1 && Math.abs(at(20, 7) - at(20, 13)) <= 1);
  ok("kênh alpha giữ nguyên", px[3] === 255 && px[(10 * w + 20) * 4 + 3] === 255);
  const flat = new Uint8ClampedArray(8 * 8 * 4).fill(120);
  blurRGBA(flat, 8, 8, 4);
  ok("ảnh một màu làm mờ vẫn y nguyên (mép không bị nhạt)", flat.every((v) => v === 120));
  ok("làm mờ ở ảnh nhỏ, không quá nửa kích thước gốc", workScale(56) < 0.2 && workScale(2) === 0.5);
}

/* ── Khung trang trí: phần ảnh trừ viền, góc bo ─────────────────────────── */
{
  const fr = { rect: { x: 100, y: 100, w: 400, h: 500 }, deco: { pad: 20, padBottom: 90 } };
  check("phần ảnh polaroid trừ viền (viền dưới dày)", photoArea(fr), { x: 120, y: 120, w: 360, h: 390 });
  check("khung không trang trí: phần ảnh = cả khung", photoArea({ rect: { x: 0, y: 0, w: 10, h: 20 } }), { x: 0, y: 0, w: 10, h: 20 });
  check("vòm: hai góc trên bo nửa bề ngang", shapeRadii("arch", 300, 500), [150, 150, 0, 0]);
}

/* ── Kiểm bộ layout có trang trí (máy chủ) ─────────────────────────────── */
{
  const base = generateDoc({ photos: photos.slice(0, 4), perPage: 4, formatId: "4x5", styleId: "white", texts: [], seed: 3 });
  const allowedIds = new Set(photos.map((p) => p.id));
  const fr = base.pages[0].frames.find((f) => f.kind === "photo");
  const withDeco = { ...base, mode: "manual", pages: [{ ...base.pages[0], frames: base.pages[0].frames.map((f) => (f === fr ? { ...f, deco: { shape: "arch", pad: 12, padBottom: 60, padColor: "#FFFFFF", rotate: 4.24, shadow: true } } : f)) }] };
  const okDoc = sanitizeDoc(withDeco, allowedIds);
  const got = okDoc.ok ? okDoc.doc.pages[0].frames.find((f) => f.id === fr.id) : null;
  check("giữ trang trí hợp lệ (màu viền chuẩn hoá, xoay làm tròn)", got?.deco, { shape: "arch", pad: 12, padBottom: 60, padColor: "#ffffff", rotate: 4.2, shadow: true });
  ok("giữ chế độ tự chọn từng layout", okDoc.ok && okDoc.doc.mode === "manual");
  const weird = { ...base, mode: "x", pages: [{ ...base.pages[0], frames: base.pages[0].frames.map((f) => (f === fr ? { ...f, deco: { shape: "star", rotate: 90, padColor: "red", shadow: "yes" } } : f)) }] };
  const w2 = sanitizeDoc(weird, allowedIds);
  ok("trang trí lạ bị bỏ, không làm hỏng cả bộ", w2.ok && !w2.doc.pages[0].frames.find((f) => f.id === fr.id).deco && !w2.doc.mode);
}

/* ── Tự chọn ảnh từng layout ───────────────────────────────────────────── */
{
  const groups = [[photos[0].id, photos[1].id], [photos[2].id], [photos[3].id, photos[4].id, photos[5].id]];
  const doc = generateDoc({ photos: photos.slice(0, 6), perPage: 4, formatId: "4x5", styleId: "mix", texts: ["Một", "Hai"], seed: 77, groups });
  check("mỗi layout đúng những ảnh khách chọn", doc.pages.map((p) => pagePhotoIds(p).sort()), groups.map((g) => [...g].sort()));
  ok("đánh dấu bộ tự chọn", doc.mode === "manual");
  const withText = doc.pages.map((p) => pageText(p)?.text).filter(Boolean).sort();
  check("mỗi nội dung đúng một layout", withText, ["Hai", "Một"]);
}

/* ── Gợi ý chọn ảnh: đúng số ảnh MỚI, bỏ ảnh đã dùng ─────────────────────── */
{
  const order = Array.from({ length: 40 }, (_, i) => `s${i}`);
  const res = { cats: [], info: {} };
  const taken = new Set(order.slice(0, 10));
  const pick = suggestPhotos(order, res, 8, new Set(), taken);
  ok("chọn giúp đủ số ảnh khách nhập, không lấy lại ảnh đã dùng", pick.length === 8 && pick.every((id) => !taken.has(id)), JSON.stringify(pick));
}

/* ── Mẫu gợi ý cho một trang: đa dạng, "Gợi ý khác" ra loạt mới ─────────── */
{
  const inputs = new Map(photos.map((p) => [p.id, p]));
  const allowedIds = new Set(photos.map((p) => p.id));
  for (const n of [1, 2, 3, 4]) {
    const doc = generateDoc({ photos: photos.slice(0, n), perPage: n, formatId: n % 2 ? "4x5" : "9x16", styleId: "white", texts: ["Chúng mình cưới rồi"], seed: 11 + n });
    const page = doc.pages[0];
    const r0 = pageSuggestions(page, inputs, doc.formatId, doc.seed, 0, 10);
    const r1 = pageSuggestions(page, inputs, doc.formatId, doc.seed, 1, 10);
    const key = (x) => `${x.recipe}|${x.styleId}`;
    const fams = new Set(r0.map((x) => family(x.recipe)));
    ok(`${n} ảnh: loạt gợi ý đủ nhiều họ bố cục`, r0.length >= 6 && fams.size >= 5, `${r0.length} mẫu, ${fams.size} họ: ${[...fams].join(" ")}`);
    ok(`${n} ảnh: lượt đầu ưu tiên phong cách đang dùng`, r0[0].styleId === page.styleId);
    ok(`${n} ảnh: "Gợi ý khác" ra loạt mẫu khác hẳn`, r1.filter((x) => r0.some((y) => key(y) === key(x))).length <= 3, `${r1.map(key).join(" ")}`);
    ok(`${n} ảnh: mẫu đầu "Gợi ý khác" luôn khác trang hiện tại`, key(r1[0]) !== `${page.recipe}|${page.styleId}`);
    ok(`${n} ảnh: có mẫu phong cách khác`, new Set([...r0, ...r1].map((x) => x.styleId)).size >= 3);
    // Mọi mẫu khi áp vào trang đều qua được bộ kiểm của máy chủ, chữ không bị mất.
    const bad = [...r0, ...r1].filter((x) => {
      const d = { ...doc, pages: [{ ...page, frames: x.frames, recipe: x.recipe, styleId: x.styleId, ...(x.bgPhoto ? { bgPhoto: x.bgPhoto } : {}) }] };
      const c = sanitizeDoc(d, allowedIds);
      return !c.ok || c.doc.pages[0].frames.filter((f) => f.kind === "text").length !== 1;
    });
    ok(`${n} ảnh: mọi mẫu gợi ý hợp lệ, giữ đúng một nội dung`, bad.length === 0, bad.map((x) => x.recipe).join(" "));
  }
}

/* ── Bố cục trang trí: nằm trong trang, chữ trong vùng an toàn của Story ──── */
{
  let out = 0;
  let unsafe = 0;
  let seen = new Set();
  for (const formatId of ["4x5", "1x1", "9x16", "16x9", "3x4"]) {
    const f = formatById(formatId);
    const top = f.safeTop ?? 0;
    const bottom = f.h - (f.safeBottom ?? 0);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      for (const text of [null, "Thank you for coming — hẹn gặp mọi người ở tiệc cưới nhé!"]) {
        for (const style of ["ivory", "kraft", "blur"]) {
          const res = composeOptions({ photos: photos.slice(0, n), format: f, style: styleById(style), text, seed: 5 + n });
          for (const r of res.filter((x) => x.recipe.startsWith("deco-") || x.recipe.startsWith("grid-"))) {
            seen.add(family(r.recipe));
            for (const fr of r.frames) {
              const cx = fr.rect.x + fr.rect.w / 2;
              const cy = fr.rect.y + fr.rect.h / 2;
              const full = fr.rect.w >= f.w - 1 && fr.rect.h >= f.h - 1;
              if (!full && (fr.rect.x < -f.w * 0.04 || fr.rect.y < -f.h * 0.04 || fr.rect.x + fr.rect.w > f.w * 1.04 || fr.rect.y + fr.rect.h > f.h * 1.04 || cx < 0 || cy < 0 || cx > f.w || cy > f.h)) out++;
              if (fr.kind === "text" && (fr.rect.y < top - 1 || fr.rect.y + fr.rect.h > bottom + 1)) unsafe++;
            }
          }
        }
      }
    }
  }
  check("bố cục trang trí không lọt ra ngoài trang", out, 0);
  check("chữ của bố cục trang trí nằm trong vùng an toàn Story", unsafe, 0);
  ok("đủ các họ trang trí", ["deco-polaroid", "deco-arch", "deco-oval", "deco-prints", "deco-inset", "deco-arches", "deco-circles", "deco-stagger", "deco-scatter", "grid-round", "grid-print"].every((x) => seen.has(x)), [...seen].join(" "));
}

/* ── Mẫu chữ (typo): dòng phụ tự điền ngày / tên ───────────────────────── */
{
  const ctx = { date: lockDate("2026-10-12"), names: lockNames("Lan & Minh · Tiệc cưới Riverside") };
  check("ngày cưới dạng 12 · 10 · 2026", ctx.date, "12 · 10 · 2026");
  check("tên lấy từ tên album", ctx.names, "Lan & Minh");
  check("tên album không có dấu tách → cả tên (ngắn)", lockNames("Lan và Minh"), "Lan và Minh");
  check("điền mẫu dòng phụ", fillLine("{date}", ctx), "12 · 10 · 2026");
  check("thiếu ngày cưới → bỏ dòng đó", fillLine("{date}", { names: "A & B" }), undefined);
  check("Save the date đủ dòng trên / dưới", lockupFor("save-date", ctx), { id: "save-date", kicker: "Save the date", sub: "12 · 10 · 2026" });
  check("chữ đơn không gắn mẫu", lockupFor("plain", ctx), undefined);
  ok("mẫu chữ có cả loại thường và theo dịp", LOCKUPS.some((l) => l.occasion) && LOCKUPS.filter((l) => !l.occasion).length >= 6, String(LOCKUPS.length));
  ok("dòng phụ được chừa chỗ khi dàn trang", lockupExtraHeight({ id: "save-date", kicker: "x", sub: "y" }, 80) > 40);
  const t = { kind: "text", id: "t1", rect: { x: 0, y: 0, w: 800, h: 400 }, text: "Lan & Minh", style: { font: "pinyon", size: 80, weight: 400, italic: false, color: "#222222", align: "center", letterSpacing: 0, lineHeight: 1.2, uppercase: false }, lockup: { id: "save-date", kicker: "Save the date", sub: "12 · 10 · 2026" } };
  const lay = layoutLockup(t);
  check("khối chữ: dòng trên · nội dung · hoa văn · dòng dưới", lay?.blocks.map((b) => b.kind === "text" ? `t${Math.round(b.size)}` : b.kind), ["t19", "t80", "div", "t26"]);
  check("phông cần nạp gồm cả phông dòng phụ", docFontKeys({ pages: [{ frames: [t] }] }).sort(), ["manrope", "pinyon", "prata"]);
}

/* ── Hình trang trí (dùng chung SVG / canvas) ──────────────────────────── */
{
  const bad = ORN_KINDS.filter((k) => k !== "path" && !ornamentPrims({ kind: k, rect: { x: 0, y: 0, w: 120, h: 80 }, color: "#888888" }).every((p) => typeof p.d === "string" && p.d.length > 8 && !/NaN|undefined/.test(p.d)));
  check("mọi hình trang trí ra đường vẽ hợp lệ", bad, []);
  const st = stampPath(300, 400);
  ok("viền tem thư: đường khép kín, có răng cưa", st.startsWith("M0 0") && st.endsWith("Z") && (st.match(/A/g) || []).length > 20);
  ok("hoa văn chia dòng đủ kiểu", ["line", "diamond", "dots", "heart", "flourish", "leaf"].every((k) => dividerPrims(k, 200, 30, "#000000").length > 0));
}

/* ── Màu lấy từ ảnh ────────────────────────────────────────────────────── */
{
  const px = new Uint8ClampedArray(64 * 4);
  for (let i = 0; i < 64; i++) px.set(i < 40 ? [200, 120, 110, 255] : i < 56 ? [60, 80, 120, 255] : [250, 250, 250, 255], i * 4);
  const pal = quantize(px, 4);
  ok("màu chủ đạo: màu nhiều nhất đứng đầu", pal.length >= 2 && pal[0] === "#c8786e", JSON.stringify(pal));
  const ps = paletteStyle(pal);
  ok("nền nhạt cùng tông + chữ đọc rõ (tương phản ≥ 4,5)", !!ps && contrast(ps.bg, ps.ink) >= 4.5, JSON.stringify(ps));
  ok("dải màu từ ảnh cho tab Nền", paletteSwatches([pal]).length >= 3);
  const withPal = photos.slice(0, 3).map((p) => ({ ...p, palette: pal }));
  const res = composeOptions({ photos: withPal, format: formatById("4x5"), style: styleById("palette"), text: null, seed: 3 });
  ok("phong cách Màu theo ảnh: nền trang lấy từ ảnh", res.length > 0 && res.every((r) => r.background === ps.bg));
}

/* ── Carousel liền mạch ────────────────────────────────────────────────── */
{
  const allowedIds = new Set(photos.map((p) => p.id));
  const f = formatById("4x5");
  for (const [S, n, text] of [[2, 3, null], [3, 7, "Chúng mình cưới rồi"], [5, 14, "Save"]]) {
    const doc = generateDoc({ photos: photos.slice(0, n), perPage: 4, formatId: "4x5", styleId: "white", texts: text ? [text, "thừa"] : [], seed: 21 + S, carousel: S, lockup: "save-date", ctx: { date: "12 · 10 · 2026" } });
    const page = doc.pages[0];
    ok(`carousel ${S} slide: một trang rộng ${S} slide`, doc.pages.length === 1 && page.span === S);
    ok(`carousel ${S} slide: đủ ${Math.min(n, panoramaMax(S))} ảnh`, pagePhotoIds(page).length === Math.min(n, panoramaMax(S)));
    const crosses = page.frames.filter((fr) => fr.kind === "photo" && [...Array(S - 1)].some((_, k) => fr.rect.x < (k + 1) * f.w && fr.rect.x + fr.rect.w > (k + 1) * f.w));
    ok(`carousel ${S} slide: có ảnh vắt qua ranh giới slide (liền mạch)`, crosses.length >= 1);
    ok(`carousel ${S} slide: máy chủ nhận bộ này`, sanitizeDoc(doc, allowedIds).ok);
    if (text) ok(`carousel ${S} slide: chữ nằm ở slide đầu`, page.frames.some((fr) => fr.kind === "text" && fr.rect.x + fr.rect.w <= f.w));
    ok(`carousel ${S} slide: chỉ một nội dung`, page.frames.filter((fr) => fr.kind === "text").length === (text ? 1 : 0));
  }
  // Đường cắt slide đi qua khuôn mặt bị phạt nặng.
  const face = [{ id: "pf", aspect: 1, score: 5, faces: [[0.4, 0.3, 0.2, 0.2]] }];
  const byId = new Map(face.map((p) => [p.id, p]));
  const across = [{ kind: "photo", id: "a", rect: { x: 1080 - 500, y: 100, w: 1000, h: 1000 }, photoId: "pf", crop: { zoom: 1, cx: 0.5, cy: 0.5 } }];
  const aside = [{ kind: "photo", id: "b", rect: { x: 1080 - 80, y: 100, w: 1000, h: 1000 }, photoId: "pf", crop: { zoom: 1, cx: 0.5, cy: 0.5 } }];
  ok("đường cắt qua khuôn mặt bị phạt, cắt sát mép thì không", cutPenalty(across, byId, 1080, 2) >= 0.6 && cutPenalty(aside, byId, 1080, 2) < 0.1);
  const pano = composePanorama({ photos: photos.slice(0, 6), format: f, style: styleById("kraft"), slides: 3, text: null, seed: 4 });
  ok("carousel có nhiều kiểu", new Set(pano.map((x) => x.recipe.split(":")[0])).size >= 4, pano.map((x) => x.recipe).join(" "));
  const bigSpan = { ...generateDoc({ photos, perPage: 4, formatId: "4x5", styleId: "white", texts: [], seed: 1, carousel: 2 }) };
  bigSpan.pages = [{ ...bigSpan.pages[0], span: 99 }];
  ok("máy chủ kẹp số slide trong giới hạn", (sanitizeDoc(bigSpan, allowedIds).ok ? sanitizeDoc(bigSpan, allowedIds).doc.pages[0].span : 0) === COLLAGE_LIMITS.slides);
}

/* ── Máy chủ giữ hình trang trí + mẫu chữ hợp lệ, bỏ cái lạ ─────────────── */
{
  const allowedIds = new Set(photos.map((p) => p.id));
  const base = generateDoc({ photos: photos.slice(0, 2), perPage: 2, formatId: "4x5", styleId: "white", texts: ["Hi"], seed: 2, lockup: "thank-you", ctx: { names: "Lan & Minh" } });
  const pg = base.pages[0];
  const doc = { ...base, pages: [{ ...pg, ornaments: [{ id: "o1", kind: "sprig", rect: { x: 10, y: 10, w: 100, h: 60 }, color: "#879779", rotate: 12, over: true }, { id: "o2", kind: "bomb", rect: { x: 0, y: 0, w: 5, h: 5 }, color: "#000000" }, { id: "o3", kind: "path", rect: { x: 0, y: 0, w: 50, h: 50 }, color: "#000000", d: "M0 0 L10 10 <script>" }] }] };
  const c = sanitizeDoc(doc, allowedIds);
  check("chỉ giữ hình trang trí hợp lệ", c.ok ? c.doc.pages[0].ornaments.map((o) => o.kind) : null, ["sprig"]);
  const tf = c.ok ? c.doc.pages[0].frames.find((f) => f.kind === "text") : null;
  check("giữ mẫu chữ của khung chữ", tf?.lockup, { id: "thank-you", kicker: "Thank you", sub: "Lan & Minh" });
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
