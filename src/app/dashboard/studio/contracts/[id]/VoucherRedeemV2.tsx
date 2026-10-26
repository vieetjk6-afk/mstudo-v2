"use client";

import { AlertTriangle, Search, Ticket } from "lucide-react";
import { Badge, Callout, Field, btn, inputCls } from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";
import { vnd } from "@/lib/types";
import { isLoyalty, voucherValueLabel } from "@/lib/vouchers";
import { useVoucherRedeem, type VoucherRedeemProps } from "./VoucherRedeem";

/* ═══════════════════════════════════════════════════════════════════════════
   "Khách dùng voucher" — giao diện mới (tab Thanh toán). Cùng logic với bản cũ
   (useVoucherRedeem): một nút mở hộp thoại → nhập mã, Kiểm mã để xem mệnh giá
   và điều kiện, rồi mới trừ vào hợp đồng.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VoucherRedeemV2(props: VoucherRedeemProps & { className?: string }) {
  const { balance, className } = props;
  const v = useVoucherRedeem(props);
  const { found } = v;
  const loyalty = !!found && isLoyalty(found);
  const over = !!found && !loyalty && found.amount > balance && balance >= 0;

  return (
    <>
      <button type="button" className={className ?? btn("ghost", "sm")} onClick={() => v.setOpen(true)}>
        <Ticket size={15} /> Khách dùng voucher
      </button>
      <Modal
        open={v.open}
        onClose={() => (v.busy ? undefined : v.close())}
        icon={Ticket}
        title="Khách dùng voucher"
        desc="Kiểm mã trước để xem mệnh giá và điều kiện, rồi mới trừ vào hợp đồng."
        width={500}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={v.close} disabled={v.busy}>
              Đóng
            </button>
            <button type="button" className={btn("primary")} onClick={v.redeem} disabled={v.busy || !found}>
              {v.busy && found ? "Đang trừ…" : !found ? "Trừ vào hợp đồng" : loyalty ? "Áp vào hợp đồng" : `Trừ ${vnd(found.amount)} vào hợp đồng`}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4" data-testid="voucher-redeem">
          <Field label="Mã voucher" htmlFor="vr-code">
            <div className="flex gap-2">
              <input
                id="vr-code"
                autoFocus
                className={`${inputCls} min-w-0 flex-1 font-mono uppercase`}
                placeholder="vd QUA-7K3M9P"
                value={v.code}
                onChange={(e) => {
                  v.setCode(e.target.value);
                  v.setFound(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && v.code.trim()) v.check();
                }}
              />
              <button type="button" className={btn("secondary")} onClick={v.check} disabled={v.busy || !v.code.trim()}>
                <Search size={16} /> Kiểm mã
              </button>
            </div>
          </Field>

          {found && (
            <div className="flex items-start gap-3 rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                <Ticket size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[14px] font-bold">{found.code}</span>
                  <Badge tone="green" dot>
                    Hợp lệ
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--tx2)" }}>
                  {found.title}
                </p>
                <p className="mt-1 text-[14px] font-semibold">
                  {loyalty ? voucherValueLabel(found) : <span className="v2-num">Mệnh giá {vnd(found.amount)}</span>}
                </p>
              </div>
            </div>
          )}

          {over && found && (
            <Callout tone="amber" icon={AlertTriangle}>
              Mệnh giá lớn hơn số còn phải thu ({vnd(balance)}) — khách sẽ thành trả dư.
            </Callout>
          )}

          {v.needPhone && (
            <Field label="SĐT của hợp đồng được tặng" htmlFor="vr-phone" hint="Voucher của người khác — nhập đúng SĐT hợp đồng gốc rồi bấm áp lại.">
              <input id="vr-phone" className={inputCls} inputMode="tel" placeholder="09…" value={v.vphone} onChange={(e) => v.setVphone(e.target.value)} />
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}
