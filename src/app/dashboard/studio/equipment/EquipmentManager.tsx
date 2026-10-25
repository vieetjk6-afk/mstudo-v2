"use client";

import { useState } from "react";
import { Plus, Trash2, Camera } from "lucide-react";
import { Panel, EmptyState } from "@/components/studio/ui";
import type { StudioEquipment } from "@/lib/types";
import { useUiV2 } from "@/components/v2/UiV2Context";
import EquipmentV2 from "./EquipmentV2";
import { emptyEquipmentForm, useEquipment } from "./useEquipment";

export type EquipmentManagerProps = {
  ownerId: string;
  initial: StudioEquipment[];
};

/** Giao diện mới → EquipmentV2; bản cũ giữ nguyên bên dưới. Logic chung ở ./useEquipment. */
export default function EquipmentManager(props: EquipmentManagerProps) {
  return useUiV2() ? <EquipmentV2 {...props} /> : <EquipmentManagerV1 {...props} />;
}

function EquipmentManagerV1({ ownerId, initial }: EquipmentManagerProps) {
  const { list, add: addEquipment, remove } = useEquipment(ownerId, initial);
  const [f, setF] = useState(emptyEquipmentForm);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!f.name.trim()) return;
    setBusy(true);
    const ok = await addEquipment(f);
    setBusy(false);
    if (ok) setF(emptyEquipmentForm());
  }

  return (
    <div className="page-in">
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
