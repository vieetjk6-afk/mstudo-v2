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
import { centroid, matchKnown, nearestPerson, GROUP_DEFAULTS } from "../../src/lib/face-group.ts";
import {
  NAME_MAX,
  faceChips,
  faceCrop,
  filterByPerson,
  indexByKey,
  matchKey,
  nameProblems,
  padBox,
  resolvePhotoIds,
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

/* ── faceChips ────────────────────────────────────────────────────────────── */
console.log("\n— Khuôn mặt hiện cho khách chọn —");
const P = (id, name, cover, position, face_count = 5) => ({
  id,
  name,
  cover_photo_id: cover,
  cover_box: [0.4, 0.2, 0.1, 0.15],
  descriptor: null,
  face_count,
  position,
});
const people = [
  P("P2", "Chú rể", "p2", 1),
  P("P1", "Cô dâu", "p1", 0),
  P("P3", "", "p3", 2), // chưa đặt tên — VẪN phải hiện
  P("P5", "", "p1", 4), // chưa đặt tên, ít ảnh hơn
  P("P4", "Mẹ cô dâu", "p9", 3), // ảnh đã bị xoá khỏi album
];
const links = [
  { person_id: "P1", photo_id: "p1" },
  { person_id: "P1", photo_id: "p2" },
  { person_id: "P2", photo_id: "p2" },
  { person_id: "P3", photo_id: "p1" },
  { person_id: "P3", photo_id: "p2" },
  { person_id: "P3", photo_id: "p3" },
  { person_id: "P5", photo_id: "p3" },
  { person_id: "P4", photo_id: "p9" }, // p9 không còn trong album
];
const inAlbum = new Set(["p1", "p2", "p3"]);
const chips = faceChips(people, links, inAlbum);

// Đây là thay đổi QUAN TRỌNG so với bản đầu: khách nhận ra người bằng MẶT chứ
// không bằng tên, nên cụm chưa đặt tên phải hiện. Studio đặt tên cô dâu chú rể
// là cùng — mẹ cô dâu, cô bạn thân, đứa cháu thì không ai ngồi đặt hết.
ok("người CHƯA đặt tên VẪN hiện (khách nhận ra bằng mặt)", chips.some((c) => c.id === "P3"));
eq(
  chips.map((c) => c.id),
  ["P1", "P2", "P3", "P5"],
  "đã đặt tên lên trước theo position, rồi tới mặt chưa tên xếp theo SỐ ẢNH giảm dần"
);
ok(!chips.some((c) => c.id === "P4"), "người mà mọi ảnh đã bị xoá khỏi album thì không hiện");
eq(chips[0].photoIds, ["p1", "p2"], "mang đúng danh sách ảnh");
ok(chips[0].coverPhotoId === "p1", "ảnh bìa còn trong album thì giữ");
eq(chips[0].coverBox, [0.4, 0.2, 0.1, 0.15], "mang theo khung khuôn mặt để cắt ảnh thẻ");
{
  const c = faceChips(
    [{ ...P("P9", "X", "p-mat", 0), cover_box: null }],
    [{ person_id: "P9", photo_id: "p1" }],
    inAlbum
  );
  ok(c[0].coverPhotoId === null, "ảnh bìa đã bị xoá → bìa null, mặt vẫn còn (còn ảnh khác)");
  ok(c[0].coverBox === null, "không có khung thì trả null, không trả mảng rỗng");
}
{
  const c = faceChips(
    [{ ...P("P9", "X", "p1", 0), cover_box: [1, 2, 3] }],
    [{ person_id: "P9", photo_id: "p1" }],
    inAlbum
  );
  ok(c[0].coverBox === null, "khung sai độ dài (3 số) bị loại, không cắt bừa");
}
{
  const same = faceChips(
    [P("A", "Bé An", null, 0), P("B", "Anh Ba", null, 0)],
    [
      { person_id: "A", photo_id: "p1" },
      { person_id: "B", photo_id: "p1" },
    ],
    inAlbum
  );
  eq(same.map((c) => c.name), ["Anh Ba", "Bé An"], "cùng position thì xếp theo tên tiếng Việt");
}
eq(faceChips([], [], inAlbum), [], "album chưa lưu ai: không có mặt nào");
{
  // Database CHƯA chạy lại migration: hàng đọc lên không có `cover_box`, cũng
  // không có `face_count`. Khối tìm theo khuôn mặt phải vẫn chạy, chỉ mất phần
  // ảnh mặt cắt sẵn — chứ không biến mất hẳn.
  const cu = faceChips(
    [{ id: "P9", name: "Cô dâu", cover_photo_id: "p1", descriptor: null, position: 0 }],
    [{ person_id: "P9", photo_id: "p1" }],
    inAlbum
  );
  ok(cu.length === 1, "thiếu cột cover_box (migration cũ) vẫn ra khuôn mặt");
  ok(cu[0].coverBox === null, "…chỉ là không có khung, ảnh thẻ lùi về lấy cả tấm");
  ok(cu[0].faceCount === 0, "…thiếu face_count thì đếm 0, không phải undefined");
}

/* ── Cắt ảnh mặt ──────────────────────────────────────────────────────────── */
console.log("\n— Cắt ảnh mặt bằng CSS —");
{
  const b = padBox([0.4, 0.4, 0.1, 0.1], 0.5);
  ok(Math.abs(b.w - 0.2) < 1e-9 && Math.abs(b.h - 0.2) < 1e-9, "nới 50% mỗi bên → to gấp đôi");
  ok(
    Math.abs(b.x + b.w / 2 - 0.45) < 1e-9 && Math.abs(b.y + b.h / 2 - 0.45) < 1e-9,
    "…và giữ nguyên TÂM khuôn mặt"
  );
}
{
  const b = padBox([0.02, 0.02, 0.1, 0.1], 0.5);
  ok(b.x === 0 && b.y === 0, "mặt sát mép trên-trái: đẩy vào trong, không âm");
  ok(Math.abs(b.w - 0.2) < 1e-9, "…và vẫn giữ đủ bề rộng đã nới");
}
{
  const b = padBox([0.9, 0.9, 0.09, 0.09], 0.5);
  ok(b.x + b.w <= 1 + 1e-9 && b.y + b.h <= 1 + 1e-9, "mặt sát mép dưới-phải: không tràn ra ngoài");
}
{
  const b = padBox([0.1, 0.1, 0.9, 0.9], 1);
  ok(b.w <= 1 && b.h <= 1 && b.x >= 0 && b.y >= 0, "mặt gần kín ảnh: nới xong vẫn nằm trong ảnh");
}

ok(faceCrop(null) === null, "không có khung → null (màn hình lấy cả tấm làm ảnh thẻ)");
ok(faceCrop([0.1, 0.1, 0.2]) === null, "khung thiếu số → null");
ok(faceCrop([0.1, NaN, 0.2, 0.2]) === null, "khung có NaN → null, không sinh CSS hỏng");

/*
 * Phép kiểm thật của faceCrop: MÔ PHỎNG lại đúng ngữ nghĩa CSS rồi xem khuôn mặt
 * có rơi đúng vào ô vuông không. So chuỗi CSS chỉ chứng minh hàm không đổi, chứ
 * không chứng minh nó ĐÚNG.
 *
 * Ngữ nghĩa cần tái hiện: `transform: scale(k) translate(tx%, ty%)` với
 * `transform-origin: 0 0` áp translate TRƯỚC, và phần trăm của translate ăn theo
 * kích thước CHÍNH THẺ ẢNH (rộng S, cao S/tỉ-lệ), không phải theo ô chứa.
 */
function simulate(box, S, aspect) {
  const css = faceCrop(box);
  const k = Number(/scale\(([-0-9.]+)\)/.exec(css.transform)[1]);
  const m = /translate\(([-0-9.]+)%, ([-0-9.]+)%\)/.exec(css.transform);
  const txPct = Number(m[1]) / 100;
  const tyPct = Number(m[2]) / 100;
  const imgW = S;
  const imgH = S / aspect;
  const b = padBox(box, 0.45);
  // Góc trên-trái của khung mặt trên ảnh khi ảnh vẽ ở cỡ layout:
  const faceLeft = b.x * imgW;
  const faceTop = b.y * imgH;
  // translate rồi scale quanh gốc 0,0:
  return {
    left: (faceLeft + txPct * imgW) * k,
    top: (faceTop + tyPct * imgH) * k,
    width: b.w * imgW * k,
    height: b.h * imgH * k,
  };
}
// Ngưỡng tính bằng ĐIỂM ẢNH, không phải 1e-6: chuỗi CSS được làm tròn có chủ ý
// (scale 4 chữ số, dịch 3 chữ số) nên sai số nằm ở khoảng 5 phần vạn của một
// điểm ảnh trên ô 64 px — dưới một điểm ảnh thật ngay cả trên màn hình 3×. Đòi
// khớp tuyệt đối là kiểm nhầm thứ: cái cần đúng là VỊ TRÍ NHÌN THẤY.
const PX = 0.05;
for (const [label, aspect] of [["ảnh ngang 3:2", 1.5], ["ảnh dọc 2:3", 2 / 3], ["ảnh vuông", 1]]) {
  const r = simulate([0.42, 0.18, 0.12, 0.16], 64, aspect);
  ok(Math.abs(r.left) < PX && Math.abs(r.top) < PX,
    `${label}: khuôn mặt nằm đúng góc trên-trái ô (left=${r.left.toFixed(4)} top=${r.top.toFixed(4)})`);
  ok(Math.abs(r.width - 64) < PX,
    `${label}: bề ngang khuôn mặt vừa đúng bề ngang ô (w=${r.width.toFixed(4)})`);
}
{
  // Không bóp méo: một khuôn mặt VUÔNG tính bằng điểm ảnh phải ra vuông trong ô,
  // bất kể ảnh ngang hay dọc. Trên ảnh 3:2, mặt vuông có h chuẩn hoá = w × 1,5.
  const r = simulate([0.4, 0.2, 0.1, 0.15], 64, 1.5);
  ok(Math.abs(r.height - r.width) < PX,
    `mặt vuông trên ảnh 3:2 vẫn ra vuông trong ô, không bóp méo (w=${r.width.toFixed(3)} h=${r.height.toFixed(3)})`);
}

/* ── nearestPerson: khách tải ảnh mình lên ───────────────────────────────── */
console.log("\n— Khách tải ảnh mình lên để tìm —");
{
  const list = [
    { id: "bride", descriptor: BRIDE },
    { id: "groom", descriptor: GROOM },
  ];
  ok(nearestPerson(near(BRIDE, 0.1), list)?.id === "bride", "tìm đúng người gần nhất");
  ok(nearestPerson(near(GROOM, 0.2), list)?.id === "groom", "…kể cả khi hỏi người kia");
  ok(
    nearestPerson([999, 0, 0, 0], list) === null,
    "quá ngưỡng thì trả null, KHÔNG trả người gần nhất"
  );
  ok(nearestPerson(BRIDE, [{ id: "x", descriptor: null }]) === null, "người chưa có tâm cụm thì bỏ qua");
  ok(nearestPerson([10, 0], list) === null, "vector khác chiều không khớp");
  ok(nearestPerson(BRIDE, []) === null, "album chưa lưu ai → null");
  ok(
    nearestPerson(near(BRIDE, 0.5), list, { maxDistance: 0.3 }) === null,
    "kéo ngưỡng chặt hơn thì cùng dữ liệu KHÔNG còn khớp"
  );
  const d = nearestPerson(near(BRIDE, 0.1), list).distance;
  ok(d > 0 && d < 0.6, `có trả về khoảng cách để màn hình nói được mức tự tin (d=${d.toFixed(3)})`);
}

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
