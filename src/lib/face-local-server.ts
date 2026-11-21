/* eslint-disable @typescript-eslint/no-explicit-any */

import { apDungLocCanQuet, apDungLocConQuet } from "./face-can-quet";
import { GOM_LAI_SAU_MS, ghiKetQuaQuet, veHangDoiGomNeuCan } from "./face-ghi";
import { clusterAlbum, ghiNguoi } from "./face-gom";
import { daDonKhuonMat } from "./face-don";
import { kiemLoKetQua } from "./face-scan-core";

/**
 * PHÍA MÁY CHỦ CỦA VIỆC QUÉT TRÊN MÁY STUDIO — giao việc, nhận kết quả, gom.
 *
 * Luật thuần + vào/ra DB, KHÔNG TensorFlow (không nhập face-node /
 * face-scan-server). Route /api/albums/[id]/face-local chỉ lo đăng nhập, gói,
 * giới hạn tần suất rồi gọi xuống đây. Kiểm thử: desktop/test/face-local.mjs.
 */

/** Số ảnh giao mỗi trang. Nhỏ: mỗi dòng ~120 byte, và máy studio hỏi lại liên tục. */
export const TRANG_VIEC = 40;

export type ViecQuet = {
  /** Ảnh CẦN quét của album (không tính video / thiếu drive_file_id). */
  tong: number;
  conLai: number;
  daQuet: number;
  nguoi: number;
  /** Album đã quét hết mà còn khuôn mặt chưa gom → máy studio gọi {gom:true}. */
  canGom: boolean;
  anh: { id: string; drive_file_id: string; name: string | null }[];
};

const dem = (db: any, albumId: string) => db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);

/**
 * Album có cần gom không: đang trong hàng đợi, hoặc có tấm quét SAU lần gom cuối.
 *
 * `gomNgay` = false (bộ tự quét, tự gom khi mở trang): album ĐÃ từng gom thì gom
 * lại nhiều nhất GOM_LAI_SAU_MS một lần. Mỗi lần gom máy studio đọc toàn bộ vector
 * khuôn mặt của album (10–50 MB với album cưới), mà desktop đổ ảnh vào album rải
 * rác cả ngày — mỗi đợt vài tấm mới từng kéo theo một lượt đọc lại cả album.
 * Studio bấm "Quét" tay thì gom ngay.
 */
async function canGomKhong(db: any, albumId: string, daQuet: number, gomNgay = true): Promise<{ can: boolean; lanCuoi: number | null }> {
  const { data: al, error } = await db.from("albums").select("faces_clustered_at").eq("id", albumId).maybeSingle();
  if (error) throw new Error(`doc_album_that_bai: ${error.message}`);
  const lanCuoi = al?.faces_clustered_at ? Date.parse(al.faces_clustered_at as string) : null;
  if (daQuet === 0) return { can: false, lanCuoi };
  // Album đã dọn vector (face-don.ts): không gom được nữa — đừng để máy studio
  // đọc cả bảng khuôn mặt về rồi mới bị từ chối lúc ghi.
  if (await daDonKhuonMat(db, albumId)) return { can: false, lanCuoi };
  if (lanCuoi === null || !Number.isFinite(lanCuoi)) return { can: true, lanCuoi: null };
  if (!gomNgay && Date.now() - lanCuoi < GOM_LAI_SAU_MS) return { can: false, lanCuoi };
  /*
   * Mốc gom còn đó không có nghĩa là không còn gì để gom: mẻ CUỐI của album có
   * thể toàn ảnh không mặt (không ghi dòng nào nên không đặt lại hàng đợi),
   * trong khi các mẻ trước đã ghi mặt mà chưa gom. Một dòng, một cột.
   */
  const { data: moi } = await db
    .from("photos")
    .select("id")
    .eq("album_id", albumId)
    .gt("faces_scanned_at", al.faces_clustered_at)
    .limit(1);
  return { can: (moi ?? []).length > 0, lanCuoi };
}

/** Tiến độ + một trang ảnh còn phải quét. `boQua` để bỏ qua những tấm vừa hỏng tạm. */
export async function layViecQuet(db: any, albumId: string, boQua = 0, gomNgay = false): Promise<ViecQuet> {
  const from = Math.max(0, Math.min(Number.isFinite(boQua) ? Math.floor(boQua) : 0, 100_000));
  const [can, cho, ng] = await Promise.all([
    apDungLocCanQuet(dem(db, albumId)),
    apDungLocConQuet(db.from("photos").select("id, drive_file_id, name", { count: "exact" }).eq("album_id", albumId))
      .order("position")
      .order("id")
      .range(from, from + TRANG_VIEC - 1),
    db.from("album_people").select("id", { count: "exact", head: true }).eq("album_id", albumId),
  ]);
  if (can.error) throw new Error(`dem_anh_that_bai: ${can.error.message}`);
  // `range` quá cuối danh sách thì PostgREST trả 416 — coi là trang rỗng.
  const anh = (cho.error ? [] : cho.data ?? []) as ViecQuet["anh"];
  const tong = can.count ?? 0;
  let conLai = cho.count ?? null;
  if (conLai === null) {
    const c = await apDungLocConQuet(dem(db, albumId));
    if (c.error) throw new Error(`dem_anh_cho_that_bai: ${c.error.message}`);
    conLai = c.count ?? 0;
  }
  const daQuet = Math.max(0, tong - conLai);
  const g = conLai === 0 ? await canGomKhong(db, albumId, daQuet, gomNgay) : { can: false };
  return { tong, conLai, daQuet, nguoi: ng.error ? 0 : ng.count ?? 0, canGom: g.can, anh };
}

export type KetQuaNhan =
  | { ok: true; daGhi: number; khuonMat: number; boQuaDaQuet: number; conLai: number; xong: boolean }
  | { ok: false; error: string; detail?: string };

/**
 * Nhận một lô kết quả từ máy studio và ghi xuống DB đúng như `scanAlbum` ghi.
 *
 * Chỉ nhận ảnh THUỘC album này và CÒN CHỜ QUÉT: tấm đã có mốc (tab thứ hai, hay
 * máy chủ vừa quét) bị bỏ qua — ghi đè sẽ trộn hai lượt dò của cùng một tấm.
 */
export async function nhanLoKetQua(db: any, albumId: string, raw: unknown): Promise<KetQuaNhan> {
  const k = kiemLoKetQua(raw);
  if (!k.ok) return { ok: false, error: "lo_khong_hop_le", detail: k.loi };

  const ids = k.lo.map((r) => r.photoId);
  const { data: rows, error } = await apDungLocConQuet(db.from("photos").select("id").eq("album_id", albumId).in("id", ids));
  if (error) throw new Error(`doc_anh_cua_lo_that_bai: ${error.message}`);
  const conCho = new Set(((rows ?? []) as { id: string }[]).map((r) => r.id));
  // Tấm nào không thuộc album (hoặc là video) thì cả lô bị từ chối — không phải
  // chuyện "đã quét rồi". Phân biệt bằng một câu đếm theo album, không lọc mốc.
  if (conCho.size < ids.length) {
    const { count } = await db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId).in("id", ids);
    if ((count ?? 0) < ids.length) return { ok: false, error: "anh_khong_thuoc_album" };
  }

  const faceRows: Record<string, unknown>[] = [];
  const doneIds: string[] = [];
  for (const r of k.lo) {
    if (!conCho.has(r.photoId)) continue;
    if ("faces" in r) {
      r.faces.forEach((f, at) => {
        faceRows.push({ album_id: albumId, photo_id: r.photoId, at, box: [f.box.x, f.box.y, f.box.w, f.box.h], descriptor: f.descriptor, sharpness: f.sharpness });
      });
    }
    // Đánh mốc KỂ CẢ khi 0 mặt / bỏ qua vĩnh viễn — như scanAlbum.
    doneIds.push(r.photoId);
  }
  const khuonMat = faceRows.length;
  const daGhi = doneIds.length;
  const g = await ghiKetQuaQuet(db, faceRows, doneIds);
  if (g.ghiKhongAn) return { ok: false, error: "ghi-khong-an" };

  const c = await apDungLocConQuet(dem(db, albumId));
  if (c.error) throw new Error(`dem_anh_cho_that_bai: ${c.error.message}`);
  const conLai = c.count ?? 0;
  if (g.daGhiMat > 0) await veHangDoiGomNeuCan(db, albumId, conLai === 0);
  return { ok: true, daGhi, khuonMat, boQuaDaQuet: ids.length - daGhi, conLai, xong: conLai === 0 };
}

/**
 * Gom nhóm nếu CẦN — máy studio gọi khi quét hết hoặc khi tạm dừng.
 *
 * Giữ luật 12 giờ: album còn quét dở thì gom lại nhiều nhất 12 giờ một lần (mỗi
 * lần gom đọc toàn bộ vector của album — egress Supabase). Quét hết thì gom
 * đúng một lần; gọi lại không làm gì.
 */
export async function gomNeuCan(db: any, albumId: string): Promise<{ gom: boolean; lyDo?: string; nguoi: number }> {
  const [can, con] = await Promise.all([apDungLocCanQuet(dem(db, albumId)), apDungLocConQuet(dem(db, albumId))]);
  if (can.error || con.error) throw new Error(`dem_anh_that_bai: ${(can.error ?? con.error).message}`);
  const conLai = con.count ?? 0;
  const daQuet = Math.max(0, (can.count ?? 0) - conLai);
  const demNguoi = async () => (await db.from("album_people").select("id", { count: "exact", head: true }).eq("album_id", albumId)).count ?? 0;
  const g = await canGomKhong(db, albumId, daQuet);
  if (!g.can) return { gom: false, lyDo: daQuet === 0 ? "chua-quet" : "khong-co-gi-moi", nguoi: await demNguoi() };
  if (conLai > 0 && g.lanCuoi !== null && Date.now() - g.lanCuoi < GOM_LAI_SAU_MS) {
    return { gom: false, lyDo: "cho-12-gio", nguoi: await demNguoi() };
  }
  return { gom: true, nguoi: await clusterAlbum(db, albumId) };
}

/** Tối đa ngần này album gần nhất của studio được xét cho bộ tự quét nền. */
export const HANG_DOI_XET = 200;

export type AlbumChoQuet = { id: string; ten: string; conLai: number; /** Quét hết rồi, chỉ còn thiếu bước gom. */ canGom?: boolean };

/** Ngần này album mới nhất được xét thêm "đã quét mà chưa gom". */
export const XET_CHUA_GOM = 20;

/**
 * HÀNG ĐỢI CỦA BỘ TỰ QUÉT NỀN — album của MỘT chủ studio còn ảnh chưa quét.
 *
 * Gọi mỗi lần studio mở dashboard (và vài chục phút một lần khi để mở), nên
 * phải rẻ: đa số lần gọi câu trả lời là "không còn gì". Như `albumsNeedingScan`
 * của cron: MỘT câu `limit(1)` trên cả lô trả lời "có không" (chỉ mục một phần
 * photos_faces_pending_idx); chỉ khi có mới đếm, theo nhóm 8 album, và chỉ đủ
 * `gioiHan` album — mới nhất trước, vì album mới là album khách sắp mở.
 *
 * Gói đã được người gọi kiểm (route). Cả album nháp cũng xét: studio hay đăng
 * ảnh lên rồi mới xuất bản, quét sẵn trước khi khách vào là đúng lúc nhất.
 */
export async function albumChoQuetCuaChu(db: any, ownerId: string, gioiHan = 10): Promise<AlbumChoQuet[]> {
  const { data, error } = await db
    .from("albums")
    .select("id, title")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(HANG_DOI_XET);
  if (error) throw new Error(`doc_album_that_bai: ${error.message}`);
  const rows = (data ?? []) as { id: string; title: string | null }[];
  if (rows.length === 0) return [];
  const conViec = async (ids: string[]) => {
    const { data: d, error: e } = await apDungLocConQuet(db.from("photos").select("album_id").in("album_id", ids)).limit(1);
    if (e) throw new Error(`doc_anh_cho_that_bai: ${e.message}`);
    return (d ?? []).length > 0;
  };
  const out: AlbumChoQuet[] = [];
  if (!(await conViec(rows.map((r) => r.id)))) return themChuaGom(db, rows, out, gioiHan);
  for (let i = 0; i < rows.length && out.length < gioiHan; i += 8) {
    const lo = rows.slice(i, i + 8);
    if (rows.length > 8 && !(await conViec(lo.map((r) => r.id)))) continue;
    const dem = await Promise.all(
      lo.map(async (r) => {
        const { count, error: e } = await apDungLocConQuet(dem0(db, r.id));
        if (e) throw new Error(`dem_anh_cho_that_bai: ${e.message}`);
        return { id: r.id, ten: r.title || "Album", conLai: count ?? 0 };
      }),
    );
    for (const a of dem) if (a.conLai > 0 && out.length < gioiHan) out.push(a);
  }
  return themChuaGom(db, rows, out, gioiHan);
}

/**
 * Album ĐÃ QUÉT HẾT nhưng chưa gom (lượt gom trước hỏng / bị cắt giữa chừng):
 * khách không thấy ô tìm khuôn mặt cho tới khi gom xong, nên bộ tự quét phải
 * nhận cả những album này. Chỉ xét XET_CHUA_GOM album mới nhất, mỗi album một
 * câu `limit(1)` — đúng câu hỏi `canGomKhong` dùng.
 */
async function themChuaGom(db: any, rows: { id: string; title: string | null }[], out: AlbumChoQuet[], gioiHan: number): Promise<AlbumChoQuet[]> {
  const daCo = new Set(out.map((a) => a.id));
  const xet = rows.filter((r) => !daCo.has(r.id)).slice(0, XET_CHUA_GOM);
  for (let i = 0; i < xet.length && out.length < gioiHan; i += 8) {
    const lo = xet.slice(i, i + 8);
    const kq = await Promise.all(
      lo.map(async (r) => {
        try {
          const st = await layViecQuet(db, r.id);
          return st.conLai === 0 && st.canGom ? { id: r.id, ten: r.title || "Album", conLai: 0, canGom: true } : null;
        } catch {
          return null; // chưa chạy migration… — không chặn danh sách
        }
      }),
    );
    for (const a of kq) if (a && out.length < gioiHan) out.push(a);
  }
  return out;
}
const dem0 = (db: any, albumId: string) => db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);

/* ── GOM TRÊN MÁY STUDIO: máy chủ chỉ KIỂM rồi GHI ─────────────────────────────
   Album cưới vài nghìn ảnh có hàng chục nghìn khuôn mặt; phép gom so từng cặp
   và đã quá giờ của máy chủ (khách không bao giờ thấy ô tìm khuôn mặt). Nay máy
   studio đọc vector, gom trong Web Worker rồi gửi KẾT QUẢ lên đây. Máy chủ không
   tin kết quả đó: mọi ảnh phải thuộc đúng album, mọi vector đúng 128 số hữu hạn,
   tên chỉ lấy từ người CŨ của chính album (studio đã đặt), không lấy từ client. */

/** Trần thân yêu cầu {luuGom} — dưới giới hạn 4,5 MB của Vercel. */
export const THAN_GOM_TOI_DA = 4_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const so01 = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;
const nguyen = (x: unknown, max: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= max;

export type KiemGom = { ok: true; nguoi: (Omit<NguoiGomVao, "name">)[] } | { ok: false; loi: string };
type NguoiGomVao = {
  knownId: string | null;
  name: string;
  face_count: number;
  cover_photo_id: string | null;
  cover_at: number;
  cover_box: number[] | null;
  descriptor: number[];
  position: number;
  anh: string[];
};

/** Kiểm hình dạng kết quả gom gửi từ máy studio (thuần — kiểm thử được). */
export function kiemKetQuaGom(raw: unknown): KiemGom {
  const ds = (raw as { nguoi?: unknown })?.nguoi;
  if (!Array.isArray(ds)) return { ok: false, loi: "khong_phai_mang" };
  if (ds.length > 5000) return { ok: false, loi: "qua_nhieu_nguoi" };
  let tongNoi = 0;
  const out: Omit<NguoiGomVao, "name">[] = [];
  for (let i = 0; i < ds.length; i++) {
    const p = ds[i] as Record<string, unknown>;
    if (!p || typeof p !== "object") return { ok: false, loi: "nguoi_sai" };
    if (p.knownId != null && !(typeof p.knownId === "string" && UUID.test(p.knownId))) return { ok: false, loi: "known_id_sai" };
    if (!nguyen(p.face_count, 10_000_000) || (p.face_count as number) < 1) return { ok: false, loi: "face_count_sai" };
    if (p.cover_photo_id != null && !(typeof p.cover_photo_id === "string" && UUID.test(p.cover_photo_id))) return { ok: false, loi: "cover_sai" };
    if (!nguyen(p.cover_at, 1000)) return { ok: false, loi: "cover_at_sai" };
    if (p.cover_box != null && !(Array.isArray(p.cover_box) && p.cover_box.length === 4 && p.cover_box.every(so01))) return { ok: false, loi: "cover_box_sai" };
    if (!Array.isArray(p.descriptor) || p.descriptor.length !== 128 || !p.descriptor.every((x) => typeof x === "number" && Number.isFinite(x))) return { ok: false, loi: "descriptor_sai" };
    if (p.position !== i) return { ok: false, loi: "position_sai" };
    const anh = p.anh;
    if (!Array.isArray(anh) || anh.length === 0 || !anh.every((x) => typeof x === "string" && UUID.test(x))) return { ok: false, loi: "anh_sai" };
    if (new Set(anh).size !== anh.length) return { ok: false, loi: "anh_trung" };
    tongNoi += anh.length;
    if (tongNoi > 500_000) return { ok: false, loi: "qua_nhieu_noi" };
    out.push({
      knownId: (p.knownId as string | null) ?? null,
      face_count: p.face_count as number,
      cover_photo_id: (p.cover_photo_id as string | null) ?? null,
      cover_at: p.cover_at as number,
      cover_box: (p.cover_box as number[] | null) ?? null,
      descriptor: p.descriptor as number[],
      position: i,
      anh: anh as string[],
    });
  }
  return { ok: true, nguoi: out };
}

/** Nhận kết quả gom từ máy studio: kiểm, đối chiếu ảnh thuộc album, rồi ghi. */
export async function nhanKetQuaGom(db: any, albumId: string, raw: unknown): Promise<{ ok: true; nguoi: number } | { ok: false; error: string; detail?: string }> {
  const k = kiemKetQuaGom(raw);
  if (!k.ok) return { ok: false, error: "gom_khong_hop_le", detail: k.loi };

  // Mọi ảnh nhắc tới phải là ảnh CỦA ALBUM NÀY. Tra ĐÚNG những id được nhắc,
  // theo lô, bằng khoá chính — KHÔNG đọc cả album theo `order("id")`: cách đó
  // bắt Postgres lướt khoá chính của bảng ảnh MỌI album và đã chết vì
  // "statement timeout" trên album 5.877 ảnh.
  const canTra = new Set<string>();
  for (const p of k.nguoi) {
    if (p.cover_photo_id) canTra.add(p.cover_photo_id);
    for (const a of p.anh) canTra.add(a);
  }
  const ids = [...canTra];
  let thuoc = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const lo = ids.slice(i, i + 200);
    const { data, error } = await db.from("photos").select("id").in("id", lo).eq("album_id", albumId);
    if (error) throw new Error(`doc_anh_album_that_bai: ${error.message}`);
    thuoc += (data ?? []).length;
  }
  if (thuoc !== ids.length) return { ok: false, error: "anh_khong_thuoc_album" };

  // Tên: CHỈ từ người cũ của chính album này (studio đã đặt), một tên một người.
  const { data: cu, error: eCu } = await db.from("album_people").select("id, name").eq("album_id", albumId);
  if (eCu) throw new Error(`doc_nguoi_cu_that_bai: ${eCu.message}`);
  const tenCu = new Map(((cu ?? []) as { id: string; name: string | null }[]).map((r) => [r.id, r.name ?? ""]));
  const daDung = new Set<string>();
  const nguoi = k.nguoi.map((p) => {
    let name = "";
    if (p.knownId && tenCu.has(p.knownId) && !daDung.has(p.knownId)) {
      name = tenCu.get(p.knownId)!;
      daDung.add(p.knownId);
    }
    return { ...p, name };
  });
  await ghiNguoi(db, albumId, nguoi);
  return { ok: true, nguoi: nguoi.length };
}
