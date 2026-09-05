/* Kiểm thử LỌC ẢNH THEO KHUÔN MẶT — phần luật.
 *
 * Thứ đắt nhất ở đây KHÔNG phải bộ nhận diện (đó là mô hình của Google, ta chỉ
 * gọi). Đắt nhất là LUẬT CHỌN BẢN NÊN GIỮ. Cả tính năng sinh ra để sửa đúng một
 * lỗi: bộ đo cũ chọn tấm nét nhất cả khung, mà tấm nét nhất trong một chuỗi bấm
 * rất hay là tấm cô dâu chớp mắt — chớp mắt không làm ảnh kém nét chút nào.
 * Nếu luật ở đây sai thứ tự ưu tiên, tính năng không những vô dụng mà còn làm
 * kết quả TỆ HƠN bản không có nó.
 *
 * Nạp thẳng code thật ở src/lib/face-ai.ts.
 */
import {
  FACE_DEFAULTS,
  betterKeeper,
  faceArea,
  faceDecides,
  applyFaces,
  judgeFaces,
  mainFace,
  pickFaceKeeper,
  subjectFaces,
  summarizeFaces,
} from "../../src/lib/face-ai.ts";

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

/** Một khuôn mặt: `size` là cạnh khung mặt theo tỉ lệ ảnh. */
const face = (size, blink, sharpness) => ({
  box: { x: 0.4, y: 0.3, w: size, h: size },
  blink,
  sharpness,
});
const shot = (key, index, faces, frameSharpness = 600) => ({
  key, name: `${key}.JPG`, index, faces, frameSharpness,
});

/* ═══ Mặt nào đủ lớn để được tính ════════════════════════════════════════════ */

{
  const big = face(0.3, 0, 500);     // 9% khung
  const tiny = face(0.05, 0.9, 300); // 0,25% khung — khách qua đường
  const s = shot("a", 0, [big, tiny]);

  check("diện tích mặt = w × h", faceArea(big), 0.09);
  check("chỉ mặt đủ lớn được tính là chủ thể", subjectFaces(s).length, 1);
  check("chủ thể là mặt LỚN NHẤT", mainFace(s).box.w, 0.3);

  // Đây là điều quan trọng: người ở rất xa nhắm mắt KHÔNG được làm hỏng tấm ảnh.
  check("người phía xa nhắm mắt → tấm vẫn 'ok'", judgeFaces(s).verdict, "ok");
  ok("… và mức nhắm báo cáo cũng chỉ tính mặt đủ lớn", judgeFaces(s).worstBlink === 0);
}

/* ═══ Nhắm mắt ═══════════════════════════════════════════════════════════════ */

{
  const blinked = shot("b", 0, [face(0.3, 0.82, 500)]);
  const j = judgeFaces(blinked);
  check("mắt khép rõ → 'blink'", j.verdict, "blink");
  ok("lý do nói ra SỐ ĐO, không chỉ một cái nhãn", /82%/.test(j.reason), j.reason);

  // Nhíu mắt khi cười KHÔNG phải nhắm mắt. Hạ ngưỡng là mọi tấm cười tươi đều
  // dính nhãn, và studio sẽ tắt cả tính năng.
  check("nhíu mắt khi cười (0.42) → vẫn 'ok'", judgeFaces(shot("c", 0, [face(0.3, 0.42, 500)])).verdict, "ok");
  check("đúng ngay tại ngưỡng → tính là nhắm",
    judgeFaces(shot("d", 0, [face(0.3, FACE_DEFAULTS.blinkClosed, 500)])).verdict, "blink");

  // Một bên nhắm cũng là nhắm — lấy mắt khép NHIỀU HƠN, không lấy trung bình.
  const oneEye = shot("e", 0, [face(0.3, 0.9, 500), face(0.3, 0.02, 500)]);
  check("hai người, một người nhắm → cả tấm là 'blink'", judgeFaces(oneEye).verdict, "blink");
  check("… và lý do nói rõ có mấy người", judgeFaces(oneEye).subjects, 2);
}

/* ═══ Mặt nhoè trong khi nền nét ═════════════════════════════════════════════ */

{
  // Đúng tình huống bộ đo cũ mù hoàn toàn: khung nét căng (lá cây, gạch tường),
  // mặt thì nhoè vì lấy nét trượt ra sau lưng.
  const missed = shot("f", 0, [face(0.3, 0.05, 40)], 800);
  const j = judgeFaces(missed);
  check("nền nét, mặt nhoè → 'soft_face'", j.verdict, "soft_face");
  ok("lý do đặt CẢ HAI số cạnh nhau để đối chiếu", /40/.test(j.reason) && /800/.test(j.reason), j.reason);

  // Chân dung nền trơn: điểm khung thấp vì nền ít cạnh, KHÔNG phải vì mặt nhoè.
  check("chân dung nền trơn (khung 120, mặt 100) → 'ok'",
    judgeFaces(shot("g", 0, [face(0.35, 0.05, 100)], 120)).verdict, "ok");

  // Cả tấm vốn mềm (thiếu sáng, ISO cao) thì không đổ cho khuôn mặt.
  check("cả khung đều mềm → không kết luận 'mặt nhoè'",
    judgeFaces(shot("h", 0, [face(0.3, 0.05, 20)], 45)).verdict, "ok");

  // Kém tương đối nhưng vẫn nét TUYỆT ĐỐI thì thôi — mặt người vốn ít cạnh hơn
  // nền chi tiết, xét mỗi tỉ lệ là báo oan hàng loạt.
  check("mặt nét 300 trên nền cực nét 900 → vẫn 'ok'",
    judgeFaces(shot("i", 0, [face(0.3, 0.05, 300)], 900)).verdict, "ok");

  // Nhắm mắt THẮNG mặt nhoè: mắt khép là chắc chắn, "nhoè" luôn có vùng xám.
  check("vừa nhắm mắt vừa mặt nhoè → xếp 'blink'",
    judgeFaces(shot("j", 0, [face(0.3, 0.9, 40)], 800)).verdict, "blink");
}

/* ═══ Không có mặt ═══════════════════════════════════════════════════════════ */

{
  check("không mặt nào → 'no_face'", judgeFaces(shot("k", 0, [])).verdict, "no_face");
  const far = judgeFaces(shot("l", 0, [face(0.04, 0.9, 200)]));
  check("chỉ có mặt ở rất xa → cũng 'no_face'", far.verdict, "no_face");
  ok("… và lý do nói rõ là 'ở rất xa', không phải 'không có mặt'",
    /rất xa/.test(far.reason), far.reason);
  check("không mặt nào thì điểm nét mặt là 0", judgeFaces(shot("m", 0, [])).faceSharpness, 0);
}

/* ═══ CHỌN BẢN NÊN GIỮ — phần quan trọng nhất ════════════════════════════════ */

{
  // Đúng cảnh mà cả tính năng sinh ra để sửa: tấm NÉT NHẤT là tấm nhắm mắt.
  const burst = [
    shot("x1", 0, [face(0.3, 0.05, 380)], 700),  // mắt mở, hơi kém nét
    shot("x2", 1, [face(0.3, 0.95, 520)], 900),  // NÉT NHẤT — nhưng nhắm mắt
    shot("x3", 2, [face(0.3, 0.10, 300)], 640),
  ];
  check("bộ đo cũ sẽ chọn tấm nét nhất; luật mặt chọn tấm MẮT MỞ",
    pickFaceKeeper(burst).key, "x1");
  ok("và tấm nhắm mắt KHÔNG được chọn dù nét nhất cả khung",
    pickFaceKeeper(burst).key !== "x2");

  // Cùng hạng "mắt mở" thì MẶT nét hơn thắng, không phải khung nét hơn.
  const two = [
    shot("y1", 0, [face(0.3, 0.05, 200)], 900), // khung nét hơn, mặt nhoè hơn
    shot("y2", 1, [face(0.3, 0.05, 460)], 500), // khung kém nét, MẶT nét hơn
  ];
  check("mắt đều mở → mặt nét hơn thắng khung nét hơn", pickFaceKeeper(two).key, "y2");

  // Ngang nhau hoàn toàn → lấy tấm bấm TRƯỚC (ổn định, không phụ thuộc thứ tự mảng).
  const tie = [
    shot("z2", 5, [face(0.3, 0.05, 300)], 600),
    shot("z1", 1, [face(0.3, 0.05, 300)], 600),
  ];
  check("hoàn toàn ngang nhau → lấy tấm bấm trước", pickFaceKeeper(tie).key, "z1");

  // CẢ chuỗi đều nhắm mắt: không có tấm nào "mắt mở" để ưu tiên, rơi về mặt nét.
  const allBlink = [
    shot("w1", 0, [face(0.3, 0.9, 200)], 600),
    shot("w2", 1, [face(0.3, 0.8, 450)], 500),
  ];
  check("cả chuỗi đều nhắm → chọn tấm mặt nét nhất", pickFaceKeeper(allBlink).key, "w2");

  check("chuỗi rỗng → null", pickFaceKeeper([]), null);
}

/* ═══ Khi nào khuôn mặt ĐƯỢC quyền quyết định ════════════════════════════════ */

{
  const scenery = [
    shot("s1", 0, [], 700),
    shot("s2", 1, [face(0.03, 0.9, 100)], 900), // chỉ có người ở rất xa
  ];
  check("chuỗi ảnh phong cảnh → khuôn mặt KHÔNG có ý kiến", faceDecides(scenery), false);
  check("… nên betterKeeper trả null để giữ nguyên bộ đo cũ", betterKeeper(scenery), null);

  const portraits = [
    shot("p1", 0, [face(0.3, 0.9, 500)], 800),
    shot("p2", 1, [face(0.3, 0.05, 300)], 600),
  ];
  check("chuỗi có mặt → khuôn mặt được quyết", faceDecides(portraits), true);
  check("… và nó chọn tấm mắt mở", betterKeeper(portraits).key, "p2");
}

/* ═══ Tổng kết ═══════════════════════════════════════════════════════════════ */

{
  const js = [
    judgeFaces(shot("a", 0, [face(0.3, 0.05, 400)], 600)),
    judgeFaces(shot("b", 1, [face(0.3, 0.9, 400)], 600)),
    judgeFaces(shot("c", 2, [face(0.3, 0.05, 30)], 800)),
    judgeFaces(shot("d", 3, [], 600)),
  ];
  check("tổng kết đếm đúng từng loại",
    summarizeFaces(js, 2),
    { scanned: 4, withFaces: 3, blink: 1, softFace: 1, noFace: 1, keepersChanged: 2 });
  check("lô rỗng → tổng kết toàn 0, không nổ",
    summarizeFaces([]),
    { scanned: 0, withFaces: 0, blink: 0, softFace: 0, noFace: 0, keepersChanged: 0 });
}

/* ═══ Dữ liệu rác không được làm nổ ══════════════════════════════════════════ */

{
  const junk = { key: "j", name: "j.JPG", index: 0, faces: undefined, frameSharpness: 0 };
  check("thiếu hẳn mảng mặt → 'no_face', không ném lỗi", judgeFaces(junk).verdict, "no_face");
  const noBlink = shot("n", 0, [{ box: { x: 0, y: 0, w: 0.3, h: 0.3 }, sharpness: 300 }], 600);
  check("thiếu trường blink → coi như 0, không phải NaN", judgeFaces(noBlink).worstBlink, 0);
  const neg = shot("o", 0, [{ box: { x: 0, y: 0, w: -1, h: 0.3 }, blink: 0.9, sharpness: 1 }], 600);
  check("khung mặt âm → diện tích 0, bị loại khỏi chủ thể", judgeFaces(neg).subjects, 0);
}

/* ═══ Ghép vào kết luận của bộ đo cũ ═════════════════════════════════════════ */

const jd = (key, group, keeper, verdict, reason = "…", sharpness = 500) =>
  ({ key, name: `${key}.JPG`, group, keeper, verdict, reason, sharpness });

{
  // Chuỗi ba tấm. Bộ đo cũ chọn m2 (nét nhất cả khung) — mà m2 là tấm nhắm mắt.
  const old = [
    jd("m1", 1, false, "duplicate"),
    jd("m2", 1, true, "keep"),
    jd("m3", 1, false, "duplicate"),
  ];
  const fm = [
    shot("m1", 0, [face(0.3, 0.05, 380)], 700),
    shot("m2", 1, [face(0.3, 0.95, 520)], 900),
    shot("m3", 2, [face(0.3, 0.10, 300)], 640),
  ];
  const r = applyFaces(old, fm);
  const by = Object.fromEntries(r.judgements.map((j) => [j.key, j]));
  check("bản nên giữ chuyển sang tấm mắt mở", by.m1.keeper, true);
  check("tấm nhắm mắt thôi làm bản nên giữ", by.m2.keeper, false);
  check("… và bị xếp là trùng chuỗi", by.m2.verdict, "duplicate");
  check("đếm đúng số chuỗi bị đổi bản nên giữ", r.keepersChanged, 2);
  ok("lý do của bản mới nói RÕ là do khuôn mặt", /khuôn mặt/i.test(by.m1.reason), by.m1.reason);
  ok("lý do của tấm bị bỏ nói RÕ là nhắm mắt", /nhắm mắt/i.test(by.m2.reason), by.m2.reason);

  // Tấm vốn đã bị bỏ và vẫn bị bỏ: giữ nguyên vai, nhưng thêm lý do khuôn mặt.
  ok("tấm bị bỏ sẵn cũng được ghi thêm lý do khuôn mặt nếu có", by.m3.reason.length > 0);
}

{
  // Chuỗi KHÔNG có mặt (ảnh chi tiết váy): khuôn mặt không được đụng vào.
  const old = [jd("d1", 2, true, "keep", "nét nhất chuỗi"), jd("d2", 2, false, "duplicate", "trùng")];
  const fm = [shot("d1", 0, [], 700), shot("d2", 1, [], 800)];
  const r = applyFaces(old, fm);
  check("chuỗi không có mặt → giữ nguyên bản nên giữ cũ", r.judgements[0].keeper, true);
  check("… và không đổi lý do", r.judgements[0].reason, "nét nhất chuỗi");
  check("… và không đếm là có thay đổi", r.keepersChanged, 0);
}

{
  // Tấm ĐỨNG RIÊNG nhắm mắt: hạ xuống "xem lại", KHÔNG phải "nên loại".
  // Đứng riêng nghĩa là không có bản nào khác của khoảnh khắc đó.
  const old = [jd("s1", null, false, "keep", "ổn")];
  const r = applyFaces(old, [shot("s1", 0, [face(0.3, 0.9, 400)], 600)]);
  check("tấm đứng riêng nhắm mắt → 'xem lại'", r.judgements[0].verdict, "review");
  ok("… KHÔNG bị đẩy thành 'nên loại'", r.judgements[0].verdict !== "reject");
  ok("… và mang đúng lý do khuôn mặt", /nhắm mắt/i.test(r.judgements[0].reason));

  const soft = applyFaces([jd("s2", null, false, "keep", "ổn")], [shot("s2", 0, [face(0.3, 0.05, 40)], 800)]);
  check("tấm đứng riêng mặt nhoè → 'xem lại'", soft.judgements[0].verdict, "review");
}

{
  // KHÔNG BAO GIỜ nâng hạng: khung đen thui vẫn "nên loại" dù mô hình thấy mặt.
  const old = [jd("k1", null, false, "reject", "Khung gần như đen hoàn toàn.")];
  const r = applyFaces(old, [shot("k1", 0, [face(0.3, 0.02, 500)], 600)]);
  check("ảnh đã bị loại thì khuôn mặt không cứu", r.judgements[0].verdict, "reject");
  check("… và lý do cũ được giữ nguyên", r.judgements[0].reason, "Khung gần như đen hoàn toàn.");
}

{
  // Ảnh có trong bảng cũ nhưng KHÔNG quét được khuôn mặt (giải mã hỏng) —
  // không được biến mất, không được đổi hạng.
  const old = [jd("u1", null, false, "keep", "ổn"), jd("u2", 3, true, "keep", "nét nhất")];
  const r = applyFaces(old, []);
  check("ảnh không có dữ liệu khuôn mặt → giữ nguyên hoàn toàn", r.judgements, old);
  check("… và không đếm thay đổi nào", r.keepersChanged, 0);
  check("lô khuôn mặt rỗng → danh sách kết luận mặt cũng rỗng", r.faceJudgements, []);
}

{
  // Bản nên giữ cũ TÌNH CỜ đã đúng: không được đếm là "đã đổi".
  const old = [jd("g1", 4, true, "keep"), jd("g2", 4, false, "duplicate")];
  const fm = [shot("g1", 0, [face(0.3, 0.05, 500)], 700), shot("g2", 1, [face(0.3, 0.9, 300)], 600)];
  const r = applyFaces(old, fm);
  check("bản cũ đã đúng → không đếm là đổi", r.keepersChanged, 0);
  check("… và vẫn là bản nên giữ", r.judgements[0].keeper, true);
}

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
