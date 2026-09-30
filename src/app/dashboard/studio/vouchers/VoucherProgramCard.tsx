"use client";

import { useState } from "react";
import { Sparkles, Loader2, Plus, X } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Panel, PanelHead } from "@/components/studio/ui";
import { vnd } from "@/lib/types";
import { cleanTiers, maxTierPercent, tierAt, tierMax, type VoucherProgram } from "@/lib/voucher-program";
import type { PercentTier } from "@/lib/vouchers";

/**
 * Cài đặt CHƯƠNG TRÌNH voucher ưu đãi — một lần cho cả studio. Bật lên là mọi
 * hợp đồng tự có voucher: cổng khách mời "nhận voucher lên đến …" trước khi
 * ký, và voucher thật được phát khi khách ký + studio xác nhận cọc + studio ký.
 */
export default function VoucherProgramCard({
  initial,
  migrated,
  toast,
  packages = [],
}: {
  initial: VoucherProgram;
  migrated: boolean;
  toast: (m: string) => void;
  /** Gói trong bảng giá của studio, để chọn gói được dùng voucher. */
  packages?: { name: string; group: string }[];
}) {
  const [p, setP] = useState<VoucherProgram>(initial);
  const [saved, setSaved] = useState<VoucherProgram>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);

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
          Tặng khách voucher <b>giảm % cho hợp đồng lần sau</b>. Hợp đồng khách chốt càng lớn thì % tặng càng cao (theo các mốc bên dưới);
          lần sau khách được giảm đúng % đó trên giá trị hợp đồng mới. Tự gắn vào <b>mọi hợp đồng</b>: khách thấy lời mời ngay khi đọc hợp đồng, và nhận voucher khi
          <b> đã ký + studio xác nhận cọc + studio ký</b>. Hợp đồng huỷ thì voucher tự huỷ.
        </p>

        <label className="flex items-center gap-2.5 font-semibold">
          <input type="checkbox" className="h-4 w-4" checked={p.enabled} disabled={!migrated || busy} onChange={(e) => save({ ...p, enabled: e.target.checked })} />
          Bật chương trình
        </label>

        <TierEditor tiers={p.tiers} defaultMax={p.max_discount} onChange={(tiers) => setP({ ...p, tiers, percent: maxTierPercent(cleanTiers(tiers)) || p.percent })} />

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Giảm tối đa chung (mốc không đặt riêng)</span>
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

        <PackagePicker
          packages={packages}
          value={p.package_names}
          onChange={(names) => setP({ ...p, package_names: names })}
        />
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          Voucher tặng được cho người khác, khi dùng phải nhập đúng SĐT của hợp đồng được tặng. Không quy đổi thành tiền mặt.
        </p>

        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          Ví dụ khách chốt{" "}
          {[8_000_000, 20_000_000, 40_000_000].map((t, i) => {
            const hit = tierAt(p.tiers, t);
            const cap = tierMax(hit, p.max_discount);
            return (
              <span key={t}>
                {i ? " · " : ""}
                {vnd(t)} → voucher <b>{hit ? `giảm ${hit.percent}%${cap ? ` (tối đa ${vnd(cap)})` : ""}` : "không có"}</b>
              </span>
            );
          })}
          . Lần sau, số tiền giảm = % đó × giá trị hợp đồng mới, không vượt mức tối đa. Từng hợp đồng tắt được hoặc đặt % riêng ở tab Thanh toán.
        </p>

        {dirty && (
          <button onClick={() => save(p)} disabled={busy || !migrated || cleanTiers(p.tiers).length === 0} className="btn-primary px-3 py-2 text-xs disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Lưu cài đặt
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Chọn gói được dùng voucher: "Mọi gói" hoặc tick từng gói trong bảng giá (theo nhóm). */
function PackagePicker({
  packages,
  value,
  onChange,
}: {
  packages: { name: string; group: string }[];
  value: string[];
  onChange: (names: string[]) => void;
}) {
  const [open, setOpen] = useState(value.length > 0);
  const groups = new Map<string, string[]>();
  for (const p of packages) {
    const list = groups.get(p.group) ?? [];
    if (!list.includes(p.name)) list.push(p.name);
    groups.set(p.group, list);
  }
  // Gói đã chọn mà không còn trong bảng giá (đổi tên / ẩn) vẫn hiện để bỏ tick được.
  const orphans = value.filter((n) => !packages.some((p) => p.name === n));
  if (orphans.length) groups.set("Không còn trong bảng giá", orphans);
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);

  return (
    <div className="space-y-2">
      <span className="label">Áp dụng cho gói</span>
      <div className="flex flex-wrap gap-1.5">
        {([[false, "Mọi gói"], [true, "Chọn gói"]] as const).map(([pick, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => { setOpen(pick); if (!pick) onChange([]); }}
            className="rounded-[20px] px-2.5 py-1 text-[12px] font-semibold"
            style={{ border: "1px solid var(--bd)", background: open === pick ? "var(--ac)" : "var(--sf)", color: open === pick ? "#fff" : "var(--tx2)" }}
          >
            {label}
          </button>
        ))}
      </div>
      {open && (
        packages.length === 0 && orphans.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Bảng giá chưa có gói nào — thêm gói ở mục Bảng giá trước.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...groups.entries()].map(([g, names]) => (
              <div key={g}>
                <p className="mb-1 text-[11px] font-bold uppercase" style={{ letterSpacing: ".5px", color: "var(--tx3)" }}>{g}</p>
                {names.map((n) => (
                  <label key={n} className="flex items-center gap-2 py-0.5 text-[13px]">
                    <input type="checkbox" className="h-4 w-4" checked={value.includes(n)} onChange={() => toggle(n)} />
                    {n}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )
      )}
      {open && value.length === 0 && packages.length > 0 && (
        <p className="text-[12px]" style={{ color: "var(--am)" }}>Chưa chọn gói nào — đang áp dụng cho mọi gói.</p>
      )}
    </div>
  );
}

/**
 * Bảng mốc %: mỗi dòng "hợp đồng chốt từ X đồng → tặng voucher Y%, giảm tối đa
 * Z đồng" (bỏ trống Z = theo mức tối đa chung). Dòng "từ 0đ"
 * là mức cho mọi hợp đồng dưới các mốc khác; bỏ nó đi thì hợp đồng dưới mốc
 * thấp nhất không được tặng.
 */
function TierEditor({ tiers, defaultMax, onChange }: { tiers: PercentTier[]; defaultMax: number | null; onChange: (t: PercentTier[]) => void }) {
  const rows = tiers.length ? tiers : [{ min: 0, percent: 5 }];
  const set = (i: number, patch: Partial<PercentTier>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <span className="label">Mốc % tặng theo giá trị hợp đồng khách chốt</span>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <span className="flex-none" style={{ color: "var(--tx3)" }}>Từ</span>
              <MoneyInput className="input w-0 min-w-0 flex-1 sm:w-40 sm:flex-none" placeholder="0đ (mọi HĐ)" value={r.min} onChange={(n) => set(i, { min: n })} />
              <span className="flex-none" style={{ color: "var(--tx3)" }}>→ tặng</span>
              <input
                className="input w-14 flex-none text-center"
                inputMode="numeric"
                value={r.percent || ""}
                onChange={(e) => set(i, { percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })}
              />
              <span>%</span>
            </div>
            <div className="flex w-full items-center gap-2 pl-6 sm:w-auto sm:pl-0">
              <span className="flex-none" style={{ color: "var(--tx3)" }}>tối đa</span>
              <MoneyInput
                className="input w-0 min-w-0 flex-1 sm:w-48 sm:flex-none"
                placeholder={defaultMax ? `${defaultMax.toLocaleString("vi-VN")} (chung)` : "không giới hạn"}
                value={r.max ?? 0}
                onChange={(n) => set(i, { max: n > 0 ? n : null })}
                ariaLabel="Số tiền giảm tối đa của mốc"
              />
              {rows.length > 1 && (
                <button type="button" onClick={() => onChange(rows.filter((_, k) => k !== i))} className="p-1" style={{ color: "var(--tx3)" }} aria-label="Xoá mốc">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const top = rows.reduce((m, r) => Math.max(m, r.min), 0);
          onChange([...rows, { min: top ? top * 2 : 15_000_000, percent: Math.min(100, maxTierPercent(cleanTiers(rows)) + 2) }]);
        }}
        className="btn-ghost mt-2 px-2.5 py-1.5 text-xs"
      >
        <Plus size={13} /> Thêm mốc
      </button>
    </div>
  );
}
