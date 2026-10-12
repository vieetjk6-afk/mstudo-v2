import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addContractAlbumLink,
  albumModeReadiness,
  ensureManualContractAlbum,
} from "@/lib/studio-drive";
import { deliverContractIfReady } from "@/lib/contract-delivery";
import { isDeliveryPhase } from "@/lib/album-phase";
import { isMissingColumn } from "@/lib/missing-column";
import { contractKind, kindHasPhotoWork } from "@/lib/contract-kind";
import { logAction } from "@/lib/audit-log";
import { isBranchScopedRole } from "@/lib/studio-roles";
import {
  isDesktopReady,
  normalizeAlbumMode,
  readinessHints,
  shouldEnsureManualAlbum,
  type AlbumMode,
} from "@/lib/album-mode";

export const dynamic = "force-dynamic";
// Dán link = thêm nguồn + đồng bộ ảnh từ Drive ngay — cần thêm thời gian.
export const maxDuration = 60;

/**
 * Album của hợp đồng theo CHẾ ĐỘ ALBUM (@/lib/album-mode) — tab Sản phẩm.
 *
 *   GET  ?contractId=…  → { mode, readiness, album }
 *   POST { contractId, action: "set_mode", mode: "desktop" | "manual" }
 *   POST { contractId, action: "create_album" }        (chỉ chế độ nhập link riêng)
 *   POST { contractId, action: "add_link", stage, url } (dán link Drive vào album)
 *   POST { contractId, action: "deliver" }              (chuyển album sang giao khách)
 *
 * Quyền: cùng luật đổi trạng thái hợp đồng (/api/studio/contract-status) — chủ
 * studio và nhân viên; nhân viên thường chỉ hợp đồng được giao, quản lý chi
 * nhánh chỉ hợp đồng chi nhánh mình; kế toán không sửa. Ghi bằng service role
 * SAU khi đã kiểm quyền, nên nhân viên cũng dán link được dù RLS album chỉ cho chủ.
 */

type Ctx = NonNullable<Awaited<ReturnType<typeof requireStudio>>>;

async function loadContract(profile: Ctx, contractId: string | null | undefined, write: boolean) {
  if (!contractId) return { error: NextResponse.json({ error: "bad_request" }, { status: 400 }) } as const;
  if (write && profile.actingRole === "accountant") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  const db = createAdminClient();
  // "*": album_mode / branch_id chỉ có sau migration — nêu tên cột chưa có là 400.
  const { data: c } = await db.from("studio_contracts").select("*").eq("id", contractId).maybeSingle();
  if (!c || c.owner_id !== profile.id) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) } as const;
  if (profile.actingRole === "staff" && c.assigned_to !== profile.actingUserId) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  if (isBranchScopedRole(profile.actingRole as string)) {
    const mine = (profile.actingBranchId as string | null) ?? null;
    if (!mine || c.branch_id !== mine) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) } as const;
  }
  return { db, contract: c as Record<string, unknown> & { id: string; owner_id: string } } as const;
}

async function albumInfo(db: ReturnType<typeof createAdminClient>, albumId: string | null) {
  if (!albumId) return null;
  const { data: al } = await db
    .from("albums")
    .select("id, title, slug, phase, is_gallery, status")
    .eq("id", albumId)
    .maybeSingle();
  if (!al) return null;
  const { data: srcRows } = await db
    .from("album_sources")
    .select("id, name, drive_url, stage, kind")
    .eq("album_id", albumId)
    .order("position");
  const sources = (srcRows ?? []) as { id: string; name: string; drive_url: string; stage: string | null; kind: string }[];
  const { count: photoCount } = await db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);
  const delIds = sources.filter((s) => s.stage === "delivery").map((s) => s.id);
  let deliveryPhotos = 0;
  if (delIds.length) {
    const { count } = await db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId).in("source_id", delIds);
    deliveryPhotos = count ?? 0;
  }
  return {
    id: al.id as string,
    title: al.title as string,
    slug: al.slug as string,
    status: al.status as string,
    phase: isDeliveryPhase(al) ? "delivery" : "selection",
    photoCount: photoCount ?? 0,
    deliveryPhotos,
    sources: sources.map((s) => ({ id: s.id, name: s.name, url: s.drive_url, stage: s.stage === "delivery" ? "delivery" : "selection" })),
  };
}

async function snapshot(profile: Ctx, db: ReturnType<typeof createAdminClient>, contractId: string) {
  const { data: c } = await db.from("studio_contracts").select("*").eq("id", contractId).maybeSingle();
  const readiness = await albumModeReadiness(profile.id as string, profile.studioTier === "full");
  return {
    mode: normalizeAlbumMode(c?.album_mode),
    // Cột chưa có (chưa chạy migration) → màn hợp đồng ẩn nút đổi chế độ.
    migrated: !!c && "album_mode" in c,
    status: (c?.status as string | null) ?? null,
    readiness: { ...readiness, ready: isDesktopReady(readiness), hints: readinessHints(readiness) },
    selectionAlbumId: (c?.selection_album_id as string | null) ?? null,
    galleryAlbumId: (c?.gallery_album_id as string | null) ?? null,
    album: await albumInfo(db, (c?.selection_album_id as string | null) ?? null),
  };
}

export async function GET(req: Request) {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("contractId");
  const r = await loadContract(profile, id, false);
  if ("error" in r) return r.error;
  return NextResponse.json(await snapshot(profile, r.db, r.contract.id));
}

export async function POST(req: Request) {
  const profile = await requireStudio("plus");
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    contractId?: string;
    action?: string;
    mode?: string;
    stage?: string;
    url?: string;
  };
  const r = await loadContract(profile, body.contractId, true);
  if ("error" in r) return r.error;
  const { db, contract } = r;
  const ownerId = profile.id as string;
  const mode = normalizeAlbumMode(contract.album_mode);
  const hasPhotoWork = kindHasPhotoWork(contractKind(contract.shoot_type as never));

  // ── Đổi chế độ album ───────────────────────────────────────────────────
  if (body.action === "set_mode") {
    const wanted = normalizeAlbumMode(body.mode);
    if (!wanted) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (wanted === "desktop") {
      const ready = await albumModeReadiness(ownerId, profile.studioTier === "full");
      if (!isDesktopReady(ready)) {
        return NextResponse.json(
          { error: "Chưa dùng được album mặc định: " + readinessHints(ready).map((h) => h.text).join(" "), hints: readinessHints(ready) },
          { status: 409 }
        );
      }
    }
    if (wanted !== mode) {
      const { error } = await db.from("studio_contracts").update({ album_mode: wanted satisfies AlbumMode }).eq("id", contract.id);
      if (error) {
        const msg = isMissingColumn(error, "album_mode")
          ? "Database chưa có cột chế độ album — chạy supabase/migrations/che_do_album_hop_dong.sql (hoặc cap-nhat.sql) rồi thử lại."
          : error.message;
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      await logAction(db, {
        ownerId,
        actorId: profile.actingUserId as string,
        action: "contract.album_mode",
        entity: "contract",
        entityId: contract.id,
        summary: `Đổi chế độ album ${mode ?? "mặc định cũ"} → ${wanted}`,
        before: { album_mode: mode },
        after: { album_mode: wanted },
      });
      // Sang nhập link riêng khi khách đã xác nhận → có album ngay để dán link.
      if (shouldEnsureManualAlbum(wanted, contract.status as string, hasPhotoWork)) {
        await ensureManualContractAlbum(ownerId, contract.id).catch(() => undefined);
      }
    }
    return NextResponse.json({ ok: true, ...(await snapshot(profile, db, contract.id)) });
  }

  // ── Tạo album trống cho hợp đồng (trước khi khách xác nhận) ─────────────
  if (body.action === "create_album") {
    if (mode !== "manual") {
      return NextResponse.json({ error: "Chỉ hợp đồng “Nhập link ảnh riêng” mới tạo album tay ở đây." }, { status: 400 });
    }
    const e = await ensureManualContractAlbum(ownerId, contract.id);
    if (!e.albumId) {
      const msg = e.error === "no_photo_work" ? "Hợp đồng makeup / thuê đồ không có album ảnh." : `Không tạo được album: ${e.error ?? "không rõ lỗi"}`;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true, created: e.created, ...(await snapshot(profile, db, contract.id)) });
  }

  // ── Dán link Drive (ảnh chọn / ảnh hoàn thiện) ─────────────────────────
  if (body.action === "add_link") {
    const stage = body.stage === "delivery" ? "delivery" : "selection";
    let albumId = (contract.selection_album_id as string | null) ?? null;
    if (!albumId) {
      if (mode !== "manual") return NextResponse.json({ error: "Hợp đồng chưa có album." }, { status: 400 });
      const e = await ensureManualContractAlbum(ownerId, contract.id);
      albumId = e.albumId;
      if (!albumId) return NextResponse.json({ error: `Không tạo được album: ${e.error ?? "không rõ lỗi"}` }, { status: 400 });
    }
    const a = await addContractAlbumLink(ownerId, albumId, body.url ?? "", stage);
    if (!a.ok) {
      const msg = a.error === "bad_link" ? "Link không phải link Google Drive (thư mục hoặc ảnh)." : a.error;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    // Link ảnh hoàn thiện của hợp đồng ĐÃ hoàn thành → giao khách luôn (cùng
    // album, báo khách một lần). Chưa hoàn thành thì để studio tự bấm chuyển.
    let delivered = false;
    if (stage === "delivery" && contract.status === "completed") {
      const d = await deliverContractIfReady(ownerId, contract.id, { notifyExisting: true }).catch(() => null);
      delivered = !!d?.album;
    }
    return NextResponse.json({
      ok: true,
      added: a.added,
      total: a.total,
      errors: a.errors,
      delivered,
      ...(await snapshot(profile, db, contract.id)),
    });
  }

  // ── Chuyển album sang giao khách ───────────────────────────────────────
  if (body.action === "deliver") {
    const d = await deliverContractIfReady(ownerId, contract.id, { force: true, notifyExisting: true });
    if (!d.album) {
      const msg =
        d.reason === "manual_no_link"
          ? "Dán link ảnh hoàn thiện trước khi chuyển sang giao khách."
          : d.reason === "waiting"
            ? "Thư mục ảnh hoàn thiện còn trống."
            : `Chưa chuyển được sang giao khách${d.reason ? ` (${d.reason})` : ""}.`;
      return NextResponse.json({ error: msg, reason: d.reason ?? null }, { status: 400 });
    }
    return NextResponse.json({ ok: true, delivered: true, ...(await snapshot(profile, db, contract.id)) });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
