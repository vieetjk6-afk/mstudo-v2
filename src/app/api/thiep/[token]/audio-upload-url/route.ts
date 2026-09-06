import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Nhạc nền có thể tới 10MB — vượt trần body của serverless trên Vercel (~4.5MB),
// nên KHÔNG tải qua route /upload. Thay vào đó: server (service role) cấp một URL
// KÝ SẴN, client tải file THẲNG lên Supabase Storage → không vướng trần body.
const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "wav", "ogg", "oga", "flac", "weba"]);

export async function POST(req: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const limited = limitByIp(req, "thiep-audio-url", 30, 60_000);
  if (limited) return limited;

  const db = createAdminClient();
  const { data: inv } = await db
    .from("wedding_invitations")
    .select("id, owner_id")
    .eq("edit_token", params.token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { ext?: string } | null;
  const raw = (body?.ext || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = AUDIO_EXT.has(raw) ? raw : "mp3";

  const path = `${inv.owner_id}/${inv.id}/${crypto.randomUUID?.() ?? Date.now()}.${ext}`;
  const { data, error } = await db.storage.from("wedding-photos").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "sign_failed" }, { status: 500 });

  const publicUrl = db.storage.from("wedding-photos").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ path, token: data.token, publicUrl });
}
