/* Kiểm thử NGƯỜI TRONG ALBUM — cầu nối giữa lượt quét của studio và DB.
 *
 * Ba thứ ở đây hỏng theo kiểu "vẫn chạy, chỉ là sai", nên phần lớn bài kiểm thử
 * xoay quanh đúng chúng:
 *
 *  1. NHẬN LẠI NGƯỜI CŨ. Studio quét đợt hai. Nếu hai cụm mới cùng nhận một
 *     người cũ thì album có hai "Cô dâu" — chỉ mục UNIQUE trong DB từ chối, và
 *     dữ liệu thì sai từ trước đó. `matchKnown` phải ghép MỘT-ĐỐI-MỘT.
 *  2. GHÉP TÊN FILE. Studio lọc trên RAW, giao khách JPG. Ghép sai luật thì
 *     KHÔNG có ảnh nào khớp và bảng người lưu xuống rỗng, im lặng.
 *  3. CHIP CHẾT. Studio xoá ảnh khỏi album sau khi lưu → chip vẫn hiện nhưng bấm
 *     vào ra lưới trống. `visibleChips` phải tự loại.
 *
 * Nạp thẳng code thật.
 */
import { centroid, matchKnown, GROUP_DEFAULTS } from "../../src/lib/face-group.ts";
import {
  NAME_MAX,
  filterByPerson,
  indexByKey,
  matchKey,
  nameProblems,
  resolvePhotoIds,
  visibleChips,
} from "../../src/lib/face-people.ts";

let pass = 0;
const fails = [];
function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`✓ ${label}`);
  } else {
    fails.push(label);
    console.log(`✗ ${label}`);
  }
}
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — ${JSON.stringify(a)}`);

/* ── matchKey ─────────────────────────────────────────────────────────────── */
console.log("\n— Luật ghép tên file —");
ok(matchKey("IMG_2841.CR3") === matchKey("IMG_2841.jpg"), "RAW và JPG cùng tấm ghép được với nhau");
ok(matchKey("  Anh Cuoi.JPG ") === "anh cuoi", "cắt trắng hai đầu và hạ chữ thường");
ok(matchKey("a.b.c.jpg") === "a.b.c", "chỉ bỏ ĐUÔI cuối, tên có dấu chấm giữa vẫn nguyên");
ok(matchKey("khong-co-duoi") === "khong-co-duoi", "tên không có đuôi để nguyên");
ok(matchKey("") === "", "tên rỗng ra khoá rỗng, không nổ");

/* ── indexByKey / resolvePhotoIds ─────────────────────────────────────────── */
console.log("\n— Đổi tên file thành id ảnh —");
const albumPhotos = [
  { id: "p1", name: "IMG_001.jpg" },
  { id: "p2", name: "IMG_002.jpg" },
  { id: "p3", name: "IMG_003.jpg" },
  // Trùng tên (hai thư mục nguồn) — bản ĐẦU phải thắng.
  { id: "p4", name: "img_001.JPG" },
];
const idx = indexByKey(albumPhotos);
ok(idx.get("img_001") === "p1", "trùng khoá thì bản đầu thắng (thứ tự position)");
ok(idx.size === 3, "bốn hàng ảnh ra ba khoá");

const r1 = resolvePhotoIds(["IMG_002.CR3", "IMG_003.jpg"], idx);
eq(r1.ids, ["p2", "p3"], "ghép được cả khi quét RAW mà album lưu JPG");
eq(r1.missing, [], "không thiếu tấm nào");

const r2 = resolvePhotoIds(["IMG_002.jpg", "IMG_999.jpg", "IMG_888.jpg"], idx);
eq(r2.ids, ["p2"], "ảnh ngoài album bị bỏ ra");
eq(r2.missing, ["IMG_999.jpg", "IMG_888.jpg"], "…và ĐƯỢC KỂ TÊN, không im lặng bỏ bớt");

const r3 = resolvePhotoIds(["IMG_001.jpg", "img_001.cr3", "IMG_001.JPG"], idx);
eq(r3.ids, ["p1"], "ba tên cùng trỏ một ảnh chỉ ra một id (khoá chính person+photo không nổ)");

/* ── nameProblems ─────────────────────────────────────────────────────────── */
console.log("\n— Kiểm tên trước khi ghi —");
eq(nameProblems(["Cô dâu", "Chú rể"]), [], "hai tên khác nhau: không có vấn đề");
eq(nameProblems(["Cô dâu", "", "", "Chú rể"]), [], "tên rỗng KHÔNG phải vấn đề (cụm chưa đặt tên)");
ok(nameProblems(["Cô dâu", "cô dâu"]).length === 1, "trùng tên khác hoa/thường vẫn là trùng");
ok(
  nameProblems(["Cô dâu", " Cô dâu "]).length === 1,
  "trùng tên khác khoảng trắng hai đầu vẫn là trùng"
);
ok(nameProblems(["x".repeat(NAME_MAX + 1)]).length === 1, `tên dài quá ${NAME_MAX} ký tự bị chặn`);
ok(nameProblems(["x".repeat(NAME_MAX)]).length === 0, `đúng ${NAME_MAX} ký tự vẫn được`);

/* ── centroid ─────────────────────────────────────────────────────────────── */
console.log("\n— Tâm cụm —");
eq(centroid([[0, 0], [2, 4]]), [1, 2], "trung bình từng chiều");
eq(centroid([[1, 1]]), [1, 1], "một vector thì tâm cụm là chính nó");
ok(centroid([]) === null, "không có vector nào → null");
ok(centroid([[], []]) === null, "toàn vector rỗng → null, không phải [NaN]");
eq(centroid([[0, 0], [9, 9, 9], [2, 4]]), [1, 2], "vector SAI CHIỀU bị bỏ, không kéo lệch tâm cụm");
ok(
  centroid([[1, 2, 3]]).length === 3 && centroid([[1, 2, 3]]).every((n) => Number.isFinite(n)),
  "tâm cụm toàn số hữu hạn"
);

// Tâm cụm phải GẦN các thành viên hơn là các thành viên gần nhau — đây là lý do
// lưu tâm cụm thay vì vector của một khuôn mặt đại diện.
{
  const a = [0, 0];
  const b = [0.4, 0];
  const c = centroid([a, b]);
  const dist = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1]);
  ok(
    dist(c, a) < dist(a, b) && dist(c, b) < dist(a, b),
    "tâm cụm gần mọi thành viên hơn là các thành viên gần nhau"
  );
}

/* ── matchKnown: nhận lại người đã lưu ───────────────────────────────────── */
console.log("\n— Nhận lại người đã lưu ở lần quét trước —");
const D = GROUP_DEFAULTS.maxDistance; // 0,6
// Vector giả 4 chiều: đủ để kiểm luật ghép, không cần 128 chiều thật.
const near = (base, off) => base.map((n, i) => (i === 0 ? n + off : n));
const BRIDE = [10, 0, 0, 0];
const GROOM = [20, 0, 0, 0];

{
  const known = [
    { id: "k-bride", name: "Cô dâu", descriptor: BRIDE },
    { id: "k-groom", name: "Chú rể", descriptor: GROOM },
  ];
  const fresh = [
    { id: "s1", descriptor: near(GROOM, 0.1) },
    { id: "s2", descriptor: near(BRIDE, 0.1) },
  ];
  const m = matchKnown(fresh, known);
  eq(m.map((x) => x.name), ["Chú rể", "Cô dâu"], "cụm mới thừa hưởng đúng tên người cũ");
  eq(m.map((x) => x.knownId), ["k-groom", "k-bride"], "…và đúng id để CẬP NHẬT thay vì thêm mới");
}

{
  // Người cũ ở XA mọi cụm mới → không ai nhận, tất cả là người mới.
  const known = [{ id: "k-x", name: "Ai đó", descriptor: [999, 0, 0, 0] }];
  const fresh = [{ id: "s1", descriptor: BRIDE }];
  const m = matchKnown(fresh, known);
  eq(m.map((x) => x.knownId), [null], "quá xa ngưỡng thì KHÔNG ghép bừa");
  ok(m[0].distance === Infinity, "…và khoảng cách báo Infinity");
  ok(m[0].name === "", "…tên để trống cho studio tự đặt");
}

{
  // MỘT-ĐỐI-MỘT: một người cũ bị tách thành hai cụm mới. Chỉ cụm GẦN HƠN được
  // thừa hưởng tên; cụm kia phải để trống, nếu không album có hai "Cô dâu".
  const known = [{ id: "k-bride", name: "Cô dâu", descriptor: BRIDE }];
  const fresh = [
    { id: "s-far", descriptor: near(BRIDE, 0.5) },
    { id: "s-near", descriptor: near(BRIDE, 0.05) },
  ];
  const m = matchKnown(fresh, known);
  const named = m.filter((x) => x.knownId);
  ok(named.length === 1, "một người cũ chỉ được MỘT cụm mới nhận");
  ok(named[0].personId === "s-near", "…và là cụm GẦN HƠN, không phải cụm gặp trước");
  ok(m.find((x) => x.personId === "s-far").name === "", "cụm còn lại để trống, không nhân bản tên");
}

{
  // Ngược lại: hai người cũ, một cụm mới nằm giữa nhưng gần một bên hơn.
  const known = [
    { id: "k-a", name: "A", descriptor: [0, 0, 0, 0] },
    { id: "k-b", name: "B", descriptor: [0.5, 0, 0, 0] },
  ];
  const m = matchKnown([{ id: "s1", descriptor: [0.05, 0, 0, 0] }], known);
  ok(m[0].name === "A", "một cụm nằm giữa hai người cũ chọn người GẦN NHẤT");
}

{
  const m = matchKnown([{ id: "s1", descriptor: null }], [
    { id: "k", name: "Cô dâu", descriptor: BRIDE },
  ]);
  eq(m.map((x) => x.knownId), [null], "cụm không có tâm cụm (null) thì bỏ qua, không nổ");
}

{
  const m = matchKnown([{ id: "s1", descriptor: BRIDE }], [
    { id: "k", name: "Cô dâu", descriptor: [] },
  ]);
  eq(m.map((x) => x.knownId), [null], "người cũ chưa có descriptor thì không tham gia ghép");
}

{
  const m = matchKnown([{ id: "s1", descriptor: [10, 0] }], [
    { id: "k", name: "Cô dâu", descriptor: BRIDE }, // 4 chiều vs 2 chiều
  ]);
  eq(
    m.map((x) => x.knownId),
    [null],
    "vector KHÁC CHIỀU không ghép (euclidean trả Infinity, không phải 0)"
  );
}

{
  // Ngưỡng: đúng bằng maxDistance thì ghép, hơn một chút thì không.
  const known = [{ id: "k", name: "Cô dâu", descriptor: [0, 0, 0, 0] }];
  ok(matchKnown([{ id: "s", descriptor: [D, 0, 0, 0] }], known)[0].knownId === "k", `đúng ${D} thì ghép`);
  ok(
    matchKnown([{ id: "s", descriptor: [D + 0.01, 0, 0, 0] }], known)[0].knownId === null,
    `quá ${D} một chút thì không`
  );
  // Thanh chặt/rộng của studio phải ăn vào đây.
  ok(
    matchKnown([{ id: "s", descriptor: [0.5, 0, 0, 0] }], known, { maxDistance: 0.4 })[0].knownId === null,
    "kéo ngưỡng chặt hơn thì cùng dữ liệu KHÔNG còn ghép"
  );
}

{
  // Cùng đầu vào, cùng kết quả — studio bấm lại không được thấy tên nhảy.
  const known = [
    { id: "k-a", name: "A", descriptor: [0, 0, 0, 0] },
    { id: "k-b", name: "B", descriptor: [0.2, 0, 0, 0] },
  ];
  const fresh = [
    { id: "s1", descriptor: [0.1, 0, 0, 0] },
    { id: "s2", descriptor: [0.1, 0, 0, 0] }, // hoà hoàn toàn
  ];
  const a = JSON.stringify(matchKnown(fresh, known));
  const b = JSON.stringify(matchKnown(fresh, known));
  ok(a === b, "hoà hoàn toàn vẫn ra cùng kết quả hai lần chạy (phá hoà theo chỉ số)");
}

{
  eq(matchKnown([], []), [], "không có gì thì trả mảng rỗng");
  const m = matchKnown([{ id: "s1", descriptor: BRIDE }], []);
  eq(m.map((x) => x.knownId), [null], "album chưa lưu ai: tất cả là người mới");
}

/* ── visibleChips ─────────────────────────────────────────────────────────── */
console.log("\n— Chip lọc hiện cho khách —");
const people = [
  { id: "P2", name: "Chú rể", cover_photo_id: "p2", position: 1 },
  { id: "P1", name: "Cô dâu", cover_photo_id: "p1", position: 0 },
  { id: "P3", name: "", cover_photo_id: "p3", position: 2 }, // chưa đặt tên
  { id: "P4", name: "Mẹ cô dâu", cover_photo_id: "p9", position: 3 }, // ảnh đã bị xoá
];
const links = [
  { person_id: "P1", photo_id: "p1" },
  { person_id: "P1", photo_id: "p2" },
  { person_id: "P2", photo_id: "p2" },
  { person_id: "P3", photo_id: "p3" },
  { person_id: "P4", photo_id: "p9" }, // p9 không còn trong album
];
const inAlbum = new Set(["p1", "p2", "p3"]);
const chips = visibleChips(people, links, inAlbum);

eq(chips.map((c) => c.name), ["Cô dâu", "Chú rể"], "xếp theo position studio đặt, không theo thứ tự hàng");
ok(!chips.some((c) => c.id === "P3"), "người CHƯA ĐẶT TÊN không thành chip");
ok(!chips.some((c) => c.id === "P4"), "người mà mọi ảnh đã bị xoá khỏi album cũng không thành chip");
eq(chips[0].photoIds, ["p1", "p2"], "chip mang đúng danh sách ảnh");
ok(chips[0].coverPhotoId === "p1", "ảnh bìa còn trong album thì giữ");
{
  const c = visibleChips(
    [{ id: "P9", name: "X", cover_photo_id: "p-mat", position: 0 }],
    [{ person_id: "P9", photo_id: "p1" }],
    inAlbum
  );
  ok(c[0].coverPhotoId === null, "ảnh bìa đã bị xoá → bìa null, chip vẫn còn (còn ảnh khác)");
}
{
  const same = visibleChips(
    [
      { id: "A", name: "Bé An", cover_photo_id: null, position: 0 },
      { id: "B", name: "Anh Ba", cover_photo_id: null, position: 0 },
    ],
    [
      { person_id: "A", photo_id: "p1" },
      { person_id: "B", photo_id: "p1" },
    ],
    inAlbum
  );
  eq(same.map((c) => c.name), ["Anh Ba", "Bé An"], "cùng position thì xếp theo tên tiếng Việt");
}
eq(visibleChips([], [], inAlbum), [], "album chưa lưu ai: không có chip nào");

/* ── filterByPerson ──────────────────────────────────────────────────────── */
console.log("\n— Lọc lưới theo người —");
const grid = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
eq(filterByPerson(grid, null).map((p) => p.id), ["p1", "p2", "p3"], "không chọn ai thì không lọc");
eq(filterByPerson(grid, chips[1]).map((p) => p.id), ["p2"], "chọn Chú rể thì còn đúng ảnh của anh ấy");
ok(
  filterByPerson(grid, { id: "x", name: "x", coverPhotoId: null, photoIds: ["p3", "p1"] }).map((p) => p.id)
    .join() === "p1,p3",
  "giữ THỨ TỰ LƯỚI, không theo thứ tự trong chip"
);

console.log(`\n${pass} đạt${fails.length ? `, ${fails.length} KHÔNG đạt` : ""}`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Tất cả kiểm thử đạt");
