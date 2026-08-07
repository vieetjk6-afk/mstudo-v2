"use client";

import { useState } from "react";
import { Plus, Trash2, Minus, RotateCcw, Phone, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import { vnd, type StudioPackage } from "@/lib/types";
import { Panel, Pill, EmptyState } from "@/components/studio/ui";

export default function PackagesManager({
  ownerId,
  initial,
}: {
  ownerId: string;
  initial: StudioPackage[];
}) {
  const supabase = createClient();
  const [list, setList] = useState<StudioPackage[]>(initial);
  const [f, setF] = useState({ client_name: "", client_phone: "", name: "Thẻ buổi", total_sessions: 1, price: 0 });
  const [busy, setBusy] = useState(false);
  /* Form nhập bung ra từ nút "Tạo thẻ buổi" thay vì chiếm cứng một cột. */
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!f.client_name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_packages")
      .insert({
        owner_id: ownerId,
        client_name: f.client_name.trim(),
        client_phone: f.client_phone.trim() || null,
        name: f.name.trim() || "Thẻ buổi",
        total_sessions: Math.max(1, Math.round(Number(f.total_sessions) || 1)),
        price: Math.max(0, Math.round(Number(f.price) || 0)),
      })
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setList((p) => [data as StudioPackage, ...p]);
      setF({ client_name: "", client_phone: "", name: "Thẻ buổi", total_sessions: 1, price: 0 });
      setAdding(false);
    }
  }

  async function setUsed(p: StudioPackage, delta: number) {
    const next = Math.max(0, Math.min(p.total_sessions, p.used_sessions + delta));
    if (next === p.used_sessions) return;
    await supabase.from("studio_packages").update({ used_sessions: next }).eq("id", p.id);
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, used_sessions: next } : x)));
  }

  async function togglePaid(p: StudioPackage) {
    await supabase.from("studio_packages").update({ paid: !p.paid }).eq("id", p.id);
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, paid: !x.paid } : x)));
  }

  async function remove(id: string) {
    if (!confirm("Xoá thẻ buổi này?")) return;
    await supabase.from("studio_packages").delete().eq("id", id);
    setList((l) => l.filter((x) => x.id !== id));
  }

  return (
    <div className="page-in flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Khách mua gói nhiều buổi trả trước — trừ dần mỗi lần chụp.
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
          style={adding ? { border: "1px solid var(--bd)" } : { background: "var(--ac)", color: "#fff" }}
        >
          <Plus size={17} /> {adding ? "Đóng" : "Tạo thẻ buổi"}
        </button>
      </div>

      {adding && (
        <Panel className="p-4">
          <p className="mb-3 text-[13.5px] font-bold">Tạo thẻ buổi</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div><label className="label mb-1 block uppercase">Khách hàng</label><input className="input w-full" value={f.client_name} onChange={(e) => setF((p) => ({ ...p, client_name: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">SĐT</label><input className="input w-full" value={f.client_phone} onChange={(e) => setF((p) => ({ ...p, client_phone: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Tên gói</label><input className="input w-full" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label mb-1 block uppercase">Số buổi</label><input type="number" className="input w-full" value={f.total_sessions} onChange={(e) => setF((p) => ({ ...p, total_sessions: Number(e.target.value) }))} /></div>
            <div><label className="label mb-1 block uppercase">Giá</label><MoneyInput value={f.price} onChange={(n) => setF((p) => ({ ...p, price: n }))} /></div>
          </div>
          <button
            onClick={add}
            disabled={busy || !f.client_name.trim()}
            className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Plus size={16} /> {busy ? "Đang tạo…" : "Tạo thẻ"}
          </button>
        </Panel>
      )}

      {list.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Ticket}
            title="Chưa có thẻ buổi nào"
            hint="Thẻ buổi dành cho khách trả trước nhiều buổi — mỗi lần chụp bấm “Dùng 1 buổi” là trừ dần."
          />
        </Panel>
      ) : (
        /* Dòng thẻ buổi: tên khách + gói, thanh tiến độ buổi đã dùng, tiền và
           trạng thái thanh toán bên phải, nút trừ / hoàn ở cuối. */
        <Panel>
          {list.map((p) => {
            const remaining = p.total_sessions - p.used_sessions;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
                <div className="w-[200px] min-w-0 flex-none">
                  <p className="truncate text-[14px] font-bold">{p.client_name}</p>
                  <p className="mt-px flex items-center gap-1 truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {p.client_phone ? <><Phone size={11} /> {p.client_phone} · </> : null}{p.name}
                  </p>
                </div>

                <div className="min-w-[150px] flex-1">
                  <p className="text-[12.5px] font-semibold" style={{ color: remaining > 0 ? "var(--tx2)" : "var(--rd)" }}>
                    Còn {remaining}/{p.total_sessions} buổi
                  </p>
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded-[4px]" style={{ background: "var(--bd2)" }}>
                    <div
                      className="h-full rounded-[4px]"
                      style={{ width: `${(p.used_sessions / p.total_sessions) * 100}%`, background: remaining > 0 ? "var(--bl)" : "var(--rd)" }}
                    />
                  </div>
                </div>

                <div className="w-[110px] flex-none text-right">
                  <p className="tnum text-[14px] font-bold">{vnd(p.price)}</p>
                </div>
                <button onClick={() => togglePaid(p)} className="flex-none" title="Bấm để đổi trạng thái thanh toán">
                  <Pill tone={p.paid ? "green" : "amber"} dot>{p.paid ? "Đã thanh toán" : "Chưa thanh toán"}</Pill>
                </button>

                <div className="flex flex-none items-center gap-1.5">
                  <button
                    onClick={() => setUsed(p, -1)}
                    disabled={p.used_sessions === 0}
                    className="flex items-center gap-1 whitespace-nowrap rounded-[9px] px-3 py-[7px] text-[12px] font-semibold disabled:opacity-40"
                    style={{ border: "1px solid var(--bd)" }}
                  >
                    <RotateCcw size={13} /> Hoàn
                  </button>
                  <button
                    onClick={() => setUsed(p, 1)}
                    disabled={remaining === 0}
                    className="flex items-center gap-1 whitespace-nowrap rounded-[9px] px-3 py-[7px] text-[12px] font-semibold disabled:opacity-40"
                    style={{ background: "var(--acS)", color: "var(--ac)" }}
                  >
                    <Minus size={13} /> Dùng 1 buổi
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    aria-label="Xoá thẻ buổi"
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]"
                    style={{ color: "var(--tx3)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
