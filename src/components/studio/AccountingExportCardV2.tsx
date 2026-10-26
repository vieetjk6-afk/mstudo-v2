"use client";

import { Check, FileSpreadsheet, Loader2, Lock, LockOpen } from "lucide-react";
import { Badge, Callout, Field, Section, btn, inputCls } from "@/components/v2/kit";
import { useAccountingExport } from "./useAccountingExport";

/* ═══════════════════════════════════════════════════════════════════════════
   XUẤT KẾ TOÁN & KHOÁ SỔ — giao diện mới. Cùng logic với AccountingExportCard
   (./useAccountingExport): chọn kỳ → xuất Excel ba sheet; khoá / mở khoá sổ.
   ═══════════════════════════════════════════════════════════════════════════ */

const dmy = (iso: string) => iso.split("-").reverse().join("/");

export default function AccountingExportCardV2({
  ownerId,
  initialClosedUntil,
  canClose,
}: {
  ownerId: string;
  initialClosedUntil: string | null;
  canClose: boolean;
}) {
  const a = useAccountingExport(ownerId, initialClosedUntil);

  return (
    <Section
      icon={FileSpreadsheet}
      title="Xuất kế toán & khoá sổ"
      desc={
        <>
          Một file Excel ba sheet: <b>Thu</b> · <b>Chi</b> · <b>Công nợ</b>, đúng khoảng ngày bạn chọn.
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <Field label="Từ ngày" htmlFor="acc-from">
            <input id="acc-from" type="date" className={inputCls} value={a.from} max={a.to} onChange={(e) => a.setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày" htmlFor="acc-to">
            <input id="acc-to" type="date" className={inputCls} value={a.to} min={a.from} onChange={(e) => a.setTo(e.target.value)} />
          </Field>
          <button type="button" onClick={a.exportXlsx} disabled={a.busy || a.from > a.to} className={btn("secondary", "md", "col-span-2 sm:col-span-1")}>
            {a.busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            {a.busy ? "Đang xuất…" : "Xuất Excel"}
          </button>
        </div>

        {a.periodLocked && (
          <Callout tone="amber" icon={Lock}>
            Kỳ đang chọn nằm trong vùng đã khoá — số liệu ở đây được coi là đã chốt.
          </Callout>
        )}

        {/* ── Khoá sổ ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 pt-4" style={{ borderTop: "1px solid var(--bd2)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold">Khoá sổ</p>
            {a.closedUntil ? (
              <Badge tone="amber" icon={Lock}>Đã khoá tới {dmy(a.closedUntil)}</Badge>
            ) : (
              <Badge tone="gray" icon={LockOpen}>Chưa khoá kỳ nào</Badge>
            )}
          </div>
          <p className="max-w-[70ch] text-[12.5px] leading-relaxed" style={{ color: "var(--tx3)" }}>
            Khoá sổ để số liệu của kỳ đã gửi kế toán không đổi khi ai đó sửa một hợp đồng cũ. Khoá sổ{" "}
            <b>không xoá gì</b> — chỉ đánh mốc và cảnh báo khi có người định sửa số trước mốc đó.
          </p>
          {canClose && (
            <div className="flex flex-wrap items-center gap-2">
              {a.suggestClose && (
                <button type="button" onClick={() => a.closeBooks(a.suggestClose)} disabled={a.closing} className={btn("secondary", "sm")}>
                  <Lock size={14} /> Khoá tới hết tháng này
                </button>
              )}
              <button type="button" onClick={() => a.closeBooks(a.to)} disabled={a.closing} className={btn("secondary", "sm")}>
                <Lock size={14} /> Khoá tới {dmy(a.to)}
              </button>
              {a.closedUntil && (
                <button type="button" onClick={() => a.closeBooks(null)} disabled={a.closing} className={btn("ghost", "sm")}>
                  <LockOpen size={14} /> Mở khoá
                </button>
              )}
            </div>
          )}
        </div>

        {a.msg && (
          <p className="flex items-start gap-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
            <Check size={15} className="mt-px flex-none" style={{ color: "var(--tx3)" }} /> {a.msg}
          </p>
        )}
      </div>
    </Section>
  );
}
