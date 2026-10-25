"use client";

import { useMemo, useState } from "react";
import { Building2, Check, KeyRound, Lock, Search, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Avatar, Badge, Callout, Empty, Field, InfoList, Toolbar, btn, inputCls, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, SearchInput, Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { STUDIO_ROLES, roleLabel } from "@/lib/studio-roles";
import { noAccent } from "@/lib/studio-nav";
import type { StaffRow } from "./StaffManager";
import type { StaffState } from "./useStaff";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÂN VIÊN & PHÂN QUYỀN — giao diện mới (tab đầu của StaffAndCrewV2). Cùng
   logic với StaffManager (bản cũ, ./useStaff); khác ở cách sắp xếp:
     • Một bảng gọn: người · vai trò · chi nhánh · trạng thái. Không còn hai ô
       chọn chen trên mỗi dòng.
     • Bấm một người mở NGĂN KÉO phân quyền: chọn vai trò trong danh sách có
       giải thích từng vai trò thấy gì, gán chi nhánh, xoá tài khoản. Đổi là
       lưu ngay — đúng như bản cũ.
     • Tạo tài khoản bằng ngăn kéo (nút chính ở đầu trang).
   Quyền giữ nguyên: chỉ chủ studio đổi vai trò / tạo / xoá; chủ studio và quản
   lý toàn studio gán chi nhánh; người khác chỉ xem.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StaffPanelProps = {
  branches: { id: string; name: string }[];
  canManageRoles: boolean;
  canAssignBranch: boolean;
  lockedBranchName: string | null;
};

const ROLE_TONE: Record<string, Tone> = { manager: "blue", branch_manager: "violet", staff: "gray", accountant: "teal" };
const roleTone = (r: string | null) => ROLE_TONE[r ?? "staff"] ?? "gray";

type StatusFilter = "all" | "active" | "locked";

const displayName = (s: StaffRow) => s.full_name || s.email;
/** Vai trò bị ghim vào chi nhánh mà chưa gán chi nhánh: họ không thấy dữ liệu nào. */
const missingBranch = (s: StaffRow) => s.studio_role === "branch_manager" && !s.studio_branch_id;

export function StaffPanelV2({ s, branches, canManageRoles, canAssignBranch, lockedBranchName }: { s: StaffState } & StaffPanelProps) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState("all");
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? s.list.find((x) => x.id === peekId) ?? null : null;

  const branchOf = (row: StaffRow) => branches.find((b) => b.id === row.studio_branch_id)?.name ?? "Toàn studio";
  const lockedCount = s.list.filter((x) => !x.is_active).length;

  const shown = useMemo(() => {
    const n = noAccent(q.trim());
    return s.list.filter((x) => {
      if (status === "active" && !x.is_active) return false;
      if (status === "locked" && x.is_active) return false;
      if (role !== "all" && (x.studio_role ?? "staff") !== role) return false;
      return !n || noAccent(`${x.full_name ?? ""} ${x.email}`).includes(n);
    });
  }, [s.list, q, status, role]);

  const statusBadge = (x: StaffRow) =>
    x.is_active ? <Badge tone="green" dot>Đang hoạt động</Badge> : <Badge tone="red" dot>Đã khoá</Badge>;

  const branchCell = (x: StaffRow) =>
    missingBranch(x) ? (
      <Badge tone="red" icon={Building2}>Chưa gán chi nhánh</Badge>
    ) : (
      <span className="text-[13.5px]" style={{ color: x.studio_branch_id ? "var(--tx)" : "var(--tx3)" }}>{branchOf(x)}</span>
    );

  const rowMenu = (x: StaffRow) => (
    <Menu
      label={`Thao tác với ${displayName(x)}`}
      items={[
        { label: canManageRoles ? "Đổi vai trò & chi nhánh" : canAssignBranch && branches.length ? "Gán chi nhánh" : "Xem quyền", icon: ShieldCheck, onClick: () => setPeekId(x.id) },
        ...(canManageRoles
          ? (["divider", { label: "Xoá tài khoản", hint: "Hợp đồng đã giao vẫn còn", icon: Trash2, danger: true, onClick: () => void s.remove(x) }] as const)
          : []),
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {lockedBranchName ? (
        <Callout tone="blue" icon={Lock}>
          Bạn đang ở vai trò <b>Toàn quyền chi nhánh</b> — chỉ thấy nhân sự của <b>{lockedBranchName}</b>.
        </Callout>
      ) : null}
      {!canManageRoles ? (
        <Callout tone="gray" icon={ShieldCheck} title="Chỉ chủ studio tạo tài khoản và đổi vai trò">
          Bạn xem được danh sách để biết ai đang làm gì{canAssignBranch && branches.length ? ", và gán nhân viên vào chi nhánh." : "."}
        </Callout>
      ) : null}

      {s.list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={UserCog}
            title="Chưa có tài khoản nhân viên nào"
            hint={canManageRoles ? "Bấm “Tạo nhân viên” ở đầu trang để nhân viên đăng nhập được." : "Chủ studio chưa tạo tài khoản nào."}
          />
        </div>
      ) : (
        <div className="v2-card overflow-hidden">
          <div className="v2-card-pad flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Toolbar>
              <div className="min-w-[200px] flex-1">
                <SearchInput value={q} onChange={setQ} placeholder="Tên hoặc email…" className="w-full" />
              </div>
              <Segmented<StatusFilter>
                label="Trạng thái tài khoản"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Tất cả", count: s.list.length },
                  { value: "active", label: "Hoạt động", count: s.list.length - lockedCount },
                  { value: "locked", label: "Đã khoá", count: lockedCount },
                ]}
              />
              <select aria-label="Lọc theo vai trò" className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="all">Mọi vai trò</option>
                {STUDIO_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </Toolbar>
          </div>

          {shown.length === 0 ? (
            <Empty compact icon={Search} title="Không có ai khớp bộ lọc" hint="Thử chọn “Tất cả” hoặc gõ ít chữ hơn." />
          ) : (
            <>
              <div className="v2-table-wrap hidden md:block">
                <table className="v2-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th style={{ width: 200 }}>Vai trò</th>
                      {branches.length > 0 ? <th style={{ width: 200 }}>Chi nhánh</th> : null}
                      <th style={{ width: 160 }}>Trạng thái</th>
                      <th style={{ width: 56 }} aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.id} className="cursor-pointer" onClick={() => setPeekId(x.id)} style={x.is_active ? undefined : { opacity: 0.7 }}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={displayName(x)} size={36} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {x.full_name || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên</span>}
                              </p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{x.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={roleTone(x.studio_role)}>{roleLabel(x.studio_role)}</Badge>
                        </td>
                        {branches.length > 0 ? <td>{branchCell(x)}</td> : null}
                        <td>{statusBadge(x)}</td>
                        <td onClick={(e) => e.stopPropagation()}>{rowMenu(x)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden">
                {shown.map((x) => (
                  <button key={x.id} type="button" onClick={() => setPeekId(x.id)} className="v2-row v2-row-link w-full text-left" style={x.is_active ? undefined : { opacity: 0.7 }}>
                    <Avatar name={displayName(x)} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{x.full_name || <span style={{ color: "var(--tx3)" }}>Chưa đặt tên</span>}</p>
                      <p className="v2-row-sub">{x.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge tone={roleTone(x.studio_role)}>{roleLabel(x.studio_role)}</Badge>
                        {missingBranch(x) ? <Badge tone="red">Chưa gán chi nhánh</Badge> : branches.length > 0 && x.studio_branch_id ? <Badge tone="gray">{branchOf(x)}</Badge> : null}
                        {!x.is_active ? <Badge tone="red" dot>Đã khoá</Badge> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={canManageRoles ? "Phân quyền nhân viên" : "Quyền của nhân viên"}
        desc="Đổi vai trò hay chi nhánh là lưu ngay."
        footer={
          peek && canManageRoles ? (
            <>
              <button type="button" onClick={() => void s.remove(peek)} className={btn("danger", "md", "mr-auto")}>
                <Trash2 size={16} /> Xoá tài khoản
              </button>
              <button type="button" onClick={() => setPeekId(null)} className={btn("secondary")}>
                Xong
              </button>
            </>
          ) : null
        }
      >
        {peek ? (
          <StaffPeek
            row={peek}
            branches={branches}
            canManageRoles={canManageRoles}
            canAssignBranch={canAssignBranch}
            onRole={(r) => void s.setRole(peek, r)}
            onBranch={(b) => void s.setBranch(peek, b)}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function StaffPeek({
  row,
  branches,
  canManageRoles,
  canAssignBranch,
  onRole,
  onBranch,
}: {
  row: StaffRow;
  branches: { id: string; name: string }[];
  canManageRoles: boolean;
  canAssignBranch: boolean;
  onRole: (role: string) => void;
  onBranch: (branchId: string) => void;
}) {
  const current = row.studio_role ?? "staff";
  const branchName = branches.find((b) => b.id === row.studio_branch_id)?.name ?? "Toàn studio";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={displayName(row)} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{row.full_name || "Chưa đặt tên"}</p>
          <p className="truncate text-[13.5px]" style={{ color: "var(--tx2)" }}>{row.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={roleTone(row.studio_role)}>{roleLabel(row.studio_role)}</Badge>
            {row.is_active ? <Badge tone="green" dot>Đang hoạt động</Badge> : <Badge tone="red" dot>Đã khoá</Badge>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="v2-label">Vai trò</p>
        {canManageRoles ? (
          <RoleChoices value={current} onChange={(r) => r !== current && onRole(r)} />
        ) : (
          <div className="rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
            <p className="text-[14px] font-semibold">{roleLabel(row.studio_role)}</p>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{STUDIO_ROLES.find((r) => r.key === current)?.hint}</p>
          </div>
        )}
      </div>

      {branches.length > 0 ? (
        <Field
          label="Chi nhánh"
          hint={canAssignBranch ? "Nhân viên chỉ làm ở một cơ sở thì gán vào đó; để “Toàn studio” nếu làm chung." : undefined}
          error={missingBranch(row) ? "Vai trò Toàn quyền chi nhánh phải được gán một chi nhánh — chưa gán thì họ không thấy dữ liệu nào." : undefined}
        >
          {canAssignBranch ? (
            <select
              className={inputCls}
              value={row.studio_branch_id ?? ""}
              onChange={(e) => onBranch(e.target.value)}
              aria-label={`Chi nhánh của ${displayName(row)}`}
              style={missingBranch(row) ? { borderColor: "var(--rd)" } : undefined}
            >
              <option value="">{row.studio_role === "branch_manager" ? "⚠ Chưa gán" : "Toàn studio"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-[14px] font-medium">{branchName}</p>
          )}
        </Field>
      ) : null}

      <InfoList
        items={[
          { label: "Đăng nhập bằng", value: <span className="break-all">{row.email}</span> },
          { label: "Tạo tài khoản", value: fmtDate(row.created_at) },
          { label: "Trạng thái", value: row.is_active ? "Đăng nhập được" : "Đã khoá — không đăng nhập được" },
        ]}
      />
    </div>
  );
}

/** Chọn vai trò: mỗi vai trò một dòng có giải thích vai trò đó thấy gì. */
function RoleChoices({ value, onChange }: { value: string; onChange: (role: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Vai trò" className="flex flex-col gap-2">
      {STUDIO_ROLES.map((r) => {
        const on = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r.key)}
            className="flex w-full items-start gap-3 rounded-[12px] px-3.5 py-3 text-left transition-colors"
            style={on ? { background: "var(--acS)", border: "1px solid var(--ac)" } : { background: "var(--sf)", border: "1px solid var(--bd)" }}
          >
            <span
              className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full"
              style={on ? { background: "var(--ac)", color: "#fff" } : { border: "1.5px solid var(--bdS)" }}
            >
              {on ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold" style={on ? { color: "var(--ac)" } : undefined}>{r.label}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--tx3)" }}>{r.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Ngăn kéo tạo tài khoản nhân viên. */
export function StaffCreateDrawer({
  s,
  open,
  onClose,
  branches,
}: {
  s: StaffState;
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string }[];
}) {
  const { f, setF } = s;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tạo nhân viên"
      desc="Nhân viên đăng nhập bằng email và mật khẩu bạn đặt ở đây."
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button
            type="button"
            disabled={s.busy}
            onClick={async () => {
              if (await s.add()) onClose();
            }}
            className={btn("primary")}
          >
            <KeyRound size={16} /> {s.busy ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Họ tên">
          <input className={inputCls} value={f.full_name} onChange={(e) => setF((p) => ({ ...p, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email đăng nhập">
            <input className={inputCls} type="email" autoComplete="off" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Mật khẩu" hint="Ít nhất 6 ký tự.">
            <input className={inputCls} type="text" autoComplete="off" value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <p className="v2-label">Vai trò</p>
          <RoleChoices value={f.role} onChange={(r) => setF((p) => ({ ...p, role: r }))} />
        </div>
        {branches.length > 0 ? (
          <Field label="Chi nhánh" hint={f.role === "branch_manager" ? "Bắt buộc với vai trò Toàn quyền chi nhánh." : undefined}>
            <select className={inputCls} value={f.branch_id} onChange={(e) => setF((p) => ({ ...p, branch_id: e.target.value }))}>
              <option value="">{f.role === "branch_manager" ? "— Bắt buộc chọn —" : "Toàn studio (không gán)"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {s.err ? <Callout tone="red">{s.err}</Callout> : null}
      </div>
    </Drawer>
  );
}
