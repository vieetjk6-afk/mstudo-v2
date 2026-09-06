import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadToAdminDrive } from "@/lib/mstudo-drive";
import { sniffImageType } from "@/lib/upload-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB (giới hạn cứng phía server)

/**
 * Upload nội dung NGƯỜI DÙNG. Ưu tiên lưu vào Drive của admin mstudo (không tốn
 * dung lượng Supabase); nếu Drive chưa kết nối thì fallback về Supabase Storage.
 * Trả về { url } dùng trực tiếp làm src ảnh.
 */
export async function POST(req: Request) {
  // Chỉ người đã đăng nhập mới được upload.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not_image" }, { status: 400 });

  const bucket = (form?.get("bucket") as string) || "logos";
  const original = form?.get("original") === "1"; // giữ nguyên gốc (logo PNG trong suốt)
  const buf = Buffer.from(await file.arrayBuffer());
  // Xác thực bằng magic-byte, KHÔNG tin file.type do client gửi: chặn lưu tệp
  // không-phải-ảnh vào bucket công khai dưới content-type ảnh.
  const sniffed = sniffImageType(buf);
  if (!sniffed) return NextResponse.json({ error: "not_image" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";

  // 1) Drive admin — cho MỌI tài khoản, kể cả admin. Trước đây nội dung của
  // admin (logo, ảnh của app) cố tình ở lại Supabase; nay không còn lý do giữ
  // ngoại lệ đó, mà mỗi byte ở lại đều ăn vào hạn mức 1 GB. Bỏ luôn truy vấn
  // role kèm theo — không còn ai đọc tới nó.
  const id = await uploadToAdminDrive(buf, `${user.id}-${Date.now()}.${ext}`, sniffed);
  if (id) {
    const url = `/api/img?id=${id}${original ? "&orig=1" : "&w=800"}`;
    return NextResponse.json({ url, id, storage: "drive" });
  }

  // 2) Fallback: Supabase Storage (dùng client của user + RLS, như luồng cũ).
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, buf, { contentType: sniffed, upsert: true });
  if (error) {
    if (error.message.includes("not found") || error.message.includes("Bucket")) {
      return NextResponse.json({ error: "bucket_missing", bucket }, { status: 500 });
    }
    // Không trả nguyên văn thông báo lỗi Storage/Postgres ra client (rò rỉ nội bộ).
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, storage: "supabase" });
}
