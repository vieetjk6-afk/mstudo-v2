import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { convertQuoteToContract } from "@/lib/quote-convert";
import { applyDefaultAlbumMode } from "@/lib/studio-drive";

export const dynamic = "force-dynamic";

/**
 * Studio-only: explicitly convert an accepted quote into a contract.
 * Anonymous client auto-conversion happens inside the public /api/quote/[token]
 * route when the client ticks "tự động tạo hợp đồng" on accept.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("studio_quotes")
    .select("id, status, owner_id")
    .eq("id", params.id)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Báo giá không tồn tại." }, { status: 404 });
  // Studio tự chốt được cả khi khách đồng ý qua điện thoại/Zalo (báo giá còn
  // "đã gửi", "khách đã xem"…) — không bắt đổi trạng thái tay trước. Chỉ chặn
  // báo giá đã huỷ / hết hạn.
  if (quote.status === "cancelled" || quote.status === "expired") {
    return NextResponse.json({ error: "Báo giá đã huỷ hoặc hết hạn — mở lại trước khi tạo hợp đồng." }, { status: 409 });
  }

  const result = await convertQuoteToContract(
    supabase,
    quote.id,
    profile.actingRole === "staff" ? (profile.actingUserId as string) : null
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  // Chế độ album mặc định theo kết nối mstudo desktop / Drive của studio.
  await applyDefaultAlbumMode(profile.id as string, result.contract_id);
  return NextResponse.json({ ok: true, contract_id: result.contract_id });
}
