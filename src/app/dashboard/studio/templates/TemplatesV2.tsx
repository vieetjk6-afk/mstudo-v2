"use client";

import { FileStack, ListChecks, Plus, ScrollText, Trash2, X } from "lucide-react";
import ClauseInserter from "@/components/ClauseInserter";
import MoneyInput from "@/components/MoneyInput";
import { Empty, Field, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu } from "@/components/v2/kit-client";
import { SHOOT_TYPE_LABEL, SHOOT_TYPES, vnd, type ShootType } from "@/lib/types";
import { PaneItemV2 } from "../services/settings-v2";
import type { TemplatesState } from "./useTemplates";

/* ═══════════════════════════════════════════════════════════════════════════
   MẪU HỢP ĐỒNG — giao diện mới (tab 2 của ServicesTemplatesTabsV2). Cùng logic
   với TemplatesManager (./useTemplates). Cột trái: các mẫu; cột phải: ba khối
   Thông tin mẫu · Hạng mục mặc định (bảng có tạm tính) · Điều khoản / ghi chú.
   Có thay đổi là hiện thanh Lưu dính đáy (ở màn cha).
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TemplatesV2({ t, onCreate }: { t: TemplatesState; onCreate: () => void }) {
  function pick(id: string) {
    const next = t.templates.find((x) => x.id === id);
    if (!next || next.id === t.selId) return;
    if (t.dirty && !confirm(`Bỏ thay đổi chưa lưu ở mẫu “${t.sel?.name}”?`)) return;
    t.selectTemplate(next);
  }
  const setItem = (idx: number, patch: Partial<{ name: string; qty: number; unit_price: number }>) =>
    t.setItems((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  if (t.templates.length === 0) {
    return (
      <div className="v2-card">
        <Empty
          icon={FileStack}
          title="Chưa có mẫu hợp đồng nào"
          hint="Mẫu điền sẵn hạng mục, giá và điều khoản khi tạo hợp đồng mới — đỡ gõ lại cho các gói hay bán."
          action={
            <button type="button" onClick={onCreate} disabled={t.busy} className={btn("primary")}>
              <Plus size={17} /> Tạo mẫu đầu tiên
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="v2-card overflow-hidden lg:sticky lg:top-[84px]">
        <div className="px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <p className="v2-section-title">Mẫu hợp đồng</p>
          <p className="v2-section-desc">{t.templates.length} mẫu · mới tạo ở trên</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-220px)]">
          {t.templates.map((x) => {
            const active = x.id === t.selId;
            const n = active ? t.items.length : (x.contract_template_items ?? []).length;
            return (
              <PaneItemV2
                key={x.id}
                icon={FileStack}
                active={active}
                onClick={() => pick(x.id)}
                title={(active ? t.name : x.name) || "Mẫu"}
                sub={`${SHOOT_TYPE_LABEL[active ? t.shootType : x.shoot_type]} · ${n} hạng mục`}
                trailing={active && t.dirty ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} title="Chưa lưu" /> : null}
              />
            );
          })}
        </div>
      </div>

      {!t.sel ? (
        <div className="v2-card">
          <Empty compact icon={FileStack} title="Chọn một mẫu ở bên trái để sửa" />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <Section
            icon={FileStack}
            title="Thông tin mẫu"
            desc="Tên hiện trong ô chọn mẫu khi tạo hợp đồng."
            actions={
              <Menu
                label="Thao tác với mẫu"
                items={[{ label: "Xoá mẫu này", icon: Trash2, danger: true, onClick: () => void t.deleteTemplate() }]}
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <Field label="Tên mẫu">
                <input className={inputCls} value={t.name} onChange={(e) => t.setName(e.target.value)} />
              </Field>
              <Field label="Loại dịch vụ">
                <select className={inputCls} value={t.shootType} onChange={(e) => t.setShootType(e.target.value as ShootType)}>
                  {SHOOT_TYPES.map((k) => (
                    <option key={k} value={k}>{SHOOT_TYPE_LABEL[k]}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section
            icon={ListChecks}
            title="Hạng mục mặc định"
            desc="Điền sẵn vào hợp đồng mới tạo từ mẫu này."
            flush
            actions={
              <button type="button" onClick={() => t.setItems((p) => [...p, { name: "", qty: 1, unit_price: 0 }])} className={btn("secondary", "sm")}>
                <Plus size={15} /> Thêm hạng mục
              </button>
            }
          >
            {t.items.length === 0 ? (
              <Empty compact icon={ListChecks} title="Chưa có hạng mục nào" hint="Bấm “Thêm hạng mục” để điền sẵn gói, album, phụ phí…" />
            ) : (
              <div className="flex flex-col">
                <div
                  className="hidden gap-3 px-5 py-2.5 text-[12px] font-semibold sm:grid sm:grid-cols-[minmax(0,1fr)_84px_160px_36px]"
                  style={{ background: "var(--sf2)", color: "var(--tx3)", borderBottom: "1px solid var(--bd)" }}
                >
                  <span>Hạng mục</span>
                  <span className="text-center">SL</span>
                  <span className="text-right">Đơn giá</span>
                  <span />
                </div>
                {t.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_84px_160px_36px] sm:gap-3 sm:px-5"
                    style={{ borderBottom: "1px solid var(--bd2)" }}
                  >
                    <input
                      className={`${inputCls} col-span-3 sm:col-span-1`}
                      placeholder="Tên hạng mục"
                      value={it.name}
                      onChange={(e) => setItem(idx, { name: e.target.value })}
                      aria-label={`Tên hạng mục ${idx + 1}`}
                    />
                    <input
                      type="number"
                      className={`${inputCls} text-center`}
                      value={it.qty}
                      onChange={(e) => setItem(idx, { qty: Number(e.target.value) })}
                      aria-label={`Số lượng hạng mục ${idx + 1}`}
                    />
                    <MoneyInput
                      className={`${inputCls} text-right`}
                      value={it.unit_price}
                      onChange={(n) => setItem(idx, { unit_price: n })}
                      ariaLabel={`Đơn giá hạng mục ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => t.setItems((p) => p.filter((_, i) => i !== idx))}
                      className={iconBtn()}
                      aria-label={`Bỏ hạng mục ${it.name || idx + 1}`}
                      title="Bỏ hạng mục"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5" style={{ background: "var(--sf2)", borderTop: t.items.length ? undefined : "1px solid var(--bd2)" }}>
              <span className="text-[13px]" style={{ color: "var(--tx2)" }}>Tạm tính</span>
              <span className="v2-num text-[16px] font-bold">{vnd(t.total)}</span>
            </div>
          </Section>

          <Section icon={ScrollText} title="Điều khoản / ghi chú mặc định" desc="In cuối hợp đồng tạo từ mẫu này.">
            <textarea className={`${inputCls} !min-h-[140px]`} value={t.note} onChange={(e) => t.setNote(e.target.value)} aria-label="Điều khoản / ghi chú mặc định" />
            <ClauseInserter onInsert={(x) => t.setNote((n) => (n.trim() ? `${n.trim()}\n\n${x}` : x))} />
          </Section>
        </div>
      )}
    </div>
  );
}
