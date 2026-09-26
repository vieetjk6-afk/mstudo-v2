import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // giới hạn 6MB/album (spreads jsonb)

/**
 * Album Designer — lưu/nạp album đã thiết kế của studio.
 *   GET            → danh sách album (không kèm spreads, để nhẹ)
 *   GET ?id=…      → một album đầy đủ (kèm spreads) để mở lại
 *   POST { id?, name, size, tpl, spreads, folder } → tạo/cập nhật, trả { id }
 *   DELETE ?id=…   → xoá
 * Phân quyền: gói Studio; nhân viên thao tác trên album của chủ studio.
 */
export async function GET(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = createAdminClient();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const { data, error } = await db
      .from("album_designs")
      .select("id, name, size, tpl, spreads, folder, updated_at")
      .eq("id", id)
      .eq("owner_id", profile.id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ design: data });
  }

  const { data, error } = await db
    .from("album_designs")
    .select("id, name, size, tpl, folder, updated_at")
    .eq("owner_id", profile.id)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ designs: data ?? [] });
}

export async function POST(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: {
    id?: string;
    name?: string;
    size?: unknown;
    tpl?: unknown;
    spreads?: unknown;
    folder?: string;
  };
  try {
    // Thân request hỏng phải trả 400 rõ ràng, đừng để JSON.parse ném ra 500.
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const db = createAdminClient();
  const patch = {
    name: (body.name || "Album chưa đặt tên").slice(0, 200),
    size: body.size ?? {},
    tpl: body.tpl ?? {},
    spreads: Array.isArray(body.spreads) ? body.spreads : [],
    folder: body.folder?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    // Cập nhật — chỉ khi album thuộc về studio này.
    const { data, error } = await db
      .from("album_designs")
      .update(patch)
      .eq("id", body.id)
      .eq("owner_id", profile.id)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ id: data.id });
  }

  const { data, error } = await db
    .from("album_designs")
    .insert({ owner_id: profile.id, ...patch })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: Request) {
  const profile = await requireStudio();
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.from("album_designs").delete().eq("id", id).eq("owner_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
