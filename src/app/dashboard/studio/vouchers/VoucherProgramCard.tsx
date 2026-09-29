"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Panel, PanelHead } from "@/components/studio/ui";
import { vnd } from "@/lib/types";
import { programAmount, type VoucherProgram } from "@/lib/voucher-program";

/**
 * Cài đặt CHƯƠNG TRÌNH voucher ưu đãi — một lần cho cả studio. Bật lên là mọi
 * hợp đồng tự có voucher: cổng khách mời "nhận voucher lên đến …" trước khi
 * ký, và voucher thật được phát khi khách ký + studio xác nhận cọc + studio ký.
 */
export default function VoucherProgramCard({
  initial,
  migrated,
  toast,
}: {
  initial: VoucherProgram;
  migrated: boolean;
  toast: (m: string) => void;
}) {
  const [p, setP] = useState<VoucherProgram>(initial);
  const [saved, setSaved] = useState<VoucherProgram>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const sample = 20_000_000;

  async function save(next: VoucherProgram) {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "program_save", ...next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error === "missing_migration" ? "Cần chạy supabase/voucher-uu-dai.sql trong Supabase trước." : res.status === 403 ? "Bạn không có quyền đổi chương trình." : `Lỗi: ${j.error || res.status}`);
        return;
      }
      setP(next);
      setSaved(next);
      toast(next.enabled ? "Đã lưu — chương trình voucher đang BẬT." : "Đã lưu — chương trình voucher đang tắt.");
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHead icon={Sparkles} tone="brand" title="Chương trình voucher ưu đãi" note={p.enabled ? "Đang bật" : "Đang tắt"} />
      <div className="space-y-3 p-4 text-[13px]">
        {!migrated && (
          <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            Cần chạy <code>supabase/voucher-uu-dai.sql</code> trong Supabase SQL Editor để dùng chương trình.
          </p>
        )}
        <p style={{ color: "var(--tx2)" }}>
          Tặng khách một phần giá trị hợp đồng thành voucher cho lần sau. Tự gắn vào <b>mọi hợp đồng</b>: khách thấy lời mời ngay khi đọc hợp đồng,
          và nhận voucher khi <b>đã ký + studio xác nhận cọc + studio ký</b>. Hợp đồng huỷ thì voucher tự huỷ.
        </p>

        <label className="flex items-center gap-2.5 font-semibold">
          <input type="checkbox" className="h-4 w-4" checked={p.enabled} disabled={!migrated || busy} onChange={(e) => save({ ...p, enabled: e.target.checked })} />
          Bật chương trình
        </label>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="label">% giá trị hợp đồng</span>
            <input className="input" inputMode="numeric" value={p.percent || ""} onChange={(e) => setP({ ...p, percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
          </label>
          <label className="block">
            <span className="label">Tối đa (không bắt buộc)</span>
            <MoneyInput className="input" value={p.max_discount ?? 0} onChange={(n) => setP({ ...p, max_discount: n > 0 ? n : null })} />
          </label>
          <label className="block">
            <span className="label">Hạn dùng</span>
            <select
              className="input"
              value={p.valid_months == null ? "" : String(p.valid_months)}
              onChange={(e) => setP({ ...p, valid_months: e.target.value ? Number(e.target.value) : null })}
            >
              {[3, 6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} tháng</option>)}
              <option value="">Không giới hạn</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Tên voucher</span>
            <input className="input" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
          </label>
        </div>

        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4" checked={p.wedding_only} onChange={(e) => setP({ ...p, wedding_only: e.target.checked })} />
          Chỉ áp dụng cho gói <b>phóng sự cưới</b>
        </label>
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          Voucher tặng được cho người khác, khi dùng phải nhập đúng SĐT của hợp đồng được tặng. Không quy đổi thành tiền mặt.
        </p>

        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          Ví dụ hợp đồng {vnd(sample)} → voucher <b>{vnd(programAmount(sample, p.percent, p.max_discount))}</b>. Từng hợp đồng tắt được hoặc đặt % riêng ở tab Thanh toán.
        </p>

        {dirty && (
          <button onClick={() => save(p)} disabled={busy || !migrated || p.percent < 1} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Lưu cài đặt
          </button>
        )}
      </div>
    </Panel>
  );
}
