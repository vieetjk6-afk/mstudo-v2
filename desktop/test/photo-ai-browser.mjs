/* Kiểm thử ĐẦU-CUỐI phần lọc ảnh AI, chạy trong Chromium thật.
 *
 * Vì sao cần thêm bài này khi đã có desktop/test/photo-ai.mjs: bài kia chứng
 * minh PHÉP TOÁN đúng trên mảng số dựng sẵn. Nó không trả lời được câu hỏi thật
 * sự quan trọng — "một tấm ảnh nhoè THẬT, sau khi đi qua đúng đường giải mã của
 * @/lib/photo-ai-scan (createImageBitmap → thu nhỏ về 480px → OffscreenCanvas →
 * luminance), có rơi xuống dưới ngưỡng không?". Nếu không thì cả tính năng vô
 * dụng dù mọi kiểm thử đơn vị đều xanh.
 *
 * Cách chạy: sinh ảnh PNG bằng số học (không cần file ảnh mẫu trong repo), mở
 * Chromium, giải mã ĐÚNG cách bộ quét làm, mang mảng mức xám về node rồi cho
 * chạy qua đúng `measure()` + `judge()` của code thật.
 *
 *   npm run test:photo-ai-browser
 *
 * Cần Chromium nên KHÔNG nằm trong bộ kiểm thử chạy bằng node thuần. Máy đã có
 * sẵn trình duyệt thì đặt `CHROME_PATH` trỏ tới nó — cùng quy ước với
 * scripts/kiem-tra-giao-dien.mjs.
 */
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { AI_DEFAULTS, cropRect, judge, measure, SAMPLE_EDGE } from "../../src/lib/photo-ai.ts";

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

/* ── Bộ đóng PNG xám 8 bit (đủ để sinh ảnh mẫu, không thêm phụ thuộc nào) ──── */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function grayPng(gray, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type 0 = greyscale
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = gray[y * w + x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Ảnh mẫu: "cảnh" tổng hợp cỡ thật, rồi bản làm nhoè của chính nó ───────── */

const W = 1200;
const H = 800;

/**
 * Một "cảnh" có cạnh sắc, chi tiết mảnh và vùng phẳng — gần với ảnh chụp hơn là
 * bàn cờ đều tăm tắp: nếu chỉ thử bàn cờ thì phép thu nhỏ 480px có thể xoá hết
 * tần số cao và ta rút ra kết luận sai về cả tính năng.
 *
 * `layout` đổi CẤU TRÚC cảnh (chiều chuyển sáng, vị trí các khối, hướng/mật độ
 * sọc), không chỉ đổi hạt nhiễu. Lần đầu viết bài này mỗi seed chỉ đổi nhiễu,
 * nên sau khi thu về 9×8 để băm thì ba "cảnh khác nhau" ra CÙNG một hash — và
 * đúng ra chúng LÀ ảnh trùng thật. Muốn kiểm được "ảnh khác cảnh thì không bị
 * gom" thì cảnh phải khác nhau ở tầm nhìn của một ảnh 9×8, tức là ở khối lớn.
 */
function scene(layout = 0) {
  const g = new Uint8Array(W * H);
  let s = layout * 7919 + 13;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.hypot(cx, cy);
  // Sọc mảnh: chi tiết tần số cao, thứ phép đo độ nét sống bằng. Nó nằm ở TẦNG
  // CHI TIẾT nên gần như tan hết sau phép thu về 9×8 để băm — đúng như trên ảnh
  // thật, và vì thế nó không cứu được sự khác biệt giữa hai cảnh.
  const pitch = 5 + layout * 3;
  const vertical = layout % 2 === 1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // TẦNG BỐ CỤC — cái duy nhất còn sót lại ở 9×8, tức là cái quyết định hash.
      // Mỗi layout là một bố cục KHÁC HẲN, không phải cùng một bố cục đổi tham số.
      let v;
      if (layout === 0) v = 55 + 150 * (x / W);                        // sáng dần sang phải
      else if (layout === 1) v = 55 + 150 * (y / H);                   // sáng dần xuống dưới
      else v = 205 - 150 * (Math.hypot(x - cx, y - cy) / maxR);        // sáng ở giữa

      // Khối sáng/tối lệch tâm, vị trí theo layout. KHÔNG phải để trang trí: một
      // bố cục chuyển sáng ĐỀU MỘT CHIỀU cho ra dHash toàn số 0 (mã suy biến,
      // xem hashDetail) và bị loại khỏi việc gom nhóm — đúng như thiết kế, nhưng
      // thế thì bài này không kiểm được luật gom chuỗi bấm. Ảnh chụp thật luôn có
      // chủ thể phá vỡ chiều chuyển sáng; khối này đóng vai chủ thể đó.
      // Hai khối, để mã hash có DƯ bit chứ không nằm sát ngưỡng minHashBits: một
      // bài kiểm thử sát ngưỡng thì lần sau chỉnh gì cũng đỏ vì lý do không liên quan.
      const boxes = [
        [[0.10, 0.52, 215], [0.62, 0.10, 40]],
        [[0.56, 0.12, 40], [0.14, 0.60, 215]],
        [[0.32, 0.60, 215], [0.06, 0.10, 40]],
      ][layout];
      for (const [bx, by, tone] of boxes) {
        if (x > bx * W && x < (bx + 0.24) * W && y > by * H && y < (by + 0.28) * H) v = tone;
      }

      // TẦNG CHI TIẾT.
      if ((vertical ? x : y) % pitch === 0) v += 50;
      if ((vertical ? y : x) % 9 === 0) v -= 28;
      v += (rnd() - 0.5) * 14; // hạt nhiễu như ảnh thật
      g[y * W + x] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return g;
}

/** Làm nhoè bằng box blur bán kính r — mô phỏng lấy nét sai / rung tay. */
function blur(src, r) {
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        sum += src[y * W + xx]; n++;
      }
      tmp[y * W + x] = Math.round(sum / n);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        sum += tmp[yy * W + x]; n++;
      }
      out[y * W + x] = Math.round(sum / n);
    }
  }
  return out;
}

const base = scene(0);
const SAMPLES = [
  { name: "NET_01.png", gray: base },
  { name: "NET_02.png", gray: scene(1) },
  { name: "NET_03.png", gray: scene(2) },
  // Cùng khung với NET_01, lệch nhẹ + sáng hơn 12 mức: đúng hình dạng của hai
  // tấm liền nhau trong một chuỗi bấm.
  { name: "CHUOI_01.png", gray: base.map((v, i) => Math.min(255, base[(i + 3) % base.length] + 12)) },
  { name: "NHOE_01.png", gray: blur(base, 9) },
  { name: "DEN_01.png", gray: new Uint8Array(W * H).fill(3) },
];

console.log(`Sinh ${SAMPLES.length} ảnh PNG ${W}×${H}…`);
const encoded = SAMPLES.map((s) => ({ name: s.name, b64: grayPng(s.gray, W, H).toString("base64") }));

/* ── Giải mã trong Chromium, ĐÚNG đường mà @/lib/photo-ai-scan đi ──────────── */

const EXEC = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const page = await browser.newPage();
await page.goto("about:blank");

const support = await page.evaluate(
  () => typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function"
);
ok("Chromium có createImageBitmap + OffscreenCanvas (điều scanSupported() kiểm)", support);

const decoded = await page.evaluate(
  async ({ files, edge }) => {
    const out = [];
    for (const f of files) {
      const blob = await (await fetch(`data:image/png;base64,${f.b64}`)).blob();
      // ── giống hệt sampleOne() ──────────────────────────────────────────────
      const probe = await createImageBitmap(blob);
      const scale = edge / Math.max(probe.width, probe.height);
      const w = scale < 1 ? Math.max(3, Math.round(probe.width * scale)) : probe.width;
      const h = scale < 1 ? Math.max(3, Math.round(probe.height * scale)) : probe.height;
      probe.close();
      const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      // Cầm kích thước TRƯỚC khi close(): `ImageBitmap.close()` giải phóng ảnh
      // và đặt width/height về 0. Đọc sau đó thì mọi ảnh thành 0×0 và cả lô ra
      // điểm nét 0 — tức là "mọi ảnh đều nhoè". Đây là cái bẫy mà chính bài kiểm
      // thử này bắt được lần đầu chạy.
      const width = bmp.width;
      const height = bmp.height;
      bmp.close();
      const gray = new Array(width * height);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
        gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
      }
      out.push({ name: f.name, gray, width, height });
    }
    return out;
  },
  { files: encoded, edge: SAMPLE_EDGE }
);
/* ── Ô cắt 1:1 của khung so sánh ───────────────────────────────────────────
   `makePixelCrop` dựa vào một hợp đồng của trình duyệt mà không kiểm thử đơn vị
   nào chạm tới được: `createImageBitmap(blob, sx, sy, sw, sh)` phải trả về ĐÚNG
   ô điểm ảnh GỐC đó — không thu nhỏ, không lấy lệch. Nếu nó thu nhỏ thì nút
   "soi 1:1" hiện một tấm mờ y hệt ảnh lớn, và cả nấc quyết định của khung so
   sánh thành vô nghĩa mà không có lỗi nào.

   Ảnh mẫu: nền 40, một ô 100×100 tô 220 đặt ở toạ độ biết trước. */
{
  const MW = 1200;
  const MH = 800;
  const BX = 700;
  const BY = 300;
  const mark = new Uint8Array(MW * MH).fill(40);
  for (let y = BY; y < BY + 100; y++) for (let x = BX; x < BX + 100; x++) mark[y * MW + x] = 220;
  const markB64 = grayPng(mark, MW, MH).toString("base64");

  // Tâm ô soi đặt đúng giữa khối sáng → khối phải nằm giữa ô cắt.
  const rect = cropRect(MW, MH, (BX + 50) / MW, (BY + 50) / MH, 520);

  const crop = await page.evaluate(
    async ({ b64, r }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bmp = await createImageBitmap(blob, r.sx, r.sy, r.w, r.h);
      const w = bmp.width;
      const h = bmp.height;
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      bmp.close();
      const at = (x, y) => data[(y * w + x) * 4];
      const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];
      return {
        w, h,
        centre: at(w >> 1, h >> 1),
        corner: at(2, 2),
        minAlpha: Math.min(alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)),
      };
    },
    { b64: markB64, r: rect }
  );

  check("ô cắt ra ĐÚNG cỡ đã xin, không bị thu nhỏ", [crop.w, crop.h], [rect.w, rect.h]);
  ok("giữa ô cắt là khối sáng (cắt đúng chỗ, không lệch)", crop.centre > 200, `nhận ${crop.centre}`);
  ok("góc ô cắt là nền tối (ô cắt không phóng to khối lên toàn khung)", crop.corner < 80, `nhận ${crop.corner}`);
  ok("ô cắt đặc, không viền trong suốt", crop.minAlpha === 255, `alpha nhỏ nhất ${crop.minAlpha}`);
}

/* ── Ảnh xem trước cỡ lớn KHÔNG phóng to ảnh vốn nhỏ ───────────────────────── */
{
  const small = new Uint8Array(200 * 120).fill(128);
  const b64 = grayPng(small, 200, 120).toString("base64");
  const got = await page.evaluate(async ({ b64, edge }) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const probe = await createImageBitmap(blob);
    const scale = edge / Math.max(probe.width, probe.height);
    const w = scale >= 1 ? probe.width : Math.round(probe.width * scale);
    const h = scale >= 1 ? probe.height : Math.round(probe.height * scale);
    probe.close();
    return [w, h];
  }, { b64, edge: 1600 });
  check("ảnh 200×120 xin xem trước 1600px → giữ nguyên, không phóng to", got, [200, 120]);
}

await browser.close();

check("giải mã đủ cả 6 ảnh", decoded.length, 6);
check("thu về đúng cạnh dài 480px, giữ tỉ lệ 3:2", [decoded[0].width, decoded[0].height], [480, 320]);

/* ── Cho chạy qua ĐÚNG code thật ───────────────────────────────────────────── */

const metrics = decoded.map((d, i) =>
  measure({ key: d.name, name: d.name, index: i, gray: Uint8Array.from(d.gray), width: d.width, height: d.height })
);
const result = judge(metrics);
const by = Object.fromEntries(result.judgements.map((j) => [j.name, j]));

console.log("\nĐo được trên ảnh thật:");
for (const m of metrics) console.log(`   ${m.name.padEnd(14)} nét=${Math.round(m.sharpness).toString().padStart(5)}  sáng=${Math.round(m.brightness).toString().padStart(3)}  hash=${m.hash} (${String(m.hashBits).padStart(2)} bit)`);
console.log(`   (trung vị lô = ${Math.round(result.summary.medianSharpness)})\n`);

// Ảnh mẫu phải có mã hash dùng được, nếu không thì mọi ca gom nhóm bên dưới
// "xanh" chỉ vì không có gì được gom cả.
for (const n of ["NET_01.png", "NET_02.png", "NET_03.png", "CHUOI_01.png"]) {
  const m = metrics.find((x) => x.name === n);
  ok(`${n} có mã hash KHÔNG suy biến (điều kiện để bài này có nghĩa)`,
    m.hashBits >= AI_DEFAULTS.minHashBits && m.hashBits <= 128 - AI_DEFAULTS.minHashBits,
    `hashBits=${m.hashBits}/128`);
}
ok(
  "khung đen thui ra mã suy biến → tự bị loại khỏi việc gom nhóm",
  metrics.find((m) => m.name === "DEN_01.png").hashBits < AI_DEFAULTS.minHashBits
);

// ĐÂY là câu hỏi mà mọi kiểm thử đơn vị không trả lời được.
ok(
  "ảnh làm nhoè thật rơi xuống dưới ngưỡng → bị xếp 'nên loại'",
  by["NHOE_01.png"].verdict === "reject",
  `nhận ${by["NHOE_01.png"].verdict} — ${by["NHOE_01.png"].reason}`
);
ok(
  "ảnh nhoè kém nét hơn ảnh gốc ít nhất 10 lần (biên an toàn, không sát ngưỡng)",
  metrics.find((m) => m.name === "NET_01.png").sharpness > metrics.find((m) => m.name === "NHOE_01.png").sharpness * 10
);
check("khung đen thui → nên loại", by["DEN_01.png"].verdict, "reject");

// Ba ảnh nét, khác cảnh nhau → không tấm nào bị loại, không tấm nào bị gom.
for (const n of ["NET_01.png", "NET_02.png", "NET_03.png"]) {
  ok(`${n} (nét, cảnh khác nhau) KHÔNG bị loại`, by[n].verdict !== "reject", `nhận ${by[n].verdict}`);
}
ok(
  "hai ảnh nét KHÁC CẢNH không bị gom vào chuỗi nào",
  by["NET_02.png"].group === null && by["NET_03.png"].group === null,
  JSON.stringify(["NET_02.png", "NET_03.png"].map((n) => by[n].group))
);
ok(
  "…nên cả hai được giữ",
  by["NET_02.png"].verdict === "keep" && by["NET_03.png"].verdict === "keep",
  JSON.stringify([by["NET_02.png"].verdict, by["NET_03.png"].verdict])
);

// Chuỗi bấm: CHUOI_01 cùng khung với NET_01 → phải vào cùng nhóm, và chỉ MỘT
// trong hai được giữ.
ok(
  "hai tấm cùng khung (lệch nhẹ + sáng hơn) được gom vào một chuỗi",
  by["NET_01.png"].group !== null && by["NET_01.png"].group === by["CHUOI_01.png"].group,
  `NET_01 nhóm=${by["NET_01.png"].group}, CHUOI_01 nhóm=${by["CHUOI_01.png"].group}`
);
ok(
  "…và chuỗi đó chỉ giữ đúng một bản",
  [by["NET_01.png"], by["CHUOI_01.png"]].filter((j) => j.keeper).length === 1,
  JSON.stringify([by["NET_01.png"].verdict, by["CHUOI_01.png"].verdict])
);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
