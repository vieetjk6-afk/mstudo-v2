/* Kiểm thử CỔNG GÓI của tính năng "khách tìm ảnh theo khuôn mặt".
 *
 * Tính năng này chỉ mở cho Photographer Plus và Studio. Vấn đề là nó không có
 * MỘT chỗ để chặn: bộ quét cron, nút quét tay của studio, ba đường phía khách
 * (trang chọn ảnh, trang giao khách, hai route mở khoá bằng mật khẩu) và route
 * khách gửi ảnh selfie lên — mỗi đường tự hỏi lấy. Bỏ sót một đường là tính năng
 * gói cao chạy không mất tiền, mà không đường nào báo lỗi.
 *
 * Bài này khoá ba điều dễ hỏng nhất, bằng code thật + database giả:
 *
 *   1. TRUTH TABLE của planAllowsFaceSearch, kèm gói HẾT HẠN. Gói Studio quá
 *      hạn phải rơi về free và cổng đóng — không phải "đã từng mua thì mãi có".
 *   2. Bộ quét cron BỎ QUA album của gói không đủ, và — quan trọng hơn — một lô
 *      toàn album gói thấp KHÔNG ĐƯỢC làm album đủ gói phía sau mất lượt. Đây
 *      đúng kiểu chết đói đã từng xảy ra với album kẹt.
 *   3. Đọc gói THẤT BẠI thì cổng ĐÓNG (fail-closed), không phải mở hết.
 *
 * Và tiến độ quét: con số thay cho câu "vài phút nữa bạn quay lại nhé".
 */
import { effectivePlan, planAllowsFaceSearch } from "../../src/lib/plans.ts";
import { chuAlbumDuocTimMat, conDangQuet, tienDoQuet } from "../../src/lib/face-pending.ts";
import { albumsNeedingCluster, albumsNeedingScan } from "../../src/lib/face-scan-server.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const check = (name, got, want) => {
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (!same) fail++;
  console.log(`${same ? "✓" : "✗"} ${name}${same ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const NGAY_MAI = new Date(Date.now() + 86_400_000).toISOString();
const HOM_QUA = new Date(Date.now() - 86_400_000).toISOString();

/* ── 1. Truth table ──────────────────────────────────────────────────────── */
for (const p of ["free", "basic", "photographer"]) {
  ok(`gói ${p} KHÔNG được tìm theo khuôn mặt`, planAllowsFaceSearch(p) === false);
}
for (const p of ["photographer_plus", "studio"]) {
  ok(`gói ${p} được tìm theo khuôn mặt`, planAllowsFaceSearch(p) === true);
}
ok("admin luôn được, kể cả trên gói free", planAllowsFaceSearch("free", true) === true);

// Gói hết hạn: đây là chỗ dễ quên nhất, vì cột `plan` vẫn ghi "studio".
ok("studio còn hạn → cổng mở", planAllowsFaceSearch(effectivePlan("studio", NGAY_MAI)) === true);
ok("studio HẾT HẠN → cổng đóng", planAllowsFaceSearch(effectivePlan("studio", HOM_QUA)) === false);
ok(
  "photographer_plus HẾT HẠN → cổng đóng",
  planAllowsFaceSearch(effectivePlan("photographer_plus", HOM_QUA)) === false
);
ok("gói null (dòng profiles thiếu) → cổng đóng", planAllowsFaceSearch(effectivePlan(null, null)) === false);

/* ── Database giả ────────────────────────────────────────────────────────────
 * Chỉ dựng đúng những mắt của PostgREST mà code thật gọi tới. `loi` bơm lỗi cho
 * một bảng cụ thể, để kiểm hướng hỏng.
 */
function fakeDb({ albums = [], profiles = [], photos = [], loi = {} } = {}) {
  const stats = { docProfiles: 0, demPhotos: 0 };

  const from = (table) => {
    const eqs = {};
    const neqs = {};
    const isNulls = [];
    const notNulls = [];
    let wantCount = false;
    let gioiHan = Infinity;

    const chon = () => {
      if (table === "albums") {
        let rows = albums;
        for (const [c, v] of Object.entries(eqs)) rows = rows.filter((r) => r[c] === v);
        for (const c of isNulls) rows = rows.filter((r) => (r[c] ?? null) === null);
        return { data: rows.slice(0, gioiHan), error: null };
      }
      if (table === "profiles") {
        stats.docProfiles++;
        if (loi.profiles) return { data: null, error: { message: loi.profiles } };
        let rows = profiles;
        if (eqs.__in) rows = rows.filter((r) => eqs.__in.includes(r.id));
        for (const [c, v] of Object.entries(eqs)) if (c !== "__in") rows = rows.filter((r) => r[c] === v);
        return { data: rows, error: null };
      }
      if (table === "photos") {
        stats.demPhotos++;
        if (loi.photos) return { count: null, data: null, error: { message: loi.photos } };
        let rows = photos;
        for (const [c, v] of Object.entries(eqs)) rows = rows.filter((r) => r[c] === v);
        for (const [c, v] of Object.entries(neqs)) rows = rows.filter((r) => r[c] !== v);
        for (const c of isNulls) rows = rows.filter((r) => (r[c] ?? null) === null);
        for (const c of notNulls) rows = rows.filter((r) => (r[c] ?? null) !== null);
        return wantCount ? { count: rows.length, data: null, error: null } : { data: rows, error: null };
      }
      throw new Error(`bảng chưa dựng trong db giả: ${table}`);
    };

    const self = {
      select(_cols, opts) {
        if (opts?.count === "exact") wantCount = true;
        return self;
      },
      eq(c, v) { eqs[c] = v; return self; },
      neq(c, v) { neqs[c] = v; return self; },
      is(c, v) { if (v === null) isNulls.push(c); return self; },
      not(c, _op, v) { if (v === null) notNulls.push(c); return self; },
      in(_c, list) { eqs.__in = list; return self; },
      order() { return self; },
      limit(n) { gioiHan = n; return self; },
      maybeSingle() { const r = chon(); return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error }); },
      then(res, rej) { return Promise.resolve(chon()).then(res, rej); },
    };
    return self;
  };

  return { from, stats };
}

/* ── 2. chuAlbumDuocTimMat ───────────────────────────────────────────────── */
const dbGoi = fakeDb({
  profiles: [
    { id: "u-studio", plan: "studio", plan_expires_at: NGAY_MAI, role: "photographer" },
    { id: "u-plus", plan: "photographer_plus", plan_expires_at: NGAY_MAI, role: "photographer" },
    { id: "u-pho", plan: "photographer", plan_expires_at: NGAY_MAI, role: "photographer" },
    { id: "u-het", plan: "studio", plan_expires_at: HOM_QUA, role: "photographer" },
    { id: "u-admin", plan: "free", plan_expires_at: null, role: "admin" },
  ],
});
ok("chủ gói studio → được", (await chuAlbumDuocTimMat(dbGoi, "u-studio")) === true);
ok("chủ gói photographer_plus → được", (await chuAlbumDuocTimMat(dbGoi, "u-plus")) === true);
ok("chủ gói photographer → KHÔNG", (await chuAlbumDuocTimMat(dbGoi, "u-pho")) === false);
ok("chủ gói studio đã hết hạn → KHÔNG", (await chuAlbumDuocTimMat(dbGoi, "u-het")) === false);
ok("admin → được", (await chuAlbumDuocTimMat(dbGoi, "u-admin")) === true);
ok("không có id chủ album → KHÔNG (không đi hỏi DB)", (await chuAlbumDuocTimMat(dbGoi, null)) === false);
ok("id chủ album không có dòng profiles → KHÔNG", (await chuAlbumDuocTimMat(dbGoi, "u-la")) === false);
ok(
  "đọc profiles LỖI → KHÔNG (fail-closed)",
  (await chuAlbumDuocTimMat(fakeDb({ loi: { profiles: "mất mạng" } }), "u-studio")) === false
);

/* ── 3. Bộ quét cron chỉ nhặt album đủ gói ───────────────────────────────── */
const profilesChung = [
  { id: "u-studio", plan: "studio", plan_expires_at: NGAY_MAI, role: "photographer" },
  { id: "u-pho", plan: "photographer", plan_expires_at: NGAY_MAI, role: "photographer" },
];
const anhChuaQuet = (albumId, n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${albumId}-${i}`,
    album_id: albumId,
    is_video: false,
    faces_scanned_at: null,
    drive_file_id: `d-${albumId}-${i}`,
  }));

{
  const db = fakeDb({
    albums: [
      { id: "a-pho", owner_id: "u-pho", status: "published", faces_clustered_at: null },
      { id: "a-studio", owner_id: "u-studio", status: "published", faces_clustered_at: null },
    ],
    profiles: profilesChung,
    photos: [...anhChuaQuet("a-pho", 5), ...anhChuaQuet("a-studio", 7)],
  });
  const canQuet = await albumsNeedingScan(db, 5);
  check("albumsNeedingScan bỏ album của gói photographer", canQuet, [{ id: "a-studio", pending: 7 }]);
  ok(
    "và KHÔNG đếm ảnh của album bị loại (không tiêu lượt gọi vô ích)",
    db.stats.demPhotos === 1,
    `đếm ${db.stats.demPhotos} lần`
  );
}

{
  // Album chưa phát hành không được nhặt, dù chủ đủ gói.
  const db = fakeDb({
    albums: [{ id: "a-nhap", owner_id: "u-studio", status: "draft", faces_clustered_at: null }],
    profiles: profilesChung,
    photos: anhChuaQuet("a-nhap", 9),
  });
  check("album nháp không vào hàng đợi quét", await albumsNeedingScan(db, 5), []);
}

{
  // Ảnh đã quét hết → không còn việc, kể cả gói đủ.
  const db = fakeDb({
    albums: [{ id: "a-xong", owner_id: "u-studio", status: "published", faces_clustered_at: null }],
    profiles: profilesChung,
    photos: [{ id: "x", album_id: "a-xong", is_video: false, faces_scanned_at: "2026-01-01T00:00:00Z" }],
  });
  check("album đã quét xong không vào hàng đợi", await albumsNeedingScan(db, 5), []);
}

/* ── 4. Chết đói: lô đầu toàn gói thấp ───────────────────────────────────────
 * Đây là lý do albumsNeedingCluster lấy DƯ rồi mới lọc. Lọc sau `limit` thì 30
 * album gói photographer đứng trước sẽ chiếm sạch danh sách và album Studio phía
 * sau không bao giờ được gom — im lặng, không lỗi, không cách nào biết.
 */
{
  const nhieuAlbumGoiThap = Array.from({ length: 30 }, (_, i) => ({
    id: `a-pho-${i}`,
    owner_id: "u-pho",
    status: "published",
    faces_clustered_at: null,
  }));
  const db = fakeDb({
    albums: [...nhieuAlbumGoiThap, { id: "a-studio", owner_id: "u-studio", status: "published", faces_clustered_at: null }],
    profiles: profilesChung,
  });
  check("albumsNeedingCluster vẫn tới được album đủ gói sau 30 album gói thấp", await albumsNeedingCluster(db, 3), ["a-studio"]);
}

{
  const db = fakeDb({
    albums: [{ id: "a-goi-xong", owner_id: "u-studio", status: "published", faces_clustered_at: "2026-01-01T00:00:00Z" }],
    profiles: profilesChung,
  });
  check("album đã gom rồi không gom lại", await albumsNeedingCluster(db, 3), []);
}

/* ── 5. Đọc gói lỗi → cả hai hàng đợi phải NỔ, không âm thầm quét hết ────── */
for (const [ten, chay] of [
  ["albumsNeedingScan", albumsNeedingScan],
  ["albumsNeedingCluster", albumsNeedingCluster],
]) {
  const db = fakeDb({
    albums: [{ id: "a", owner_id: "u-studio", status: "published", faces_clustered_at: null }],
    loi: { profiles: "connection reset" },
  });
  let loi = null;
  try {
    await chay(db, 5);
  } catch (e) {
    loi = e;
  }
  ok(`${ten}: đọc gói lỗi thì nổ chứ không quét bừa`, /doc_goi_chu_album_that_bai/.test(String(loi?.message)));
}

/* ── 6. Tiến độ quét — con số thay cho lời hẹn "vài phút nữa" ────────────── */
{
  const db = fakeDb({
    photos: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `s${i}`, album_id: "a", is_video: false, faces_scanned_at: "2026-01-01T00:00:00Z", drive_file_id: `ds${i}`,
      })),
      ...anhChuaQuet("a", 6),
      // Video KHÔNG được tính vào mẫu số: bộ quét bỏ qua chúng, nên đếm vào là
      // tiến độ mãi không tới 100%.
      { id: "v", album_id: "a", is_video: true, faces_scanned_at: null, drive_file_id: "dv" },
      // Ảnh album khác không được lẫn vào.
      { id: "khac", album_id: "b", is_video: false, faces_scanned_at: null, drive_file_id: "dk" },
    ],
  });
  const td = await tienDoQuet(db, "a");
  check("tienDoQuet đếm đúng đã quét / tổng (bỏ video, bỏ album khác)", td, { daQuet: 4, tong: 10 });
  ok("còn ảnh chưa quét → conDangQuet true", conDangQuet(td) === true);
  ok("quét hết → conDangQuet false", conDangQuet({ daQuet: 10, tong: 10 }) === false);
  ok("album rỗng → conDangQuet false (đừng hứa hẹn gì)", conDangQuet({ daQuet: 0, tong: 0 }) === false);
}

{
  // Chưa chạy supabase/khuon-mat.sql: cột faces_scanned_at không tồn tại. Trang
  // album của khách KHÔNG được sập vì một tính năng thêm.
  const td = await tienDoQuet(fakeDb({ loi: { photos: "column does not exist" } }), "a");
  check("thiếu cột faces_scanned_at → hỏng êm, không nói bừa", td, { daQuet: 0, tong: 0 });
  ok("và không hiện câu đang chuẩn bị", conDangQuet(td) === false);
}

/* ── 6b. BA phía hỏi "còn phải quét không" phải trả lời GIỐNG NHAU ──────────
 * Đây là hồi quy cho vòng lặp vô hạn im lặng đọc được trong log production
 * 18:11 ngày 10/09: tám lượt liên tiếp "quét 0 ảnh · hàng đợi 3 quét / 0 gom".
 *
 * Hàng đợi đếm `faces_scanned_at is null AND is_video = false`; vòng quét đòi
 * thêm `drive_file_id` không rỗng. Một dòng `drive_file_id = ''` (cột khai
 * `not null`, chuỗi rỗng vẫn lọt) rơi đúng khe giữa hai câu đó:
 *   • hàng đợi ĐẾM nó  → album luôn "còn việc"
 *   • vòng quét BỎ nó   → scanned = 0, không mốc nào được ghi
 *   • lượt cron sau thấy y nguyên, chiếm một trong ba chỗ, mãi mãi
 * Và mẫu số tiến độ của khách đứng ở 209/210 kèm câu "đang tìm khuôn mặt"
 * không bao giờ tắt.
 */
{
  const { pendingRows } = await import("../../src/lib/face-can-quet.ts");

  // Một album mà MỌI ảnh chưa quét đều thiếu drive_file_id.
  const anhRong = [
    { id: "r0", album_id: "a", is_video: false, faces_scanned_at: null, drive_file_id: "" },
    { id: "r1", album_id: "a", is_video: false, faces_scanned_at: null, drive_file_id: "" },
    { id: "ok", album_id: "a", is_video: false, faces_scanned_at: "2026-01-01T00:00:00Z", drive_file_id: "d" },
  ];
  const db = fakeDb({
    albums: [{ id: "a", owner_id: "u-studio", status: "published", faces_clustered_at: null }],
    profiles: profilesChung,
    photos: anhRong,
  });

  check("vòng quét bỏ ảnh thiếu drive_file_id", pendingRows(anhRong).map((p) => p.id), []);
  check("→ nên hàng đợi cũng KHÔNG được nhặt album đó", await albumsNeedingScan(db, 5), []);
  check("→ và tiến độ của khách phải là 1/1, không phải 1/3", await tienDoQuet(db, "a"), { daQuet: 1, tong: 1 });
  ok("→ khối tìm mặt biến mất chứ không treo lời hẹn", conDangQuet(await tienDoQuet(db, "a")) === false);

  // Album lẫn cả hai loại: chỉ những tấm quét được mới vào cả ba con số.
  const lanLon = [
    ...anhChuaQuet("b", 3),
    { id: "b-rong", album_id: "b", is_video: false, faces_scanned_at: null, drive_file_id: "" },
    { id: "b-video", album_id: "b", is_video: true, faces_scanned_at: null, drive_file_id: "dv" },
    { id: "b-xong", album_id: "b", is_video: false, faces_scanned_at: "2026-01-01T00:00:00Z", drive_file_id: "dx" },
  ];
  const db2 = fakeDb({
    albums: [{ id: "b", owner_id: "u-studio", status: "published", faces_clustered_at: null }],
    profiles: profilesChung,
    photos: lanLon,
  });
  check("lẫn lộn: vòng quét thấy đúng 3 tấm", pendingRows(lanLon).length, 3);
  check("lẫn lộn: hàng đợi cũng báo đúng 3", await albumsNeedingScan(db2, 5), [{ id: "b", pending: 3 }]);
  check("lẫn lộn: tiến độ 1/4 (3 chưa quét + 1 đã quét)", await tienDoQuet(db2, "b"), { daQuet: 1, tong: 4 });
  ok(
    "hàng đợi và vòng quét khớp nhau",
    (await albumsNeedingScan(db2, 5))[0].pending === pendingRows(lanLon).length
  );
  // Mẫu số trừ tử số PHẢI bằng số tấm vòng quét sẽ chạm — nếu không, tiến độ có
  // một phần không bao giờ đi tới đích.
  const td = await tienDoQuet(db2, "b");
  ok("mẫu số không chứa tấm nào vòng quét không chạm tới", td.tong - td.daQuet === pendingRows(lanLon).length);
}

/* ── 6c. Vì sao Drive từ chối — năm nguyên nhân, năm cách sửa ───────────────
 * Log production 18:31 ngày 10/09 in "lỗi tải 54 · lỗi mẫu: khong_tai_duoc_anh"
 * tám lượt liền, ba album, 100% tấm hỏng. Biết là Drive từ chối, mà KHÔNG biết
 * Google từ chối bằng câu gì — trong khi chính câu đó quyết định phải sửa quyền
 * chia sẻ Drive, giãn nhịp gọi, hay chờ Drive xử lý xong file.
 *
 * `fetchThumbChiTiet` gọi mạng thật nên không kiểm được ở đây; bài này kiểm phần
 * PHÂN LOẠI — chạy code thật với `fetch` thay thế.
 */
{
  const { fetchThumbChiTiet } = await import("../../src/lib/face-node.ts");
  const goc = globalThis.fetch;

  const gia = (than) => {
    globalThis.fetch = async () => than();
  };
  const jpegThat = () => {
    const b = new Uint8Array(600);
    b[0] = 0xff;
    b[1] = 0xd8;
    return b;
  };
  /** Ảnh 600 byte mang đúng chữ ký của một định dạng. */
  const anhGia = (chuKy) => {
    const b = new Uint8Array(600);
    for (let i = 0; i < chuKy.length; i++) if (chuKy[i] !== "_") b[i] = chuKy.charCodeAt(i);
    return b;
  };
  const traVe = ({ status = 200, ct = "image/jpeg", body = jpegThat() }) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? ct : null) },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  });

  const truong = [
    ["ảnh JPEG thật → tải được", { }, null],
    ["file chưa chia sẻ công khai → http-403", { status: 403 }, "http-403"],
    ["file đã xoá khỏi Drive → http-404", { status: 404 }, "http-404"],
    ["Google chặn vì gọi quá nhiều → http-429", { status: 429 }, "http-429"],
    ["Drive trả trang xin quyền → khong-phai-anh", { ct: "text/html" }, "khong-phai-anh (text/html)"],
    ["ảnh giữ chỗ của Drive → anh-giu-cho", { body: jpegThat().slice(0, 100) }, "anh-giu-cho (100 byte)"],
    ["WebP (Google thương lượng) → gọi tên webp", { body: anhGia("RIFF____WEBPVP8 ") }, "khong-phai-jpeg (webp)"],
    ["PNG → gọi tên png", { body: anhGia("\x89PNG\r\n\x1a\n") }, "khong-phai-jpeg (png)"],
    ["HEIC (ảnh iPhone) → gọi tên heic", { body: anhGia("____ftypheic") }, "khong-phai-jpeg (heic)"],
    ["định dạng lạ → in mấy byte đầu", { body: anhGia("\x00\x01\x02\x03") }, "khong-phai-jpeg (khong-ro (00 01 02 03))"],
  ];
  for (const [ten, opt, canLyDo] of truong) {
    gia(() => traVe(opt));
    const r = await fetchThumbChiTiet("id-gia", 200);
    if (canLyDo === null) ok(ten, r.bytes !== null && r.lyDo === null, JSON.stringify(r.lyDo));
    else check(ten, r.lyDo, canLyDo);
  }

  gia(() => {
    const e = new Error("The operation was aborted");
    e.name = "AbortError";
    throw e;
  });
  check("mạng treo 12 giây → het-gio", (await fetchThumbChiTiet("id-gia", 200)).lyDo, "het-gio (12s)");

  gia(() => {
    throw new Error("getaddrinfo ENOTFOUND");
  });
  ok(
    "mạng lỗi → mang-loi kèm câu của hệ thống",
    /^mang-loi: getaddrinfo ENOTFOUND/.test((await fetchThumbChiTiet("id-gia", 200)).lyDo)
  );

  // Năm nguyên nhân phải cho ra năm câu KHÁC nhau — gộp lại là quay về đúng chỗ mù.
  const lyDos = [];
  for (const [, opt, canLyDo] of truong) {
    if (canLyDo === null) continue;
    gia(() => traVe(opt));
    lyDos.push((await fetchThumbChiTiet("id-gia", 200)).lyDo);
  }
  ok(`mỗi nguyên nhân một câu riêng (${lyDos.length} câu)`, new Set(lyDos).size === lyDos.length, lyDos.join(" | "));

  /*
   * XIN JPEG TƯỜNG MINH — chính dòng sửa được lỗi. Không có `Accept` thì Google
   * thấy UA Chrome và trả WebP, và bộ quét bỏ 100% tấm trong im lặng.
   */
  {
    let daGui = null;
    globalThis.fetch = async (_url, init) => {
      daGui = init?.headers ?? {};
      return traVe({});
    };
    await fetchThumbChiTiet("id-gia", 200);
    ok("gửi header Accept xin JPEG", /image\/jpeg/.test(String(daGui?.Accept ?? "")), JSON.stringify(daGui));
    ok("vẫn giữ User-Agent (Google 403 với UA lạ)", /Mozilla/.test(String(daGui?.["User-Agent"] ?? "")));
  }

  globalThis.fetch = goc;
}

/* ── 7. Không đường nào vào tính năng được bỏ sót cổng ──────────────────────
 * Bốn bài trên kiểm code ĐANG CÓ. Bài này kiểm code SẼ VIẾT: quét cây src/app,
 * tìm mọi file chạm vào dữ liệu khuôn mặt, và đòi mỗi file phải nhắc tới cổng
 * gói. Đó là kiểu hỏng đúng nghĩa âm thầm — thêm một route mới, quên một dòng,
 * không lỗi, không test nào đỏ, và tính năng gói cao lại chạy không mất tiền.
 */
{
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  const CHAM_KHUON_MAT = /album_people|scanAlbum|scanJpeg|clusterAlbum/;
  const CO_CONG = /planAllowsFaceSearch|chuAlbumDuocTimMat|albumsNeeding(Scan|Cluster)|canFaceSearch/;

  /* Miễn trừ — mỗi dòng phải nêu LÝ DO, không được là "tạm bỏ qua". */
  const MIEN_TRU = {
    // Chạy TensorFlow nhưng không ghi gì và không quét cả album: nó đo xem trọng
    // số có đi theo gói triển khai, một ảnh mất bao lâu, bộ dò có tìm ra mặt.
    // Ba câu đó nói về BẢN TRIỂN KHAI, không nói về gói. Chặn ở đây chỉ lấy đi
    // công cụ trả lời "tại sao không thấy gì" mà không giữ lại đồng nào — nên nó
    // BÁO CÁO cổng gói (goiChoTimMat) thay vì chặn.
    "src/app/api/albums/[id]/face-thu/route.ts": "công cụ đo bản triển khai, báo cáo gói chứ không chặn",
  };

  const files = [];
  const dao = (d) => {
    for (const ten of readdirSync(d)) {
      const p = join(d, ten);
      if (statSync(p).isDirectory()) dao(p);
      else if (/\.(ts|tsx)$/.test(ten)) files.push(p);
    }
  };
  dao("src/app");

  let soDuong = 0;
  for (const p of files.sort()) {
    const src = readFileSync(p, "utf8");
    if (!CHAM_KHUON_MAT.test(src)) continue;
    soDuong++;
    const key = p.replace(/\\/g, "/");
    if (MIEN_TRU[key]) {
      ok(`${key}: miễn trừ có lý do — ${MIEN_TRU[key]}`, /goiChoTimMat|chuAlbumDuocTimMat/.test(src));
      continue;
    }
    ok(`${key}: có cổng gói`, CO_CONG.test(src), "thêm planAllowsFaceSearch / chuAlbumDuocTimMat");
  }
  // Regex hỏng (đổi tên hàm, đổi cây thư mục) làm vòng lặp trên chạy 0 lần và
  // bài kiểm xanh mà không kiểm gì. Chốt sàn lại.
  ok(`quét được các đường vào tính năng (thấy ${soDuong})`, soDuong >= 8);
}

/* ── 8. Chỗ trống trong câu chữ phải khớp chỗ code điền ─────────────────────
 * Câu "đã quét {n}/{m} ảnh" chỉ đúng khi CẢ HAI ngôn ngữ có đúng những chỗ trống
 * mà FaceFinder điền. Lệch một chỗ thì khách đọc nguyên chữ "{m}" — mà không lỗi
 * nào nổ, không kiểu nào sai, và bản tiếng Anh thì càng không ai mở ra xem.
 */
{
  const { readFileSync } = await import("node:fs");
  const dict = readFileSync("src/lib/i18n.tsx", "utf8");
  const finder = readFileSync("src/app/a/[slug]/FaceFinder.tsx", "utf8");

  const khoi = dict.match(/facePreparing:\s*\{([\s\S]*?)\},/);
  ok("tìm được câu facePreparing trong từ điển", !!khoi);
  const cho = (ma) => {
    const dong = khoi?.[1].match(new RegExp(`${ma}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    return dong ? [...new Set(dong[1].match(/\{[a-z]+\}/g) ?? [])].sort() : null;
  };
  const dien = [...new Set(finder.match(/\.replace\("(\{[a-z]+\})"/g)?.map((x) => x.slice(10, -1)) ?? [])].sort();

  check("code điền đúng hai chỗ trống", dien, ["{m}", "{n}"]);
  check("câu tiếng Việt có đúng những chỗ đó", cho("vi"), dien);
  check("câu tiếng Anh có đúng những chỗ đó", cho("en"), dien);
  // Câu cũ hẹn "vài phút nữa" cho một việc mất hàng giờ. Đừng để nó quay lại.
  ok("không còn hứa 'vài phút'", !/vài phút/.test(khoi?.[1] ?? ""));
  ok("không còn hứa 'a few minutes'", !/a few minutes/.test(khoi?.[1] ?? ""));
}

console.log(`\n${fail === 0 ? "Tất cả đều đạt" : `${fail} lỗi`}`);
process.exit(fail === 0 ? 0 : 1);
