import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
// A neglected bucket can hold tens of thousands of objects, and Storage only
// deletes 1000 per call — well past the 10–15s default. Give the job room, and
// stop it early enough (TIME_BUDGET_MS) to always return a JSON verdict rather
// than dying mid-sweep with no idea how far it got.
export const maxDuration = 300;
const TIME_BUDGET_MS = 270_000;

// The /api/img durable cache (DRIVE_IMG_CACHE_BUCKET). Files are content-
// addressed (`<id>_w<width>.jpg`, `<id>_orig`) and never mutate, so nothing
// tracks them in the DB — this job bounds bucket growth on its own.
const BUCKET = process.env.DRIVE_IMG_CACHE_BUCKET || "";
// Evict cache objects older than this many days. A deleted object is simply
// re-fetched + re-cached on its next request (one Vercel fetch), so eviction is
// safe — it only trades a rare cache miss for reclaimed Supabase storage.
const MAX_AGE_DAYS = Number(process.env.DRIVE_IMG_CACHE_MAX_AGE_DAYS || "21");
// Hard ceiling on the bucket, in bytes. Age alone cannot bound storage: a busy
// month fills the bucket long before anything turns 21 days old, which is how
// the free plan's 1 GB gets blown through. After the age sweep, keep deleting
// oldest-first until the bucket fits. Default 500 MB leaves headroom for the
// other buckets (wedding-photos, payment-proofs, logos) inside 1 GB.
const MAX_BYTES = Number(process.env.DRIVE_IMG_CACHE_MAX_BYTES || String(500 * 1024 * 1024));
const PAGE = 1000; // Supabase Storage list() hard cap per call.

type StorageObject = {
  id: string | null;
  name: string;
  created_at: string | null;
  metadata: { size?: number } | null;
};

/** Oldest-first page of real files (folder placeholders have id === null). */
async function listOldest(db: ReturnType<typeof createAdminClient>, offset: number) {
  const { data, error } = await db.storage
    .from(BUCKET)
    .list("", { limit: PAGE, offset, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return null;
  return (data as StorageObject[]).filter((o) => o.id);
}

function sizeOf(o: StorageObject) {
  return Number(o.metadata?.size ?? 0);
}

// Bucket mà /api/upload/large dùng làm chỗ trung chuyển (mặc định của client).
const TMP_BUCKET = "logos";
// Chỉ xoá bản tạm đã quá cũ so với một phiên upload — đừng cắt ngang file mà
// finalize đang xử lý dở.
const TMP_MAX_AGE_MS = 6 * 3600 * 1000;

/** Dọn bản tạm bị bỏ rơi dưới `tmp/<user_id>/` của luồng tải ảnh lớn. */
async function sweepTmp(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = Date.now() - TMP_MAX_AGE_MS;
  let removed = 0;
  const { data: users } = await db.storage.from(TMP_BUCKET).list("tmp", { limit: PAGE });
  for (const u of (users ?? []) as StorageObject[]) {
    if (u.id) continue; // chỉ đi vào thư mục user, bỏ qua file lạc
    const { data: files } = await db.storage.from(TMP_BUCKET).list(`tmp/${u.name}`, { limit: PAGE });
    const stale = ((files ?? []) as StorageObject[])
      .filter((f) => f.id && f.created_at && new Date(f.created_at).getTime() < cutoff)
      .map((f) => `tmp/${u.name}/${f.name}`);
    if (stale.length === 0) continue;
    const { error } = await db.storage.from(TMP_BUCKET).remove(stale);
    if (!error) removed += stale.length;
  }
  return removed;
}

/**
 * Daily job: prune the drive-image cache bucket so Supabase storage doesn't grow
 * unbounded as new albums are viewed. Scheduled via vercel.json crons.
 *
 * `?purge=1` empties the bucket outright — use it to reclaim space immediately
 * when the project is already over quota. Nothing is lost: every object is
 * re-derivable from Drive on the next request.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  // Rác `tmp/` là của luồng tải ảnh lớn, KHÔNG liên quan tới bucket cache — phải
  // dọn kể cả khi cache đã tắt (cấu hình khuyến nghị ở gói Free).
  const tmpRemoved = await sweepTmp(db);
  if (!BUCKET) return NextResponse.json({ ok: true, tmpRemoved, skipped: "no cache bucket configured" });

  const purge = req.nextUrl.searchParams.get("purge") === "1";
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;
  const cutoff = startedAt - MAX_AGE_DAYS * 24 * 3600 * 1000;
  let removed = 0;
  let scanned = 0;
  let freed = 0;
  // false ⇒ the sweep stopped on the clock, not because it ran out of work.
  // Re-run the same request to continue; progress is durable (deleted is
  // deleted) and every pass re-lists from the current oldest object.
  let done = true;

  // ── Pass 1: age (or purge everything) ─────────────────────────────────────
  // Oldest-first from offset 0: each round removes the stale head of the
  // bucket. Because deleted objects vanish, re-listing from 0 keeps surfacing
  // the next stale batch until a page holds a non-stale object — the age
  // boundary — at which point we stop. Bounded rounds guard against runaway
  // loops and long function runs.
  for (let round = 0; round < 1000; round++) {
    if (outOfTime()) { done = false; break; }
    const files = await listOldest(db, 0);
    if (!files || files.length === 0) break;
    scanned += files.length;

    const stale = purge
      ? files
      : files.filter((o) => o.created_at && new Date(o.created_at).getTime() < cutoff);
    if (stale.length === 0) break;

    const { error: rmErr } = await db.storage.from(BUCKET).remove(stale.map((o) => o.name));
    if (rmErr) break;
    removed += stale.length;
    freed += stale.reduce((n, o) => n + sizeOf(o), 0);

    // This page still held recent files → we've passed the boundary. Done.
    if (stale.length < files.length) break;
  }

  // ── Pass 2: size ceiling ──────────────────────────────────────────────────
  // Measure what's left, then evict oldest-first until the bucket is under
  // MAX_BYTES. Skipped after a purge (bucket is already empty).
  let bytesBefore = 0;
  let bytesAfter = 0;
  if (!purge && done) {
    const all: StorageObject[] = [];
    for (let offset = 0; offset < 1000 * PAGE; offset += PAGE) {
      if (outOfTime()) { done = false; break; }
      const page = await listOldest(db, offset);
      if (!page || page.length === 0) break;
      all.push(...page);
      if (page.length < PAGE) break;
    }
    bytesBefore = all.reduce((n, o) => n + sizeOf(o), 0);
    bytesAfter = bytesBefore;

    // `done` still true ⇒ the listing above saw the WHOLE bucket, so the total
    // is trustworthy. A partial listing under-counts, which would evict against
    // a phantom total — leave it to the next run instead.
    if (done && bytesAfter > MAX_BYTES) {
      // `all` is already oldest-first; walk forward marking victims until the
      // running total fits, then delete them in list()-sized batches.
      const victims: string[] = [];
      for (const o of all) {
        if (bytesAfter <= MAX_BYTES) break;
        victims.push(o.name);
        bytesAfter -= sizeOf(o);
      }
      for (let i = 0; i < victims.length; i += PAGE) {
        if (outOfTime()) { done = false; break; }
        const batch = victims.slice(i, i + PAGE);
        const { error } = await db.storage.from(BUCKET).remove(batch);
        if (error) break;
        removed += batch.length;
      }
      freed += bytesBefore - bytesAfter;
    }
  }

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    tmpRemoved,
    mode: purge ? "purge" : "prune",
    maxAgeDays: MAX_AGE_DAYS,
    maxBytes: MAX_BYTES,
    scanned,
    removed,
    done, // false ⇒ hit the time budget; run it again to continue
    freedBytes: freed,
    bucketBytes: bytesAfter,
  });
}
