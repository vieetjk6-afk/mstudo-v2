import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import type { WeddingConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Token-gated wedding-invitation editor endpoint (no login — the edit_token is
 * the key, mirroring the /c/[token] contract portal).
 *   GET                       -> the invitation + its RSVP responses
 *   POST { config, published, template } -> save the client's edits
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  // Như /api/story/[token]: edit_token là chìa khoá duy nhất, phải có trần dò.
  // GET ở đây còn trả về DANH SÁCH KHÁCH MỜI đã phản hồi (tên, số người đi) nên
  // càng không nên để mở không giới hạn.
  const limited = await limitByIpDurable(req, "thiep-token", 60, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, owner_id, slug, template, config, published, updated_at")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: rsvps } = await db
    .from("wedding_rsvps")
    .select("id, guest_name, side, attending, num_guests, wish, created_at")
    .eq("invitation_id", inv.id)
    .order("created_at", { ascending: false })
    .limit(500);

  return NextResponse.json({ invitation: inv, rsvps: rsvps ?? [] });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const limited = await limitByIpDurable(req, "thiep-token", 60, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    config?: WeddingConfig;
    published?: boolean;
    template?: string;
  };

  // Guard against oversized payloads (the gallery stores URLs, not blobs, so a
  // legitimate config stays small — anything past ~256KB is abuse).
  if (JSON.stringify(body.config ?? {}).length > 256_000) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.config && typeof body.config === "object") patch.config = body.config;
  if (typeof body.published === "boolean") patch.published = body.published;
  if (typeof body.template === "string") patch.template = body.template;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await db.from("wedding_invitations").update(patch).eq("id", inv.id);
  // Không trả nguyên văn lỗi Postgres ra client — nó lộ tên bảng/cột và ràng buộc.
  if (error) {
    console.error("[api/thiep] update lỗi", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
