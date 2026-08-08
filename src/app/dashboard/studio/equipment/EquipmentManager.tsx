"use client";

import { useState } from "react";
import { Plus, Trash2, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, EmptyState } from "@/components/studio/ui";
import { useUndoToast } from "@/components/studio/UndoToast";
import type { StudioEquipment } from "@/lib/types";

export default function EquipmentManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: StudioEquipment[];
}) {
  const supabase = createClient();
  const { run, view } = useUndoToast();
  const [list, setList] = useState<StudioEquipment[]>(initial);
  const [f, setF] = useState({ name: "", category: "", note: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!f.name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_equipment")
      .insert({ owner_id: ownerId, name: f.name.trim(), category: f.category.trim() || null, note: f.note.trim() || null })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setList((p) => [...p, data as StudioEquipment].sort((a, b) => a.name.localeCompare(b.name)));
      setF({ name: "", category: "", note: "" });
    }
  }

  /** Xoá có hoàn tác: hàng biến mất ngay, 5 giây sau mới xoá thật. */
  function remove(id: string) {
    const idx = list.findIndex((e) => e.id === id);
    const row = list[idx];
    if (!row) return;
    setList((p) => p.filter((e) => e.id !== id));
    run({
      label: `Đã xoá ${row.name || "thiết bị"}`,
      commit: async () => { await supabase.from("studio_equipment").delete().eq("id", id); },
      undo: () => setList((p) => { const n = [...p]; n.splice(idx, 0, row); return n; }),
    });
  }

  return (
    <div className="page-in">
      {view}
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>Máy, ống kính, đèn… gán nhanh vào hợp đồng và tránh trùng buổi.</p>

      <div className="grid gap-3.5 lg:grid-cols-3">
        <Panel className="h-fit p-[18px]">
          <h2 className="mb-3.5 text-[14px] font-bold">Thêm thiết bị</h2>
          <div className="space-y-3">
            <div className="field"><label className="label">Tên</label><input className="input" placeholder="VD: Sony A7IV #1" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="field"><label className="label">Loại</label><input className="input" placeholder="Body / Lens / Đèn…" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))} /></div>
            <div className="field"><label className="label">Ghi chú</label><input className="input" value={f.note} onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))} /></div>
            <button
              onClick={add}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
            >
              <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm vào sổ"}
            </button>
          </div>
        </Panel>

        <div className="lg:col-span-2">
          {list.length === 0 ? (
            <Panel>
              <EmptyState icon={Camera} title="Chưa có thiết bị nào" hint="Thêm body, ống kính, đèn… để gán vào hợp đồng và biết hôm nào bị trùng." />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((e) => (
                <Panel key={e.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex-none rounded-[9px] p-2" style={{ background: "var(--sf2)", color: "var(--tx2)", lineHeight: 0 }}>
                      <Camera size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold">{e.name}</p>
                      <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{e.category || "Chưa phân loại"}{e.note ? ` · ${e.note}` : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    aria-label="Xoá thiết bị"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
                    style={{ border: "1px solid var(--bd)", color: "var(--tx3)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
