import { NextResponse } from "next/server";
import { limitByIpDurable } from "@/lib/rate-limit";
import { mintPrintKey } from "@/lib/album-access";
import { matchPrintPhone } from "@/lib/album-print-rules";
import { collageGate } from "@/lib/album-collage";

export const dynamic = "force-dynamic";

/**
 * Xác minh "tôi là cô dâu / chú rể" trước khi ghép layout ảnh.
 *
 * Khách nhập SĐT; khớp SĐT khách / cô dâu / chú rể trên hợp đồng dùng album
 * này thì trả `key` — CHÍNH LÀ vé chọn ảnh in (mintPrintKey: HMAC của album +
 * danh sách SĐT), nên xác minh ở đây hay ở ảnh in đều mở được cả hai. Không bao
 * giờ trả lại SĐT nào. Hợp đồng không ghi SĐT thì không cần vé (key null).
 *
 * Chặn dò SĐT theo IP, dùng CHUNG bộ đếm với /print/verify: hai cửa cùng đoán
 * một bộ số, tách bộ đếm là nhân đôi số lần đoán được.
 *
 * Body: { phone: string, access?: string }
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const limited = await limitByIpDurable(req, `album-print-verify:${slug}`, 8, 10 * 60_000, { failClosed: true });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; access?: unknown };
  const gate = await collageGate(slug, { access: body.access }, false);
  if (!gate.ok) return gate.res;
  if (gate.phones.length === 0) return NextResponse.json({ ok: true, key: null });
  if (!matchPrintPhone(body.phone, gate.phones)) return NextResponse.json({ error: "wrong_phone" }, { status: 403 });
  return NextResponse.json({ ok: true, key: mintPrintKey(gate.album.id, gate.phones) });
}
