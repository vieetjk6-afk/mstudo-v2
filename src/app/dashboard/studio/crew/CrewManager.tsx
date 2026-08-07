"use client";

import { useState } from "react";
import { Plus, Trash2, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mainUrl } from "@/lib/hosts";
import { Panel, EmptyState } from "@/components/studio/ui";
import { avatarColor, initials } from "@/lib/avatar";
import { useUndoToast } from "@/components/studio/UndoToast";
import { CREW_ROLE_LABEL, type StudioCrew, type CrewRole } from "@/lib/types";

export default function CrewManager({
  ownerId,
  initial,
  stats,
  registerUrl = "",
  registerError = null,
}: {
  ownerId: string;
  initial: StudioCrew[];
  stats: Record<string, { total: number; accepted: number; declined: number }>;
  /** Link riêng của studio để thợ tự đăng ký vào sổ. */
  registerUrl?: string;
  /** Vì sao chưa cấp được link (thường là DB chưa có cột crew_token). */
  registerError?: string | null;
}) {
  const supabase = createClient();
  const { run, view } = useUndoToast();
  const statFor = (phone: string) => stats[(phone || "").replace(/\D/g, "")] || null;
  const [list, setList] = useState<StudioCrew[]>(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<CrewRole>("photographer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Thợ tự đăng ký qua link riêng — chờ studio nhận vào sổ.
  const pending = list.filter((c) => (c as StudioCrew & { status?: string }).status === "pending");

  async function add() {
    setErr(null);
    if (!phone.trim()) {
      setErr("Cần nhập số điện thoại.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_crew")
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        phone: phone.trim(),
        role,
        note: note.trim() || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      setErr(error.code === "23505" ? "Số điện thoại này đã có trong sổ thợ." : error.message);
      return;
    }
    if (data) {
      setList((p) => [...p, data as StudioCrew].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPhone("");
      setNote("");
      setRole("photographer");
    }
  }

  /** Nhận thợ tự đăng ký vào sổ chính thức. */
  async function approve(id: string) {
    await supabase.from("studio_crew").update({ status: "active" }).eq("id", id);
    setList((p) => p.map((c) => (c.id === id ? { ...c, status: "active" } : c)));
  }

  /**
   * Xoá có hoàn tác: hàng biến mất ngay, 5 giây sau mới xoá thật.
   * Dùng chung cho cả nút "Xoá" ở sổ thợ và nút "Từ chối" ở danh sách xin vào
   * sổ — cùng một thao tác xoá dòng, chỉ khác chữ hiện trên toast.
   */
  function remove(id: string, verb = "Đã xoá") {
    const idx = list.findIndex((c) => c.id === id);
    const row = list[idx];
    if (!row) return;
    setList((p) => p.filter((c) => c.id !== id));
    run({
      label: `${verb} ${row.name || row.phone || "thợ"}`,
      commit: async () => { await supabase.from("studio_crew").delete().eq("id", id); },
      undo: () => setList((p) => { const n = [...p]; n.splice(idx, 0, row); return n; }),
    });
  }

  return (
    <div className="page-in">
      {view}
      <div className="mb-3.5">
        <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
          Lưu photographer / cameramen theo số điện thoại để gán nhanh vào hợp đồng.
          Thợ vào <span style={{ color: "var(--text)" }}>{mainUrl("/crew")}</span> để xem việc và
          tự báo lịch đã nhận — mỗi thợ chỉ thấy lịch của mình.
          Xem lịch cả đội ở <a href="/dashboard/studio/team" style={{ color: "var(--text)" }}>Lịch đội ngũ</a>.
        </p>
      </div>

      {/* Không cấp được link thì NÓI RA — trước đây card lặng lẽ biến mất và
          không ai biết vì sao. */}
      {!registerUrl && registerError && (
        <div className="card mb-4 p-4">
          <p className="text-[13px] font-medium" style={{ color: "var(--s-amber)" }}>Chưa cấp được link đăng ký cho thợ</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>
            Chưa ghi được mã link vào hồ sơ studio. Thường là do chưa chạy
            {" "}<code>supabase/migrations/crew_profile_show.sql</code>. Chạy xong tải lại trang.
          </p>
          <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--text3)" }}>{registerError}</p>
        </div>
      )}

      {registerUrl && (
        <div className="card mb-4 p-4">
          <p className="text-[13px] font-medium">Link đăng ký cho thợ</p>
          <p className="mb-2 text-[11px]" style={{ color: "var(--text3)" }}>
            Gửi link này cho thợ để họ tự khai thông tin và xin vào sổ. Link mang mã riêng của studio bạn —
            trang /crew chung không biết thợ thuộc studio nào.
          </p>
          <input className="input text-[12px]" readOnly value={registerUrl} aria-label="Link đăng ký thợ" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      {pending.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--s-amber)" }}>
            {pending.length} thợ xin vào sổ
          </p>
          <ul className="space-y-2">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface2)" }}>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{c.name || c.phone}</span>
                  <span className="block text-[11px]" style={{ color: "var(--text3)" }}>{c.phone}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button onClick={() => approve(c.id)} className="btn-primary px-3 py-1.5 text-xs">Nhận</button>
                  <button onClick={() => remove(c.id, "Đã từ chối")} className="btn-ghost px-3 py-1.5 text-xs">Từ chối</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-3">
        {/* Add form */}
        <Panel className="h-fit p-[18px]">
          <h2 className="mb-3.5 text-[14px] font-bold">Thêm thợ vào sổ</h2>
          <div className="space-y-3">
            <div className="field">
              <label className="label">Tên</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Số điện thoại</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Vai trò</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as CrewRole)}>
                {(Object.keys(CREW_ROLE_LABEL) as CrewRole[]).map((k) => (
                  <option key={k} value={k}>{CREW_ROLE_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Ghi chú</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
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

        {/* List */}
        <div className="lg:col-span-2">
          {list.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Phone}
                title="Chưa có thợ nào trong sổ"
                hint="Thêm thợ ở khối bên trái, hoặc gửi link đăng ký để thợ tự khai thông tin."
              />
            </Panel>
          ) : (
            <div className="flex flex-col gap-2">
              {list.map((c) => (
                <Panel key={c.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: avatarColor(c.name || c.phone) }}>
                      {initials(c.name || c.phone)}
                    </span>
                    <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold">{c.name || "(chưa đặt tên)"}</p>
                    <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      <Phone size={12} /> {c.phone} · {CREW_ROLE_LABEL[c.role] ?? c.role}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                    {(() => {
                      const s = statFor(c.phone);
                      if (!s || s.total === 0) return null;
                      const rate = Math.round((s.accepted / s.total) * 100);
                      return (
                        <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                          <span style={{ color: "var(--gn)", fontWeight: 700 }}>{s.accepted} buổi đã nhận</span> · {s.total} lời mời · nhận {rate}%
                          {s.declined ? ` · từ chối ${s.declined}` : ""}
                        </p>
                      );
                    })()}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(c.id)}
                    aria-label="Xoá thợ"
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
