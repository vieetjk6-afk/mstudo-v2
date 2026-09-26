import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { AddendumLine, ContractAddendum } from "@/lib/contract-addenda";

type Db = ReturnType<typeof createAdminClient>;

const COLS = "id, contract_id, no, title, note, lines, signed_at, signed_by, signed_name, created_at";

export async function listAddenda(db: Db, contractId: string): Promise<ContractAddendum[]> {
  const { data, error } = await db.from("contract_addenda").select(COLS).eq("contract_id", contractId).order("no");
  if (error) return [];
  return (data ?? []) as unknown as ContractAddendum[];
}

/**
 * Ký một phụ lục: đóng dấu chữ ký rồi chép các dòng nháp thành contract_items.
 *
 * Đóng dấu TRƯỚC bằng một UPDATE có điều kiện `signed_at is null` — hai lần bấm
 * ký cùng lúc (khách bấm đúp, hoặc khách ký đúng lúc studio xác nhận thay) chỉ
 * một lần thắng, nên các dòng không bao giờ bị chép hai lần. Chép hỏng thì gỡ
 * dấu chữ ký, để phụ lục quay về trạng thái chờ ký chứ không "đã ký mà không
 * có tiền".
 */
export async function signAddendum(
  db: Db,
  addendumId: string,
  who: { by: "client" | "studio"; name: string; signature?: string | null }
): Promise<{ ok: true; addendum: ContractAddendum } | { ok: false; error: string }> {
  const { data: claimed, error: claimErr } = await db
    .from("contract_addenda")
    .update({
      signed_at: new Date().toISOString(),
      signed_by: who.by,
      signed_name: who.name.slice(0, 200),
      signature: who.signature ?? null,
    })
    .eq("id", addendumId)
    .is("signed_at", null)
    .select(COLS)
    .maybeSingle();
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed) return { ok: false, error: "already_signed" };
  const a = claimed as unknown as ContractAddendum;

  const lines = (Array.isArray(a.lines) ? a.lines : []) as AddendumLine[];
  if (lines.length) {
    const { data: last } = await db
      .from("contract_items")
      .select("position")
      .eq("contract_id", a.contract_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (Number(last?.position) || 0) + 1;
    const rows = lines.map((l, i) => ({
      contract_id: a.contract_id,
      addendum_id: a.id,
      name: l.name,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price,
      position: start + i,
    }));
    const { error } = await db.from("contract_items").insert(rows);
    if (error) {
      await db
        .from("contract_addenda")
        .update({ signed_at: null, signed_by: null, signed_name: null, signature: null })
        .eq("id", a.id);
      return { ok: false, error: error.message };
    }
  }
  return { ok: true, addendum: a };
}
