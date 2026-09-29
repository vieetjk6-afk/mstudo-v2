"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { vnd, type ContractItem, type ContractPayment } from "@/lib/types";
import { REDEEM_ERROR_TEXT, isLoyalty, voucherValueLabel, type Voucher } from "@/lib/vouchers";

/**
 * "Khách có voucher?" — hai bước: kiểm mã (xem mệnh giá, còn dùng được không)
 * rồi mới trừ. Trừ = một khoản thu kind 'voucher' bằng mệnh giá; công nợ hợp
 * đồng tự giảm. Xoá khoản thu đó thì thẻ tự quay về "còn hiệu lực".
 *
 * Voucher ƯU ĐÃI (studio tặng) thì khác: không có tiền nào vào quỹ, nên trừ =
 * một DÒNG GIẢM GIÁ trong hạng mục (máy chủ tự tính % theo tổng hiện tại).
 */
export default function VoucherRedeem({
  contractId,
  balance,
  onRedeemed,
  onItemAdded,
  beforeLoyalty,
  toast,
}: {
  contractId: string;
  balance: number;
  onRedeemed: (p: ContractPayment) => void;
  /** Voucher ưu đãi đã thành dòng giảm giá — đưa vào bảng hạng mục đang mở. */
  onItemAdded: (item: ContractItem) => void;
  /** Chạy trước khi áp voucher ưu đãi (lưu bảng hạng mục đang sửa dở). */
  beforeLoyalty?: () => Promise<void>;
  toast: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Voucher | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(action: "check" | "redeem") {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code, contractId }),
      });
      return { res, j: await res.json().catch(() => ({})) };
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    const { res, j } = await call("check");
    if (res.status === 403) return toast("Bạn không có quyền dùng voucher.");
    if (!j.ok) {
      setFound(null);
      return toast(REDEEM_ERROR_TEXT[j.error as keyof typeof REDEEM_ERROR_TEXT] ?? `Lỗi: ${j.error || res.status}`);
    }
    setFound(j.voucher as Voucher);
  }

  async function redeem() {
    if (found && isLoyalty(found) && beforeLoyalty) await beforeLoyalty();
    const { res, j } = await call("redeem");
    if (!res.ok) {
      return toast(
        j.error === "missing_migration" ? "Cần chạy supabase/migrations/studio_vouchers.sql trước."
        : j.error === "contract_signed" ? "Khách đã ký — giá đã khoá. Áp voucher ưu đãi trước khi gửi ký, hoặc ghi qua phụ lục."
        : j.error === "nothing_to_discount" ? "Hợp đồng chưa có hạng mục có giá để trừ voucher."
        : REDEEM_ERROR_TEXT[j.error as keyof typeof REDEEM_ERROR_TEXT] ?? `Lỗi: ${j.error || res.status}`
      );
    }
    if (j.kind === "loyalty") {
      onItemAdded(j.item as ContractItem);
      toast(`Đã áp voucher ${found?.code} · giảm ${vnd(j.discount ?? 0)} vào hạng mục`);
    } else {
      onRedeemed(j.payment as ContractPayment);
      toast(`Đã trừ voucher ${found?.code} · ${vnd(found?.amount ?? 0)}`);
    }
    setOpen(false);
    setCode("");
    setFound(null);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost mb-3 px-2.5 py-1.5 text-xs">
        <Ticket size={14} /> Khách dùng voucher
      </button>
    );
  }
  return (
    <div className="mb-4 rounded-xl p-3" style={{ background: "var(--surface2)" }} data-testid="voucher-redeem">
      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-0 flex-1 font-mono uppercase"
          placeholder="Mã voucher, vd QUA-7K3M9P"
          value={code}
          onChange={(e) => { setCode(e.target.value); setFound(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) check(); }}
        />
        <button onClick={check} disabled={busy || !code.trim()} className="btn-ghost">Kiểm mã</button>
        <button onClick={() => { setOpen(false); setFound(null); setCode(""); }} className="btn-ghost">Đóng</button>
      </div>
      {found && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
          <span>
            <b className="font-mono">{found.code}</b> · {found.title} ·{" "}
            {isLoyalty(found) ? <b>{voucherValueLabel(found)}</b> : <>mệnh giá <b className="tnum">{vnd(found.amount)}</b></>}
            {!isLoyalty(found) && found.amount > balance && balance >= 0 && (
              <span style={{ color: "var(--s-amber)" }}> — lớn hơn số còn phải thu ({vnd(balance)}), khách sẽ thành trả dư</span>
            )}
          </span>
          <div className="flex-1" />
          <button onClick={redeem} disabled={busy} className="btn-primary px-3 py-1.5 text-xs">
            {busy ? "Đang trừ…" : isLoyalty(found) ? "Áp vào hợp đồng" : `Trừ ${vnd(found.amount)} vào hợp đồng`}
          </button>
        </div>
      )}
    </div>
  );
}
