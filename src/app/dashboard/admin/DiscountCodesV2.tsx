"use client";

import { useState } from "react";
import { Check, Copy, Plus, Shuffle, Sparkles, Tag, Trash2 } from "lucide-react";
import DateInput from "@/components/DateInput";
import { Badge, Callout, Empty, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import type { DiscountCode } from "@/lib/types";
import { useDiscountCodes, type DiscountCodesState } from "./useDiscountCodes";

/* ═══════════════════════════════════════════════════════════════════════════
   MÃ GIẢM GIÁ — giao diện mới (một tab của AdminPanelV2). Cùng logic với
   DiscountCodes (bản cũ, ./useDiscountCodes); khác ở cách sắp xếp:
     • Bảng gọn: mã · ưu đãi · áp dụng cho · đã dùng · hạn dùng; mã hết hạn
       / hết lượt có nhãn đỏ.
     • Form tạo mã (7 ô) chuyển vào ngăn kéo — nút "Tạo mã" ở đầu khối.
   ═══════════════════════════════════════════════════════════════════════════ */

type Filter = "all" | "live" | "ended";

const expired = (c: DiscountCode) => !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
const usedUp = (c: DiscountCode) => c.max_uses != null && c.used_count >= c.max_uses;
const ended = (c: DiscountCode) => expired(c) || usedUp(c);
const scopeText = (c: DiscountCode) =>
  `${c.plan ? PLAN_LABEL[c.plan as Plan] ?? c.plan : "Mọi gói"} · ${c.cycle ? (c.cycle === "year" ? "theo năm" : "theo tháng") : "mọi kỳ"}`;

export default function DiscountCodesV2({ initial }: { initial: DiscountCode[] }) {
  const d = useDiscountCodes(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const endedCount = d.codes.filter(ended).length;
  const shown = d.codes.filter((c) => (filter === "all" ? true : filter === "ended" ? ended(c) : !ended(c)));

  function copy(code: string) {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  const offer = (c: DiscountCode) =>
    c.trial_days ? <Badge tone="blue" icon={Sparkles}>Dùng thử {c.trial_days} ngày</Badge> : <Badge tone="green">-{c.percent}%</Badge>;
  const uses = (c: DiscountCode) => (c.max_uses == null ? `${c.used_count} lần` : `${c.used_count}/${c.max_uses}`);
  const until = (c: DiscountCode) =>
    c.expires_at ? (
      expired(c) ? <Badge tone="red" dot>Hết hạn {fmtDate(c.expires_at)}</Badge> : <span>{fmtDate(c.expires_at)}</span>
    ) : (
      <span style={{ color: "var(--tx3)" }}>Không hạn</span>
    );
  const menu = (c: DiscountCode) => (
    <Menu
      label={`Thao tác với mã ${c.code}`}
      items={[
        { label: "Chép mã", icon: Copy, onClick: () => copy(c.code) },
        "divider",
        { label: "Xoá mã", icon: Trash2, danger: true, onClick: () => void d.deleteCode(c.id) },
      ]}
    />
  );

  return (
    <section className="v2-card overflow-hidden">
      <header className="v2-section-head">
        <span className="v2-section-icon"><Tag size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">Mã giảm giá</h3>
          <p className="v2-section-desc">Mã giảm % khi mua gói, hoặc mã dùng thử kích hoạt gói ngay.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={btn("primary", "sm")}>
          <Plus size={15} /> Tạo mã
        </button>
      </header>

      {d.codes.length > 0 ? (
        <div className="v2-card-pad" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Segmented<Filter>
            label="Lọc mã"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tất cả", count: d.codes.length },
              { value: "live", label: "Còn dùng được", count: d.codes.length - endedCount },
              { value: "ended", label: "Hết hạn / hết lượt", count: endedCount },
            ]}
          />
        </div>
      ) : null}

      {d.codes.length === 0 ? (
        <Empty
          icon={Tag}
          title="Chưa có mã nào"
          hint="Tạo mã giảm giá cho đợt khuyến mãi, hoặc mã dùng thử để gửi riêng cho một studio."
        />
      ) : shown.length === 0 ? (
        <Empty compact icon={Tag} title="Không có mã nào ở nhóm này" />
      ) : (
        <>
          <div className="v2-table-wrap hidden md:block">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Ưu đãi</th>
                  <th>Áp dụng cho</th>
                  <th className="num">Đã dùng</th>
                  <th>Hạn dùng</th>
                  <th style={{ width: 56 }} aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} style={ended(c) ? { opacity: 0.7 } : undefined}>
                    <td>
                      <button type="button" onClick={() => copy(c.code)} className="inline-flex items-center gap-1.5 font-mono text-[13.5px] font-bold" title="Chép mã">
                        {c.code}
                        {copied === c.code ? <Check size={13} style={{ color: "var(--gn)" }} /> : <Copy size={13} style={{ color: "var(--tx3)" }} />}
                      </button>
                    </td>
                    <td>{offer(c)}</td>
                    <td style={{ color: "var(--tx2)" }}>{scopeText(c)}</td>
                    <td className="num">
                      <span style={usedUp(c) ? { color: "var(--rd)", fontWeight: 600 } : undefined}>{uses(c)}</span>
                    </td>
                    <td className="text-[13px]">{until(c)}</td>
                    <td>{menu(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {shown.map((c) => (
              <div key={c.id} className="v2-row" style={ended(c) ? { opacity: 0.7 } : undefined}>
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title font-mono">{c.code}</p>
                  <p className="v2-row-sub">{scopeText(c)} · đã dùng {uses(c)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    {offer(c)}
                    {c.expires_at ? until(c) : null}
                  </div>
                </div>
                {menu(c)}
              </div>
            ))}
          </div>
        </>
      )}

      <CreateCodeDrawer d={d} open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}

function CreateCodeDrawer({ d, open, onClose }: { d: DiscountCodesState; open: boolean; onClose: () => void }) {
  const { form, setForm } = d;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tạo mã giảm giá"
      desc="Studio nhập mã ở trang Gói phần mềm."
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button
            type="button"
            disabled={!form.code.trim()}
            onClick={async () => {
              if (await d.addCode()) onClose();
            }}
            className={btn("primary")}
          >
            <Plus size={16} /> Tạo mã
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Mã" hint="Chữ in hoa, không dấu. Bấm xúc xắc để tạo ngẫu nhiên.">
          <div className="flex gap-2">
            <input
              className={`${inputCls} min-w-0 flex-1 font-mono`}
              value={form.code}
              placeholder="VD: TET2026"
              autoFocus
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
            <button type="button" onClick={d.randomCode} className={iconBtn()} aria-label="Tạo mã ngẫu nhiên" title="Tạo ngẫu nhiên" style={{ border: "1px solid var(--bd)" }}>
              <Shuffle size={16} />
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Giảm (%)">
            <input type="number" min={0} max={100} className={inputCls} value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} />
          </Field>
          <Field label="Dùng thử (ngày)" hint="Lớn hơn 0 = mã dùng thử.">
            <input type="number" min={0} className={inputCls} value={form.trial} onChange={(e) => setForm({ ...form, trial: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="Gói">
            <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="">Mọi gói</option>
              <option value="basic">Basic</option>
              <option value="photographer">Photographer</option>
              <option value="photographer_plus">Photographer Plus</option>
              <option value="studio">Studio</option>
            </select>
          </Field>
          <Field label="Chu kỳ">
            <select className={inputCls} value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>
              <option value="">Mọi kỳ</option>
              <option value="month">Tháng</option>
              <option value="year">Năm</option>
            </select>
          </Field>
          <Field label="Lượt dùng">
            <select className={inputCls} value={form.uses} onChange={(e) => setForm({ ...form, uses: e.target.value as "1" | "many" })}>
              <option value="many">Nhiều lần</option>
              <option value="1">1 lần</option>
            </select>
          </Field>
          <Field label="Hạn dùng">
            <DateInput className={inputCls} value={form.expires} onChange={(v) => setForm({ ...form, expires: v })} />
          </Field>
        </div>
        <button type="button" onClick={d.quickTrial} className={btn("soft", "sm", "self-start")}>
          <Sparkles size={15} /> Điền nhanh: mã dùng thử Studio 1 ngày
        </button>
        {d.msg ? <Callout tone="red">{d.msg}</Callout> : null}
      </div>
    </Drawer>
  );
}
