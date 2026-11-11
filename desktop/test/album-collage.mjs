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
import { categorize, suggestPhotos, fold, CAT_COUPLE, CAT_DECOR, CAT_FAMILY } from "../../src/lib/collage/categories.ts";
import { focusCrop, placePhoto, DEFAULT_CROP } from "../../src/lib/collage/crop.ts";
import { formatById } from "../../src/lib/collage/formats.ts";
import { rng } from "../../src/lib/collage/rng.ts";
import { COLLAGE_LIMITS } from "../../src/lib/collage/types.ts";

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

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
