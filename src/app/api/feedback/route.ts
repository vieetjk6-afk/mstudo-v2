import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public: submit feedback for a gallery. */
export async function POST(req: Request) {
  const limited = limitByIp(req, "feedback", 10, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    albumId?: string;
    clientName?: string;
    rating?: number;
    content?: string;
    captcha?: string;
  };

  const captcha = await guardCaptcha(req, "feedback", body.captcha);
  if (captcha) return captcha;
  const content = body.content?.trim();
  if (!body.albumId || !content) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const rating = body.rating && body.rating >= 1 && body.rating <= 5 ? body.rating : null;

  const db = createAdminClient();
  // Make sure the target is a published gallery.
  const { data: album } = await db
    .from("albums")
    .select("id, is_gallery, status")
    .eq("id", body.albumId)
    .single();
  if (!album || !album.is_gallery) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await db.from("feedback").insert({
    album_id: body.albumId,
    client_name: body.clientName?.trim() || null,
    rating,
    content,
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
