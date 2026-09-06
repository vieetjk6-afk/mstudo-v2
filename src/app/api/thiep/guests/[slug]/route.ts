import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import type { WeddingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * "Trang xem riêng cho gia đình": trả DANH SÁCH RSVP + LỜI CHÚC của một thiệp,
 * CHỈ khi nhập đúng mật khẩu do cặp đôi đặt (config.guests_password). Mật khẩu
 * được kiểm tra Ở ĐÂY (server) — không bao giờ nằm trong HTML thiệp công khai.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  // Chặn dò mật khẩu (bền giữa các instance nếu có Upstash; nếu không → in-memory).
  const limited = await limitByIpDurable(req, "thiep-guests", 20, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const entered = (body?.password ?? "").trim();
  if (!entered) return NextResponse.json({ error: "no_password" }, { status: 400 });

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, config")
    .eq("slug", params.slug.toLowerCase())
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cfg = (inv.config ?? {}) as WeddingConfig;
  const real = (cfg.guests_password ?? "").trim();
  if (!real) return NextResponse.json({ error: "disabled" }, { status: 404 });
  if (entered !== real) return NextResponse.json({ error: "wrong_password" }, { status: 401 });

  const { data: rsvps } = await db
    .from("wedding_rsvps")
    .select("id, guest_name, side, attending, num_guests, wish, created_at")
    .eq("invitation_id", inv.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  return NextResponse.json({
    couple: { groom: cfg.groom_name || "Chú rể", bride: cfg.bride_name || "Cô dâu" },
    rsvps: rsvps ?? [],
  });
}
