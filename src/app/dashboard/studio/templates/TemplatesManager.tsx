"use client";

import { Plus, Trash2, FileStack } from "lucide-react";
import {
  vnd,
  SHOOT_TYPE_LABEL,
  SHOOT_TYPES,
  type ShootType,
  type ContractTemplate,
  type ContractTemplateItem,
} from "@/lib/types";
import ClauseInserter from "@/components/ClauseInserter";
import { useTemplates } from "./useTemplates";

export type TemplateWithItems = ContractTemplate & { contract_template_items: ContractTemplateItem[] };

export default function TemplatesManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: TemplateWithItems[];
}) {
  // Logic dùng chung với bản mới (TemplatesV2) — xem ./useTemplates.
  const { templates, selId, sel, busy, msg, name, setName, shootType, setShootType, note, setNote, items, setItems, total, selectTemplate, createTemplate, saveTemplate, deleteTemplate } =
    useTemplates(ownerId, initial);

  return (
    <div className="page-in">
      {msg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          {msg}
        </div>
      )}
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-serif text-2xl font-medium mr-auto">Mẫu hợp đồng</h1>
        <button onClick={createTemplate} disabled={busy} className="btn-primary">
          <Plus size={16} /> Mẫu mới
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="space-y-2">
          {templates.length === 0 ? (
            <div className="card p-6 text-sm" style={{ color: "var(--text3)" }}>Chưa có mẫu nào.</div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                className="card flex w-full items-center gap-3 p-4 text-left transition-colors"
                style={{ borderColor: t.id === selId ? "var(--border2)" : "var(--border)" }}
              >
                <FileStack size={16} style={{ color: "var(--text3)" }} />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text3)" }}>
                    {SHOOT_TYPE_LABEL[t.shoot_type]} · {(t.contract_template_items ?? []).length} hạng mục
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {!sel ? (
            <div className="card flex items-center justify-center py-16 text-sm" style={{ color: "var(--text3)" }}>
              Chọn một mẫu hoặc tạo mẫu mới.
            </div>
          ) : (
            <div className="card p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label className="label">Tên mẫu</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Loại dịch vụ</label>
                  <select className="input" value={shootType} onChange={(e) => setShootType(e.target.value as ShootType)}>
                    {SHOOT_TYPES.map((k) => (
                      <option key={k} value={k}>{SHOOT_TYPE_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <label className="label mb-0">Hạng mục mặc định</label>
                <button onClick={() => setItems((p) => [...p, { name: "", qty: 1, unit_price: 0 }])} className="btn-ghost px-2.5 py-1.5 text-xs">
                  <Plus size={14} /> Thêm
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <input className="input col-span-12 sm:col-span-6" placeholder="Hạng mục" value={it.name}
                      onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
                    <input type="number" className="input col-span-3 text-center sm:col-span-2" value={it.qty}
                      onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))} />
                    <input type="number" className="input col-span-7 text-right sm:col-span-3" value={it.unit_price}
                      onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: Number(e.target.value) } : x)))} />
                    <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="col-span-2 flex justify-center sm:col-span-1" style={{ color: "var(--text3)" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t pt-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--text2)" }}>Tạm tính</span>
                <span className="font-medium">{vnd(total)}</span>
              </div>

              <div className="mt-4">
                <label className="label">Điều khoản / ghi chú mặc định</label>
                <textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} />
                <ClauseInserter onInsert={(t) => setNote((n) => (n.trim() ? `${n.trim()}\n\n${t}` : t))} />
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={saveTemplate} disabled={busy} className="btn-primary">{busy ? "Đang lưu…" : "Lưu mẫu"}</button>
                <button onClick={deleteTemplate} className="btn-danger px-3 py-2 text-sm"><Trash2 size={14} /> Xoá</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
