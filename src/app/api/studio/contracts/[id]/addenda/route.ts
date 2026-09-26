import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studioFor, loadContract, notifyContractChanged } from "@/lib/contract-change";
import { normalizeAddendumLines, nextAddendumNo, addendumLabel } from "@/lib/contract-addenda";
import { listAddenda, signAddendum } from "@/lib/contract-addenda-server";
import { logAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * Phụ lục hợp đồng (xem supabase/migrations/contract_addenda.sql).
 *
 * Quyền: chủ studio + quản lý + quản lý chi nhánh — cùng những người được sửa
 * hạng mục hợp đồng. Nhân viên thường không tạo phụ lục (đó là thay đổi giá).
 *
 * POST { action: "create", title?, note?, lines }
 *      { action: "update", addendumId, title?, note?, lines }   — chỉ khi chưa ký
 *      { action: "delete", addendumId }                        — chỉ khi chưa ký
 *      { action: "confirm", addendumId, name }                 — studio xác nhận thay khách
 */
const ROLES = ["manager", "branch_manager"] as const;

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const profile = await studioFor(ROLES);
  if (!profile) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = createAdminClient();
  const contract = await loadContract(db, id, profile.id);
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as {
    action?: string;
    addendumId?: string;
    title?: string;
    note?: string;
    lines?: unknown;
    name?: string;
  };
  const actor = (profile.actingUserId as string | undefined) ?? profile.id;
  const title = (b.title ?? "").trim().slice(0, 200);
  const note = (b.note ?? "").trim().slice(0, 2000) || null;

  const { data: signedRow } = await db.from("studio_contracts").select("client_signed_at").eq("id", id).maybeSingle();
  if (!signedRow?.client_signed_at) {
    // Chưa ký thì cứ sửa thẳng bảng hạng mục — phụ lục chỉ có nghĩa sau khi ký.
    return NextResponse.json({ error: "not_signed" }, { status: 409 });
  }

  const existing = await listAddenda(db, id);
  const target = b.addendumId ? existing.find((a) => a.id === b.addendumId) : undefined;
  if (b.action !== "create" && !target) return NextResponse.json({ error: "addendum_not_found" }, { status: 404 });
  if (target?.signed_at && b.action !== "create") return NextResponse.json({ error: "already_signed" }, { status: 409 });

  if (b.action === "create" || b.action === "update") {
    const lines = normalizeAddendumLines(b.lines);
    if (!lines.length) return NextResponse.json({ error: "no_lines" }, { status: 400 });
    if (b.action === "create") {
      const no = nextAddendumNo(existing);
      const { error } = await db.from("contract_addenda").insert({
        contract_id: id, owner_id: contract.owner_id, no, title, note, lines, created_by: actor,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAction(db, { ownerId: contract.owner_id, actorId: actor, action: "addendum.create", entity: "contract", entityId: id, summary: `Tạo ${addendumLabel({ no, title })}`, after: { lines } });
    } else {
      const { error } = await db.from("contract_addenda").update({ title, note, lines }).eq("id", target!.id).is("signed_at", null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAction(db, { ownerId: contract.owner_id, actorId: actor, action: "addendum.update", entity: "contract", entityId: id, summary: `Sửa ${addendumLabel({ no: target!.no, title })}`, before: { lines: target!.lines }, after: { lines } });
    }
  } else if (b.action === "delete") {
    const { error } = await db.from("contract_addenda").delete().eq("id", target!.id).is("signed_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAction(db, { ownerId: contract.owner_id, actorId: actor, action: "addendum.delete", entity: "contract", entityId: id, summary: `Xoá ${addendumLabel(target!)} (chưa ký)`, before: { lines: target!.lines } });
  } else if (b.action === "confirm") {
    const name = (b.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "no_name" }, { status: 400 });
    const r = await signAddendum(db, target!.id, { by: "studio", name });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "already_signed" ? 409 : 500 });
    await logAction(db, { ownerId: contract.owner_id, actorId: actor, action: "addendum.confirm", entity: "contract", entityId: id, summary: `Xác nhận thay khách ${addendumLabel(target!)} — người xác nhận: ${name}`, after: { lines: target!.lines } });
    await notifyContractChanged(db, contract.owner_id, id, `${addendumLabel(target!)} của HĐ “${contract.title}” đã được studio xác nhận`);
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  const [addenda, { data: items }] = await Promise.all([
    listAddenda(db, id),
    db.from("contract_items").select("*").eq("contract_id", id).not("addendum_id", "is", null).order("position"),
  ]);
  return NextResponse.json({ ok: true, addenda, addendumItems: items ?? [] });
}
