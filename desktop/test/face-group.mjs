/* Kiểm thử GOM ẢNH THEO TỪNG NGƯỜI — phần luật.
 *
 * Hai thứ dễ vỡ, và cả hai đều hỏng theo kiểu "vẫn chạy, chỉ là sai":
 *
 *  1. BẪY DÂY CHUYỀN. A giống B, B giống C, nhưng A và C là hai người khác nhau.
 *     Nối thành phần liên thông sẽ gộp cả ba, rồi từ C sang D… và cuối cùng cả
 *     đám cưới thành một người. Đây là lý do thuật toán ở đây là Chinese
 *     Whispers chứ không phải union-find, nên phần lớn bài kiểm thử dưới đây
 *     xoay quanh đúng tình huống ấy.
 *  2. THƯỚC ĐO. Vector của mạng này nằm trong một hình nón, cosine giữa hai
 *     vector bất kỳ đã là ~0,94 — đo thật ở /uipreview/gom-theo-nguoi. Lấy
 *     cosine làm thước là gom tất cả vào một cụm mà không có dấu hiệu gì.
 *     Thước đúng là khoảng cách Euclid trên vector THÔ.
 *
 * Nạp thẳng code thật ở src/lib/face-group.ts.
 */
import {
  GROUP_DEFAULTS,
  chineseWhispers,
  dropPhoto,
  euclidean,
  groupFaces,
  mergePeople,
  photoToPeople,
} from "../../src/lib/face-group.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/** Khuôn mặt giả: vector 2 chiều cho dễ hình dung — luật không quan tâm số chiều. */
const f = (key, x, y, { at = 0, area = 0.05, sharpness = 300 } = {}) => ({
  key, at, v: [x, y], area, sharpness,
});

/* ═══ Thước đo ═══════════════════════════════════════════════════════════════ */

{
  check("khoảng cách của hai vector giống hệt = 0", euclidean([1, 2, 3], [1, 2, 3]), 0);
  check("khoảng cách 3-4-5", euclidean([0, 0], [3, 4]), 5);
  // Khác chiều dài phải là VÔ CỰC, không phải 0: 0 nghĩa là "giống hệt" và sẽ
  // gộp nhầm hai người — hỏng phải hỏng về phía an toàn.
  check("khác số chiều → vô cực, KHÔNG phải 0", euclidean([1, 2], [1, 2, 3]), Infinity);
  check("vector rỗng → vô cực", euclidean([], []), Infinity);
}

/* ═══ Bẫy dây chuyền — lý do tồn tại của thuật toán này ══════════════════════ */

{
  // ĐÚNG tình huống nguy hiểm ngoài đời: hai cụm DÀY (cô dâu 200 tấm, chú rể 180
  // tấm) và một khuôn mặt nằm lửng giữa, gần cả hai bên trong ngưỡng. Union-find
  // sẽ nối hai cụm qua đúng một khuôn mặt đó và cả đám cưới thành một người.
  const dense2 = [
    f("a1", 0, 0), f("a2", 0.05, 0), f("a3", 0, 0.05), f("a4", 0.05, 0.05), f("a5", 0.02, 0.03),
    f("b1", 1.0, 0), f("b2", 1.05, 0), f("b3", 1.0, 0.05), f("b4", 1.05, 0.05), f("b5", 1.02, 0.03),
    f("cau", 0.5, 0.02), // trong ngưỡng 0,6 với CẢ HAI cụm
  ];
  const lab = chineseWhispers(dense2, { maxDistance: 0.6 });
  const labA = new Set(lab.slice(0, 5));
  const labB = new Set(lab.slice(5, 10));
  ok("hai cụm dày, nối bằng một khuôn mặt lửng → KHÔNG bị gộp",
    labA.size === 1 && labB.size === 1 && [...labA][0] !== [...labB][0],
    `nhãn=${JSON.stringify(lab)}`);

  // Còn một chuỗi TRẦN ba mắt xích (A–B–C, không ai có cụm riêng) thì Chinese
  // Whispers gộp cả ba, và đó là hành vi đúng của thuật toán chứ không phải lỗi:
  // B gắn với A và C như nhau, A và C không có gì khác để bám. Không sao — với
  // `minFaces` mặc định, một cụm ba khuôn mặt lửng lơ như vậy vốn đã nằm sát mép
  // của thứ đáng gọi là "một người". Ghi lại ở đây để lần sau không ai đọc code
  // rồi tưởng nó chống được mọi kiểu dây chuyền.
  const bare = chineseWhispers([f("A", 0, 0), f("B", 0.5, 0), f("C", 1.0, 0)], { maxDistance: 0.6 });
  ok("chuỗi trần ba mắt xích thì gộp — hành vi đã biết, không phải lỗi",
    new Set(bare).size === 1, `nhãn=${JSON.stringify(bare)}`);

  // Ngược lại: hai CỤM DÀY thì phải gộp đúng. Bốn tấm quây quanh một điểm là
  // một người; thuật toán không được vì sợ dây chuyền mà xé nát cụm thật.
  const dense = [
    f("a1", 0, 0), f("a2", 0.1, 0.05), f("a3", 0.05, 0.1), f("a4", 0.12, 0.02),
    f("b1", 5, 5), f("b2", 5.1, 5.05), f("b3", 5.05, 5.1), f("b4", 5.12, 5.02),
  ];
  const g = groupFaces(dense, { maxDistance: 0.6, minFaces: 2 });
  check("hai cụm dày, cách xa nhau → đúng hai người", g.people.length, 2);
  ok("mỗi cụm đủ bốn ảnh", g.people.every((p) => p.photoKeys.length === 4));
  ok("không ai bị bỏ rơi", g.loose === 0);
}

/* ═══ Kết quả ổn định ════════════════════════════════════════════════════════ */

{
  // Chạy hai lần trên cùng dữ liệu phải ra CÙNG kết quả. Không có điều này thì
  // studio bấm quét lại và thấy các cụm nhảy lung tung — họ sẽ không tin.
  const list = [
    f("a1", 0, 0), f("a2", 0.1, 0.05), f("a3", 0.05, 0.1),
    f("b1", 3, 3), f("b2", 3.1, 3.05), f("b3", 3.05, 3.1),
    f("c1", 6, 0), f("c2", 6.1, 0.05), f("c3", 6.05, 0.1),
  ];
  const one = groupFaces(list, { maxDistance: 0.6 });
  const two = groupFaces(list, { maxDistance: 0.6 });
  check("chạy hai lần ra kết quả y hệt", one, two);
  check("ba người", one.people.length, 3);
}

/* ═══ Cụm quá nhỏ ════════════════════════════════════════════════════════════ */

{
  const list = [
    f("a1", 0, 0), f("a2", 0.1, 0), f("a3", 0.05, 0.1),
    f("x1", 9, 9), // khách qua đường, chỉ một khung
  ];
  const g = groupFaces(list, { maxDistance: 0.6, minFaces: 3 });
  check("khách chỉ lọt một khung → không thành một người", g.people.length, 1);
  check("… và được đếm riêng chứ không biến mất", g.loose, 1);
  check("hạ ngưỡng số ảnh → khách đó thành một người",
    groupFaces(list, { maxDistance: 0.6, minFaces: 1 }).people.length, 2);
}

/* ═══ Ảnh đại diện và thứ tự ═════════════════════════════════════════════════ */

{
  const list = [
    f("nho", 0, 0, { area: 0.01, sharpness: 900 }),
    f("to", 0.1, 0, { area: 0.20, sharpness: 100 }),   // MẶT TO NHẤT
    f("vua", 0.05, 0.1, { area: 0.09, sharpness: 800 }),
  ];
  const g = groupFaces(list, { maxDistance: 0.6, minFaces: 2 });
  check("ảnh đại diện là tấm MẶT TO NHẤT, không phải nét nhất", g.people[0].coverKey, "to");

  // Hoà diện tích thì mới xét tới nét.
  const tie = [
    f("mo", 0, 0, { area: 0.09, sharpness: 100 }),
    f("net", 0.1, 0, { area: 0.09, sharpness: 900 }),
    f("k", 0.05, 0.1, { area: 0.02, sharpness: 500 }),
  ];
  check("cùng diện tích → lấy tấm nét hơn",
    groupFaces(tie, { maxDistance: 0.6, minFaces: 2 }).people[0].coverKey, "net");

  // Người NHIỀU ảnh nhất lên đầu — trong album cưới đó gần như luôn là cô dâu.
  const many = [
    f("a1", 0, 0), f("a2", 0.1, 0), f("a3", 0.05, 0.1),
    f("b1", 5, 5), f("b2", 5.1, 5), f("b3", 5.05, 5.1), f("b4", 5.02, 5.08), f("b5", 5.08, 5.03),
  ];
  const gm = groupFaces(many, { maxDistance: 0.6, minFaces: 2 });
  check("người có nhiều ảnh nhất đứng đầu", gm.people[0].photoKeys.length, 5);
  check("id đánh lại theo thứ tự đã sắp", gm.people.map((p) => p.id), ["p1", "p2"]);
}

/* ═══ Một tấm có nhiều người ═════════════════════════════════════════════════ */

{
  // Ảnh "chung" chứa cả hai người: mỗi người một khuôn mặt trong cùng một tấm.
  const list = [
    f("a1", 0, 0), f("a2", 0.1, 0), f("chung", 0.05, 0.05, { at: 0 }),
    f("b1", 5, 5), f("b2", 5.1, 5), f("chung", 5.05, 5.05, { at: 1 }),
  ];
  const g = groupFaces(list, { maxDistance: 0.6, minFaces: 2 });
  check("hai người", g.people.length, 2);
  ok("tấm chung thuộc về CẢ HAI người",
    g.people.every((p) => p.photoKeys.includes("chung")));
  const map = photoToPeople(g.people);
  check("bảng tra: tấm chung có hai người", map.get("chung").length, 2);
  check("bảng tra: tấm riêng chỉ một người", map.get("a1").length, 1);
}

/* ═══ Sửa lại khi máy gom sai ════════════════════════════════════════════════ */

{
  // Năm khuôn mặt trên bốn tấm — tấm "c" có HAI mặt, mỗi người một mặt. Đúng
  // tình huống làm faceIdx không suy ra được từ photoKeys.
  const faces = [
    { key: "a", at: 0 }, // 0 → p1
    { key: "b", at: 0 }, // 1 → p1
    { key: "c", at: 0 }, // 2 → p1
    { key: "c", at: 1 }, // 3 → p2
    { key: "d", at: 0 }, // 4 → p2
  ];
  const people = [
    { id: "p1", faces: 3, photoKeys: ["a", "b", "c"], faceIdx: [0, 1, 2], coverKey: "a", coverAt: 0 },
    { id: "p2", faces: 2, photoKeys: ["c", "d"], faceIdx: [3, 4], coverKey: "d", coverAt: 0 },
  ];

  // Gộp: cùng một người đội mũ và bỏ mũ rất dễ thành hai cụm.
  const merged = mergePeople(people, "p1", "p2");
  check("gộp xong còn một người", merged.length, 1);
  check("… gộp hết ảnh, không trùng", merged[0].photoKeys, ["a", "b", "c", "d"]);
  check("… gộp cả danh sách khuôn mặt", merged[0].faceIdx, [0, 1, 2, 3, 4]);
  check("… người nhận giữ ảnh đại diện của mình", merged[0].coverKey, "a");
  check("gộp vào chính mình → không đổi gì", mergePeople(people, "p1", "p1"), people);
  check("gộp với người không tồn tại → không đổi gì", mergePeople(people, "p1", "p9"), people);
  // Gộp theo chiều nào cũng ra CÙNG danh sách khuôn mặt: tâm cụm lưu xuống DB
  // không được phụ thuộc vào studio bấm gộp từ thẻ nào.
  check("gộp chiều ngược lại ra cùng danh sách khuôn mặt",
    mergePeople(people, "p2", "p1")[0].faceIdx, [0, 1, 2, 3, 4]);

  // Gỡ một tấm: sửa lỗi "gom thừa", người lạ lọt vào cụm cô dâu.
  const dropped = dropPhoto(people, "p1", "b", faces);
  check("gỡ đúng tấm khỏi đúng người", dropped[0].photoKeys, ["a", "c"]);
  check("… và bỏ luôn khuôn mặt của tấm đó", dropped[0].faceIdx, [0, 2]);
  check("… số khuôn mặt khớp lại", dropped[0].faces, 2);
  check("… không đụng người khác", dropped[1].photoKeys, ["c", "d"]);

  // Tấm "c" có hai mặt, mỗi người một. Gỡ "c" khỏi p1 chỉ được bỏ mặt của p1;
  // mặt của p2 trên cùng tấm đó phải còn nguyên.
  const shared = dropPhoto(people, "p1", "c", faces);
  check("gỡ tấm CHUNG: chỉ bỏ khuôn mặt của người bị gỡ", shared[0].faceIdx, [0, 1]);
  check("… khuôn mặt người kia trên cùng tấm đó còn nguyên", shared[1].faceIdx, [3, 4]);

  // Gỡ đúng ảnh đại diện thì phải chọn ảnh khác, không để trống.
  const noCover = dropPhoto(people, "p1", "a", faces);
  check("gỡ ảnh đại diện → lấy ảnh khác làm đại diện", noCover[0].coverKey, "b");

  // Gỡ tấm cuối cùng thì người đó biến mất: một thẻ lọc rỗng chỉ chờ bấm nhầm.
  let one = [{ id: "p1", faces: 1, photoKeys: ["a"], faceIdx: [0], coverKey: "a", coverAt: 0 }];
  check("gỡ tấm cuối → người đó biến mất", dropPhoto(one, "p1", "a", faces), []);
}

/* ═══ faceIdx: người nào gồm khuôn mặt thứ mấy ═══════════════════════════════
 * Không suy ra được từ photoKeys — một tấm ảnh cưới có cả cô dâu và chú rể. Sai
 * chỗ này thì tâm cụm lưu xuống DB trộn hai người, và lần quét sau ghép sai tên.
 */
{
  // Hai cụm dày cách xa nhau, xen kẽ nhau trong mảng đầu vào.
  const mixed = [
    f("x1", 0, 0), f("y1", 5, 0), f("x2", 0.1, 0),
    f("y2", 5.1, 0), f("x3", 0.05, 0.1), f("y3", 5.05, 0.1),
  ];
  const g = groupFaces(mixed, { maxDistance: 0.6, minFaces: 3 });
  check("hai cụm", g.people.length, 2);
  for (const p of g.people) {
    ok(`faceIdx của ${p.coverKey} có đúng ${p.faces} khuôn mặt`, p.faceIdx.length === p.faces);
    ok(`… và trỏ đúng vào ảnh của người đó`,
      p.faceIdx.every((i) => p.photoKeys.includes(mixed[i].key)));
  }
  const all = g.people.flatMap((p) => p.faceIdx);
  ok("không khuôn mặt nào thuộc hai người", new Set(all).size === all.length);
}

/* ═══ Dữ liệu rác không được làm nổ ══════════════════════════════════════════ */

{
  check("lô rỗng", groupFaces([]), { people: [], loose: 0 });
  check("một khuôn mặt duy nhất, ngưỡng số ảnh 3 → không ai",
    groupFaces([f("a", 0, 0)]).people.length, 0);
  // Vector lệch số chiều nằm lẫn trong lô: phải tự đứng riêng, không kéo ai theo.
  const mixed = [f("a1", 0, 0), f("a2", 0.1, 0), f("a3", 0.05, 0.1),
    { key: "rac", at: 0, v: [0, 0, 0], area: 0.05, sharpness: 1 }];
  const g = groupFaces(mixed, { maxDistance: 0.6, minFaces: 3 });
  check("vector lệch số chiều không kéo ai vào cụm", g.people.length, 1);
  ok("… và không lọt vào cụm thật", !g.people[0].photoKeys.includes("rac"));
}

check("ngưỡng mặc định là 0,6 — con số dlib công bố cho mạng này",
  GROUP_DEFAULTS.maxDistance, 0.6);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
