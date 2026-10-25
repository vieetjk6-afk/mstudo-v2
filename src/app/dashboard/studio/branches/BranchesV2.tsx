"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Building2, CalendarRange, Eye, EyeOff, FileText, MapPin, Pencil, Phone, Plus, Trash2, UserCog, UsersRound, Wallet,
} from "lucide-react";
import { Avatar, Badge, Callout, Empty, Field, InfoList, PageHead, Progress, Stack, Stat, StatGrid, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Modal, Switch } from "@/components/v2/kit-client";
import { UNASSIGNED_LABEL, type BranchStats } from "@/lib/branch-rules";
import { vnd, vndShort, type StudioBranch } from "@/lib/types";
import { roleLabel } from "@/lib/studio-roles";
import type { BranchesProps, BranchStaff } from "./BranchesManager";
import { draftOf, emptyDraft, useBranches, type Draft } from "./useBranches";

/* ═══════════════════════════════════════════════════════════════════════════
   CHI NHÁNH — giao diện mới. Cùng logic với BranchesManager (./useBranches);
   khác ở cách sắp xếp:
     • 4 số liệu gộp cả studio trong tháng: số cơ sở · đã thu · hợp đồng · nhân sự.
     • Một BẢNG SO SÁNH các cơ sở (đã thu có thanh so sánh, hợp đồng, lịch tuần,
       nhân viên, thợ) thay cho lưới thẻ dày đặc. Sửa / tạm ẩn / xoá vào menu ⋯.
     • Bấm một cơ sở mở ngăn kéo: địa chỉ, điện thoại, quản lý, người làm ở đó,
       ghi chú. Dữ liệu chưa gán chi nhánh thành một lời nhắc có lối đi gán.
     • Thêm/sửa bằng hộp thoại, "Đang hoạt động" là công tắc.
   Chỉ chủ studio và quản lý toàn studio thêm/sửa/xoá — như bản cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function BranchesV2({ ownerId, canEdit, initial, stats, staff, monthLabel }: BranchesProps) {
  const b = useBranches({ ownerId, initial, stats, staff });
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId ? b.list.find((x) => x.id === peekId) ?? null : null;

  const sum = (k: keyof Omit<BranchStats, "branchId">) => b.list.reduce((n, x) => n + (b.statOf.get(x.id)?.[k] ?? 0), 0);
  const activeCount = b.list.filter((x) => x.active).length;
  const revenue = sum("revenue");
  const un = b.unassigned;
  const hasUnassigned = !!un && (un.contracts > 0 || un.staff > 0 || un.crew > 0 || un.appointments > 0);

  const rowMenu = (x: StudioBranch) =>
    canEdit ? (
      <Menu
        label={`Thao tác với ${x.name}`}
        items={[
          { label: "Sửa thông tin", icon: Pencil, onClick: () => b.setDraft(draftOf(x)) },
          {
            label: x.active ? "Tạm ẩn chi nhánh" : "Mở lại chi nhánh",
            hint: x.active ? "Dữ liệu cũ giữ nguyên" : undefined,
            icon: x.active ? EyeOff : Eye,
            onClick: () => void b.toggleActive(x),
          },
          "divider",
          { label: "Xoá chi nhánh", hint: "Dữ liệu chuyển về “chưa gán”", icon: Trash2, danger: true, onClick: () => void b.remove(x) },
        ]}
      />
    ) : null;

  return (
    <Stack>
      <PageHead
        desc={
          b.list.length ? (
            <>Mỗi cơ sở có đội ngũ, lịch và sổ thu chi riêng; bảng giá và album dùng chung. Số liệu tính trong tháng {monthLabel}.</>
          ) : (
            "Nhiều cơ sở trong cùng một tài khoản: mỗi chi nhánh có đội ngũ, lịch và sổ thu chi riêng."
          )
        }
        actions={
          canEdit && b.list.length ? (
            <button type="button" onClick={() => b.setDraft(emptyDraft())} className={btn("primary")}>
              <Plus size={17} /> Thêm chi nhánh
            </button>
          ) : null
        }
      />

      {b.list.length === 0 ? (
        <div className="v2-card">
          <Empty
            icon={Building2}
            title="Chưa khai chi nhánh nào"
            hint="Studio một cơ sở không cần dùng mục này. Có từ hai cơ sở trở lên thì thêm vào đây để tách đội ngũ, lịch và doanh thu."
            action={
              canEdit ? (
                <button type="button" onClick={() => b.setDraft(emptyDraft())} className={btn("primary")}>
                  <Plus size={17} /> Thêm chi nhánh đầu tiên
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <>
          <StatGrid>
            <Stat
              icon={Building2}
              tone="brand"
              label="Chi nhánh"
              value={activeCount}
              sub={b.list.length > activeCount ? `${b.list.length - activeCount} đang tạm ẩn` : "Đều đang hoạt động"}
            />
            <Stat icon={Wallet} tone="green" label={`Đã thu tháng ${monthLabel}`} value={vndShort(revenue)} sub={`Giá trị hợp đồng ${vndShort(sum("contractValue"))}`} />
            <Stat icon={FileText} tone="blue" label="Hợp đồng trong tháng" value={sum("contracts")} sub={`${sum("appointments")} lịch hẹn tuần này`} />
            <Stat icon={UsersRound} tone="violet" label="Nhân sự" value={sum("staff") + sum("crew")} sub={`${sum("staff")} nhân viên · ${sum("crew")} thợ`} />
          </StatGrid>

          {hasUnassigned && un ? (
            <Callout
              tone="amber"
              icon={Building2}
              title={UNASSIGNED_LABEL}
              action={
                <Menu
                  label="Gán dữ liệu vào chi nhánh"
                  width={220}
                  trigger={({ toggle }) => (
                    <button type="button" onClick={toggle} className={btn("secondary", "sm")}>
                      Gán ngay <ArrowRight size={15} />
                    </button>
                  )}
                  items={[
                    { label: "Gán hợp đồng", icon: FileText, href: "/dashboard/studio/contracts" },
                    { label: "Gán nhân viên", icon: UserCog, href: "/dashboard/studio/staff" },
                    { label: "Gán thợ", icon: UsersRound, href: "/dashboard/studio/staff?tab=crew" },
                  ]}
                />
              }
            >
              {[
                un.contracts && `${un.contracts} hợp đồng`,
                un.appointments && `${un.appointments} lịch tuần`,
                un.staff && `${un.staff} nhân viên`,
                un.crew && `${un.crew} thợ`,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              chưa thuộc cơ sở nào — vẫn dùng bình thường, chỉ là không tách được theo chi nhánh.
            </Callout>
          ) : null}

          <div className="v2-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="min-w-0 flex-1">
                <p className="v2-section-title">So sánh các cơ sở</p>
                <p className="v2-section-desc">Bấm một chi nhánh để xem địa chỉ, quản lý và người làm ở đó.</p>
              </div>
            </div>

            <div className="v2-table-wrap hidden md:block">
              <table className="v2-table">
                <thead>
                  <tr>
                    <th>Chi nhánh</th>
                    <th style={{ width: 230 }}>Đã thu tháng {monthLabel}</th>
                    <th className="num" style={{ width: 96 }}>Hợp đồng</th>
                    <th className="num" style={{ width: 96 }}>Lịch tuần</th>
                    <th className="num" style={{ width: 96 }}>Nhân viên</th>
                    <th className="num" style={{ width: 70 }}>Thợ</th>
                    {canEdit ? <th style={{ width: 56 }} aria-label="Thao tác" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {b.list.map((x) => {
                    const s = b.statOf.get(x.id);
                    const mgr = b.managerName(x.manager_id);
                    return (
                      <tr key={x.id} className="cursor-pointer" onClick={() => setPeekId(x.id)} style={x.active ? undefined : { opacity: 0.62 }}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="v2-section-icon"><Building2 size={16} /></span>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 font-semibold">
                                <span className="truncate">{x.name}</span>
                                {x.code ? <Badge tone="gray">{x.code}</Badge> : null}
                                {!x.active ? <Badge tone="amber">Tạm ẩn</Badge> : null}
                              </p>
                              <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                                {mgr ? `Quản lý: ${mgr}` : "Chưa chọn quản lý"}
                                {x.address ? ` · ${x.address}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <Progress value={((s?.revenue ?? 0) / b.maxRevenue) * 100} tone="green" />
                            </div>
                            <span className="v2-num w-[64px] flex-none text-right font-semibold" style={{ color: (s?.revenue ?? 0) > 0 ? "var(--gn)" : "var(--tx3)" }}>
                              {vndShort(s?.revenue ?? 0)}
                            </span>
                          </div>
                        </td>
                        <td className="num">{s?.contracts ?? 0}</td>
                        <td className="num">{s?.appointments ?? 0}</td>
                        <td className="num">{s?.staff ?? 0}</td>
                        <td className="num">{s?.crew ?? 0}</td>
                        {canEdit ? <td onClick={(e) => e.stopPropagation()}>{rowMenu(x)}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden">
              {b.list.map((x) => {
                const s = b.statOf.get(x.id);
                return (
                  <button key={x.id} type="button" onClick={() => setPeekId(x.id)} className="v2-row v2-row-link w-full text-left" style={x.active ? undefined : { opacity: 0.62 }}>
                    <span className="v2-section-icon"><Building2 size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{x.name}</p>
                      <p className="v2-row-sub">
                        {s?.contracts ?? 0} hợp đồng · {(s?.staff ?? 0) + (s?.crew ?? 0)} người{!x.active ? " · tạm ẩn" : ""}
                      </p>
                      <div className="mt-1.5">
                        <Progress value={((s?.revenue ?? 0) / b.maxRevenue) * 100} tone="green" />
                      </div>
                    </div>
                    <p className="v2-num flex-none text-[14px] font-semibold" style={{ color: (s?.revenue ?? 0) > 0 ? "var(--gn)" : "var(--tx3)" }}>
                      {vndShort(s?.revenue ?? 0)}
                    </p>
                  </button>
                );
              })}
            </div>

            <p className="flex items-start gap-2 px-4 py-3 text-[12.5px] sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)", color: "var(--tx3)" }}>
              <Wallet size={14} className="mt-0.5 flex-none" />
              “Đã thu” là tiền THỰC THU của hợp đồng thuộc chi nhánh đó trong tháng — không phải giá trị hợp đồng. Chọn chi nhánh ở thanh trên cùng để lọc các màn khác.
            </p>
          </div>
        </>
      )}

      <Drawer
        open={!!peek}
        onClose={() => setPeekId(null)}
        title={peek?.name ?? "Chi nhánh"}
        desc={peek ? (peek.code ? `Mã ${peek.code}` : "Chưa đặt mã") + (peek.active ? "" : " · đang tạm ẩn") : undefined}
        footer={
          peek && canEdit ? (
            <>
              <button
                type="button"
                onClick={() => void b.remove(peek)}
                className={btn("danger", "md", "mr-auto")}
                aria-label="Xoá chi nhánh"
              >
                <Trash2 size={16} /> <span className="hidden sm:inline">Xoá</span>
              </button>
              <button type="button" onClick={() => void b.toggleActive(peek)} className={btn("secondary")}>
                {peek.active ? <EyeOff size={16} /> : <Eye size={16} />} {peek.active ? "Tạm ẩn" : "Mở lại"}
              </button>
              <button
                type="button"
                onClick={() => {
                  b.setDraft(draftOf(peek));
                  setPeekId(null);
                }}
                className={btn("primary")}
              >
                <Pencil size={16} /> Sửa
              </button>
            </>
          ) : null
        }
      >
        {peek ? <BranchPeek x={peek} s={b.statOf.get(peek.id)} maxRevenue={b.maxRevenue} monthLabel={monthLabel} manager={b.managerName(peek.manager_id)} people={b.staffOf(peek.id)} /> : null}
      </Drawer>

      <Modal
        open={!!b.draft}
        onClose={() => b.setDraft(null)}
        icon={Building2}
        title={b.draft?.id ? "Sửa chi nhánh" : "Thêm chi nhánh"}
        width={560}
        footer={
          <>
            <button type="button" onClick={() => b.setDraft(null)} className={btn("ghost")}>Huỷ</button>
            <button type="button" onClick={() => void b.save()} disabled={b.busy} className={btn("primary")}>
              {b.busy ? "Đang lưu…" : b.draft?.id ? "Lưu thay đổi" : "Thêm chi nhánh"}
            </button>
          </>
        }
      >
        {b.draft ? <BranchForm draft={b.draft} setDraft={b.setDraft} staff={staff} /> : null}
      </Modal>
      {b.toastNode}
    </Stack>
  );
}

function BranchPeek({
  x, s, maxRevenue, monthLabel, manager, people,
}: {
  x: StudioBranch;
  s: BranchStats | undefined;
  maxRevenue: number;
  monthLabel: string;
  manager: string | null;
  people: BranchStaff[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="v2-card v2-card-pad flex flex-col gap-3" style={{ boxShadow: "none" }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px]" style={{ color: "var(--tx2)" }}>Đã thu tháng {monthLabel}</p>
          <p className="v2-num text-[18px] font-bold" style={{ color: "var(--gn)" }}>{vnd(s?.revenue ?? 0)}</p>
        </div>
        <Progress value={((s?.revenue ?? 0) / maxRevenue) * 100} tone="green" />
        <p className="v2-num text-[12.5px]" style={{ color: "var(--tx3)" }}>
          Giá trị hợp đồng {vndShort(s?.contractValue ?? 0)}
          {(s?.expenses ?? 0) > 0 ? ` · đã chi ${vndShort(s?.expenses ?? 0)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: FileText, k: "Hợp đồng", v: s?.contracts ?? 0 },
          { icon: CalendarRange, k: "Lịch tuần", v: s?.appointments ?? 0 },
          { icon: UserCog, k: "Nhân viên", v: s?.staff ?? 0 },
          { icon: UsersRound, k: "Thợ", v: s?.crew ?? 0 },
        ].map((m) => (
          <div key={m.k} className="rounded-[12px] px-2 py-2.5 text-center" style={{ background: "var(--sf2)" }}>
            <m.icon size={15} style={{ color: "var(--tx3)", margin: "0 auto" }} />
            <p className="v2-num mt-1 text-[16px] font-bold leading-none">{m.v}</p>
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>{m.k}</p>
          </div>
        ))}
      </div>

      <InfoList
        items={[
          { label: "Quản lý", value: manager ?? "Chưa chọn" },
          {
            label: "Địa chỉ",
            value: x.address ? (
              <span className="inline-flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 flex-none" style={{ color: "var(--tx3)" }} />{x.address}</span>
            ) : (
              "—"
            ),
          },
          {
            label: "Điện thoại",
            value: x.phone ? (
              <a href={`tel:${x.phone}`} className="inline-flex items-center gap-1.5" style={{ color: "var(--ac)" }}><Phone size={14} />{x.phone}</a>
            ) : (
              "—"
            ),
          },
        ]}
      />

      {people.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="v2-label">Nhân viên ở cơ sở này</p>
          <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
            {people.map((p) => (
              <div key={p.id} className="v2-row" style={{ padding: "10px 14px" }}>
                <Avatar name={p.full_name || p.email} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="v2-row-title text-[13.5px]">{p.full_name || p.email}</p>
                </div>
                <Badge tone="gray">{roleLabel(p.studio_role)}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {x.note ? (
        <div className="rounded-[12px] px-3.5 py-3 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx2)", whiteSpace: "pre-wrap" }}>
          {x.note}
        </div>
      ) : null}
    </div>
  );
}

function BranchForm({ draft, setDraft, staff }: { draft: Draft; setDraft: (d: Draft | null) => void; staff: BranchStaff[] }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Tên chi nhánh">
          <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Chi nhánh Quận 1" autoFocus />
        </Field>
        <Field label="Mã ngắn" hint="Hiện ở chỗ chật.">
          <input className={inputCls} value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="Q1" maxLength={12} />
        </Field>
      </div>
      <Field label="Địa chỉ">
        <input className={inputCls} value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="12 Nguyễn Huệ, Quận 1, TP.HCM" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Số điện thoại">
          <input className={inputCls} type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field
          label="Người quản lý"
          hint={
            staff.length === 0 ? (
              <>
                Chưa có tài khoản nhân viên nào —{" "}
                <Link href="/dashboard/studio/staff" style={{ color: "var(--ac)", fontWeight: 600 }}>tạo nhân viên</Link>.
              </>
            ) : undefined
          }
        >
          <select className={inputCls} value={draft.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
            <option value="">— Chưa chọn —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.full_name || s.email) + (s.studio_role ? ` · ${roleLabel(s.studio_role)}` : "")}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Ghi chú">
        <textarea className={inputCls} rows={2} value={draft.note} onChange={(e) => set("note", e.target.value)} placeholder="Giờ mở cửa, ghi chú riêng của cơ sở…" />
      </Field>
      <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
        <Switch
          checked={draft.active}
          onChange={(v) => set("active", v)}
          label="Đang hoạt động"
          desc="Tắt để tạm ẩn cơ sở đã đóng — không còn trong ô chọn khi gán dữ liệu mới, số liệu cũ vẫn tra được."
        />
      </div>
    </div>
  );
}
