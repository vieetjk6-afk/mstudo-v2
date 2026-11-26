import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { nearestPerson } from "@/lib/face-group";
import { limitByIpDurable } from "@/lib/rate-limit";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";
import { laDescriptorHopLe } from "@/lib/face-scan-core";
import { apDungLocCanQuet, apDungLocConQuet } from "@/lib/face-can-quet";
import { fetchAllRows, fetchInChunks } from "@/lib/fetch-all-rows";
import { anhKhop, giaiMaManh, kiemManhKhach, NGUON_KHACH, type ManhKho } from "@/lib/face-kho";
import { docKho, ghiManh, khachTuQuetBat, KHO_TOI_DA_BYTE, lietKeManh, nenNeuCan } from "@/lib/face-kho-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Số ảnh tối đa một mảnh khách gửi lên. */
const ANH_MOI_MANH = 40;
/** 40 ảnh × 24 mặt × 268 byte + phần đầu — trần cứng của thân yêu cầu. */
const THAN_TOI_DA = 12 + ANH_MOI_MANH * (17 + 24 * 268);

/**
 * KHÁCH TỰ TÌM ẢNH CÓ MÌNH — không cần studio quét trước.
 *
 *  • POST JSON { descriptor, password } — "ảnh nào có tôi?". Trả về:
 *      photoIds: ảnh đã có dữ liệu khuôn mặt mà khớp (kho file + nhóm người
 *                studio đã gom), và
 *      chuaQuet: ảnh CHƯA ai quét — máy khách tự quét tiếp những tấm này.
 *    Vector khuôn mặt của người khác KHÔNG bao giờ trả về: chỉ danh sách ảnh.
 *
 *  • POST application/octet-stream (mật khẩu ở header x-album-password) — máy
 *    khách gửi kết quả vừa tự quét (định dạng @/lib/face-kho) để khách sau khỏi
 *    quét lại. Chỉ nhận ảnh THUỘC album, CHƯA ai quét; dữ liệu studio luôn thắng
 *    dữ liệu khách khi đọc (gopManh), khách sau không ghi đè được khách trước.
 *
 * Cùng cổng với /face-match: album đã xuất bản, gói có tìm theo khuôn mặt, đúng
 * mật khẩu nếu album có mật khẩu.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  if (!khachTuQuetBat()) return NextResponse.json({ error: "tat" }, { status: 404 });
  const laManh = (req.headers.get("content-type") ?? "").includes("application/octet-stream");
  const limited = await limitByIpDurable(req, `face-kho:${laManh ? "gui" : "tim"}:${slug}`, laManh ? 40 : 20, 60_000, { failClosed: false });
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, status, password_hash, gallery_pinned")
    .eq("slug", slug)
    .single();
  if (!album || album.status !== "published") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await chuAlbumDuocTimMat(admin, album.owner_id))) {
    return NextResponse.json({ error: "goi_khong_co_tinh_nang" }, { status: 403 });
  }

  // Đọc thân TRƯỚC khi kiểm mật khẩu (mật khẩu nằm trong thân ở đường JSON).
  let descriptor: number[] | null = null;
  let manh: ManhKho | null = null;
  let matKhau = "";
  if (laManh) {
    matKhau = (req.headers.get("x-album-password") ?? "").trim();
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length > THAN_TOI_DA) return NextResponse.json({ error: "qua_lon" }, { status: 413 });
    try {
      manh = giaiMaManh(buf);
    } catch (e) {
      return NextResponse.json({ error: "manh_hong", detail: e instanceof Error ? e.message : "" }, { status: 400 });
    }
    const loi = kiemManhKhach(manh, ANH_MOI_MANH);
    if (loi) return NextResponse.json({ error: loi }, { status: 400 });
  } else {
    let body: { descriptor?: unknown; password?: unknown };
    try {
      const text = await req.text();
      if (text.length > 16_000) return NextResponse.json({ error: "bad_request" }, { status: 413 });
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (!laDescriptorHopLe(body?.descriptor)) return NextResponse.json({ error: "descriptor_khong_hop_le" }, { status: 400 });
    descriptor = body.descriptor;
    matKhau = String(body.password ?? "").trim();
  }

  // Album có mật khẩu: chung hạn mức đoán với /access và /face-match.
  if (!album.gallery_pinned && album.password_hash) {
    const pwLimited = await limitByIpDurable(req, `gallery-pw:${slug}`, 10, 60_000, { failClosed: true });
    if (pwLimited) return pwLimited;
    const ok = matKhau ? await bcrypt.compare(matKhau, album.password_hash) : false;
    if (!ok) return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const albumId = album.id as string;
  try {
    if (manh) return NextResponse.json(await nhanManhKhach(admin, albumId, manh));
    return NextResponse.json(await tim(admin, albumId, descriptor!));
  } catch (e) {
    return NextResponse.json({ error: "loi_kho", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

type Db = ReturnType<typeof createAdminClient>;

async function tim(db: Db, albumId: string, descriptor: number[]) {
  const [{ kho }, chuaCoMoc, nguoi] = await Promise.all([
    docKho(db, albumId).catch(() => ({ kho: new Map() as Awaited<ReturnType<typeof docKho>>["kho"] })),
    // Ảnh CHƯA có mốc quét của studio/máy chủ (chỉ id — vài chục KB với album lớn).
    fetchAllRows<{ id: string }>((from, to) =>
      apDungLocConQuet(db.from("photos").select("id").eq("album_id", albumId)).order("id").range(from, to),
    ),
    timTheoNguoi(db, albumId, descriptor),
  ]);
  const photoIds = new Set<string>(anhKhop(kho, descriptor));
  for (const id of nguoi) photoIds.add(id);
  const chuaQuet = chuaCoMoc.map((r) => r.id).filter((id) => !kho.has(id));
  return { photoIds: [...photoIds], chuaQuet };
}

/** Nhóm người studio đã gom (album_people) — người gần nhất → ảnh của người đó. */
async function timTheoNguoi(db: Db, albumId: string, descriptor: number[]): Promise<string[]> {
  const { data: people, error } = await db.from("album_people").select("id, descriptor").eq("album_id", albumId);
  if (error || !people?.length) return [];
  const hit = nearestPerson(descriptor, (people as { id: string; descriptor: number[] | null }[]).map((p) => ({ id: p.id, descriptor: p.descriptor })));
  if (!hit) return [];
  const links = await fetchAllRows<{ photo_id: string }>((from, to) =>
    db.from("album_photo_people").select("photo_id").eq("album_id", albumId).eq("person_id", hit.id).order("photo_id").range(from, to),
  );
  return links.map((l) => l.photo_id);
}

async function nhanManhKhach(db: Db, albumId: string, manh: ManhKho) {
  const ids = manh.anh.map((a) => a.photoId);
  // Chỉ ảnh THUỘC album, là ảnh quét được, và CHƯA có mốc của studio.
  const rows = await fetchInChunks<{ id: string }>(ids, (chunk, from, to) =>
    apDungLocConQuet(db.from("photos").select("id").eq("album_id", albumId).in("id", chunk)).order("id").range(from, to),
  );
  const hopLe = new Set(rows.map((r) => r.id));
  if (hopLe.size === 0) {
    // Phân biệt "đã quét hết" với "ảnh lạ" — ảnh lạ là gọi tay, từ chối.
    const thuoc = await fetchInChunks<{ id: string }>(ids, (chunk, from, to) =>
      apDungLocCanQuet(db.from("photos").select("id").eq("album_id", albumId).in("id", chunk)).order("id").range(from, to),
    );
    if (thuoc.length < ids.length) return { ok: false, error: "anh_khong_thuoc_album" };
    return { ok: true, daNhan: 0 };
  }
  const files = await lietKeManh(db, albumId);
  if (files.reduce((n, f) => n + f.size, 0) > KHO_TOI_DA_BYTE) return { ok: false, error: "kho_day" };
  const { kho } = await docKho(db, albumId, files);
  const moi = manh.anh.filter((a) => hopLe.has(a.photoId) && !kho.has(a.photoId));
  if (moi.length) await ghiManh(db, albumId, { nguon: NGUON_KHACH, anh: moi });
  // Nén bớt mảnh nhỏ — hỏng thì để lượt sau.
  await nenNeuCan(db, albumId).catch(() => false);
  return { ok: true, daNhan: moi.length };
}
