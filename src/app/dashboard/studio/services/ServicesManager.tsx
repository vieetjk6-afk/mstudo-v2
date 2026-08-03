"use client";

import { useState } from "react";
import { Plus, Trash2, Check, FileText, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { fullClauseText } from "@/lib/contract-clauses";
import type { StudioService } from "@/lib/types";

export default function ServicesManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: StudioService[];
}) {
  const supabase = createClient();
  const [services, setServices] = useState<StudioService[]>(initial);
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sel = services.find((s) => s.id === selId) || null;
  const [name, setName] = useState(sel?.name ?? "");
  const [clauses, setClauses] = useState(sel?.clauses ?? "");

  function toast(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 2000);
  }

  function select(s: StudioService) {
    setSelId(s.id);
    setName(s.name);
    setClauses(s.clauses);
  }

  async function createService() {
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_services")
      .insert({ owner_id: ownerId, name: "Dịch vụ mới", clauses: fullClauseText(), position: services.length })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      const s = data as StudioService;
      setServices((p) => [...p, s]);
      select(s);
      toast("Đã tạo dịch vụ.");
    } else {
      toast(error?.message.includes("studio_services") ? "Chưa chạy migration studio_services." : (error?.message || "Lỗi"));
    }
  }

  async function saveService() {
    if (!sel) return;
    setBusy(true);
    const patch = { name: name.trim() || "Dịch vụ", clauses };
    await supabase.from("studio_services").update(patch).eq("id", sel.id);
    setServices((p) => p.map((s) => (s.id === sel.id ? { ...s, ...patch } : s)));
    setBusy(false);
    toast("Đã lưu.");
  }

  async function deleteService(s: StudioService) {
    if (!confirm(`Xoá dịch vụ "${s.name}"? Các hợp đồng/báo giá đã tạo không bị ảnh hưởng.`)) return;
    await supabase.from("studio_services").delete().eq("id", s.id);
    const next = services.filter((x) => x.id !== s.id);
    setServices(next);
    if (selId === s.id) {
      const first = next[0] ?? null;
      setSelId(first?.id ?? null);
      setName(first?.name ?? "");
      setClauses(first?.clauses ?? "");
    }
  }

  return (
    <div className="page-in">
      {msg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-[12px] px-4 py-2 text-[13px] font-semibold" style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}>{msg}</div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Mỗi loại dịch vụ có bộ điều khoản riêng — tạo hợp đồng / báo giá chọn dịch vụ nào thì áp điều khoản của dịch vụ đó.
        </p>
        <button
          onClick={createService}
          disabled={busy}
          className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
          style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
        >
          <Plus size={16} /> Thêm dịch vụ
        </button>
      </div>

      {services.length === 0 ? (
        <Panel>
          <EmptyState icon={FileText} title="Chưa có dịch vụ nào" hint="Tạo dịch vụ đầu tiên (chụp cưới, kỷ yếu, doanh nghiệp…) và soạn bộ điều khoản riêng cho nó." />
          <div className="pb-8 text-center">
            <button
              onClick={createService}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Plus size={16} /> Tạo dịch vụ đầu tiên
            </button>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3.5 lg:grid-cols-[260px_1fr]">
          {/* List */}
          <div className="space-y-1.5">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => select(s)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors"
                style={{
                  background: selId === s.id ? "var(--acS)" : "var(--sf)",
                  color: selId === s.id ? "var(--ac)" : "var(--tx2)",
                  fontWeight: selId === s.id ? 700 : 550,
                  border: `1px solid ${selId === s.id ? "var(--acM)" : "var(--bd)"}`,
                }}
              >
                <FileText size={15} className="shrink-0" />
                <span className="truncate font-medium">{s.name}</span>
              </button>
            ))}
          </div>

          {/* Editor */}
          {sel && (
            <div className="card p-6">
              <div className="field mb-4">
                <label className="label">Tên dịch vụ</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Chụp phóng sự cưới" />
              </div>
              <div className="field">
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">Điều khoản hợp đồng</label>
                  <button
                    onClick={() => setClauses(fullClauseText())}
                    className="btn-ghost px-2 py-1 text-xs gap-1"
                    title="Chèn bộ điều khoản mẫu"
                  >
                    <Wand2 size={13} /> Điều khoản mẫu
                  </button>
                </div>
                <textarea
                  className="input min-h-[340px] font-mono text-[12.5px] leading-relaxed"
                  value={clauses}
                  onChange={(e) => setClauses(e.target.value)}
                  placeholder="Nhập điều khoản riêng cho dịch vụ này…"
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={saveService} disabled={busy} className="btn-primary"><Check size={15} /> {busy ? "Đang lưu…" : "Lưu"}</button>
                <button onClick={() => deleteService(sel)} className="btn-ghost ml-auto px-3 py-2 text-xs" style={{ color: "var(--s-red)" }}><Trash2 size={14} /> Xoá dịch vụ</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
