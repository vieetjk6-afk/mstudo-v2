"use client";

import { fmtDateTime } from "@/lib/date";
import { Check, Crown, Trash2, X as XIcon } from "lucide-react";
import { Section } from "@/components/admin/Section";
import { UPGRADE_PAYMENT_LABEL, type UpgradePaymentStatus } from "@/lib/upgrade-payment";
import type { UpgradeRequest } from "@/lib/types";
import { useUpgradeRequests } from "./useUpgradeRequests";

/** Màu viên trạng thái thanh toán — cùng bảng màu với các nhãn khác của app. */
function payTone(st: string | null | undefined): React.CSSProperties {
  if (st === "paid") return { background: "var(--gnS)", color: "var(--gn)" };
  if (st === "awaiting_confirm") return { background: "var(--amS)", color: "var(--am)" };
  if (st === "failed") return { background: "var(--rdS)", color: "var(--rd)" };
  return { background: "var(--surface)", color: "var(--text3)" };
}

/**
 * Yêu cầu nâng cấp gói + duyệt chuyển khoản.
 *
 * Nằm cùng tab với bảng tài khoản (Người dùng & studio) chứ không ở Cấu hình
 * mstudo nữa: duyệt tiền xong là thường phải xem ngay gói của tài khoản đó, hai
 * việc rời hai màn thì admin cứ phải nhảy qua nhảy lại.
 */
export default function UpgradeRequests({ initial }: { initial: UpgradeRequest[] }) {
  // Logic dùng chung với bản mới (UpgradeRequestsV2) — xem ./useUpgradeRequests.
  const { rows, busy, msg, handle, review } = useUpgradeRequests(initial);

  return (
    <Section title={`Yêu cầu nâng cấp (${rows.length})`} icon={Crown}>
      {msg && (
        <p className="rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{msg}</p>
      )}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--text3)" }}>Chưa có yêu cầu nào.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="rounded-xl p-4" style={{ background: "var(--surface2)", opacity: u.handled ? 0.55 : 1 }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {u.email ?? u.user_id}
                    {u.phone && <span className="text-[12px] font-normal" style={{ color: "var(--text2)" }}>📞 {u.phone}</span>}
                    {u.plan && (
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: "color-mix(in srgb, var(--gold) 18%, transparent)", color: "var(--gold)" }}>
                        {u.plan}{u.cycle ? ` · ${u.cycle === "year" ? "năm" : "tháng"}` : ""}
                      </span>
                    )}
                    {(u.payment_amount ?? u.amount) != null && (
                      <span className="text-[12px] font-semibold" style={{ color: "var(--gold)" }}>
                        {(u.payment_amount ?? u.amount)!.toLocaleString("vi-VN")}đ
                      </span>
                    )}
                    {u.discount_code && <span className="rounded px-2 py-0.5 font-mono text-[11px]" style={{ background: "var(--surface)", color: "var(--text2)" }}>{u.discount_code}</span>}
                    {u.payment_code && <span className="rounded px-2 py-0.5 font-mono text-[11px] font-bold" style={{ background: "var(--surface)", color: "var(--text)" }}>{u.payment_code}</span>}
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={payTone(u.payment_status)}>
                      {UPGRADE_PAYMENT_LABEL[(u.payment_status ?? "none") as UpgradePaymentStatus] ?? u.payment_status}
                    </span>
                  </div>
                  {u.note && <p className="mt-0.5 text-xs" style={{ color: "var(--text2)" }}>{u.note}</p>}
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text3)" }}>{fmtDateTime(u.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {/* Studio đã báo chuyển khoản → hai lựa chọn dứt khoát: đã
                      thấy tiền (nâng gói ngay) hay chưa thấy (báo thất bại). */}
                  {u.payment_status === "awaiting_confirm" && (
                    <>
                      <button
                        onClick={() => review(u.id, "confirm")}
                        disabled={busy === u.id}
                        className="rounded-lg px-2.5 py-2 text-[12px] font-semibold disabled:opacity-60"
                        style={{ background: "var(--gnS)", color: "var(--gn)" }}
                      >
                        <Check size={13} className="mr-1 inline" /> Đã nhận tiền
                      </button>
                      <button
                        onClick={() => review(u.id, "reject")}
                        disabled={busy === u.id}
                        className="rounded-lg px-2.5 py-2 text-[12px] font-semibold disabled:opacity-60"
                        style={{ background: "var(--rdS)", color: "var(--rd)" }}
                      >
                        <XIcon size={13} className="mr-1 inline" /> Chưa nhận được
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handle("handled", u.id, !u.handled)}
                    className="rounded-lg p-2"
                    style={{ background: "var(--surface)", color: u.handled ? "var(--success)" : "var(--text3)" }}
                    aria-label={u.handled ? "Đánh dấu chưa xử lý" : "Đánh dấu đã xử lý"}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => handle("delete", u.id)}
                    className="rounded-lg p-2"
                    style={{ background: "var(--surface)", color: "var(--danger)" }}
                    aria-label="Xoá yêu cầu nâng cấp"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
