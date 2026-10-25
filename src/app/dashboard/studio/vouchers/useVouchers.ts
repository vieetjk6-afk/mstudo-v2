"use client";

import { useMemo, useState } from "react";
import { vnd } from "@/lib/types";
import { fmtDate, todayVN } from "@/lib/date";
import { escapeHtml } from "@/lib/html-escape";
import { useToast } from "@/components/studio/Toast";
import { defaultExpiry, isLoyalty, voucherState, voucherSummary, type Voucher, type VoucherState } from "@/lib/vouchers";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Voucher & thẻ quà (bản cũ VouchersView và bản
   mới VouchersV2): danh sách, lọc, số liệu, bán voucher, đánh dấu đã thu / huỷ
   / trả lại (qua /api/studio/vouchers), in thẻ quà.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Draft = {
  title: string;
  amount: number;
  price: number;
  buyer_name: string;
  buyer_phone: string;
  recipient_name: string;
  expires_on: string;
  paid: boolean;
  paid_method: "transfer" | "cash";
  note: string;
};

export function useVouchers({ initial, studioName, studioPhone }: { initial: Voucher[]; studioName: string; studioPhone: string | null }) {
  const today = todayVN();
  const [list, setList] = useState<Voucher[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<VoucherState | "all">("all");
  const [kind, setKind] = useState<"all" | "gift" | "loyalty">("all");
  const [sharing, setSharing] = useState<Voucher | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const sum = useMemo(() => voucherSummary(list, today), [list, today]);
  const loyaltyCount = list.filter((v) => isLoyalty(v)).length;
  const loyaltyActive = list.filter((v) => isLoyalty(v) && voucherState(v, today) === "usable").length;
  const shown = list.filter(
    (v) =>
      (filter === "all" || voucherState(v, today) === filter) &&
      (kind === "all" || (kind === "loyalty" ? isLoyalty(v) : !isLoyalty(v)))
  );

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(
          j.error === "missing_migration" ? "Cần chạy supabase/migrations/studio_vouchers.sql trước."
          : j.error === "still_applied" ? "Hợp đồng vẫn còn dòng giảm giá của voucher này — gỡ dòng đó rồi mới trả lại được."
          : `Lỗi: ${j.error || res.status}`
        );
        return null;
      }
      return j as { voucher?: Voucher };
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Bản nháp mặc định khi bấm "Bán voucher". */
  const newDraft = (): Draft => ({ title: "Voucher chụp ảnh", amount: 0, price: 0, buyer_name: "", buyer_phone: "", recipient_name: "", expires_on: defaultExpiry(today), paid: true, paid_method: "transfer", note: "" });

  async function create() {
    if (!draft) return;
    if (draft.amount <= 0) return toast("Nhập mệnh giá voucher.");
    const j = await call({ action: "create", ...draft });
    if (j?.voucher) {
      setList((p) => [j.voucher!, ...p]);
      setDraft(null);
      toast(`Đã tạo voucher ${j.voucher.code}`);
    }
  }

  async function act(v: Voucher, action: "mark_paid" | "void" | "release") {
    if (action === "void" && !confirm(`Huỷ voucher ${v.code}? Thẻ sẽ không dùng được nữa.`)) return;
    if (action === "release" && !confirm(`Trả voucher ${v.code} về "còn hiệu lực"? Chỉ làm khi đã gỡ dòng giảm giá khỏi hợp đồng.`)) return;
    const j = await call({ action, id: v.id, paid_method: "transfer" });
    if (j?.voucher) setList((p) => p.map((x) => (x.id === v.id ? j.voucher! : x)));
  }

  function printCard(v: Voucher) {
    const w = window.open("", "_blank", "width=720,height=520");
    if (!w) return toast("Trình duyệt chặn cửa sổ in — cho phép popup rồi thử lại.");
    const e = escapeHtml;
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${e(v.code)}</title>
<style>
  @page { size: A5 landscape; margin: 0 }
  body { margin: 0; font-family: "Be Vietnam Pro", Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f1ee }
  .card { width: 190mm; height: 120mm; box-sizing: border-box; border-radius: 6mm; padding: 12mm 14mm; color: #fff;
          background: linear-gradient(135deg, #7a1f82, #af2bb8 55%, #d56adc); display: flex; flex-direction: column; justify-content: space-between }
  .top { display: flex; justify-content: space-between; align-items: flex-start }
  .studio { font-weight: 800; font-size: 16pt; letter-spacing: -.3px }
  .kind { font-size: 9pt; text-transform: uppercase; letter-spacing: 2px; opacity: .85 }
  .value { font-size: 40pt; font-weight: 800; letter-spacing: -1.5px; margin: 0 }
  .title { font-size: 13pt; opacity: .95; margin-top: 1mm }
  .to { font-size: 11pt; margin-top: 4mm }
  .bottom { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5pt }
  .code { font-family: ui-monospace, Menlo, monospace; font-size: 15pt; font-weight: 700; letter-spacing: 2px; background: rgba(255,255,255,.18); padding: 2mm 4mm; border-radius: 2mm }
  @media print { body { background: none } }
</style></head><body><div class="card">
  <div class="top"><div class="studio">${e(studioName)}</div><div class="kind">Gift voucher</div></div>
  <div>
    <p class="value">${e(vnd(v.amount))}</p>
    <div class="title">${e(v.title)}</div>
    ${v.recipient_name ? `<div class="to">Dành tặng: <b>${e(v.recipient_name)}</b></div>` : ""}
  </div>
  <div class="bottom">
    <div>${v.expires_on ? `Hạn dùng đến ${e(fmtDate(v.expires_on))}` : "Không thời hạn"}${studioPhone ? `<br>Đặt lịch: ${e(studioPhone)}` : ""}</div>
    <div class="code">${e(v.code)}</div>
  </div>
</div><script>setTimeout(() => window.print(), 300)</script></body></html>`);
    w.document.close();
  }

  return { today, list, draft, setDraft, newDraft, filter, setFilter, kind, setKind, sharing, setSharing, busy, toast, toastNode, sum, loyaltyCount, loyaltyActive, shown, create, act, printCard };
}
