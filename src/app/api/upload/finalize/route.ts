import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToAdminDrive } from "@/lib/mstudo-drive";
import { sniffImageType } from "@/lib/upload-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Bước 2 của luồng tải ẢNH LỚN: chuyển bản tạm trên Storage sang Drive admin
 * rồi xoá chỗ tạm. Tốn một lần egress bằng kích thước file để đổi lấy việc
 * KHÔNG chiếm dung lượng Supabase mãi mãi.
 *
 * Drive hỏng thì không mất ảnh: bản tạm được DỜI sang chỗ ở cố định trong
 * bucket và trả về public URL như luồng cũ.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { path?: string; bucket?: string; original?: boolean }
    | null;
  const path = (body?.path || "").trim();
  const bucket = body?.bucket || "logos";
  // Chốt quyền: chỉ được finalize file NẰM TRONG thư mục tạm của chính mình.
  // Thiếu chốt này thì bất kỳ ai đăng nhập cũng đọc/dời được file của người khác.
  const prefix = `tmp/${user.id}/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: blob, error: dlErr } = await db.storage.from(bucket).download(path);
  if (dlErr || !blob) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // URL ký sẵn không tự giới hạn kích thước, nên trần phải chốt ở đây. File đã
  // nằm trên Storage rồi → xoá luôn thay vì chỉ từ chối.
  if (blob.size > MAX_BYTES) {
    await db.storage.from(bucket).remove([path]);
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  // Xác thực magic-byte y như /api/upload: client đẩy thẳng lên Storage nên
  // content-type nó khai hoàn toàn không đáng tin.
  const sniffed = sniffImageType(buf);
  if (!sniffed) {
    await db.storage.from(bucket).remove([path]);
    return NextResponse.json({ error: "not_image" }, { status: 400 });
  }

  const ext = path.split(".").pop() || "jpg";
  const id = await uploadToAdminDrive(buf, `${user.id}-${Date.now()}.${ext}`, sniffed);
  if (id) {
    await db.storage.from(bucket).remove([path]);
    const url = `/api/img?id=${id}${body?.original ? "&orig=1" : "&w=1600"}`;
    return NextResponse.json({ url, id, storage: "drive" });
  }

  // Drive không dùng được → giữ trên Supabase, nhưng dời ra khỏi thư mục tạm.
  const dest = `${user.id}/${Date.now()}.${ext}`;
  const { error: mvErr } = await db.storage.from(bucket).move(path, dest);
  if (mvErr) return NextResponse.json({ error: "move_failed" }, { status: 500 });
  const url = db.storage.from(bucket).getPublicUrl(dest).data.publicUrl;
  return NextResponse.json({ url, storage: "supabase" });
}
