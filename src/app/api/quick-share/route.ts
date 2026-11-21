import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guards";
import {
  BUCKET,
  LINK_HOST,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  TTL_MS,
  cleanName,
  ensureBucket,
  fileKey,
  manifestKey,
  newCode,
  pinOk,
  sweepExpired,
  type Manifest,
} from "@/lib/quick-share";

export const dynamic = "force-dynamic";

/**
 * Tạo một lượt gửi file nhanh: ghi bản kê, cấp URL ký sẵn cho từng file để
 * trình duyệt đẩy thẳng lên Storage, trả về link rút gọn /f/<mã>.
 *
 * Body: { files: [{ name, size, type }], pin? }
 */
export async function POST(req: Request) {
  // Phải đăng nhập mới tải lên được: trước đây ai cũng đẩy được tới 1GB mỗi lượt
  // vào kho Storage dùng chung (làm đầy hạn mức của cả app, và thành chỗ treo
  // file lạ miễn phí dưới tên miền của mình). Người NHẬN link vẫn tải về không
  // cần đăng nhập.
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để gửi file" }, { status: 401 });
  // Hạn mức bền (không reset theo từng instance như bộ đếm trong bộ nhớ).
  const limited = await limitByIpDurable(req, `quick-share:${user.id}`, 30, 10 * 60 * 1000);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as
    | { files?: { name?: unknown; size?: unknown; type?: unknown }[]; pin?: unknown }
    | null;
  if (!pinOk(body?.pin)) return NextResponse.json({ error: "Sai mã PIN" }, { status: 403 });

  const raw = Array.isArray(body?.files) ? body!.files! : [];
  if (raw.length === 0) return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
  if (raw.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} file mỗi lần` }, { status: 400 });
  }
  const files = raw.map((f) => ({
    name: cleanName(f?.name),
    size: Math.max(0, Math.floor(Number(f?.size) || 0)),
    type: String(f?.type || "").slice(0, 120),
  }));
  const big = files.find((f) => f.size > MAX_FILE_BYTES);
  if (big) {
    return NextResponse.json({ error: `"${big.name}" lớn hơn ${MAX_FILE_MB}MB` }, { status: 400 });
  }

  const db = createAdminClient();
  try {
    await ensureBucket(db);
  } catch (e) {
    console.error("[quick-share] không tạo được bucket:", e);
    return NextResponse.json({ error: "Kho lưu trữ chưa sẵn sàng" }, { status: 500 });
  }
  // Dọn đồ cũ tiện đường — lỗi ở đây không được chặn người đang gửi.
  sweepExpired(db).catch(() => {});

  const now = Date.now();
  const manifest: Manifest = { v: 1, createdAt: now, expiresAt: now + TTL_MS, files };
  const code = newCode();
  const put = await db.storage
    .from(BUCKET)
    .upload(manifestKey(code), JSON.stringify(manifest), { contentType: "application/json", upsert: false });
  if (put.error) {
    console.error("[quick-share] ghi bản kê lỗi:", put.error.message);
    return NextResponse.json({ error: "Không tạo được link, thử lại" }, { status: 500 });
  }

  const uploads: { path: string; token: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(fileKey(code, i));
    if (error || !data) {
      return NextResponse.json({ error: "Không cấp được quyền tải lên" }, { status: 500 });
    }
    uploads.push({ path: data.path, token: data.token });
  }

  // Link rút gọn luôn trên tên miền ngắn (vieetjk.com/f/…) dù trang tải lên giờ
  // nằm ở tên miền chính (vì cần đăng nhập). Chạy local thì giữ origin hiện tại.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const local = !host || /^(localhost|127\.)/.test(host);
  const base = local ? new URL(req.url).origin : `https://${LINK_HOST}`;
  return NextResponse.json({
    code,
    url: `${base}/f/${code}`,
    expiresAt: manifest.expiresAt,
    bucket: BUCKET,
    uploads,
  });
}
