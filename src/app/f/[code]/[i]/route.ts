import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";
import { BUCKET, fileKey, readManifest } from "@/lib/quick-share";

export const dynamic = "force-dynamic";

/**
 * /f/<mã>/<i> — tải file thứ i: chuyển hướng sang URL ký sẵn ngắn hạn của
 * Storage, kèm tên gốc (Content-Disposition: attachment) để trình duyệt tải
 * về thay vì mở. File không đi qua serverless nên không tốn băng thông Vercel.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string; i: string }> }) {
  const limited = limitByIp(req, "quick-share-dl", 120, 60 * 1000);
  if (limited) return limited;

  const { code, i } = await ctx.params;
  const back = new URL(`/f/${code}`, req.url);
  const db = createAdminClient();
  const m = await readManifest(code, db);
  const idx = Number(i);
  if (!m || Date.now() > m.expiresAt || !Number.isInteger(idx) || !m.files[idx]) {
    return NextResponse.redirect(back);
  }
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(fileKey(code, idx), 10 * 60, { download: m.files[idx].name });
  if (error || !data) return NextResponse.redirect(back);
  return NextResponse.redirect(data.signedUrl);
}
