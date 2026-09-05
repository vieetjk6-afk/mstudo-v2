import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanJpeg } from "@/lib/face-node";
import { nearestPerson } from "@/lib/face-group";
import { limitByIpDurable } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Trần dung lượng ảnh khách gửi. Phía khách đã thu nhỏ còn ~800px trước khi gửi. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * KHÁCH TẢI MỘT ẢNH CỦA MÌNH LÊN ĐỂ TÌM "ẢNH NÀO CÓ TÔI".
 *
 * VÌ SAO CHẠY Ở MÁY CHỦ CHỨ KHÔNG Ở MÁY KHÁCH NHƯ BẢN TRƯỚC. Bản trước tải ~20
 * MB mô hình về điện thoại khách rồi nhận diện tại chỗ, và ảnh không rời khỏi
 * máy — nghe thì hay hơn. Nhưng từ khi việc quét album chuyển hẳn lên máy chủ,
 * hai bên căn khuôn mặt theo hai cách khác nhau (MediaPipe 478 điểm so với
 * face-api 68 điểm), nên vector sinh ở trình duyệt KHÔNG so được với vector
 * trong album: cùng một người vẫn ra "không tìm thấy". Một đường ống duy nhất là
 * điều kiện để tính năng đúng, không phải để cho gọn.
 *
 * Đổi lại, khách được nhiều hơn: không tải một byte mô hình nào, chạy được trên
 * điện thoại yếu, bấm là ra sau một hai giây.
 *
 * ẢNH KHÁCH GỬI KHÔNG ĐƯỢC LƯU. Nó nằm trong bộ nhớ đúng một lượt xử lý; thứ duy
 * nhất đi tiếp là một id người trong album. Không ghi Storage, không ghi DB.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const limited = await limitByIpDurable(req, `face-match:${params.slug}`, 20, 60_000, { failClosed: false });
  if (limited) return limited;

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status, password_hash, gallery_pinned")
    .eq("slug", params.slug)
    .single();
  if (!album || album.status !== "published") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Cùng cánh cửa với ảnh trong album: album có mật khẩu thì hỏi mặt cũng phải
  // có mật khẩu, nếu không đây thành cửa sau để dò "người này có trong album không".
  if (!album.gallery_pinned && album.password_hash) {
    const pw = String(form.get("password") ?? "").trim();
    const ok = pw ? await bcrypt.compare(pw, album.password_hash) : false;
    if (!ok) return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "thieu_anh" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "anh_qua_lon" }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) {
    // Phía khách luôn vẽ lại thành JPEG trước khi gửi, nên tới đây mà không phải
    // JPEG là lỗi lập trình chứ không phải lỗi của khách — vẫn trả câu đọc được.
    return NextResponse.json({ error: "khong_phai_jpeg" }, { status: 400 });
  }

  let faces;
  try {
    faces = await scanJpeg(bytes);
  } catch (e) {
    return NextResponse.json(
      { error: "may_chu_khong_nhan_dien_duoc", detail: e instanceof Error ? e.message : String(e) },
      { status: 200 }
    );
  }
  if (faces.length === 0) return NextResponse.json({ error: "khong_thay_mat" });

  // Nhiều mặt trong ảnh khách gửi (ảnh chụp chung) → lấy mặt TO NHẤT: người cầm
  // máy chọn ảnh có mình, và mình thường là người gần ống kính nhất.
  const me = faces.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a));

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
  if (!hit) return NextResponse.json({ error: "khong_khop", faces: faces.length });
  return NextResponse.json({ personId: hit.id, distance: hit.distance, faces: faces.length });
}
