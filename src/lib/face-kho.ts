/**
 * KHO KHUÔN MẶT DẠNG FILE — định dạng nhị phân + gộp + so khớp.
 *
 * VÌ SAO. Bảng album_faces (mỗi khuôn mặt một dòng, vector 128 số real[]) là
 * thứ đẩy database tới sát trần 500 MB của gói Free. Storage thì gần như trống
 * (trần 1 GB). Kho này đưa cùng dữ liệu đó vào FILE: mỗi lượt quét ghi một
 * "mảnh" (chunk) vào Storage, đọc lại thì gộp các mảnh của album.
 *
 * Đợt 1 (file này ra đời): GHI KÉP — mọi lượt quét vẫn ghi album_faces như cũ,
 * thêm một mảnh vào kho; và KHÁCH tự quét được trên máy mình, kết quả chỉ vào
 * kho. Đợt sau mới chuyển các đường đọc (gom, ghép layout) sang kho.
 *
 * File này THUẦN (không DB, không Storage, không import gì) để chạy được cả
 * trong trình duyệt khách lẫn kiểm thử Node.
 *
 * ── ĐỊNH DẠNG v1 (little-endian) ─────────────────────────────────────────────
 *   "MFK" + 0x01        4 byte  — dấu nhận + phiên bản
 *   nguon               u8      — 1 = studio / máy chủ, 2 = khách tự quét
 *   (dự phòng)          3 byte
 *   soAnh               u32
 *   mỗi ảnh:
 *     photo_id          16 byte (uuid nhị phân)
 *     soMat             u8      — 0 nghĩa là ĐÃ QUÉT, không có mặt nào
 *     mỗi mặt:
 *       box x,y,w,h     4 × u16 (tỉ lệ 0…1 nhân 65535)
 *       sharpness       f32
 *       descriptor      128 × f16
 *
 * Một mặt = 268 byte (album_faces: ~600 byte/dòng kể cả chỉ mục). f16 có ~3 chữ
 * số có nghĩa: sai số khoảng cách vào cỡ 0,001 — không đáng kể so với ngưỡng 0,6.
 */

export const NGUON_STUDIO = 1;
export const NGUON_KHACH = 2;
export type Nguon = typeof NGUON_STUDIO | typeof NGUON_KHACH;

export const SO_CHIEU = 128;
/** Trần số mặt một ảnh — bằng MAX_FACES của bộ quét. */
export const MAT_TOI_DA = 24;
/** Ngưỡng "cùng một người" — bằng GROUP_DEFAULTS.maxDistance (@/lib/face-group). */
export const NGUONG_KHOP = 0.6;

const DAU = [0x4d, 0x46, 0x4b, 0x01]; // "MFK" v1
const DAU_DAI = 12;
const ANH_DAI = 17;
const MAT_DAI = 8 + 4 + SO_CHIEU * 2;

export type MatKho = {
  /** [x, y, w, h] theo tỉ lệ 0…1 của ảnh. */
  box: [number, number, number, number];
  descriptor: number[];
  sharpness: number;
};
export type AnhKho = { photoId: string; faces: MatKho[] };
export type ManhKho = { nguon: Nguon; anh: AnhKho[] };

/* ── f16 ⇄ f32 ────────────────────────────────────────────────────────────── */

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

export function f32SangF16(v: number): number {
  f32[0] = v;
  const x = u32[0];
  const dau = (x >>> 16) & 0x8000;
  const mu = (x >>> 23) & 0xff;
  let dinh = x & 0x7fffff;
  if (mu === 0xff) return dau | 0x7c00 | (dinh ? 0x200 : 0); // Inf / NaN
  let e = mu - 127 + 15;
  if (e >= 0x1f) return dau | 0x7c00; // tràn → Inf
  if (e <= 0) {
    if (e < -10) return dau; // quá nhỏ → 0
    dinh |= 0x800000;
    const dich = 14 - e;
    let m = dinh >>> dich;
    if ((dinh >>> (dich - 1)) & 1) m += 1; // làm tròn
    return dau | m;
  }
  let m = dinh >>> 13;
  if (dinh & 0x1000) {
    m += 1;
    if (m === 0x400) {
      m = 0;
      e += 1;
      if (e >= 0x1f) return dau | 0x7c00;
    }
  }
  return dau | (e << 10) | m;
}

export function f16SangF32(h: number): number {
  const dau = h & 0x8000 ? -1 : 1;
  const e = (h >>> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return dau * m * 2 ** -24;
  if (e === 0x1f) return m ? NaN : dau * Infinity;
  return dau * (1 + m / 1024) * 2 ** (e - 15);
}

/* ── uuid ⇄ 16 byte ───────────────────────────────────────────────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const laUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

function ghiUuid(dv: DataView, o: number, id: string) {
  const hex = id.replace(/-/g, "");
  for (let i = 0; i < 16; i++) dv.setUint8(o + i, parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}
function docUuid(dv: DataView, o: number): string {
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += dv.getUint8(o + i).toString(16).padStart(2, "0");
    if (i === 3 || i === 5 || i === 7 || i === 9) s += "-";
  }
  return s;
}

/* ── mã hoá / giải mã ────────────────────────────────────────────────────── */

const kep01 = (n: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0)) * 65535);

export function maHoaManh(m: ManhKho): Uint8Array {
  let dai = DAU_DAI;
  for (const a of m.anh) dai += ANH_DAI + a.faces.length * MAT_DAI;
  const buf = new Uint8Array(dai);
  const dv = new DataView(buf.buffer);
  DAU.forEach((b, i) => dv.setUint8(i, b));
  dv.setUint8(4, m.nguon);
  dv.setUint32(8, m.anh.length, true);
  let o = DAU_DAI;
  for (const a of m.anh) {
    if (!laUuid(a.photoId)) throw new Error("photo_id_sai");
    if (a.faces.length > MAT_TOI_DA) throw new Error("qua_nhieu_mat");
    ghiUuid(dv, o, a.photoId);
    dv.setUint8(o + 16, a.faces.length);
    o += ANH_DAI;
    for (const f of a.faces) {
      if (f.descriptor.length !== SO_CHIEU) throw new Error("descriptor_sai_chieu");
      for (let i = 0; i < 4; i++) dv.setUint16(o + i * 2, kep01(f.box[i]), true);
      dv.setFloat32(o + 8, Number.isFinite(f.sharpness) ? f.sharpness : 0, true);
      for (let i = 0; i < SO_CHIEU; i++) dv.setUint16(o + 12 + i * 2, f32SangF16(f.descriptor[i]), true);
      o += MAT_DAI;
    }
  }
  return buf;
}

/**
 * Giải mã một mảnh. Sai bất kỳ chỗ nào → NÉM: mảnh hỏng (ghi dở, khách gửi
 * rác) phải bị loại nguyên mảnh chứ không được góp nửa số ảnh vào kho.
 */
export function giaiMaManh(bytes: Uint8Array): ManhKho {
  if (bytes.length < DAU_DAI) throw new Error("manh_qua_ngan");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < 4; i++) if (dv.getUint8(i) !== DAU[i]) throw new Error("sai_dau_nhan");
  const nguon = dv.getUint8(4);
  if (nguon !== NGUON_STUDIO && nguon !== NGUON_KHACH) throw new Error("sai_nguon");
  const soAnh = dv.getUint32(8, true);
  const anh: AnhKho[] = [];
  let o = DAU_DAI;
  for (let k = 0; k < soAnh; k++) {
    if (o + ANH_DAI > bytes.length) throw new Error("manh_cut_ngang");
    const photoId = docUuid(dv, o);
    const soMat = dv.getUint8(o + 16);
    if (soMat > MAT_TOI_DA) throw new Error("qua_nhieu_mat");
    o += ANH_DAI;
    if (o + soMat * MAT_DAI > bytes.length) throw new Error("manh_cut_ngang");
    const faces: MatKho[] = [];
    for (let j = 0; j < soMat; j++) {
      const box = [0, 1, 2, 3].map((i) => dv.getUint16(o + i * 2, true) / 65535) as MatKho["box"];
      const sharpness = dv.getFloat32(o + 8, true);
      const descriptor = new Array<number>(SO_CHIEU);
      for (let i = 0; i < SO_CHIEU; i++) {
        const v = f16SangF32(dv.getUint16(o + 12 + i * 2, true));
        if (!Number.isFinite(v)) throw new Error("descriptor_sai_so");
        descriptor[i] = v;
      }
      faces.push({ box, descriptor, sharpness: Number.isFinite(sharpness) ? sharpness : 0 });
      o += MAT_DAI;
    }
    anh.push({ photoId, faces });
  }
  if (o !== bytes.length) throw new Error("thua_byte");
  return { nguon: nguon as Nguon, anh };
}

/* ── gộp ──────────────────────────────────────────────────────────────────── */

export type KhoGop = Map<string, { faces: MatKho[]; nguon: Nguon }>;

/**
 * Gộp các mảnh của một album thành một bản đồ photo_id → khuôn mặt.
 *
 * Mỗi ảnh chỉ lấy MỘT bản: bản của studio/máy chủ thắng bản khách quét (dữ liệu
 * khách gửi lên không kiểm lại được); cùng nguồn thì bản ĐẦU TIÊN thắng — khách
 * sau không ghi đè được kết quả của người trước. Truyền mảnh theo thứ tự ghi.
 */
export function gopManh(manh: readonly ManhKho[]): KhoGop {
  const kq: KhoGop = new Map();
  for (const m of manh) {
    for (const a of m.anh) {
      const cu = kq.get(a.photoId);
      if (!cu || (cu.nguon === NGUON_KHACH && m.nguon === NGUON_STUDIO)) kq.set(a.photoId, { faces: a.faces, nguon: m.nguon });
    }
  }
  return kq;
}

/** Tách bản gộp về lại hai mảnh (studio, khách) — để nén nhiều mảnh nhỏ thành ít. */
export function tachTheoNguon(kho: KhoGop): ManhKho[] {
  const s: AnhKho[] = [];
  const k: AnhKho[] = [];
  for (const [photoId, v] of kho) (v.nguon === NGUON_STUDIO ? s : k).push({ photoId, faces: v.faces });
  const out: ManhKho[] = [];
  if (s.length) out.push({ nguon: NGUON_STUDIO, anh: s });
  if (k.length) out.push({ nguon: NGUON_KHACH, anh: k });
  return out;
}

/* ── so khớp ──────────────────────────────────────────────────────────────── */

export function khoangCach(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < SO_CHIEU; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Ảnh này có mặt nào đủ gần vector của khách không. */
export function coMatKhop(faces: readonly MatKho[], toi: ArrayLike<number>, nguong = NGUONG_KHOP): boolean {
  return faces.some((f) => khoangCach(f.descriptor, toi) <= nguong);
}

/** Mọi ảnh trong kho có mặt khớp với vector của khách. */
export function anhKhop(kho: KhoGop, toi: ArrayLike<number>, nguong = NGUONG_KHOP): string[] {
  const out: string[] = [];
  for (const [id, v] of kho) if (coMatKhop(v.faces, toi, nguong)) out.push(id);
  return out;
}

/**
 * Kiểm một mảnh KHÁCH gửi lên trước khi cất: vector phải là số thật của mạng
 * này (|v| ≤ 2 — vector thật nằm trong ±1), khung mặt hợp lệ.
 */
export function kiemManhKhach(m: ManhKho, toiDaAnh: number): string | null {
  if (m.nguon !== NGUON_KHACH) return "sai_nguon";
  if (m.anh.length === 0) return "manh_rong";
  if (m.anh.length > toiDaAnh) return "manh_qua_lon";
  const seen = new Set<string>();
  for (const a of m.anh) {
    if (seen.has(a.photoId)) return "photo_id_trung";
    seen.add(a.photoId);
    for (const f of a.faces) {
      if (f.box[2] <= 0 || f.box[3] <= 0) return "box_sai";
      if (f.descriptor.some((v) => Math.abs(v) > 2)) return "descriptor_sai_so";
      if (f.sharpness < 0) return "sharpness_sai";
    }
  }
  return null;
}
