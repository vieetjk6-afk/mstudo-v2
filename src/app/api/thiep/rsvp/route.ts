import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public guest RSVP for a wedding invitation (no login). Looks the invitation up
 * by slug and records the response.
 *
 * KHÔNG báo về studio (thông báo / push): danh sách xác nhận là việc riêng của
 * cặp đôi — họ xem ngay trong trang sửa thiệp (tab Khách mời & Phản hồi).
 */
export async function POST(req: Request) {
  const limited = limitByIp(req, "rsvp", 10, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    guest_name?: string;
    side?: string;
    attending?: boolean;
    num_guests?: number;
    wish?: string;
  };

  const slug = (body.slug ?? "").trim();
  const name = (body.guest_name ?? "").trim().slice(0, 120);
  if (!slug || !name) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, published, config")
    .eq("slug", slug)
    .maybeSingle();
  if (!inv || !inv.published) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((inv.config as { rsvp_enabled?: boolean })?.rsvp_enabled === false) {
    return NextResponse.json({ error: "rsvp_off" }, { status: 403 });
  }

  const side = ["groom", "bride", "both"].includes(body.side ?? "") ? body.side : "both";
  const attending = body.attending !== false;
  const num = Math.max(0, Math.min(50, Math.round(Number(body.num_guests) || 1)));

  const { error } = await db.from("wedding_rsvps").insert({
    invitation_id: inv.id,
    guest_name: name,
    side,
    attending,
    num_guests: num,
    wish: (body.wish ?? "").trim().slice(0, 1000) || null,
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
