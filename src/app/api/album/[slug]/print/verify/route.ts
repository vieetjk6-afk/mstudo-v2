import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import { isDeliveryPhase } from "@/lib/album-phase";
import { mintPrintKey } from "@/lib/album-access";
import { loadPrintPhones, loadPrintQuota } from "@/lib/album-print";
import { matchPrintPhone } from "@/lib/album-print-rules";

export const dynamic = "force-dynamic";

/**
 * Xác minh "tôi là cô dâu / chú rể" trước khi chọn ảnh in tặng.
 *
 * Khách nhập SĐT; khớp SĐT khách / cô dâu / chú rể trên hợp đồng dùng album
 * này thì trả `printKey` (HMAC — xem mintPrintKey) để đính vào /print. Không bao
 * giờ trả lại SĐT nào. Hợp đồng không có SĐT thì không cần xác minh (key null).
 *
 * Chặn dò SĐT theo IP, bền qua các instance; hỏng bộ đếm thì từ chối luôn.
 *
 * Body: { phone: string }
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const limited = await limitByIpDurable(req, `album-print-verify:${params.slug}`, 8, 10 * 60_000, { failClosed: true });
  if (limited) return limited;

  const { phone } = (await req.json().catch(() => ({}))) as { phone?: unknown };

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, status, is_gallery, phase")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!album || album.status !== "published" || !isDeliveryPhase(album)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [quota, phones] = await Promise.all([loadPrintQuota(admin, album.id), loadPrintPhones(admin, album.id)]);
  if (!quota) return NextResponse.json({ error: "not_enabled" }, { status: 403 });
  if (phones.length === 0) return NextResponse.json({ ok: true, printKey: null });
  if (!matchPrintPhone(phone, phones)) return NextResponse.json({ error: "wrong_phone" }, { status: 403 });

  return NextResponse.json({ ok: true, printKey: mintPrintKey(album.id, phones) });
}
