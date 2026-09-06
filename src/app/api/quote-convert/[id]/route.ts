import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { convertQuoteToContract } from "@/lib/quote-convert";

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
  if (quote.status !== "accepted") {
    return NextResponse.json({ error: "Chỉ tạo hợp đồng từ báo giá khách đã đồng ý." }, { status: 409 });
  }

  const result = await convertQuoteToContract(supabase, quote.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, contract_id: result.contract_id });
}
