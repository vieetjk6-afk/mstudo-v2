import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studioFor } from "@/lib/contract-change";

export const dynamic = "force-dynamic";

/**
 * Chữ ký Bên A đã lưu của studio (xem supabase/migrations/studio_saved_signature.sql).
 *   POST   { name, signature } → lưu / thay chữ ký
 *   DELETE                     → xoá chữ ký đã lưu
 * Chỉ chủ / quản lý: đây là chữ ký ĐẠI DIỆN studio trên mọi hợp đồng.
 */
const ROLES = ["manager", "branch_manager"] as const;
const SIG = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/;

export async function POST(req: Request) {
  const profile = await studioFor(ROLES);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; signature?: string };
  const name = String(b.name ?? "").trim().slice(0, 120);
  const signature = String(b.signature ?? "");
  if (!name) return NextResponse.json({ error: "no_name" }, { status: 400 });
  if (signature.length > 600_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  if (!SIG.test(signature)) return NextResponse.json({ error: "bad_signature" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from("studio_saved_signature").upsert(
    {
      owner_id: profile.id,
      signer_name: name,
      signature,
      updated_by: (profile.actingUserId as string | undefined) ?? profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" }
  );
  if (error) {
    if (error.code === "42P01" || /studio_saved_signature/.test(error.message)) {
      return NextResponse.json({ error: "missing_migration", file: "supabase/voucher-uu-dai.sql" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const profile = await studioFor(ROLES);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = createAdminClient();
  await db.from("studio_saved_signature").delete().eq("owner_id", profile.id);
  return NextResponse.json({ ok: true });
}
