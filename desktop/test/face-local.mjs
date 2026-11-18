/* QUÉT KHUÔN MẶT TRÊN MÁY STUDIO — phía máy chủ: nhận kết quả, ghi, gom, và
 * những lời KHÔNG được hứa với khách.
 *
 * Việc nặng đã rời Vercel; thứ còn lại trên máy chủ là mấy luật mà sai thì hỏng
 * âm thầm: nhận nhầm lô rác vào DB, ghi lệch với bộ quét máy chủ, gom lại vô tội
 * vạ (egress), báo "đang quét 0/700" cho một album không ai quét, hay để route
 * mới kéo TensorFlow vào gói. Mỗi phần dưới đây canh một luật đó.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { kiemLoKetQua, laDescriptorHopLe, laLoiVinhVien, LO_TOI_DA, MAX_FACES } from "../../src/lib/face-scan-core.ts";
import { albumChoQuetCuaChu, gomNeuCan, layViecQuet, nhanLoKetQua } from "../../src/lib/face-local-server.ts";
import { tienDoNoiVoiKhach } from "../../src/lib/face-pending.ts";
import { nearestPerson } from "../../src/lib/face-group.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const check = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `nhận ${JSON.stringify(got)}, cần ${JSON.stringify(want)}`);

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const vec = (seed) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * 7 + i) * 0.1);
const face = (at, seed = 1) => ({ at, box: [0.1, 0.2, 0.3, 0.4], descriptor: vec(seed), sharpness: 120 });

/* ── 1. Kiểm lô kết quả ──────────────────────────────────────────────────── */
{
  const tot = kiemLoKetQua([{ photoId: uuid(1), faces: [face(0), face(1, 2)] }, { photoId: uuid(2), faces: [] }, { photoId: uuid(3), skip: "http-404" }]);
  ok("lô đúng được nhận", tot.ok && tot.lo.length === 3);
  const sai = (ten, lo, loi) => {
    const r = kiemLoKetQua(lo);
    ok(`từ chối: ${ten}`, !r.ok && r.loi === loi, JSON.stringify(r));
  };
  sai("không phải mảng", { a: 1 }, "khong_phai_mang");
  sai("lô rỗng", [], "lo_rong");
  sai("lô quá lớn", Array.from({ length: LO_TOI_DA + 1 }, (_, i) => ({ photoId: uuid(i), faces: [] })), "lo_qua_lon");
  sai("photoId không phải uuid", [{ photoId: "1; drop table", faces: [] }], "photo_id_sai");
  sai("photoId trùng", [{ photoId: uuid(1), faces: [] }, { photoId: uuid(1), faces: [] }], "photo_id_trung");
  sai("quá trần số mặt", [{ photoId: uuid(1), faces: Array.from({ length: MAX_FACES + 1 }, (_, i) => face(i)) }], "qua_nhieu_mat");
  sai("at không liền mạch", [{ photoId: uuid(1), faces: [face(1)] }], "at_sai_thu_tu");
  sai("vector 127 chiều", [{ photoId: uuid(1), faces: [{ ...face(0), descriptor: vec(1).slice(1) }] }], "descriptor_sai_chieu");
  sai("vector có NaN", [{ photoId: uuid(1), faces: [{ ...face(0), descriptor: [NaN, ...vec(1).slice(1)] }] }], "descriptor_sai_so");
  sai("vector có chuỗi", [{ photoId: uuid(1), faces: [{ ...face(0), descriptor: ["1", ...vec(1).slice(1)] }] }], "descriptor_sai_so");
  sai("khung ngoài 0…1", [{ photoId: uuid(1), faces: [{ ...face(0), box: [0, 0, 1.2, 1] }] }], "box_sai");
  sai("khung 3 số", [{ photoId: uuid(1), faces: [{ ...face(0), box: [0, 0, 1] }] }], "box_sai");
  sai("độ nét âm", [{ photoId: uuid(1), faces: [{ ...face(0), sharpness: -1 }] }], "sharpness_sai");
  sai("lý do bỏ qua không vĩnh viễn (403 là tạm)", [{ photoId: uuid(1), skip: "http-403" }], "ly_do_bo_qua_sai");
  ok("404 và PNG là vĩnh viễn; 403/429/mạng là tạm", laLoiVinhVien("http-404") && laLoiVinhVien("khong-phai-jpeg") && !laLoiVinhVien("http-403") && !laLoiVinhVien("http-429") && !laLoiVinhVien("mang-loi: x") && !laLoiVinhVien(null));
}

/* ── Database giả (PostgREST tối thiểu) ──────────────────────────────────── */
function fakeDb({ photos, clusteredAt = null, giuMoc = true, albums = null }) {
  const t = { photos, album_faces: [], album_people: [], album_photo_people: [], albums: albums ?? [{ id: "A", faces_clustered_at: clusteredAt }] };
  const stats = { docFaces: 0 };
  const from = (table) => {
    const f = [];
    let op = "select", payload = null, head = false, cnt = false, range = null, lim = Infinity, single = false;
    const hit = () => t[table].filter((r) => f.every((fn) => fn(r)));
    const self = {
      select(_c, o) { if (o?.head) head = true; if (o?.count) cnt = true; return self; },
      insert(p) { op = "insert"; payload = p; return self; },
      upsert(p) { op = "upsert"; payload = p; return self; },
      update(p) { op = "update"; payload = p; return self; },
      delete() { op = "delete"; return self; },
      eq(c, v) { f.push((r) => r[c] === v); return self; },
      neq(c, v) { f.push((r) => r[c] !== v); return self; },
      gt(c, v) { f.push((r) => r[c] != null && r[c] > v); return self; },
      is(c, v) { if (v === null) f.push((r) => r[c] == null); return self; },
      not(c, o, v) { if (o === "is" && v === null) f.push((r) => r[c] != null); return self; },
      in(c, l) { f.push((r) => l.includes(r[c])); return self; },
      order() { return self; },
      limit(n) { lim = n; return self; },
      range(a, b) { range = [a, b]; return self; },
      maybeSingle() { single = true; return self; },
      then(res) {
        if (op === "select") {
          const h = hit();
          if (table === "album_faces" && !head) stats.docFaces++;
          if (head) return res({ data: null, count: h.length, error: null });
          let d = range ? h.slice(range[0], range[1] + 1) : h.slice(0, lim);
          if (single) d = d[0] ?? null;
          return res({ data: d, count: cnt ? h.length : null, error: null });
        }
        if (op === "update") {
          const h = hit();
          if (table !== "photos" || giuMoc) for (const r of h) Object.assign(r, payload);
          return res({ data: h.map((r) => ({ id: r.id })), error: null });
        }
        if (op === "delete") { const h = new Set(hit()); t[table] = t[table].filter((r) => !h.has(r)); return res({ error: null }); }
        const rows = Array.isArray(payload) ? payload : [payload];
        if (op === "upsert" && table === "album_faces") t[table] = t[table].filter((r) => !rows.some((n) => n.photo_id === r.photo_id && n.at === r.at));
        t[table].push(...rows);
        return res({ data: rows.map((r) => ({ photo_id: r.photo_id })), error: null });
      },
    };
    return self;
  };
  return { from, t, stats };
}
const anh = (n, over = {}) => ({ id: uuid(n), album_id: "A", position: n, drive_file_id: `d${n}`, name: `a${n}.jpg`, is_video: false, faces_scanned_at: null, ...over });

/* ── 2. Giao việc: cùng định nghĩa "còn phải quét" ───────────────────────── */
{
  const db = fakeDb({ photos: [anh(1), anh(2, { is_video: true }), anh(3, { drive_file_id: "" }), anh(4, { faces_scanned_at: "2026-01-01T00:00:00Z" }), anh(5), { ...anh(6), album_id: "B" }] });
  const v = await layViecQuet(db, "A");
  check("tổng / đã quét / còn lại bỏ video và ảnh thiếu drive_file_id", [v.tong, v.daQuet, v.conLai], [3, 1, 2]);
  check("chỉ giao ảnh còn chờ của ĐÚNG album", v.anh.map((p) => p.id), [uuid(1), uuid(5)]);
  ok("mỗi dòng chỉ có id, drive_file_id, name", Object.keys(v.anh[0]).length <= 8 && v.anh[0].drive_file_id === "d1");
}

/* ── 3. Nhận kết quả: ghi đúng như scanAlbum ─────────────────────────────── */
{
  const db = fakeDb({ photos: [anh(1), anh(2), anh(3), anh(4, { faces_scanned_at: "2026-01-01T00:00:00Z" }), { ...anh(9), album_id: "B" }] });
  const r = await nhanLoKetQua(db, "A", [{ photoId: uuid(1), faces: [face(0), face(1, 2)] }, { photoId: uuid(2), faces: [] }, { photoId: uuid(4), faces: [face(0, 9)] }]);
  check("ghi 2 tấm, 2 khuôn mặt, bỏ 1 tấm đã quét, còn 1", [r.ok, r.daGhi, r.khuonMat, r.boQuaDaQuet, r.conLai, r.xong], [true, 2, 2, 1, 1, false]);
  const d = db.t.album_faces[0];
  check("dòng album_faces đúng hình dạng của bộ quét máy chủ", Object.keys(d).sort(), ["album_id", "at", "box", "descriptor", "photo_id", "sharpness"]);
  ok("…box là mảng 4, descriptor 128, at theo thứ tự", d.box.length === 4 && d.descriptor.length === 128 && db.t.album_faces.map((x) => x.at).join() === "0,1");
  ok("ảnh 0 mặt vẫn được đánh mốc", db.t.photos[1].faces_scanned_at !== null);
  ok("tấm đã quét KHÔNG bị ghi đè khuôn mặt", !db.t.album_faces.some((x) => x.photo_id === uuid(4)));

  const la = await nhanLoKetQua(db, "A", [{ photoId: uuid(9), faces: [face(0)] }]);
  check("ảnh của album KHÁC → từ chối cả lô", [la.ok, la.error], [false, "anh_khong_thuoc_album"]);
  ok("…và không ghi gì", db.t.album_faces.length === 2 && db.t.photos[4].faces_scanned_at === null);

  const cuoi = await nhanLoKetQua(db, "A", [{ photoId: uuid(3), skip: "http-404" }]);
  check("tấm 404 được đánh mốc (0 mặt) → album xong", [cuoi.ok, cuoi.conLai, cuoi.xong], [true, 0, true]);
  const rac = await nhanLoKetQua(db, "A", [{ photoId: uuid(1), faces: [{ at: 0 }] }]);
  check("lô rác → lo_khong_hop_le", [rac.ok, rac.error], [false, "lo_khong_hop_le"]);
}
{
  // Mốc ghi không nằm lại → báo ghi-khong-an để máy studio DỪNG, không quét lặp.
  const db = fakeDb({ photos: [anh(1), anh(2)], giuMoc: false });
  const r = await nhanLoKetQua(db, "A", [{ photoId: uuid(1), faces: [face(0)] }]);
  check("ghi không ăn → ok:false, error ghi-khong-an", [r.ok, r.error], [false, "ghi-khong-an"]);
}

/* ── 4. Gom: đúng lúc, và không gom thừa ─────────────────────────────────── */
{
  const db = fakeDb({ photos: [anh(1), anh(2), anh(3), anh(4)] });
  check("chưa quét tấm nào → không gom", (await gomNeuCan(db, "A")).gom, false);
  // Ba tấm cùng một người, rồi tấm CUỐI không có mặt (mẻ cuối không ghi dòng nào).
  await nhanLoKetQua(db, "A", [1, 2, 3].map((n) => ({ photoId: uuid(n), faces: [face(0, 1)] })));
  const g1 = await gomNeuCan(db, "A");
  check("quét dở, chưa gom lần nào → gom ngay (khách thấy phần đã có)", [g1.gom, g1.nguoi], [true, 1]);
  const doc = db.stats.docFaces;
  check("gọi lại ngay → không gom, không đọc vector", [(await gomNeuCan(db, "A")).gom, db.stats.docFaces], [false, doc]);
  await new Promise((r) => setTimeout(r, 5));
  await nhanLoKetQua(db, "A", [{ photoId: uuid(4), faces: [] }]);
  ok("mẻ cuối 0 mặt KHÔNG đặt lại hàng đợi…", db.t.albums[0].faces_clustered_at !== null);
  const v = await layViecQuet(db, "A");
  ok("…nhưng album xong mà có tấm quét sau lần gom → canGom", v.conLai === 0 && v.canGom === true);
  check("→ gom đúng một lần nữa", (await gomNeuCan(db, "A")).gom, true);
  check("…rồi thôi", [(await gomNeuCan(db, "A")).gom, (await layViecQuet(db, "A")).canGom], [false, false]);
}
{
  // Luật 12 giờ: còn quét dở + vừa gom xong → không gom lại dù có mặt mới.
  const db = fakeDb({ photos: [anh(1), anh(2), anh(3)], clusteredAt: new Date(Date.now() - 3600_000).toISOString() });
  await nhanLoKetQua(db, "A", [{ photoId: uuid(1), faces: [face(0)] }]);
  const g = await gomNeuCan(db, "A");
  check("quét dở, gom cách đây 1 giờ → chờ 12 giờ", [g.gom, g.lyDo], [false, "cho-12-gio"]);
  const cu = fakeDb({ photos: [anh(1), anh(2), anh(3)], clusteredAt: new Date(Date.now() - 13 * 3600_000).toISOString() });
  await nhanLoKetQua(cu, "A", [{ photoId: uuid(1), faces: [face(0)] }]);
  check("quét dở, gom cách đây 13 giờ → gom lại", (await gomNeuCan(cu, "A")).gom, true);
}

/* ── 5. Không hứa với khách một lượt quét không ai chạy ──────────────────── */
{
  check("máy chủ không quét + chưa quét tấm nào → KHÔNG nói gì", tienDoNoiVoiKhach({ daQuet: 0, tong: 700 }, false), null);
  check("máy chủ không quét + studio đã quét dở → nói số, không hẹn đêm", tienDoNoiVoiKhach({ daQuet: 210, tong: 700 }, false), { daQuet: 210, tong: 700 });
  check("máy chủ tự quét → nói cả khi 0/700, kèm cờ mayChu", tienDoNoiVoiKhach({ daQuet: 0, tong: 700 }, true), { daQuet: 0, tong: 700, mayChu: true });
  check("quét xong → không nói gì (cả hai chế độ)", [tienDoNoiVoiKhach({ daQuet: 700, tong: 700 }, false), tienDoNoiVoiKhach({ daQuet: 700, tong: 700 }, true)], [null, null]);
  for (const f of ["src/app/album/[slug]/page.tsx", "src/app/a/[slug]/page.tsx", "src/app/api/album/[slug]/access/route.ts", "src/app/api/a/[slug]/access/route.ts"]) {
    const src = readFileSync(f, "utf8");
    ok(`${f}: dùng tienDoChoKhach, không gọi thẳng tienDoQuet`, /tienDoChoKhach\(/.test(src) && !/tienDoQuet\(/.test(src));
  }
}

/* ── 6. So khớp chỉ bằng vector ──────────────────────────────────────────── */
{
  ok("vector 128 số hữu hạn được nhận", laDescriptorHopLe(vec(1)));
  ok("từ chối 127 chiều / NaN / chuỗi / không phải mảng", !laDescriptorHopLe(vec(1).slice(1)) && !laDescriptorHopLe([NaN, ...vec(1).slice(1)]) && !laDescriptorHopLe(vec(1).map(String)) && !laDescriptorHopLe("x"));
  const people = [{ id: "co-dau", descriptor: vec(1) }, { id: "chu-re", descriptor: vec(5) }];
  const gan = vec(1).map((x) => x + 0.005);
  check("vector của khách khớp đúng người theo luật có sẵn (nearestPerson)", nearestPerson(gan, people)?.id, "co-dau");
  check("vector lạ → không khớp ai", nearestPerson(vec(1).map((x) => x + 0.2), people), null);
  const route = readFileSync("src/app/api/album/[slug]/face-match/route.ts", "utf8");
  ok("route nhận JSON descriptor", /laDescriptorHopLe\(body\?\.descriptor\)/.test(route));
  ok("route chỉ nhận ẢNH khi máy chủ được bật nhận diện", /if \(!faceServerScanEnabled\(\)\) return NextResponse\.json\(\{ error: "chi_nhan_descriptor" \}/.test(route));
  ok("route không nhập tĩnh face-node", !/^import .*face-node/m.test(route));
  ok("giữ hình dạng trả lời cũ (personId, distance, faces)", /personId: hit\.id, distance: hit\.distance, faces: soMat/.test(route));
  ok("không gửi tâm cụm xuống máy khách", !/descriptor:\s*p\.descriptor[^}]*\}\s*\)\s*;?\s*return NextResponse\.json\(\{[^}]*people/.test(route));
}

/* ── 7. Route của máy studio KHÔNG kéo theo TensorFlow ───────────────────── */
{
  const seen = new Set();
  const cam = [];
  const di = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    if (/@tensorflow|@vladmandic|face-node|face-scan-server/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""))) cam.push(file);
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      const base = spec.startsWith("@/") ? resolve("src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(file), spec) : null;
      if (!base) continue;
      const f = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((x) => existsSync(x) && /\.tsx?$/.test(x));
      if (f) di(f);
    }
  };
  di("src/app/api/albums/[id]/face-local/route.ts");
  di("src/app/api/face-local/hang-doi/route.ts");
  ok(`route face-local và mọi file nó nhập (${seen.size}) không chạm TensorFlow / face-node`, cam.length === 0 && seen.size > 5, cam.join(", "));
  const cron = readFileSync("src/app/api/cron/face-scan/route.ts", "utf8");
  ok("cron dừng trước khi quét khi máy chủ không được bật", /!faceServerScanEnabled\(\)/.test(cron));
  const scan = readFileSync("src/app/api/albums/[id]/face-scan/route.ts", "utf8");
  ok("nút quét máy chủ nói rõ chỗ quét mới thay vì chạy", /quet_may_chu_tat/.test(scan) && scan.indexOf("quet_may_chu_tat") < scan.indexOf("await scanAlbum("));
}

/* ── 8. Hàng đợi của bộ TỰ QUÉT nền khi studio mở dashboard ──────────────── */
{
  const al = (id, owner, title) => ({ id, owner_id: owner, title, faces_clustered_at: null });
  const p = (n, album, over = {}) => ({ ...anh(n), album_id: album, ...over });
  // 12 album của chủ U (để vượt một nhóm 8), 1 album của chủ khác.
  const albums = [...Array.from({ length: 12 }, (_, i) => al(`U${i}`, "U", `Album ${i}`)), al("X0", "X", "Của người khác")];
  const photos = [
    p(1, "U0"), p(2, "U0"), p(3, "U0", { faces_scanned_at: "2026-01-01T00:00:00Z" }),
    p(4, "U3", { is_video: true }), p(5, "U3", { drive_file_id: "" }),
    p(6, "U10"),
    p(7, "X0"),
    p(8, "U5", { faces_scanned_at: "2026-01-01T00:00:00Z" }),
  ];
  // Album đã quét XONG và ĐÃ gom sau lần quét cuối: không còn việc gì.
  const daGom = (ds) => ds.map((a) => ({ ...a, faces_clustered_at: "2026-06-01T00:00:00Z" }));
  const db = fakeDb({ photos, albums: daGom(albums) });
  const h = await albumChoQuetCuaChu(db, "U");
  check("chỉ album CỦA CHỦ còn ảnh chờ thật (bỏ video, ảnh thiếu drive_file_id, ảnh đã quét)", h.map((a) => [a.id, a.conLai]), [["U0", 2], ["U10", 1]]);
  ok("có tên album để hiện trên ô tiến độ", h[0].ten === "Album 0");
  check("giới hạn số album mỗi lượt", (await albumChoQuetCuaChu(db, "U", 1)).map((a) => a.id), ["U0"]);
  const xong = fakeDb({ photos: [p(9, "U1", { faces_scanned_at: "2026-01-01T00:00:00Z" })], albums: daGom(albums) });
  check("không còn gì → danh sách rỗng", await albumChoQuetCuaChu(xong, "U"), []);
  check("chủ không có album → rỗng", await albumChoQuetCuaChu(db, "khong-ai"), []);
  // Album đã quét hết nhưng lượt gom trước hỏng (chưa có mốc gom) → vẫn vào hàng đợi.
  const chuaGom = fakeDb({
    photos: [p(20, "U2", { faces_scanned_at: "2026-02-01T00:00:00Z" }), p(21, "U4", { faces_scanned_at: "2026-02-01T00:00:00Z" })],
    albums: albums.map((a) => (a.id === "U4" ? { ...a, faces_clustered_at: "2026-03-01T00:00:00Z" } : a)),
  });
  check(
    "album đã quét mà CHƯA gom (lượt gom trước hỏng) vẫn vào hàng đợi; album đã gom sau lần quét cuối thì không",
    await albumChoQuetCuaChu(chuaGom, "U"),
    [{ id: "U2", ten: "Album 2", conLai: 0, canGom: true }],
  );
}

/* ── 9. Bộ tự quét nền: các luật không được trôi ─────────────────────────── */
{
  const src = readFileSync("src/components/v2/FaceAutoScan.tsx", "utf8");
  ok("không tự quét trên điện thoại / máy ít RAM / tiết kiệm dữ liệu", /pointer: coarse/.test(src) && /deviceMemory/.test(src) && /saveData/.test(src));
  ok("chỉ một tab quét: Web Locks XẾP HÀNG (không ifAvailable — tab sau phải tiếp quản được)", /locks\.request\(KHOA_TAB, \{ signal: phien\.signal \}/.test(src) && !/ifAvailable/.test(src));
  ok("nhường khi studio bấm quét tay", /nghePhaiNhuong/.test(src) && /dangQuetTay\(\)/.test(src));
  ok("chạy nhẹ: nghỉ theo tỉ lệ thời gian làm (≥ 1 lần → máy bận ≤ ~50%)", /tiLeNghi: TI_LE_NGHI/.test(src) && Number(src.match(/const TI_LE_NGHI = ([\d.]+)/)?.[1]) >= 1);
  const runner = readFileSync("src/lib/face-local-runner.ts", "utf8");
  ok("…khoảng nghỉ tính từ thời gian nhận diện thật, có trần", /lamMs \* tiLeNghi/.test(runner) && /Math\.min\(10_000/.test(runner));
  ok("có nút tạm dừng và tắt trên máy này", /Tạm dừng/.test(src) && /Tắt tự quét trên máy này/.test(src));
  const sw = readFileSync("public/sw.js", "utf8");
  const embed = readFileSync("src/lib/face-embed-browser.ts", "utf8");
  ok("ảnh tải để quét (&quet=1) đi thẳng mạng, không chiếm bộ nhớ đệm ảnh của service worker", /&quet=1/.test(embed) && /searchParams\.get\("quet"\) === "1"\) return;/.test(sw) && sw.indexOf('"quet"') < sw.indexOf("respondWith(imageFirst(req))"));
  const layout = readFileSync("src/app/dashboard/layout.tsx", "utf8");
  ok("chỉ gắn ở giao diện mới, chỉ chủ tài khoản đủ gói", /ui\.active && tuQuetMat && <FaceAutoScan \/>/.test(layout) && /!profile\.studio_owner_id/.test(layout) && /planAllowsFaceSearch\(/.test(layout));
}

console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} lỗi`);
process.exit(fail === 0 ? 0 : 1);
