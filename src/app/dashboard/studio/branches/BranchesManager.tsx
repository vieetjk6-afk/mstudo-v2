"use client";

import Link from "next/link";
import {
  Building2, Plus, Trash2, MapPin, Phone, UserCog, FileText, Wallet, CalendarRange,
  UsersRound, Pencil, X as XIcon, EyeOff, Eye,
} from "lucide-react";
import { Panel, Pill, ProgressBar, EmptyState } from "@/components/studio/ui";
import { Modal } from "@/components/studio/Modal";
import { avatarStyle, initials } from "@/lib/avatar";
import { UNASSIGNED_LABEL, type BranchStats } from "@/lib/branch-rules";
import { vnd, vndShort, type StudioBranch } from "@/lib/types";
import { roleLabel } from "@/lib/studio-roles";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { draftOf, emptyDraft, useBranches, type Draft } from "./useBranches";
import BranchesV2 from "./BranchesV2";

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



export type BranchesProps = {
  ownerId: string;
  canEdit: boolean;
  initial: StudioBranch[];
  stats: BranchStats[];
  staff: BranchStaff[];
  monthLabel: string;
};

/** Giao diện mới có bản riêng (BranchesV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function BranchesManager(props: BranchesProps) {
  return useUiV2() ? <BranchesV2 {...props} /> : <BranchesManagerV1 {...props} />;
}

function BranchesManagerV1({ ownerId, canEdit, initial, stats, staff, monthLabel }: BranchesProps) {
  // Logic dùng chung với bản mới (BranchesV2) — xem ./useBranches.
  const { list, draft, setDraft, busy, statOf, unassigned, maxRevenue, staffOf, managerName, save, remove, toggleActive, toastNode } =
    useBranches({ ownerId, initial, stats, staff });

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
                        onClick={() => setDraft(draftOf(b))}
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
                        title={roleLabel(p.studio_role)}
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
                <Link href="/dashboard/studio/staff?tab=crew" className="rounded-[9px] px-2.5 py-1.5" style={{ border: "1px solid var(--bd)" }}>
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
    <Modal onClose={() => setDraft(null)} maxWidth={520} labelledBy="branch-dialog-title">
        <div className="flex items-center gap-2.5 px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <Building2 size={18} style={{ color: "var(--ac)" }} />
          <h2 id="branch-dialog-title" className="text-[14.5px] font-bold">{draft.id ? "Sửa chi nhánh" : "Thêm chi nhánh"}</h2>
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
                    {(s.full_name || s.email) + (s.studio_role ? ` · ${roleLabel(s.studio_role)}` : "")}
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
    </Modal>
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
