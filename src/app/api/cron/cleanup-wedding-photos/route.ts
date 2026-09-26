import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Stop early enough to always return a verdict instead of dying mid-walk.
const TIME_BUDGET_MS = 270_000;

// Uploads from the wedding-invitation editor land at
//   <owner_id>/<invitation_id>/<uuid>.<ext>
// (see /api/thiep/[token]/upload and .../audio-upload-url). Deleting an
// invitation — or a profile, which cascades to its invitations — removes the
// DB rows but leaves those objects behind forever. Nothing else reaps them, so
// they accumulate against the 1 GB file-storage quota.
const BUCKET = "wedding-photos";
const PAGE = 1000; // Supabase Storage list() hard cap per call.
// Bound the walk so a big bucket can't run the function past its time limit;
// the next run picks up where quota pressure remains.
const MAX_OWNERS = 500;

async function listAll(db: ReturnType<typeof createAdminClient>, prefix: string) {
  const out: { id: string | null; name: string }[] = [];
  for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Weekly job: delete wedding-invitation uploads whose invitation no longer
 * exists. Only orphans are touched — a folder whose invitation row is still
 * present is left completely alone, since its photos are live on the invite.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Every invitation id that still exists. The table is small (one row per
  // invite), so one pass is cheaper than a query per storage folder.
  const live = new Set<string>();
  for (let from = 0; from < 100 * PAGE; from += PAGE) {
    const { data, error } = await db
      .from("wedding_invitations")
      .select("id")
      // BẮT BUỘC có thứ tự ổn định: PostgREST không đảm bảo thứ tự giữa các trang
      // .range() khi không ORDER BY, nên với >1000 thiệp một id đang dùng có thể
      // bị bỏ sót khỏi tập "live" → ảnh còn dùng bị coi là mồ côi và XOÁ VĨNH VIỄN.
      .order("id")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data) live.add(r.id as string);
    if (data.length < PAGE) break;
  }
  // A read failure would make every folder look orphaned — refuse to delete.
  if (live.size === 0) {
    return NextResponse.json({ ok: true, skipped: "no invitations read; refusing to prune" });
  }

  // `id === null` marks a folder placeholder; at the top level those are the
  // owner_id folders.
  const owners = (await listAll(db, "")).filter((o) => !o.id).slice(0, MAX_OWNERS);

  let removed = 0;
  let orphanFolders = 0;
  let done = true;
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;
  for (const owner of owners) {
    if (outOfTime()) { done = false; break; }
    const invitations = (await listAll(db, owner.name)).filter((o) => !o.id);
    for (const inv of invitations) {
      if (live.has(inv.name)) continue; // still in use — leave it
      const prefix = `${owner.name}/${inv.name}`;
      const files = (await listAll(db, prefix)).filter((o) => o.id);
      if (files.length === 0) continue;
      orphanFolders++;
      for (let i = 0; i < files.length; i += PAGE) {
        const batch = files.slice(i, i + PAGE).map((f) => `${prefix}/${f.name}`);
        const { error } = await db.storage.from(BUCKET).remove(batch);
        if (error) break;
        removed += batch.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    liveInvitations: live.size,
    ownersScanned: owners.length,
    orphanFolders,
    removed,
    done, // false ⇒ hit the time budget; run it again to continue
  });
}
