/* Kiểm thử LỌC ẢNH BẰNG AI.
 *
 * Tính năng này ĐỀ NGHỊ XOÁ FILE ẢNH CƯỚI của khách, nên sai một chiều nào cũng
 * đắt — và hai chiều đắt khác nhau:
 *
 *  - Loại oan (ảnh tốt bị xếp "nhoè"): studio xoá mất một tấm không có bản thứ
 *    hai. Đây là chiều KHÔNG ĐƯỢC PHÉP sai, nên phần lớn kiểm thử dưới đây là
 *    các ca "ảnh này KHÔNG được bị loại".
 *  - Bỏ sót (ảnh nhoè vẫn xếp "giữ"): studio mất thêm mấy giây bấm tay. Rẻ.
 *
 * Nên ngưỡng loại đòi ảnh phải tệ CẢ tuyệt đối LẪN tương đối so với chính lô ảnh
 * đó. Hai ca then chốt ở đây là "cả lô ảnh mềm" và "cả lô ảnh siêu nét": cả hai
 * đều làm sập một bộ ngưỡng chỉ có mức tuyệt đối.
 *
 * Phần đo (Laplacian, dHash) được kiểm bằng ẢNH DỰNG SẴN bằng số học — không cần
 * file ảnh thật, và chạy được bằng node. Nạp thẳng code thật ở src/lib/photo-ai.ts.
 */
import {
  AI_DEFAULTS,
  dhash,
  cropRect,
  duplicateGroups,
  subGray,
  duplicatesToHide,
  groupDuplicates,
  hamming,
  hashDetail,
  histogramStats,
  judge,
  laplacianVariance,
  measure,
  median,
  namesToRemove,
  pickKeeper,
  resampleGray,
} from "../../src/lib/photo-ai.ts";

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

/* ═══ Ảnh dựng sẵn ═══════════════════════════════════════════════════════════ */

const W = 64;
const H = 48;
const img = (fn) => {
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = Math.max(0, Math.min(255, Math.round(fn(x, y))));
  return g;
};

const FLAT = img(() => 128);                                   // phẳng tuyệt đối
const CHECKER = img((x, y) => ((x + y) % 2 ? 230 : 25));       // cạnh dày đặc = rất nét
const SOFT_RAMP = img((x) => 40 + (x / W) * 160);              // chuyển dần = mềm
const STRIPES = img((x) => (Math.floor(x / 8) % 2 ? 210 : 45)); // sọc dọc rộng
const BLACK = img(() => 2);
const WHITE = img(() => 253);

/* ═══ Điểm nét ═══════════════════════════════════════════════════════════════ */

check("ảnh phẳng tuyệt đối → điểm nét 0", laplacianVariance(FLAT, W, H), 0);
ok("bàn cờ (cạnh dày) nét hơn hẳn ảnh chuyển dần",
  laplacianVariance(CHECKER, W, H) > laplacianVariance(SOFT_RAMP, W, H) * 100,
  `checker=${laplacianVariance(CHECKER, W, H)} ramp=${laplacianVariance(SOFT_RAMP, W, H)}`);
ok("sọc rộng có cạnh → nét hơn ảnh chuyển dần",
  laplacianVariance(STRIPES, W, H) > laplacianVariance(SOFT_RAMP, W, H));
ok("điểm nét không bao giờ âm (sai số dấu phẩy động)", laplacianVariance(SOFT_RAMP, W, H) >= 0);
check("ảnh bé hơn 3px → 0, không nổ", laplacianVariance(new Uint8Array(4), 2, 2), 0);

/* ═══ Phơi sáng ══════════════════════════════════════════════════════════════ */

{
  const s = histogramStats(FLAT);
  check("ảnh xám 128 → sáng 128, không kẹp đầu nào", [s.brightness, s.clipLow, s.clipHigh], [128, 0, 0]);
}
check("ảnh đen thui → kẹp đen 100%", histogramStats(BLACK).clipLow, 1);
check("ảnh trắng xoá → kẹp trắng 100%", histogramStats(WHITE).clipHigh, 1);
check("ảnh rỗng → không chia cho 0", histogramStats(new Uint8Array(0)), { brightness: 0, clipLow: 0, clipHigh: 0 });

/* ═══ Thu nhỏ & dHash ════════════════════════════════════════════════════════ */

check("thu nhỏ ra đúng kích thước", resampleGray(FLAT, W, H, 9, 8).length, 72);
check("thu nhỏ ảnh phẳng → vẫn phẳng", [...new Set(resampleGray(FLAT, W, H, 9, 8))], [128]);
check("hash dài 32 ký tự hex (128 bit, hai chiều)", dhash(STRIPES, W, H).length, 32);
ok("hash chỉ gồm ký tự hex", /^[0-9a-f]{32}$/.test(dhash(STRIPES, W, H)));

check("hash của chính nó → khoảng cách 0", hamming(dhash(STRIPES, W, H), dhash(STRIPES, W, H)), 0);
check("hai mã dài khác nhau → trả khoảng cách tối đa (khác hẳn)", hamming("abcd", "abcdef0123456789"), 64);
check("mã 64 bit lẫn với mã 128 bit → khác hẳn, không gom bừa", hamming("f".repeat(16), "f".repeat(32)), 128);
check("mã rỗng → khác hẳn", hamming("", "abcdef0123456789"), 64);
check("mọi bit khác nhau → 128", hamming("f".repeat(32), "0".repeat(32)), 128);
check("khác đúng một bit → 1", hamming("0".repeat(31) + "1", "0".repeat(32)), 1);

{
  // dHash so hai điểm CẠNH NHAU nên bất biến khi cả ảnh sáng/tối đi — đúng thứ
  // cần, vì hai tấm trong một chuỗi bấm thường lệch nhau chút phơi sáng.
  const darker = img((x) => (Math.floor(x / 8) % 2 ? 210 : 45) - 30);
  check("cùng khung, chỉ tối hơn 30 mức → cùng một hash", dhash(STRIPES, W, H), dhash(darker, W, H));
}
{
  // Thêm nhiễu nhẹ: hash phải gần như không đổi (đây là chỗ "lấy điểm gần nhất"
  // thay cho "trung bình ô" sẽ làm tính năng gom ảnh trùng hết tác dụng).
  const noisy = img((x, y) => (Math.floor(x / 8) % 2 ? 210 : 45) + ((x * 7 + y * 13) % 9) - 4);
  ok("cùng khung + nhiễu nhẹ → hash vẫn rất gần",
    hamming(dhash(STRIPES, W, H), dhash(noisy, W, H)) <= AI_DEFAULTS.dupDistance,
    `khoảng cách=${hamming(dhash(STRIPES, W, H), dhash(noisy, W, H))}`);
}
{
  const other = img((x, y) => (Math.floor(y / 6) % 2 ? 220 : 30)); // sọc NGANG
  ok("khung khác hẳn (sọc ngang vs sọc dọc) → hash xa nhau",
    hamming(dhash(STRIPES, W, H), dhash(other, W, H)) > AI_DEFAULTS.dupDistance,
    `khoảng cách=${hamming(dhash(STRIPES, W, H), dhash(other, W, H))}`);
}

/* ═══ measure() nối các phần lại ═════════════════════════════════════════════ */

{
  const m = measure({ key: "k1", name: "IMG_001.JPG", index: 0, gray: CHECKER, width: W, height: H });
  check("measure giữ nguyên khoá/tên/thứ tự", [m.key, m.name, m.index], ["k1", "IMG_001.JPG", 0]);
  ok("measure có đủ điểm nét + hash", m.sharpness > 0 && /^[0-9a-f]{32}$/.test(m.hash));
}

/* ═══ Trung vị ═══════════════════════════════════════════════════════════════ */

check("trung vị số lẻ phần tử", median([5, 1, 3]), 3);
check("trung vị số chẵn phần tử", median([1, 3, 5, 7]), 4);
check("danh sách rỗng → 0", median([]), 0);
{
  // Đây là lý do dùng trung vị chứ không dùng trung bình: một tấm chụp lỡ (điểm
  // nét 0) kéo trung bình xuống 375 — mốc đó thấp đến mức không loại được gì.
  const lo = [500, 520, 480, 0];
  const mean = lo.reduce((a, b) => a + b, 0) / lo.length;
  check("một tấm chụp lỡ đen thui gần như không xê dịch trung vị", median(lo), 490);
  ok("…trong khi trung bình bị kéo sập", mean === 375);
}

/* ═══ Gom ảnh trùng ══════════════════════════════════════════════════════════ */

// `hashBits` = số bit 1 của mã hash; mặc định lấy đúng từ mã truyền vào để các
// ca dưới đây phản ánh thật. Luật "mã suy biến thì không gom" kiểm riêng ở dưới.
const popcount = (hex) => [...hex].reduce((n, c) => n + parseInt(c, 16).toString(2).replace(/0/g, "").length, 0);
const met = (key, index, hash, sharpness, extra = {}) => ({
  key, name: `${key}.JPG`, index, hash, sharpness,
  brightness: 128, clipHigh: 0, clipLow: 0, hashBits: popcount(hash), ...extra,
});

{
  const list = [
    met("a", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500),
    met("b", 1, "f0e1c3870f1e3c783c78f0e1c3870f1e", 800), // y hệt a
    met("c", 2, "0f1e3c78f0e1c387c3870f1e3c78f0e1", 600), // khác hẳn
  ];
  check("hai ảnh giống nhau vào cùng nhóm, ảnh lẻ đứng riêng", groupDuplicates(list), [1, 1, -1]);
  check("bản nên giữ của nhóm = tấm nét nhất", pickKeeper([list[0], list[1]]).key, "b");
}

{
  // Cửa sổ: hai ảnh giống nhau nhưng cách nhau xa KHÔNG phải một chuỗi bấm —
  // cùng một góc phòng cưới chụp lại sau hai tiếng. Chặn theo VỊ TRÍ TRONG THƯ
  // MỤC, kể cả khi lô quét chỉ có đúng hai tấm đó (studio quét một phần thư mục).
  const far = [met("a", 4, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500), met("z", 99, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500)];
  check("cách nhau 95 vị trí thư mục, cửa sổ 12 → KHÔNG gom", groupDuplicates(far), [-1, -1]);
  check("cửa sổ 0 (so tất cả) → có gom", groupDuplicates(far, { dupWindow: 0 }), [1, 1]);
  check("cùng khoảng cách đó nhưng nới cửa sổ lên 200 → gom", groupDuplicates(far, { dupWindow: 200 }), [1, 1]);
}

{
  // Chặn theo SỐ TẤM TRONG LÔ: quét cả thư mục, tấm đầu và tấm thứ 14 giống nhau
  // nhưng 12 tấm ở giữa khác hẳn → không phải chuỗi bấm.
  const long = [met("dau", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500)];
  // Mười ba mã ở giữa: khác nhau rõ và không suy biến (mỗi mã ~32 bit 1).
  for (let i = 1; i <= 13; i++) long.push(met(`k${i}`, i, ((0x0f1e3c78f0e1c387c3870f1e3c78f0e1n * BigInt(i)) & ((1n << 128n) - 1n)).toString(16).padStart(32, "0"), 500));
  long.push(met("cuoi", 14, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500));
  const g = groupDuplicates(long);
  check("tấm đầu và tấm thứ 14 giống nhau, cửa sổ 12 → KHÔNG gom", [g[0], g[g.length - 1]], [-1, -1]);
}

{
  // Bắc cầu: a≈b, b≈c nhưng a có thể xa c — chuỗi bấm dài phải về CÙNG một nhóm,
  // nếu không studio nhận hai nhóm và giữ lại hai bản của cùng một khung.
  // a↔b lệch 8 bit, b↔c lệch 8 bit, nhưng a↔c lệch 16 bit (quá ngưỡng) — nên
  // chúng chỉ về được cùng nhóm nếu union-find BẮC CẦU đúng.
  const chain = [
    met("a", 0, "f0e1c3870f1e3c78" + "3c78f0e100000000", 100),
    met("b", 1, "f0e1c3870f1e3c78" + "3c78f0e10000ffff", 200),
    met("c", 2, "f0e1c3870f1e3c78" + "3c78f0e1ffffffff", 300),
  ];
  check("chuỗi bấm dài gom về một nhóm (bắc cầu)", groupDuplicates(chain), [1, 1, 1]);
}

check("danh sách rỗng → không nhóm nào", groupDuplicates([]), []);

{
  // Danh sách đưa vào không theo thứ tự index: kết quả phải theo index, không
  // theo thứ tự mảng (FilterTool sắp lại danh sách theo nhiều cách).
  const shuffled = [met("b", 5, "f0e1c3870f1e3c783c78f0e1c3870f1e", 800), met("a", 4, "f0e1c3870f1e3c783c78f0e1c3870f1e", 500)];
  check("mảng đưa vào lộn thứ tự → vẫn gom đúng", groupDuplicates(shuffled), [1, 1]);
}

/* ═══ Mã hash SUY BIẾN thì KHÔNG được gom ════════════════════════════════════
   Đây là chiều sai đắt nhất. dHash chỉ hỏi "trái có sáng hơn phải không", nên
   MỌI ảnh có độ sáng đổi đều một chiều (nền trời chiều, mảng tường, hắt sáng cửa
   sổ, khung đen thui) đều ra mã 0000…0000 — hai tấm khác nhau hoàn toàn vẫn cho
   khoảng cách Hamming 0. Không có chốt này thì công cụ đề nghị studio xoá một
   tấm ảnh không hề trùng. */

{
  const smooth = [
    met("troi-chieu", 0, "00000000000000000000000000000000", 500),
    met("mang-tuong", 1, "00000000000000000000000000000000", 500),
  ];
  check("hai ảnh chuyển sáng một chiều, cùng mã 0000…: KHÔNG gom", groupDuplicates(smooth), [-1, -1]);
  const r = judge(smooth);
  check("…nên cả hai được giữ, không tấm nào bị gọi là trùng", r.summary.duplicate, 0);
}

check(
  "mã toàn 1 (chuyển sáng chiều ngược lại) cũng suy biến → KHÔNG gom",
  groupDuplicates([met("a", 0, "ffffffffffffffffffffffffffffffff", 500), met("b", 1, "ffffffffffffffffffffffffffffffff", 500)]),
  [-1, -1]
);

{
  // Một đầu suy biến, một đầu bình thường: cặp đó vẫn không gom.
  const mixed = [
    met("suy-bien", 0, "00000000000000000000000000000000", 500),
    met("binh-thuong", 1, "00000000000000030000000000000003", 500, { hashBits: 40 }),
  ];
  check("một đầu suy biến → cặp đó không gom", groupDuplicates(mixed), [-1, -1]);
}

check(
  "hạ minHashBits về 0 → gom trở lại (chốt là ngưỡng, không phải điều kiện chôn cứng)",
  groupDuplicates([met("a", 0, "00000000000000000000000000000000", 500), met("b", 1, "00000000000000000000000000000000", 500)], { minHashBits: 0 }),
  [1, 1]
);

{
  // hashDetail đo trực tiếp trên ảnh dựng sẵn — và đây là chỗ chỉ ra vì sao một
  // chốt kiểu "đếm cặp điểm chênh nhau" KHÔNG bắt được ca này.
  const flat = hashDetail(FLAT, W, H);
  check("ảnh phẳng → mã toàn 0, 0 bit", [flat.hash, flat.hashBits], ["00000000000000000000000000000000", 0]);
  const ramp = hashDetail(SOFT_RAMP, W, H);
  check("nền chuyển dần trái→phải cũng ra mã toàn 0 (đúng cái bẫy)", ramp.hash, "00000000000000000000000000000000");
  check("…dù TƯƠNG PHẢN của nó rất cao — nên 'thiếu tương phản' là chốt sai", ramp.hashBits, 0);
  ok("dải chuyển sáng đó thật sự có tương phản mạnh",
    Math.max(...SOFT_RAMP) - Math.min(...SOFT_RAMP) > 100);
  const stripes = hashDetail(STRIPES, W, H);
  ok("ảnh có sọc → mã đủ bit, đáng tin",
    stripes.hashBits >= AI_DEFAULTS.minHashBits && stripes.hashBits <= 128 - AI_DEFAULTS.minHashBits,
    `hashBits=${stripes.hashBits}`);
  check("dhash() và hashDetail().hash luôn khớp", dhash(STRIPES, W, H), stripes.hash);
}

{
  const measured = measure({ key: "k", name: "n.JPG", index: 0, gray: STRIPES, width: W, height: H });
  ok("measure() có kèm hashBits", measured.hashBits > 0);
}

{
  const tie = [met("a", 0, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500, { clipHigh: 0.3 }), met("b", 1, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500)];
  check("bằng điểm nét → giữ tấm phơi sáng lành hơn", pickKeeper(tie).key, "b");
  const tie2 = [met("a", 0, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500), met("b", 1, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500)];
  check("bằng cả nét lẫn phơi sáng → giữ tấm bấm trước", pickKeeper(tie2).key, "a");
}
check("nhóm rỗng → không có bản giữ", pickKeeper([]), null);

/* ═══ Kết luận: CHIỀU KHÔNG ĐƯỢC SAI ═════════════════════════════════════════ */

const verdicts = (r) => r.judgements.map((j) => `${j.key}:${j.verdict}`);

{
  // Cả lô ảnh MỀM (chụp phim, bokeh dày). Một bộ ngưỡng chỉ có mức tuyệt đối
  // (blurFloor = 60) sẽ loại SẠCH lô này.
  const soft = [met("a", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 40), met("b", 1, "f0f0f0f000000000f0f0f0f000000000", 45), met("c", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 38)];
  const r = judge(soft);
  check("cả lô ảnh mềm → KHÔNG loại tấm nào", r.summary.reject, 0);
  ok("cả lô ảnh mềm → cũng không dồn hết vào 'xem lại'", r.summary.keep >= 2, JSON.stringify(verdicts(r)));
}

{
  // Cả lô SIÊU NÉT, một tấm 300 điểm. Tuyệt đối thì 300 rất nét; tương đối thì
  // nó mềm hơn lô. Phải là "xem lại", KHÔNG được loại.
  const sharp = [met("a", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 900), met("b", 1, "f0f0f0f000000000f0f0f0f000000000", 950), met("c", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 300)];
  const r = judge(sharp);
  check("lô siêu nét, tấm mềm nhất → xem lại chứ không loại", r.judgements.find((j) => j.key === "c").verdict, "review");
  check("lô siêu nét → không loại tấm nào", r.summary.reject, 0);
}

{
  // Tấm nhoè thật giữa một lô nét: tệ cả tuyệt đối lẫn tương đối.
  const mixed = [met("a", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 600), met("b", 1, "f0f0f0f000000000f0f0f0f000000000", 550), met("c", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 20)];
  const r = judge(mixed);
  check("ảnh nhoè thật giữa lô nét → loại", r.judgements.find((j) => j.key === "c").verdict, "reject");
  ok("lý do nói rõ cả điểm nét lẫn trung vị lô",
    /điểm nét 20/.test(r.judgements.find((j) => j.key === "c").reason) &&
    /trung vị cả lô/.test(r.judgements.find((j) => j.key === "c").reason));
}

/* ═══ Kết luận: các nhánh còn lại ════════════════════════════════════════════ */

{
  const frames = [
    met("den", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 500, { brightness: 4, clipLow: 0.99 }),
    met("trang", 1, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500, { brightness: 250, clipHigh: 0.99 }),
    met("ok", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 500),
  ];
  const r = judge(frames);
  check("khung đen thui / trắng xoá → loại, ảnh thường → giữ", verdicts(r), ["den:reject", "trang:reject", "ok:keep"]);
  ok("khung đen thui được gọi đúng tên", /đen hoàn toàn/.test(r.judgements[0].reason));
}

{
  const exposure = [
    met("toi", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 500, { brightness: 30, clipLow: 0.5 }),
    met("chay", 1, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 500, { clipHigh: 0.4 }),
    met("nguoc-sang-nhe", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 500, { clipHigh: 0.1 }),
  ];
  const r = judge(exposure);
  check("tối / cháy sáng → xem lại (không loại); cháy nhẹ → vẫn giữ",
    verdicts(r), ["toi:review", "chay:review", "nguoc-sang-nhe:keep"]);
}

{
  const burst = [
    met("shot1", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 300),
    met("shot2", 1, "f0e1c3870f1e3c783c78f0e1c3870f1e", 900),
    met("shot3", 2, "f0e1c3870f1e3c783c78f0e1c3870f1e", 400),
  ];
  const r = judge(burst);
  check("chuỗi bấm 3 tấm → giữ bản nét nhất, hai bản kia là trùng",
    verdicts(r), ["shot1:duplicate", "shot2:keep", "shot3:duplicate"]);
  check("đánh dấu đúng bản nên giữ", r.judgements.map((j) => j.keeper), [false, true, false]);
  check("cùng một số nhóm", r.judgements.map((j) => j.group), [1, 1, 1]);
  ok("lý do gọi TÊN bản được giữ, để studio đối chiếu được",
    /shot2\.JPG/.test(r.judgements[0].reason), r.judgements[0].reason);
  check("một nhóm trùng", r.summary.groups, 1);
}

{
  // Ảnh vừa trùng vừa nhoè: "loại" thắng "trùng". Cả hai đều nghĩa là bỏ, nhưng
  // studio đọc lý do "nhoè" thì hiểu ngay, còn "trùng" thì lại đi tìm bản kia.
  const both = [met("a", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 800), met("b", 1, "f0e1c3870f1e3c783c78f0e1c3870f1e", 15), met("c", 2, "0000ffff0000ffff0000ffff0000ffff", 700)];
  const r = judge(both);
  check("vừa trùng vừa nhoè → xếp 'loại' kèm lý do nhoè", r.judgements[1].verdict, "reject");
  ok("và lý do là nhoè, không phải trùng", /Nhoè/.test(r.judgements[1].reason), r.judgements[1].reason);
}

{
  const r = judge([]);
  check("lô rỗng → tổng kết toàn 0, không nổ",
    [r.summary.total, r.summary.keep, r.summary.groups, r.summary.medianSharpness], [0, 0, 0, 0]);
}

{
  const one = judge([met("a", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 5)]);
  check("chỉ một ảnh, dù rất mềm → không loại (không có gì để so tương đối)", one.summary.reject, 0);
}

/* ═══ Danh sách đưa sang công cụ Lọc ảnh ═════════════════════════════════════ */

{
  const list = [
    met("giu", 0, "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 600),
    met("nhoe", 1, "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0", 15),
    met("trung1", 2, "00ff00ff00ff00ff00ff00ff00ff00ff", 700),
    met("trung2", 3, "00ff00ff00ff00ff00ff00ff00ff00ff", 500),
    met("xemlai", 4, "aa55aa55aa55aa55aa55aa55aa55aa55", 600, { clipHigh: 0.4 }),
  ];
  const r = judge(list);
  check("danh sách nên loại = trùng + nhoè, KHÔNG gồm 'xem lại'",
    namesToRemove(r.judgements).sort(), ["nhoe.JPG", "trung2.JPG"]);
  check("tổng kết đếm khớp từng loại",
    [r.summary.total, r.summary.keep, r.summary.review, r.summary.duplicate, r.summary.reject],
    [5, 2, 1, 1, 1]);
}

/* ═══ Nhóm trùng cho MÀN KHÁCH (không kèm kết luận xấu/đẹp) ══════════════════ */

{
  const list = [
    met("a1", 0, "f0e1c3870f1e3c783c78f0e1c3870f1e", 400),
    met("a2", 1, "f0e1c3870f1e3c783c78f0e1c3870f1e", 900), // nét nhất của chuỗi
    met("a3", 2, "f0e1c3870f1e3c783c78f0e1c3870f1e", 550),
    met("le", 3, "0f1e3c78f0e1c387c3870f1e3c78f0e1", 600), // đứng riêng
    met("b1", 4, "aa55aa55aa55aa55aa55aa55aa55aa55", 300),
    met("b2", 5, "aa55aa55aa55aa55aa55aa55aa55aa55", 310),
  ];
  const g = duplicateGroups(list);
  check("hai chuỗi, ảnh lẻ KHÔNG thành nhóm", g.length, 2);
  check("chuỗi đầu đủ ba tấm, đúng thứ tự bấm", g[0].keys, ["a1", "a2", "a3"]);
  check("bản đề xuất là tấm nét nhất", g[0].bestKey, "a2");
  check("bản đề xuất luôn nằm trong nhóm", g.every((x) => x.keys.includes(x.bestKey)), true);
  ok("mọi nhóm có ít nhất hai tấm", g.every((x) => x.keys.length >= 2));

  // Đây là điểm khác `judge`: KHÔNG có nhãn nào, không tấm nào bị gọi là xấu.
  ok("nhóm trả về không mang kết luận nào về chất lượng ảnh",
    Object.keys(g[0]).sort().join(",") === "bestKey,keys");

  const hide = duplicatesToHide(g);
  check("ẩn mọi tấm trừ bản đề xuất", [...hide].sort(), ["a1", "a3", "b1"]);

  // Ảnh khách ĐÃ CHỌN không bao giờ bị ẩn — dù nó là bản trùng.
  const hideKeep = duplicatesToHide(g, new Set(["a1"]));
  ok("ảnh khách đã chọn thì không ẩn", !hideKeep.has("a1"));
  ok("… nhưng các tấm trùng khác vẫn ẩn", hideKeep.has("a3") && hideKeep.has("b1"));

  check("không nhóm nào → không ẩn gì", duplicatesToHide([]).size, 0);
}

{
  // Ảnh có mã hash SUY BIẾN (chuyển sáng đều một chiều) không được gom nhóm —
  // luật của groupDuplicates, và màn khách thừa hưởng nguyên vẹn.
  const flat = [
    met("g1", 0, "00000000000000000000000000000000", 500),
    met("g2", 1, "00000000000000000000000000000000", 500),
  ];
  check("hai ảnh mã hash toàn 0 KHÔNG bị coi là trùng", duplicateGroups(flat), []);
}

/* ═══ Ô cắt 1:1 để soi nét ═══════════════════════════════════════════════════ */

{
  // Giữa ảnh: ô cắt nằm đúng giữa.
  check("tâm giữa ảnh", cropRect(2000, 1000, 0.5, 0.5, 500), { sx: 750, sy: 250, w: 500, h: 500 });

  // Sát mép: ô cắt TRƯỢT VÀO, không thu nhỏ và không đòi điểm ảnh ngoài ảnh —
  // Chrome sẽ trả viền trong suốt nếu ta đòi.
  check("tâm sát mép trái/trên → trượt vào 0", cropRect(2000, 1000, 0, 0, 500), { sx: 0, sy: 0, w: 500, h: 500 });
  check("tâm sát mép phải/dưới → dừng ở mép", cropRect(2000, 1000, 1, 1, 500), { sx: 1500, sy: 500, w: 500, h: 500 });
  ok("ô cắt luôn nằm trọn trong ảnh", (() => {
    for (const cx of [-1, 0, 0.13, 0.5, 0.99, 1, 2]) {
      for (const cy of [-1, 0, 0.4, 1, 5]) {
        const r = cropRect(1200, 800, cx, cy, 520);
        if (r.sx < 0 || r.sy < 0 || r.sx + r.w > 1200 || r.sy + r.h > 800) return false;
      }
    }
    return true;
  })());

  // Ảnh NHỎ hơn ô cắt: lấy trọn chiều đó, không phóng to, không âm.
  check("ảnh nhỏ hơn ô cắt → lấy trọn", cropRect(300, 200, 0.5, 0.5, 520), { sx: 0, sy: 0, w: 300, h: 200 });
  check("ảnh hẹp một chiều", cropRect(300, 900, 0.5, 0.5, 520), { sx: 0, sy: 190, w: 300, h: 520 });

  // Đầu vào rác không được sinh ra ô cắt vô nghĩa (NaN lọt xuống createImageBitmap
  // là một exception, và khung so sánh sẽ chỉ hiện ô trống mãi mãi).
  const bad = cropRect(1200, 800, NaN, NaN, 520);
  ok("tâm là NaN → rơi về giữa ảnh", bad.sx === 340 && bad.sy === 140);
  ok("mọi số trả về đều là số nguyên hữu hạn",
    [bad.sx, bad.sy, bad.w, bad.h].every((v) => Number.isInteger(v)));
}

/* ═══ Cắt vùng xám (dùng cho phép đo nét trên khuôn mặt) ═════════════════════ */

{
  // Ảnh 10×10, giá trị = y*10 + x, để kiểm được cắt ĐÚNG CHỖ chứ không chỉ đúng cỡ.
  const g = Uint8Array.from({ length: 100 }, (_, i) => i);
  const mid = subGray(g, 10, 10, 0.2, 0.3, 0.4, 0.4);
  check("cắt đúng cỡ", [mid.width, mid.height], [4, 4]);
  check("cắt đúng CHỖ (góc trên-trái = hàng 3, cột 2)", mid.gray[0], 32);
  check("… và cuối hàng đầu là cột 5", mid.gray[3], 35);
  check("… hàng thứ hai nhảy đúng một dòng ảnh gốc", mid.gray[4], 42);

  // Vùng tràn ra ngoài phải bị kẹp lại, không đọc lem sang bộ nhớ khác.
  const over = subGray(g, 10, 10, 0.6, 0.6, 0.9, 0.9);
  check("vùng tràn mép → kẹp vào trong ảnh", [over.width, over.height], [4, 4]);
  check("… và lấy đúng góc dưới-phải", [...over.gray.slice(12)], [96, 97, 98, 99]);
  check("tràn mép tới mức còn dưới 3 điểm ảnh → null",
    subGray(g, 10, 10, 0.85, 0.85, 0.9, 0.9), null);

  // Không đo được thì phải nói KHÔNG BIẾT, không trả một con số bịa.
  check("vùng quá nhỏ (dưới 3 điểm ảnh) → null", subGray(g, 10, 10, 0.4, 0.4, 0.1, 0.1), null);
  check("vùng rỗng → null", subGray(g, 10, 10, 0.5, 0.5, 0, 0), null);
  check("vùng nằm hoàn toàn ngoài ảnh → null", subGray(g, 10, 10, 2, 2, 0.5, 0.5), null);
  check("ảnh rỗng → null", subGray(new Uint8Array(0), 0, 0, 0, 0, 1, 1), null);
  check("mảng ngắn hơn width×height → null", subGray(new Uint8Array(10), 10, 10, 0, 0, 1, 1), null);
  check("cắt trọn cả ảnh → đúng cỡ gốc", (() => { const a = subGray(g, 10, 10, 0, 0, 1, 1); return [a.width, a.height]; })(), [10, 10]);
}

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
