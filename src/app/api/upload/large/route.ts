import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EXT_OK = /^[a-z0-9]{1,5}$/;

/**
 * Bước 1 của luồng tải ẢNH LỚN.
 *
 * Serverless trên Vercel chặn body ở ~4.5MB, nên ảnh lớn không thể đi qua
 * /api/upload — chúng hỏng trước cả khi chạm vào route. Ở đây server cấp một URL
 * KÝ SẴN để client đẩy file THẲNG lên Storage (không qua serverless, không vướng
 * trần), rồi /api/upload/finalize chuyển tiếp sang Drive và xoá bản tạm.
 *
 * File nằm dưới tiền tố `tmp/<user_id>/` — chỗ trung chuyển, không phải chỗ ở.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { ext?: string; bucket?: string } | null;
  const raw = (body?.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = EXT_OK.test(raw) ? raw : "jpg";
  const bucket = body?.bucket || "logos";

  const path = `tmp/${user.id}/${crypto.randomUUID()}.${ext}`;
  // Service role: URL ký sẵn bỏ qua RLS, nên đường dẫn phải do SERVER đặt và
  // luôn gắn với user.id — finalize sẽ đối chiếu lại đúng tiền tố này.
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "sign_failed" }, { status: 500 });

  return NextResponse.json({ path, token: data.token, bucket });
}
