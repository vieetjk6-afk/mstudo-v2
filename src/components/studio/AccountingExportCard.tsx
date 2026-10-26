"use client";

import { FileSpreadsheet, Lock, LockOpen, Loader2, Check } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AccountingExportCardV2 from "./AccountingExportCardV2";
import { useAccountingExport } from "./useAccountingExport";

/* ═══════════════════════════════════════════════════════════════════════════
   XUẤT KẾ TOÁN & KHOÁ SỔ — thẻ trong màn Thu chi & công nợ.

   Hai việc studio có doanh thu thật cần mà app chưa có:

    1. Bản XUẤT theo kỳ đưa kế toán: ba sheet (Thu · Chi · Công nợ) trong MỘT
       file, đúng khoảng ngày studio chọn.
    2. KHOÁ SỔ. Báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng
       cũ và con số tháng trước đổi — không ai phát hiện, bản đã gửi thành sai.
       Mốc khoá biến "đừng sửa số cũ" từ lời dặn miệng thành hàng rào.

   Số liệu tự truy vấn theo khoảng ngày người dùng chọn, không dùng lại state
   của màn Thu chi: màn đó xoay quanh THÁNG/NĂM, còn kế toán hỏi theo kỳ tuỳ ý
   (quý, nửa năm, từ ngày ký tới hôm nay).
   ═══════════════════════════════════════════════════════════════════════════ */

type Props = {
  ownerId: string;
  /** Mốc khoá sổ hiện tại ('YYYY-MM-DD') hoặc null. */
  initialClosedUntil: string | null;
  /** Chỉ chủ studio / kế toán mới được khoá & mở khoá. */
  canClose: boolean;
};

export default function AccountingExportCard(props: Props) {
  return useUiV2() ? <AccountingExportCardV2 {...props} /> : <AccountingExportCardV1 {...props} />;
}

function AccountingExportCardV1({ ownerId, initialClosedUntil, canClose }: Props) {
  const {
    from, setFrom, to, setTo, busy, msg, closedUntil, closing, exportXlsx, closeBooks, suggestClose, periodLocked,
  } = useAccountingExport(ownerId, initialClosedUntil);

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
        <FileSpreadsheet size={18} style={{ color: "var(--ac, var(--gold))" }} /> Xuất kế toán & khoá sổ
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
        Một file Excel ba sheet: <b>Thu</b> · <b>Chi</b> · <b>Công nợ</b>, đúng khoảng ngày bạn chọn.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold" style={{ color: "var(--text2)" }}>Từ ngày</span>
          <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold" style={{ color: "var(--text2)" }}>Đến ngày</span>
          <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={exportXlsx} disabled={busy || from > to} className="btn-primary">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          {busy ? "Đang xuất…" : "Xuất Excel"}
        </button>
      </div>

      {/* ── Khoá sổ ──────────────────────────────────────────────────────── */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          {closedUntil ? <Lock size={14} style={{ color: "var(--warn, var(--gold))" }} /> : <LockOpen size={14} style={{ color: "var(--text3)" }} />}
          {closedUntil
            ? `Sổ đã khoá tới ${closedUntil.split("-").reverse().join("/")}`
            : "Chưa khoá kỳ nào"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
          Khoá sổ để số liệu của kỳ đã gửi kế toán không đổi khi ai đó sửa một hợp đồng cũ. Khoá sổ{" "}
          <b>không xoá gì</b> — chỉ đánh mốc và cảnh báo khi có người định sửa số trước mốc đó.
        </p>
        {canClose && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {suggestClose && (
              <button onClick={() => closeBooks(suggestClose)} disabled={closing} className="btn-ghost text-[12.5px]">
                <Lock size={14} /> Khoá tới hết tháng này
              </button>
            )}
            <button onClick={() => closeBooks(to)} disabled={closing} className="btn-ghost text-[12.5px]">
              <Lock size={14} /> Khoá tới {to.split("-").reverse().join("/")}
            </button>
            {closedUntil && (
              <button onClick={() => closeBooks(null)} disabled={closing} className="btn-ghost text-[12.5px]">
                <LockOpen size={14} /> Mở khoá
              </button>
            )}
          </div>
        )}
        {periodLocked && (
          <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--warn, var(--gold))" }}>
            Kỳ đang chọn nằm trong vùng đã khoá — số liệu ở đây được coi là đã chốt.
          </p>
        )}
      </div>

      {msg && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px]" style={{ color: "var(--text2)" }}>
          <Check size={14} style={{ flex: "none", marginTop: 1 }} /> {msg}
        </p>
      )}
    </div>
  );
}
