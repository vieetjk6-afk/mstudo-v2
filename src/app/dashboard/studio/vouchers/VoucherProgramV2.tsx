"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Settings2, Sparkles, X } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Segmented, Switch } from "@/components/v2/kit-client";
import { vnd } from "@/lib/types";
import { cleanTiers, maxTierPercent, tierAt, tierMax, type VoucherProgram } from "@/lib/voucher-program";
import type { PercentTier } from "@/lib/vouchers";
import { useVoucherProgram } from "./useVoucherProgram";

/* ═══════════════════════════════════════════════════════════════════════════
   CHƯƠNG TRÌNH VOUCHER ƯU ĐÃI — giao diện mới. Cùng logic với
   VoucherProgramCard (./useVoucherProgram). Trên màn chỉ còn MỘT dải tóm tắt:
   trạng thái, mức tặng, hạn dùng, gói áp dụng + công tắc bật/tắt (lưu ngay,
   như bản cũ). Cài đặt chi tiết (mốc %, mức tối đa, hạn, tên, gói) mở bằng
   ngăn kéo, có nút Lưu ở chân ngăn kéo.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function VoucherProgramV2({
  initial,
  migrated,
  toast,
  packages = [],
}: {
  initial: VoucherProgram;
  migrated: boolean;
  toast: (m: string) => void;
  packages?: { name: string; group: string }[];
}) {
  const g = useVoucherProgram(initial, toast);
  const [open, setOpen] = useState(false);
  // Tóm tắt theo bản ĐÃ LƯU — bản nháp trong ngăn kéo chưa có hiệu lực.
  const live = g.saved;
  const tiers = cleanTiers(live.tiers);
  const pcts = tiers.map((t) => t.percent);
  const range = pcts.length ? (Math.min(...pcts) === Math.max(...pcts) ? `${pcts[0]}%` : `${Math.min(...pcts)}–${Math.max(...pcts)}%`) : `${live.percent}%`;
  const summary = [
    `Tặng ${range} cho hợp đồng lần sau`,
    live.valid_months ? `hạn ${live.valid_months} tháng` : "không giới hạn hạn dùng",
    live.package_names.length ? `${live.package_names.length} gói được dùng` : "mọi gói",
  ].join(" · ");

  return (
    <>
      <section className="v2-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
          <span className="v2-section-icon"><Sparkles size={17} /></span>
          <div className="min-w-0 flex-1 basis-[240px]">
            <p className="flex flex-wrap items-center gap-2">
              <span className="v2-section-title">Chương trình voucher ưu đãi</span>
              {g.p.enabled ? <Badge tone="green" dot>Đang bật</Badge> : <Badge tone="gray" dot>Đang tắt</Badge>}
            </p>
            <p className="v2-section-desc">{summary}</p>
          </div>
          <div className="flex flex-none items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "sm")}>
              <Settings2 size={15} /> Cài đặt
            </button>
            <Switch checked={g.p.enabled} disabled={!migrated || g.busy} onChange={(v) => void g.save({ ...g.p, enabled: v })} />
          </div>
        </div>
        {!migrated ? (
          <div className="px-4 pb-4 sm:px-5">
            <Callout tone="amber">
              Cần chạy <code className="break-all">supabase/voucher-uu-dai.sql</code> trong Supabase SQL Editor để dùng chương trình.
            </Callout>
          </div>
        ) : null}
      </section>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        width={600}
        title="Chương trình voucher ưu đãi"
        desc="Tự gắn vào mọi hợp đồng: khách nhận voucher khi đã ký + studio xác nhận cọc + studio ký."
        footer={
          <>
            {g.dirty ? (
              <button type="button" onClick={() => g.setP(g.saved)} className={btn("ghost", "md", "mr-auto")}>
                Huỷ thay đổi
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} className={btn("secondary")}>Đóng</button>
            <button
              type="button"
              onClick={() => void g.save(g.p)}
              disabled={!g.dirty || g.busy || !migrated || cleanTiers(g.p.tiers).length === 0}
              className={btn("primary")}
            >
              {g.busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Lưu cài đặt
            </button>
          </>
        }
      >
        <ProgramForm g={g} packages={packages} migrated={migrated} />
      </Drawer>
    </>
  );
}

function ProgramForm({ g, packages, migrated }: { g: ReturnType<typeof useVoucherProgram>; packages: { name: string; group: string }[]; migrated: boolean }) {
  const { p, setP } = g;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px]" style={{ color: "var(--tx2)" }}>
        Tặng khách voucher <b>giảm % cho hợp đồng lần sau</b>. Hợp đồng chốt càng lớn thì % tặng càng cao; lần sau khách được giảm đúng % đó trên giá trị
        hợp đồng mới. Hợp đồng huỷ thì voucher tự huỷ.
      </p>

      <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
        <Switch
          checked={p.enabled}
          disabled={!migrated || g.busy}
          onChange={(v) => void g.save({ ...p, enabled: v })}
          label="Bật chương trình"
          desc="Bật/tắt là lưu ngay."
        />
      </div>

      <TierEditorV2 tiers={p.tiers} defaultMax={p.max_discount} onChange={(tiers) => setP({ ...p, tiers, percent: maxTierPercent(cleanTiers(tiers)) || p.percent })} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Giảm tối đa chung" hint="Cho các mốc không đặt mức riêng.">
          <MoneyInput className={inputCls} value={p.max_discount ?? 0} onChange={(n) => setP({ ...p, max_discount: n > 0 ? n : null })} ariaLabel="Giảm tối đa chung" />
        </Field>
        <Field label="Hạn dùng">
          <select
            className={inputCls}
            value={p.valid_months == null ? "" : String(p.valid_months)}
            onChange={(e) => setP({ ...p, valid_months: e.target.value ? Number(e.target.value) : null })}
          >
            {[3, 6, 12, 18, 24].map((m) => <option key={m} value={m}>{m} tháng</option>)}
            <option value="">Không giới hạn</option>
          </select>
        </Field>
        <Field label="Tên voucher" className="sm:col-span-2">
          <input className={inputCls} value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
        </Field>
      </div>

      <PackagePickerV2 packages={packages} value={p.package_names} onChange={(names) => setP({ ...p, package_names: names })} />

      <div className="rounded-[12px] px-3.5 py-3 text-[12.5px]" style={{ background: "var(--blS)", color: "var(--tx2)" }}>
        <p className="mb-1 font-semibold" style={{ color: "var(--bl)" }}>Ví dụ</p>
        {[8_000_000, 20_000_000, 40_000_000].map((t) => {
          const hit = tierAt(p.tiers, t);
          const cap = tierMax(hit, p.max_discount);
          return (
            <p key={t} className="v2-num">
              Khách chốt {vnd(t)} → voucher <b>{hit ? `giảm ${hit.percent}%${cap ? ` (tối đa ${vnd(cap)})` : ""}` : "không có"}</b>
            </p>
          );
        })}
        <p className="mt-1">
          Voucher tặng được cho người khác, khi dùng phải nhập đúng SĐT của hợp đồng được tặng. Không quy đổi thành tiền mặt. Từng hợp đồng tắt được hoặc đặt %
          riêng ở tab Thanh toán.
        </p>
      </div>
    </div>
  );
}

/** Bảng mốc %: "hợp đồng chốt từ X → tặng Y%, giảm tối đa Z" (bỏ trống Z = theo mức chung). */
function TierEditorV2({ tiers, defaultMax, onChange }: { tiers: PercentTier[]; defaultMax: number | null; onChange: (t: PercentTier[]) => void }) {
  const rows = tiers.length ? tiers : [{ min: 0, percent: 5 }];
  const set = (i: number, patch: Partial<PercentTier>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-2">
      <p className="v2-label">Mốc % tặng theo giá trị hợp đồng khách chốt</p>
      <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
        <div
          className="hidden gap-2 px-3.5 py-2 text-[12px] font-semibold sm:grid sm:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)_36px]"
          style={{ background: "var(--sf2)", color: "var(--tx3)", borderBottom: "1px solid var(--bd)" }}
        >
          <span>Hợp đồng từ</span>
          <span className="text-center">Tặng %</span>
          <span>Giảm tối đa</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_72px_36px] items-center gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)_36px]"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--bd2)" : undefined }}
          >
            <MoneyInput className={inputCls} placeholder="0đ (mọi HĐ)" value={r.min} onChange={(n) => set(i, { min: n })} ariaLabel={`Mốc ${i + 1}: hợp đồng từ`} />
            <div className="relative">
              <input
                className={`${inputCls} pr-6 text-center`}
                inputMode="numeric"
                value={r.percent || ""}
                onChange={(e) => set(i, { percent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                aria-label={`Mốc ${i + 1}: phần trăm tặng`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "var(--tx3)" }}>%</span>
            </div>
            <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              <MoneyInput
                className={inputCls}
                placeholder={defaultMax ? `${defaultMax.toLocaleString("vi-VN")} (chung)` : "không giới hạn"}
                value={r.max ?? 0}
                onChange={(n) => set(i, { max: n > 0 ? n : null })}
                ariaLabel={`Mốc ${i + 1}: số tiền giảm tối đa`}
              />
            </div>
            <span className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
              {rows.length > 1 ? (
                <button type="button" onClick={() => onChange(rows.filter((_, k) => k !== i))} className={iconBtn()} aria-label={`Xoá mốc ${i + 1}`} title="Xoá mốc">
                  <X size={16} />
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const top = rows.reduce((m, r) => Math.max(m, r.min), 0);
          onChange([...rows, { min: top ? top * 2 : 15_000_000, percent: Math.min(100, maxTierPercent(cleanTiers(rows)) + 2) }]);
        }}
        className={btn("ghost", "sm", "self-start")}
      >
        <Plus size={15} /> Thêm mốc
      </button>
    </div>
  );
}

/** "Mọi gói" hoặc tick từng gói trong bảng giá (theo nhóm). */
function PackagePickerV2({ packages, value, onChange }: { packages: { name: string; group: string }[]; value: string[]; onChange: (names: string[]) => void }) {
  const [pick, setPick] = useState<"all" | "some">(value.length > 0 ? "some" : "all");
  const groups = new Map<string, string[]>();
  for (const p of packages) {
    const list = groups.get(p.group) ?? [];
    if (!list.includes(p.name)) list.push(p.name);
    groups.set(p.group, list);
  }
  // Gói đã chọn mà không còn trong bảng giá vẫn hiện để bỏ tick được.
  const orphans = value.filter((n) => !packages.some((p) => p.name === n));
  if (orphans.length) groups.set("Không còn trong bảng giá", orphans);
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="v2-label">Áp dụng cho gói</p>
        <Segmented<"all" | "some">
          size="sm"
          label="Áp dụng cho gói"
          value={pick}
          onChange={(v) => {
            setPick(v);
            if (v === "all") onChange([]);
          }}
          options={[
            { value: "all", label: "Mọi gói" },
            { value: "some", label: "Chọn gói", count: value.length || undefined },
          ]}
        />
      </div>
      {pick === "some" ? (
        packages.length === 0 && orphans.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Bảng giá chưa có gói nào — thêm gói ở mục Bảng giá trước.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...groups.entries()].map(([gName, names]) => (
              <div key={gName} className="rounded-[12px] px-3 py-2.5" style={{ border: "1px solid var(--bd2)" }}>
                <p className="mb-1 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>{gName}</p>
                {names.map((n) => (
                  <label key={n} className="flex cursor-pointer items-center gap-2 py-1 text-[13.5px]">
                    <input type="checkbox" className="h-4 w-4" checked={value.includes(n)} onChange={() => toggle(n)} />
                    {n}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )
      ) : null}
      {pick === "some" && value.length === 0 && packages.length > 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--am)" }}>Chưa chọn gói nào — đang áp dụng cho mọi gói.</p>
      ) : null}
    </div>
  );
}
