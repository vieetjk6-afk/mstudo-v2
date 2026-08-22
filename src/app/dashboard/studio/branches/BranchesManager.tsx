"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Trash2, MapPin, Phone, UserCog, FileText, Wallet, CalendarRange,
  UsersRound, Pencil, X as XIcon, EyeOff, Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, Pill, ProgressBar, EmptyState } from "@/components/studio/ui";
import { useToast } from "@/components/studio/Toast";
import { avatarStyle, initials } from "@/lib/avatar";
import { sortBranches, UNASSIGNED_LABEL, type BranchStats } from "@/lib/branch-rules";
import { vnd, vndShort, type StudioBranch } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   QUẢN LÝ CHI NHÁNH — khai cơ sở, gán người quản lý, và đối chiếu các cơ sở.

   Xoá một chi nhánh KHÔNG xoá dữ liệu của nó: khoá ngoại đặt `on delete set
   null` nên hợp đồng, lịch, khoản thu chi quay về "chưa gán". Hộp thoại xác nhận
   nói đúng điều đó, vì "Xoá chi nhánh" rất dễ bị hiểu là xoá cả sổ sách.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BranchStaff = {
  id: string;
  full_name: string | null;
  email: string;
  studio_role: string | null;
  studio_branch_id: string | null;
};

const ROLE_LABEL: Record<string, string> = { manager: "Quản lý", staff: "Nhân viên", accountant: "Kế toán" };

type Draft = {
  id: string | null;
  name: string;
  code: string;
  address: string;
  phone: string;
  manager_id: string;
  note: string;
  active: boolean;
};

const emptyDraft = (): Draft => ({ id: null, name: "", code: "", address: "", phone: "", manager_id: "", note: "", active: true });

export default function BranchesManager({
  ownerId, canEdit, initial, stats, staff, monthLabel,
}: {
  ownerId: string;
  canEdit: boolean;
  initial: StudioBranch[];
  stats: BranchStats[];
  staff: BranchStaff[];
  monthLabel: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [list, setList] = useState<StudioBranch[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const statOf = useMemo(() => {
    const m = new Map<string | null, BranchStats>();
    for (const s of stats) m.set(s.branchId, s);
    return m;
  }, [stats]);

  const unassigned = statOf.get(null);
  // Mẫu số của thanh so sánh doanh thu: cơ sở thu nhiều nhất trong tháng.
  const maxRevenue = Math.max(1, ...stats.map((s) => s.revenue));

  const staffOf = (branchId: string | null) => staff.filter((s) => s.studio_branch_id === branchId);
  const managerName = (id: string | null) => {
    const m = staff.find((s) => s.id === id);
    return m ? m.full_name || m.email : null;
  };

  function errMsg(m?: string | null) {
    if (m?.includes("studio_branches")) return "Chưa chạy migration studio_branches.sql trong Supabase.";
    return m || "Không lưu được.";
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { toast("Chi nhánh cần có tên."); return; }
    setBusy(true);
    const row = {
      owner_id: ownerId,
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
      manager_id: draft.manager_id || null,
      note: draft.note.trim() || null,
      active: draft.active,
    };
    if (draft.id) {
      const { data, error } = await supabase.from("studio_branches").update(row).eq("id", draft.id).select("*").single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      setList((p) => sortBranches(p.map((b) => (b.id === draft.id ? (data as StudioBranch) : b))));
      toast("Đã lưu chi nhánh.");
    } else {
      const { data, error } = await supabase
        .from("studio_branches")
        .insert({ ...row, position: list.length })
        .select("*")
        .single();
      setBusy(false);
      if (error || !data) { toast(errMsg(error?.message)); return; }
      setList((p) => sortBranches([...p, data as StudioBranch]));
      toast(`Đã thêm chi nhánh ${row.name}.`);
    }
    setDraft(null);
    router.refresh(); // nạp lại số liệu theo chi nhánh
  }

  async function remove(b: StudioBranch) {
    const s = statOf.get(b.id);
    const n = (s?.contracts ?? 0) + (s?.staff ?? 0) + (s?.crew ?? 0) + (s?.appointments ?? 0);
    const warn =
      n > 0
        ? `Xoá chi nhánh “${b.name}”?\n\nDữ liệu KHÔNG bị xoá — hợp đồng, lịch, thu chi và nhân sự của chi nhánh này sẽ chuyển về “${UNASSIGNED_LABEL}”. Bạn gán lại sang chi nhánh khác được sau.`
        : `Xoá chi nhánh “${b.name}”?`;
    if (!confirm(warn)) return;
    const { error } = await supabase.from("studio_branches").delete().eq("id", b.id);
    if (error) { toast(errMsg(error.message)); return; }
    setList((p) => p.filter((x) => x.id !== b.id));
    toast("Đã xoá chi nhánh.");
    router.refresh();
  }

  async function toggleActive(b: StudioBranch) {
    const active = !b.active;
    setList((p) => sortBranches(p.map((x) => (x.id === b.id ? { ...x, active } : x))));
    const { error } = await supabase.from("studio_branches").update({ active }).eq("id", b.id);
    if (error) {
      setList((p) => sortBranches(p.map((x) => (x.id === b.id ? { ...x, active: b.active } : x))));
      toast(errMsg(error.message));
      return;
    }
    toast(active ? "Đã mở lại chi nhánh." : "Đã tạm ẩn chi nhánh — dữ liệu cũ giữ nguyên.");
  }

  return (
    <div className="page-in flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Nhiều cơ sở trong cùng một tài khoản. Mỗi chi nhánh có đội ngũ, lịch và sổ thu chi riêng;
            bảng giá, điều khoản và thư viện album vẫn dùng chung.
          </p>
          {list.length > 0 && (
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Số liệu tính trong tháng {monthLabel}. Chọn chi nhánh ở thanh trên cùng để lọc mọi màn khác.
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setDraft(emptyDraft())}
            className="flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Plus size={16} /> Thêm chi nhánh
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Building2}
            title="Chưa khai chi nhánh nào"
            hint="Studio một cơ sở không cần dùng mục này. Có từ hai cơ sở trở lên thì thêm vào đây để tách đội ngũ, lịch và doanh thu."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          {list.map((b) => {
            const s = statOf.get(b.id);
            const mgr = managerName(b.manager_id);
            const people = staffOf(b.id);
            return (
              <Panel key={b.id} className="px-[18px] py-4" style={{ opacity: b.active ? 1 : 0.62 }}>
                <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5">
                  <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--acS)", lineHeight: 0 }}>
                    <Building2 size={18} style={{ color: "var(--ac)" }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15.5px] font-bold">{b.name}</h2>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {b.code ? `Mã ${b.code}` : "Chưa đặt mã"}
                      {mgr ? ` · Quản lý: ${mgr}` : ""}
                    </p>
                  </div>
                  {!b.active && <Pill tone="gray">Tạm ẩn</Pill>}
                  {canEdit && (
                    <div className="flex flex-none items-center gap-1">
                      <button onClick={() => toggleActive(b)} className="rounded-[8px] p-1.5" style={{ color: "var(--tx3)" }} aria-label={b.active ? "Tạm ẩn" : "Mở lại"}>
                        {b.active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        onClick={() =>
                          setDraft({
                            id: b.id, name: b.name, code: b.code ?? "", address: b.address ?? "",
                            phone: b.phone ?? "", manager_id: b.manager_id ?? "", note: b.note ?? "", active: b.active,
                          })
                        }
                        className="rounded-[8px] p-1.5"
                        style={{ color: "var(--tx3)" }}
                        aria-label="Sửa"
                      >
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(b)} className="rounded-[8px] p-1.5" style={{ color: "var(--rd)" }} aria-label="Xoá">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {(b.address || b.phone) && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--tx2)" }}>
                    {b.address && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin size={14} style={{ flex: "none", color: "var(--tx3)" }} />
                        <span className="truncate">{b.address}</span>
                      </span>
                    )}
                    {b.phone && (
                      <a href={`tel:${b.phone}`} className="flex items-center gap-1">
                        <Phone size={14} style={{ color: "var(--tx3)" }} /> {b.phone}
                      </a>
                    )}
                  </p>
                )}

                {/* Doanh thu tháng — thanh so sánh giữa các cơ sở */}
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>Đã thu tháng {monthLabel}</span>
                    <span className="tnum text-[16px] font-bold" style={{ letterSpacing: "-.4px", color: "var(--gn)" }}>
                      {vnd(s?.revenue ?? 0)}
                    </span>
                  </div>
                  <ProgressBar pct={((s?.revenue ?? 0) / maxRevenue) * 100} color="var(--gn)" height={6} className="mt-1.5" />
                  {(s?.contractValue ?? 0) > 0 && (
                    <p className="tnum mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                      trên tổng giá trị {vndShort(s?.contractValue ?? 0)}
                      {(s?.expenses ?? 0) > 0 ? ` · chi ${vndShort(s?.expenses ?? 0)}` : ""}
                    </p>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  <Metric icon={FileText} label="Hợp đồng" value={s?.contracts ?? 0} />
                  <Metric icon={CalendarRange} label="Lịch tuần" value={s?.appointments ?? 0} />
                  <Metric icon={UserCog} label="Nhân viên" value={s?.staff ?? 0} />
                  <Metric icon={UsersRound} label="Thợ" value={s?.crew ?? 0} />
                </div>

                {people.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {people.slice(0, 6).map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-1.5 rounded-[20px] py-[3px] pl-[3px] pr-2.5 text-[11px] font-semibold"
                        style={{ background: "var(--sf2)" }}
                        title={ROLE_LABEL[p.studio_role ?? ""] ?? "Nhân viên"}
                      >
                        <span
                          className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full text-[8px] font-bold"
                          style={avatarStyle(p.full_name || p.email)}
                        >
                          {initials(p.full_name || p.email)}
                        </span>
                        {p.full_name || p.email}
                      </span>
                    ))}
                    {people.length > 6 && (
                      <span className="text-[11px]" style={{ color: "var(--tx3)" }}>+{people.length - 6} người</span>
                    )}
                  </div>
                )}

                {b.note && (
                  <p className="mt-2.5 rounded-[10px] px-2.5 py-2 text-[11.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}>
                    {b.note}
                  </p>
                )}
              </Panel>
            );
          })}

          {/* Ô "chưa gán" — chỉ hiện khi thật sự còn dữ liệu chưa thuộc cơ sở nào,
              vì đó là việc cần làm, không phải một chi nhánh. */}
          {unassigned && (unassigned.contracts > 0 || unassigned.staff > 0 || unassigned.crew > 0 || unassigned.appointments > 0) && (
            <Panel className="px-[18px] py-4" style={{ borderStyle: "dashed" }}>
              <div className="flex items-start gap-2.5">
                <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf2)", lineHeight: 0 }}>
                  <Building2 size={18} style={{ color: "var(--tx3)" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15.5px] font-bold">{UNASSIGNED_LABEL}</h2>
                  <p className="text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Dữ liệu chưa thuộc cơ sở nào — vẫn dùng bình thường, chỉ là không tách được theo chi nhánh.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <Metric icon={FileText} label="Hợp đồng" value={unassigned.contracts} />
                <Metric icon={CalendarRange} label="Lịch tuần" value={unassigned.appointments} />
                <Metric icon={UserCog} label="Nhân viên" value={unassigned.staff} />
                <Metric icon={UsersRound} label="Thợ" value={unassigned.crew} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold">
                <Link href="/dashboard/studio/contracts" className="rounded-[9px] px-2.5 py-1.5" style={{ border: "1px solid var(--bd)" }}>
                  Gán hợp đồng →
                </Link>
                <Link href="/dashboard/studio/staff" className="rounded-[9px] px-2.5 py-1.5" style={{ border: "1px solid var(--bd)" }}>
                  Gán nhân viên →
                </Link>
                <Link href="/dashboard/studio/crew" className="rounded-[9px] px-2.5 py-1.5" style={{ border: "1px solid var(--bd)" }}>
                  Gán thợ →
                </Link>
              </div>
            </Panel>
          )}
        </div>
      )}

      {list.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          <Wallet size={14} /> “Đã thu” là tiền THỰC THU của hợp đồng thuộc chi nhánh đó trong tháng — không phải giá trị hợp đồng.
        </p>
      )}

      {draft && (
        <BranchDialog
          draft={draft}
          setDraft={setDraft}
          staff={staff}
          busy={busy}
          onSave={save}
        />
      )}
      {toastNode}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <div className="rounded-[10px] px-2 py-2 text-center" style={{ background: "var(--sf2)" }}>
      <Icon size={14} style={{ color: "var(--tx3)", margin: "0 auto" }} />
      <p className="tnum mt-1 text-[15px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10.5px]" style={{ color: "var(--tx3)" }}>{label}</p>
    </div>
  );
}

function BranchDialog({
  draft, setDraft, staff, busy, onSave,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  staff: BranchStaff[];
  busy: boolean;
  onSave: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(12,10,14,.5)" }}>
      <div
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[18px] sm:rounded-[16px]"
        style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "var(--sh-modal)" }}
      >
        <div className="flex items-center gap-2.5 px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Building2 size={18} style={{ color: "var(--ac)" }} />
          <h2 className="text-[14.5px] font-bold">{draft.id ? "Sửa chi nhánh" : "Thêm chi nhánh"}</h2>
          <button onClick={() => setDraft(null)} className="ml-auto flex-none rounded-[9px] p-1.5" style={{ background: "var(--sf2)", color: "var(--tx2)" }} aria-label="Đóng">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-[18px] py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Tên chi nhánh">
              <input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Chi nhánh Quận 1" />
            </Field>
            <Field label="Mã ngắn">
              <input className="input" value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Q1" maxLength={12} />
            </Field>
          </div>

          <Field label="Địa chỉ">
            <input className="input" value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="12 Nguyễn Huệ, Quận 1, TP.HCM" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Số điện thoại">
              <input className="input" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Người quản lý">
              <select className="input" value={draft.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
                <option value="">— Chưa chọn —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.full_name || s.email) + (s.studio_role ? ` · ${ROLE_LABEL[s.studio_role] ?? s.studio_role}` : "")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {staff.length === 0 && (
            <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Chưa có tài khoản nhân viên nào để chọn làm quản lý —{" "}
              <Link href="/dashboard/studio/staff" style={{ color: "var(--ac)", fontWeight: 600 }}>tạo nhân viên</Link>.
            </p>
          )}

          <Field label="Ghi chú">
            <textarea className="input" rows={2} value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="Giờ mở cửa, ghi chú riêng của cơ sở…" />
          </Field>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[11px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
            <input type="checkbox" checked={draft.active} onChange={(e) => set("active", e.target.checked)} className="mt-0.5" />
            <span>
              <span className="block text-[12.5px] font-semibold">Đang hoạt động</span>
              <span className="block text-[11px]" style={{ color: "var(--tx3)" }}>
                Bỏ tick để tạm ẩn cơ sở đã đóng — không còn hiện trong ô chọn khi gán dữ liệu mới, nhưng số liệu cũ vẫn tra được.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
          <button onClick={() => setDraft(null)} className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
            Huỷ
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="ml-auto rounded-[10px] px-4 py-2 text-[12.5px] font-bold disabled:opacity-50"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {busy ? "Đang lưu…" : draft.id ? "Lưu thay đổi" : "Thêm chi nhánh"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>{label}</span>
      {children}
    </label>
  );
}
