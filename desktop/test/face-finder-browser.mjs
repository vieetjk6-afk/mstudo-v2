/* Kiểm thử CHIP LỌC THEO NGƯỜI trong album khách, chạy trong Chromium thật.
 *
 * Vì sao cần bài này khi đã có desktop/test/face-people.mjs: bài kia chứng minh
 * LUẬT (chip nào hiện, ảnh nào thuộc ai) đúng trên dữ liệu dựng sẵn. Nó không
 * trả lời được ba câu mà tính năng đứng hay đổ trên đó:
 *
 *   1. Hàng chip có hiện ra NGAY từ lượt vẽ đầu không. Hai lỗi hydrate trước đây
 *      trong chính repo này (nút "Quét" kẹt vô hiệu vĩnh viễn) đều là loại mà
 *      React 18 chỉ CẢNH BÁO rồi giữ nguyên HTML của máy chủ — mọi kiểm thử đơn
 *      vị vẫn xanh.
 *   2. Bấm chip có LỌC ĐƯỢC lưới không. Lọc theo người xen vào giữa một chuỗi
 *      lọc đã có (tab nguồn → người → đã chọn/không thích → ẩn ảnh trùng); xếp
 *      sai thứ tự thì lưới ra sai mà không ai báo lỗi.
 *   3. Bấm lại có TRỞ VỀ cả album không — một chip lọc mà không thoát ra được là
 *      một cái bẫy.
 *
 * Cách chạy:
 *   npx next dev -p 3333            # cửa sổ 1
 *   npm run test:face-finder        # cửa sổ 2
 *
 * Ảnh đi qua /api/img (Drive) nên bài này CHẶN đường đó lại và trả về một PNG
 * sinh tại chỗ — không cần Drive, không cần mạng.
 */
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { padBox } from "../../src/lib/face-people.ts";

const PAGE = `${process.env.UI_BASE || "http://localhost:3333"}/uipreview/loc-theo-nguoi`;

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const check = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `nhận ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`);

/*
 * Ảnh giả 300×200 (tỉ lệ 3:2 như ảnh máy ảnh thật), nền trắng, có MỘT Ô ĐEN ở
 * đúng vị trí mà `coverBox` của người đầu tiên trỏ tới.
 *
 * Nhờ vậy phép cắt ảnh mặt kiểm được bằng số chứ không bằng mắt: nếu cắt đúng,
 * điểm giữa ảnh thẻ phải rơi vào ô đen; cắt sai chỗ thì rơi vào nền trắng.
 */
const IMG_W = 300;
const IMG_H = 200;
const BOX = { x: 0.1, y: 0.1, w: 0.2, h: 0.3 }; // khớp PEOPLE[0].coverBox

function grayPng(pix, w, h) {
  const crc32 = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 0; // grayscale
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pix[y * w + x];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const pix = new Uint8Array(IMG_W * IMG_H).fill(255);
for (let y = Math.round(BOX.y * IMG_H); y < Math.round((BOX.y + BOX.h) * IMG_H); y++) {
  for (let x = Math.round(BOX.x * IMG_W); x < Math.round((BOX.x + BOX.w) * IMG_W); x++) {
    pix[y * IMG_W + x] = 0;
  }
}
const PNG = grayPng(pix, IMG_W, IMG_H);

let browser;
try {
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
} catch {
  console.log("⏭  BỎ QUA: không mở được Chromium. Đặt CHROME_PATH trỏ tới trình duyệt.");
  process.exit(0);
}
const page = await browser.newPage();

// Ảnh Drive → PNG tại chỗ.
await page.route("**/api/img**", (route) =>
  route.fulfill({ status: 200, contentType: "image/png", body: PNG })
);

/* Lỗi console: React ghi cả cảnh báo hydrate ra console.error, nên gom cả hai. */
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});

let res;
try {
  res = await page.goto(PAGE, { waitUntil: "networkidle", timeout: 25_000 });
} catch {
  console.log(`⏭  BỎ QUA: chưa có server ở ${PAGE}. Chạy 'npx next dev -p 3333' trước.`);
  await browser.close();
  process.exit(0);
}
if (!res || !res.ok()) {
  console.log(`⏭  BỎ QUA: ${PAGE} trả về ${res?.status()}.`);
  await browser.close();
  process.exit(0);
}

const gridCount = () => page.locator('[aria-label^="Xem ảnh"]').count();
/** Ảnh thẻ khuôn mặt: nút có nhãn phụ là tên người (hoặc số ảnh nếu chưa đặt tên). */
const face = (label) => page.getByRole("button", { name: new RegExp(label) });

/* ── 1. Hàng khuôn mặt hiện ngay ──────────────────────────────────────────── */
await page.waitForSelector("text=Tìm ảnh có mặt bạn", { timeout: 10_000 });
ok("hàng khuôn mặt hiện ra (không kẹt ở HTML máy chủ)", true);

for (const name of ["Cô dâu", "Chú rể"]) {
  ok(`có khuôn mặt "${name}"`, (await face(name).count()) > 0);
}
// Người studio CHƯA đặt tên vẫn phải hiện — họ mới là phần đông trong album
// thật, và khách nhận ra bằng mặt chứ không bằng tên.
//
// Kiểm theo TÊN TRỢ NĂNG chứ không theo chữ nhìn thấy: nút chỉ hiện "2 ảnh",
// còn thứ trình đọc màn hình đọc ra là alt của ảnh mặt. Người không nhìn được
// ảnh thẻ thì đó là tất cả những gì họ có, nên nó phải nói được điều gì đó.
ok(
  "người chưa đặt tên vẫn hiện, và có nhãn cho trình đọc màn hình",
  (await face("Một người trong album").count()) > 0
);
ok("…nhãn nhìn thấy là số ảnh", (await page.locator("text=2 ảnh").count()) > 0);

ok(
  "nói rõ ảnh khách tải lên không rời khỏi máy",
  (await page.locator("text=không rời khỏi máy này").count()) > 0
);
ok(
  "…và nói trước dung lượng phải tải",
  (await page.locator("text=~20 MB").count()) > 0
);

/* ── 2. Phép cắt ảnh mặt, đo trong trình duyệt THẬT ───────────────────────── */
/*
 * Đây là chỗ đáng ngờ nhất của cả tính năng: `transform: scale() translate()`
 * với phần trăm ăn theo kích thước CHÍNH THẺ ẢNH. Bài kiểm thử luật đã mô phỏng
 * ngữ nghĩa đó, nhưng mô phỏng chỉ chứng minh tôi hiểu đúng cái tôi tự viết ra.
 * Ở đây đo bằng getBoundingClientRect() của trình duyệt thật.
 */
{
  const box = [0.1, 0.1, 0.2, 0.3]; // = coverBox của người đầu tiên
  const b = padBox(box, 0.45);
  const geo = await page.evaluate(
    ([bx, by, bw]) => {
      const btn = [...document.querySelectorAll("button")].find((el) =>
        /Cô dâu/.test(el.textContent || "")
      );
      const holder = btn?.querySelector("span");
      const img = btn?.querySelector("img");
      if (!holder || !img) return null;
      const h = holder.getBoundingClientRect();
      const i = img.getBoundingClientRect();
      // Khung mặt nằm ở đâu SAU khi trình duyệt đã áp transform:
      return {
        faceLeft: i.left + bx * i.width - h.left,
        faceTop: i.top + by * i.height - h.top,
        faceWidth: bw * i.width,
        holder: h.width,
      };
    },
    [b.x, b.y, b.w]
  );
  ok("đo được ảnh thẻ trong trang", geo !== null);
  if (geo) {
    // Ngưỡng 1 điểm ảnh: chuỗi CSS làm tròn có chủ ý, và trình duyệt còn làm
    // tròn thêm khi vẽ. Sai một điểm ảnh thì mắt không thấy; sai chỗ thì lệch
    // hàng chục.
    ok(
      "khuôn mặt nằm đúng góc trên-trái ảnh thẻ",
      Math.abs(geo.faceLeft) < 1 && Math.abs(geo.faceTop) < 1,
      `left=${geo.faceLeft.toFixed(2)} top=${geo.faceTop.toFixed(2)}`
    );
    ok(
      "bề ngang khuôn mặt vừa đúng bề ngang ảnh thẻ",
      Math.abs(geo.faceWidth - geo.holder) < 1,
      `mặt=${geo.faceWidth.toFixed(2)} ô=${geo.holder.toFixed(2)}`
    );
  }
}

/* ── 3. Bấm một mặt thì lọc lưới ─────────────────────────────────────────── */
const all = await gridCount();
check("chưa lọc: lưới có cả 8 ảnh", all, 8);

await face("Cô dâu").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 4,
  null,
  { timeout: 5000 }
).catch(() => {});
check("bấm Cô dâu → lưới còn 4 ảnh", await gridCount(), 4);

const shown = await page.locator('[aria-label^="Xem ảnh"]').evaluateAll((els) =>
  els.map((e) => e.getAttribute("alt"))
);
check("…và là đúng bốn tấm của Cô dâu", shown, [
  "DSC_4470.JPG",
  "DSC_4471.JPG",
  "DSC_4472.JPG",
  "DSC_4473.JPG",
]);
ok("hiện dòng nhắc cách thoát khỏi bộ lọc", (await page.locator("text=Bấm lại vào khuôn mặt").count()) > 0);
// Thanh công cụ phải báo số ảnh ĐANG THẤY, không phải tổng album.
ok(
  "thanh công cụ đếm theo lưới đang lọc, không theo tổng album",
  (await page.locator("text=4 ảnh của Cô dâu").count()) > 0
);

await face("Chú rể").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 3,
  null,
  { timeout: 5000 }
).catch(() => {});
check("đổi sang Chú rể → còn 3 ảnh (bộ lọc THAY, không cộng dồn)", await gridCount(), 3);

await face("Chú rể").first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 8,
  null,
  { timeout: 5000 }
).catch(() => {});
check("bấm lại chính mặt đó → trở về cả 8 ảnh", await gridCount(), 8);

await face("Cô dâu").first().click();
await page.getByRole("button", { name: /Xem cả album/ }).first().click();
await page.waitForFunction(
  () => document.querySelectorAll('[aria-label^="Xem ảnh"]').length === 8,
  null,
  { timeout: 5000 }
).catch(() => {});
check('nút "Xem cả album" cũng thoát được', await gridCount(), 8);

/* ── 4. Không lỗi, không cảnh báo hydrate ─────────────────────────────────── */
/*
 * Lọc bỏ ba thứ tiếng ồn KHÔNG phải lỗi của trang, và nói rõ từng thứ là gì —
 * lọc mù cả console.error thì bài kiểm thử này mất hết giá trị:
 *
 *  • Ảnh: route ở trên trả PNG 1×1, nhưng favicon/manifest thì không đi qua đó.
 *  • `upgrade-insecure-requests` bị bỏ qua trong policy Report-Only: đúng như
 *    trình duyệt nói. next.config.mjs cố ý phát bản CSP siết chặt ở chế độ
 *    Report-Only trước khi enforce (xem ghi chú ở đó), và directive ấy phải nằm
 *    sẵn trong bản đó cho ngày đổi sang enforce. Bản ĐANG enforce cũng có nó,
 *    nên việc nâng cấp HTTPS vẫn có hiệu lực. Đây là thông báo, không phải lỗi.
 */
const real = errors.filter(
  (e) => !/Failed to load resource|favicon|manifest|upgrade-insecure-requests/i.test(e)
);
ok("không có lỗi JavaScript nào trên trang", real.length === 0, real.join("\n    "));

/* ── ALBUM GIAO KHÁCH ─────────────────────────────────────────────────────────
 *
 * Có HAI trang khách, không phải một: /a/[slug] là album chọn ảnh, /album/[slug]
 * là album giao khách. Bản đầu chỉ gắn khối tìm mặt vào trang thứ nhất, trong
 * khi yêu cầu nói rõ là cần CẢ HAI — chủ studio mở link giao khách và không thấy
 * gì, hoàn toàn đúng, vì ở đó chưa có gì cả. Phần này tồn tại để không lặp lại.
 */
{
  const g = await browser.newPage();
  const gerr = [];
  g.on("pageerror", (e) => gerr.push(e.message.slice(0, 200)));
  await g.route("**/api/img**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  // Trang này tự tải nốt ảnh trong nền; ở đây không cần thêm gì.
  await g.route("**/api/album/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ photos: [] }) })
  );
  let gres;
  try {
    gres = await g.goto(`${process.env.UI_BASE || "http://localhost:3333"}/uipreview/giao-khach-tim-mat`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
  } catch {
    gres = null;
  }
  if (!gres || !gres.ok()) {
    ok("mở được màn album giao khách", false, `trả về ${gres?.status()}`);
  } else {
    await g.waitForTimeout(2000);
    const dem = () => g.locator('[aria-label^="Xem DSC"]').count();
    ok("album GIAO KHÁCH cũng có khối tìm ảnh theo khuôn mặt", (await g.locator("text=Tìm ảnh có mặt bạn").count()) > 0);
    const tong = await dem();
    ok("…lưới đủ 8 ảnh khi chưa lọc", tong === 8, `đếm ${tong}`);
    await g.getByRole("button", { name: /Cô dâu/ }).first().click();
    await g.waitForFunction(() => document.querySelectorAll('[aria-label^="Xem DSC"]').length === 4, null, { timeout: 5000 }).catch(() => {});
    ok("…bấm một khuôn mặt thì lọc đúng 4 ảnh", (await dem()) === 4, `đếm ${await dem()}`);
    await g.getByRole("button", { name: /Xem cả album/ }).first().click();
    await g.waitForFunction(() => document.querySelectorAll('[aria-label^="Xem DSC"]').length === 8, null, { timeout: 5000 }).catch(() => {});
    ok("…bỏ lọc thì về lại cả album", (await dem()) === 8, `đếm ${await dem()}`);
    ok("…và không có lỗi JavaScript", gerr.length === 0, gerr.join(" | "));
  }
  await g.close();
}
ok(
  "không có cảnh báo hydrate (React vứt HTML máy chủ)",
  !real.some((e) => /hydrat/i.test(e)),
  real.filter((e) => /hydrat/i.test(e)).join("\n    ")
);

await browser.close();
console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
