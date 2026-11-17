import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { nearestPerson } from "@/lib/face-group";
import { limitByIpDurable } from "@/lib/rate-limit";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";
import { faceServerScanEnabled } from "@/lib/plans";
import { laDescriptorHopLe } from "@/lib/face-scan-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Trần dung lượng ảnh khách gửi. Phía khách đã thu nhỏ còn ~800px trước khi gửi. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * KHÁCH HỎI "ẢNH NÀO CÓ TÔI".
 *
 * ĐƯỜNG CHÍNH — chỉ 128 con số. Máy khách tự nhận diện ảnh của mình
 * (@/lib/face-embed-browser: cùng ba mạng, cùng cách căn mặt với dữ liệu album,
 * nên vector so được) rồi gửi lên đúng một vector; ở đây chỉ còn phép tính
 * khoảng cách với tâm cụm của album_people. Ảnh của khách KHÔNG rời khỏi máy
 * họ, và máy chủ không chạy TensorFlow.
 *
 * ĐƯỜNG CŨ — gửi ảnh lên cho máy chủ nhận diện — chỉ còn khi FACE_SERVER_SCAN=1.
 * Khi đó ảnh nằm trong bộ nhớ đúng một lượt xử lý, không ghi Storage, không ghi DB.
 *
 * Tâm cụm KHÔNG gửi xuống máy khách (egress + lộ vector của người khác): phép
 * so chạy ở đây, trả về đúng một id người.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const limited = await limitByIpDurable(req, `face-match:${params.slug}`, 20, 60_000, { failClosed: false });
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, owner_id, status, password_hash, gallery_pinned")
    .eq("slug", params.slug)
    .single();
  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Tìm ảnh theo khuôn mặt: chỉ Photographer Plus & Studio. Chặn TRƯỚC khi đọc
  // thân yêu cầu. Giao diện đã ẩn hẳn ô này với gói không đủ, nên tới được đây
  // là gọi trực tiếp.
  if (!(await chuAlbumDuocTimMat(admin, album.owner_id))) {
    return NextResponse.json({ error: "goi_khong_co_tinh_nang" }, { status: 403 });
  }

  let me: { descriptor: number[] };
  let soMat = 1;
  let matKhau = "";
  let anh: Blob | null = null;
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    let body: { descriptor?: unknown; password?: unknown; faces?: unknown };
    try {
      const text = await req.text();
      if (text.length > 16_000) return NextResponse.json({ error: "bad_request" }, { status: 413 });
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    if (!laDescriptorHopLe(body?.descriptor)) return NextResponse.json({ error: "descriptor_khong_hop_le" }, { status: 400 });
    me = { descriptor: body.descriptor };
    matKhau = String(body.password ?? "").trim();
    const n = Number(body.faces);
    soMat = Number.isInteger(n) && n >= 1 && n <= 24 ? n : 1;
  } else {
    // Gửi ẢNH lên: chỉ khi máy chủ được bật nhận diện. Chặn TRƯỚC khi đọc form.
    if (!faceServerScanEnabled()) return NextResponse.json({ error: "chi_nhan_descriptor" }, { status: 400 });
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    matKhau = String(form.get("password") ?? "").trim();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "thieu_anh" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "anh_qua_lon" }, { status: 413 });
    anh = file;
    me = { descriptor: [] };
  }

  // Cùng cánh cửa với ảnh trong album: album có mật khẩu thì hỏi mặt cũng phải
  // có mật khẩu, nếu không đây thành cửa sau để dò "người này có trong album không".
  if (!album.gallery_pinned && album.password_hash) {
    const ok = matKhau ? await bcrypt.compare(matKhau, album.password_hash) : false;
    if (!ok) return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  if (anh) {
    const bytes = new Uint8Array(await anh.arrayBuffer());
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return NextResponse.json({ error: "khong_phai_jpeg" }, { status: 400 });
    let faces;
    try {
      // Nạp động: đường mặc định (chỉ vector) không bao giờ chạm tới TensorFlow.
      const { scanJpeg } = await import("@/lib/face-node");
      faces = await scanJpeg(bytes);
    } catch (e) {
      return NextResponse.json(
        { error: "may_chu_khong_nhan_dien_duoc", detail: e instanceof Error ? e.message : String(e) },
        { status: 200 }
      );
    }
    if (faces.length === 0) return NextResponse.json({ error: "khong_thay_mat" });
    // Nhiều mặt (ảnh chụp chung) → lấy mặt TO NHẤT: người cầm máy chọn ảnh có
    // mình, và mình thường là người gần ống kính nhất. (Đường vector: máy khách
    // đã chọn theo đúng luật này trước khi gửi.)
    me = faces.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a));
    soMat = faces.length;
  }

  const { data: people, error } = await admin
    .from("album_people")
    .select("id, descriptor")
    .eq("album_id", album.id);
  if (error) {
    return NextResponse.json({ error: "chua_co_du_lieu_khuon_mat", detail: error.message }, { status: 200 });
  }
  const hit = nearestPerson(
    me.descriptor,
    ((people ?? []) as { id: string; descriptor: number[] | null }[]).map((p) => ({ id: p.id, descriptor: p.descriptor }))
  );
  if (!hit) return NextResponse.json({ error: "khong_khop", faces: soMat });
  return NextResponse.json({ personId: hit.id, distance: hit.distance, faces: soMat });
}
