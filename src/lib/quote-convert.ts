import type { SupabaseClient } from "@supabase/supabase-js";
import { nextContractCode, newShareToken } from "@/lib/contract-code";
import { computeRoundedDeposit } from "@/lib/quote-deposit";
import { fullClauseText } from "@/lib/contract-clauses";
import { fmtDate } from "@/lib/date";

export type ConvertResult =
  | { ok: true; contract_id: string; contract_token: string }
  | { ok: false; error: string };

/**
 * Spawn a studio_contracts row from an accepted quote, copying the selected
 * items into contract_items. Pure helper — caller decides who's allowed to
 * call (studio-owner explicit click, or anonymous client auto-accept).
 *
 * If the quote already has `contract_id`, returns that id (idempotent).
 */
export async function convertQuoteToContract(
  db: SupabaseClient,
  quoteId: string
): Promise<ConvertResult> {
  const { data: quote } = await db
    .from("studio_quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Báo giá không tồn tại." };
  if (quote.contract_id) {
    // Already converted — fetch the contract's share token so callers can link to it.
    const { data: existing } = await db
      .from("studio_contracts")
      .select("client_token")
      .eq("id", quote.contract_id)
      .maybeSingle();
    if (existing?.client_token) {
      return { ok: true, contract_id: quote.contract_id, contract_token: existing.client_token };
    }
    return { ok: false, error: "Hợp đồng đã tạo trước đó nhưng không tìm thấy token." };
  }

  const { data: items } = await db
    .from("quote_items")
    .select("name, qty, unit_price, is_optional, is_discount, selected, position")
    .eq("quote_id", quote.id)
    .order("position");

  const chosen = (items ?? []).filter((it) => !it.is_optional || it.selected);
  if (chosen.length === 0) return { ok: false, error: "Không có hạng mục nào được chọn." };

  // Total = (positive lines) - (discount lines). Discount lines are carried
  // into contract_items with a negative unit_price so the contract math
  // stays consistent without a separate column.
  const total = chosen.reduce((s, it) => {
    const line = (it.qty || 0) * (it.unit_price || 0);
    return it.is_discount ? s - line : s + line;
  }, 0);
  const deposit = computeRoundedDeposit(total);

  const code = await nextContractCode(db, quote.owner_id);
  const token = newShareToken();

  // Use the quoted service's clauses (if any) so the contract inherits the same
  // terms the client was quoted under; fall back to the default clause set.
  let serviceClauses: string | null = null;
  let serviceName: string | null = null;
  if (quote.service_id) {
    const { data: svc } = await db
      .from("studio_services")
      .select("name, clauses")
      .eq("id", quote.service_id)
      .maybeSingle();
    if (svc?.clauses) serviceClauses = svc.clauses as string;
    if (svc?.name) serviceName = svc.name as string;
  }

  // Title format: "Hợp đồng [loại dịch vụ] - [tên khách hàng], [ngày khách chọn]".
  const titleParts = [
    `Hợp đồng${serviceName ? ` ${serviceName}` : ""}`,
    quote.client_name ? ` - ${quote.client_name}` : "",
    quote.event_date ? `, ${fmtDate(quote.event_date)}` : "",
  ];
  const contractTitle = titleParts.join("") || quote.title || "Hợp đồng";

  const { data: contract, error: cErr } = await db
    .from("studio_contracts")
    .insert({
      owner_id: quote.owner_id,
      // Hợp đồng thừa hưởng chi nhánh của báo giá — nếu không, mọi hợp đồng
      // chốt từ báo giá đều rơi về "chưa gán" và doanh thu chi nhánh bị hụt.
      branch_id: (quote as { branch_id?: string | null }).branch_id ?? null,
      code,
      title: contractTitle,
      service_id: quote.service_id ?? null,
      client_name: quote.client_name,
      client_phone: quote.client_phone,
      client_email: quote.client_email,
      client_facebook: quote.client_facebook,
      event_date: quote.event_date,
      location: quote.location,
      deposit,
      status: "draft",
      client_token: token,
      note: [
        quote.code ? `Tạo từ báo giá ${quote.code}` : null,
        serviceClauses || fullClauseText(),
      ].filter(Boolean).join("\n\n"),
    })
    .select("id")
    .single();
  if (cErr || !contract) return { ok: false, error: cErr?.message || "Tạo hợp đồng thất bại" };
  const rows = chosen.map((it, idx) => ({
    contract_id: contract.id,
    name: it.is_discount ? `🏷️ ${it.name}` : it.name,
    qty: it.qty,
    unit_price: it.is_discount ? -Math.abs(it.unit_price || 0) : it.unit_price,
    position: idx,
  }));
  const { error: iErr } = await db.from("contract_items").insert(rows);
  if (iErr) {
    await db.from("studio_contracts").delete().eq("id", contract.id);
    return { ok: false, error: iErr.message };
  }

  // Auto-create a deposit instalment so the client sees a payment schedule immediately.
  if (deposit > 0) {
    const depositPct = Math.round((deposit / total) * 100);
    await db.from("contract_payment_plan").insert({
      contract_id: contract.id,
      label: `Cọc ${depositPct}%`,
      amount: deposit,
      position: 0,
    });
  }

  await db
    .from("studio_quotes")
    .update({ status: "converted", contract_id: contract.id })
    .eq("id", quote.id);

  return { ok: true, contract_id: contract.id, contract_token: token };
}
