"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckSquare,
  Download,
  FolderPlus,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import { Avatar, Badge, Callout, Empty, Field, Progress, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, Modal, type MenuItem } from "@/components/v2/kit-client";
import { CREW_STATUS_LABEL, vnd, type CrewStatus } from "@/lib/types";
import { mainUrl } from "@/lib/hosts";
import { googleCalendarUrl, downloadIcs, type CalEvent } from "@/lib/calendar";
import { crewRoleLabel } from "@/lib/crew-roles";
import { CREW_SIDE_LABEL, CREW_TASK_LABEL } from "@/lib/crew-show";
import { PRESET_TASKS_BY_KIND } from "@/lib/contract-kind";
import ContractAppointmentsV2 from "./ContractAppointmentsV2";
import { CREW_TONE, CrewFaces, DateTile, relDay, sessionWhen, sessionsOf, toneText, type Session, type V2Ctx } from "./ContractV2Shared";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab Ê-KÍP & LỊCH (giao diện mới):
     • Lịch chụp — buổi chính + từng mốc, mỗi buổi một thẻ gọn: ngày, giờ, nơi,
       ai làm, MỘT nút "Phân công" và menu ⋯ (Google Lịch, .ics, sửa, xoá).
     • Ê-kíp — mỗi người một dòng; bấm để sửa trong ngăn kéo (lưu là báo thợ).
     • Phụ trách & chi nhánh, lịch hẹn dịch vụ, checklist công việc.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractV2Crew({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { f, crew } = ed;
  const { contract, roster, staffList, canAssign, branches, branchLocked, ownerId, initialAppointments, crewRoles } = ed.props;
  const sessions = sessionsOf(ed);
  const [msEdit, setMsEdit] = useState<{ id: string | null } | null>(null);
  const unsaved = crew.filter(ed.crewRowDirty).length;

  return (
    <>
      {/* ── Lịch chụp ── */}
      <Section
        title="Lịch chụp"
        icon={CalendarDays}
        desc="Buổi chính và các mốc (thử đồ, đãi tiệc, trao ảnh…) — hiện trên Lịch, lịch thợ và cổng khách."
        actions={
          <button type="button" className={btn("secondary", "sm")} onClick={() => setMsEdit({ id: null })} aria-label="Thêm buổi hoặc mốc lịch">
            <Plus size={15} /> <span className="hidden sm:inline">Thêm buổi</span>
          </button>
        }
        flush
      >
        <ul>
          {sessions.map((s) => (
            <SessionCard key={s.key} ctx={ctx} s={s} onEdit={() => setMsEdit({ id: s.id })} />
          ))}
        </ul>
      </Section>

      {/* ── Ê-kíp ── */}
      <Section
        title="Ê-kíp"
        icon={Users}
        desc={crew.length ? `${ed.activeCrew.length} người · tổng tiền công ${vnd(ed.payroll)} · đã trả ${vnd(ed.paidPayroll)}` : "Ai làm hợp đồng này và tiền công của từng người."}
        actions={
          <>
            <button type="button" className={btn("secondary", "sm")} onClick={() => ctx.openCrew(null)} aria-label="Thêm người vào ê-kíp">
              <UserPlus size={15} /> <span className="hidden sm:inline">Thêm người</span>
            </button>
            <Menu
              label="Thao tác ê-kíp"
              width={240}
              items={[
                {
                  label: ed.driveBusy ? "Đang tạo…" : "Tạo thư mục Drive cho hợp đồng",
                  icon: FolderPlus,
                  onClick: ed.makeDriveFolder,
                  disabled: ed.driveBusy,
                  hint: "Bấm lại không tạo trùng",
                },
              ]}
            />
          </>
        }
        flush
      >
        {(ed.driveMsg || ed.crewDebug) && (
          <div className="flex flex-col gap-2 px-4 pt-4 sm:px-5">
            {ed.driveMsg && (
              <Callout
                tone={ed.driveMsg.startsWith("Đã tạo") ? "green" : "red"}
                icon={FolderPlus}
                action={
                  <button type="button" className={iconBtn()} aria-label="Đóng" onClick={() => ed.setDriveMsg(null)}>
                    <X size={16} />
                  </button>
                }
              >
                <span className="break-all">{ed.driveMsg}</span>
              </Callout>
            )}
            {ed.crewDebug && (
              <Callout
                tone="amber"
                icon={AlertTriangle}
                title="Kết quả lưu nhân sự"
                action={
                  <button type="button" className={iconBtn()} aria-label="Đóng" onClick={() => ed.setCrewDebug(null)}>
                    <X size={16} />
                  </button>
                }
              >
                <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px]">{ed.crewDebug}</pre>
              </Callout>
            )}
          </div>
        )}

        {crew.length === 0 ? (
          <Empty
            compact
            icon={UserPlus}
            title="Chưa có ai trong ê-kíp"
            hint={roster.length ? "Chọn nhanh từ sổ thợ hoặc nhập tay." : "Thêm người làm, tiền công và giờ làm của từng người."}
            action={
              <button type="button" className={btn("secondary")} onClick={() => ctx.openCrew(null)}>
                <UserPlus size={16} /> Thêm người
              </button>
            }
          />
        ) : (
          <ul className="mt-1">
            {crew.map((c, idx) => {
              const st = (c.status || "pending") as CrewStatus;
              const ev = c.eventId ? ed.milestones.find((m) => m.id === c.eventId) : null;
              const clash = c.phone && !c.eventId ? ed.conflictFor(c.phone) : null;
              const dirty = ed.crewRowDirty(c);
              const facts = [
                crewRoleLabel(c.role, crewRoles),
                ev ? ev.title : ed.milestones.length ? "Buổi chính" : null,
                c.start || c.end ? `${c.start || "?"}–${c.end || "?"}` : null,
                c.task ? CREW_TASK_LABEL[c.task] : null,
                c.side ? CREW_SIDE_LABEL[c.side] : null,
              ].filter(Boolean);
              const menu: MenuItem[] = [
                { label: "Sửa", icon: Pencil, onClick: () => ctx.openCrew(idx) },
                ...(c.id
                  ? [{ label: c.paid ? "Bỏ đánh dấu đã trả tiền công" : "Đánh dấu đã trả tiền công", icon: Wallet, onClick: () => ed.togglePaid(c, idx) }]
                  : []),
                "divider",
                {
                  label: "Xoá khỏi ê-kíp",
                  icon: Trash2,
                  danger: true,
                  onClick: () =>
                    ctx.ask({
                      title: `Xoá ${c.name || c.phone || "người này"} khỏi ê-kíp?`,
                      desc: "Người này không còn thấy việc của hợp đồng trên cổng thợ.",
                      confirm: "Xoá khỏi ê-kíp",
                      danger: true,
                      run: () => ed.deleteCrew(c.id, idx),
                    }),
                },
              ];
              return (
                <li key={c.id ?? `n${idx}`} className="relative flex items-start gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                  <button type="button" className="absolute inset-0" aria-label={`Sửa ${c.name || c.phone || "người này"}`} onClick={() => ctx.openCrew(idx)} />
                  <Avatar name={c.name || c.phone || "?"} size={38} />
                  <div className="pointer-events-none min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-[14px] font-semibold">{c.name || c.phone || "Chưa đặt tên"}</p>
                      <Badge tone={CREW_TONE[st] ?? "gray"} dot>
                        {CREW_STATUS_LABEL[st]}
                      </Badge>
                      {dirty && <Badge tone="amber">Chưa lưu</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
                      {facts.join(" · ")}
                    </p>
                    {clash && (
                      <p className="mt-1 flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--rd)" }}>
                        <AlertTriangle size={13} /> {clash} (ngày {f.event_date})
                      </p>
                    )}
                    {c.note && (
                      <p className="mt-1 truncate text-[12.5px]" style={{ color: "var(--tx2)" }}>
                        “{c.note}”
                      </p>
                    )}
                  </div>
                  <div className="pointer-events-none flex-none text-right">
                    <p className="v2-num text-[13.5px] font-semibold">{vnd(c.salary || 0)}</p>
                    <p className="text-[12px] font-medium" style={{ color: c.paid ? "var(--gn)" : "var(--tx3)" }}>
                      {c.paid ? "Đã trả" : "Chưa trả"}
                    </p>
                  </div>
                  <div className="relative -mr-1.5 flex-none">
                    <Menu items={menu} label={`Thao tác cho ${c.name || "người này"}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5">
          {unsaved > 0 && (
            <Callout
              tone="amber"
              title={`${unsaved} người có thay đổi chưa lưu`}
              action={
                <button type="button" className={btn("primary", "sm")} onClick={ed.saveCrew} disabled={ed.busy === "crew"}>
                  {ed.busy === "crew" ? "Đang lưu…" : "Lưu nhân sự & lương"}
                </button>
              }
            >
              Lưu để cập nhật lịch của thợ.
            </Callout>
          )}
          <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
            Thợ tự nhập SĐT tại {mainUrl("/crew")} để xem việc &amp; tiền công rồi nhận / từ chối.
          </p>
        </div>
      </Section>

      {/* ── Phụ trách & chi nhánh: "ai / ở đâu làm việc này" ── */}
      {((canAssign && staffList.length > 0) || branches.length > 0) && (
        <Section title="Phụ trách & chi nhánh" icon={Building2} desc="Tự lưu khi chọn.">
          <div className="grid gap-4 sm:grid-cols-2">
            {canAssign && staffList.length > 0 && (
              <Field label="Giao cho nhân viên" htmlFor="cr-staff" hint="Nhân viên chỉ thấy hợp đồng được giao cho mình.">
                <select id="cr-staff" className={inputCls} value={f.assigned_to} onChange={(e) => ed.set("assigned_to", e.target.value)}>
                  <option value="">— Chưa giao —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {branches.length > 0 && (
              <Field
                label="Chi nhánh thực hiện"
                htmlFor="cr-branch"
                hint={
                  branchLocked
                    ? "Bạn quản lý một chi nhánh nên không chuyển được hợp đồng sang cơ sở khác — nhờ chủ studio hoặc quản lý chung."
                    : "Tính doanh thu và lịch vào cơ sở nào."
                }
              >
                <select id="cr-branch" className={inputCls} value={f.branch_id} disabled={branchLocked} onChange={(e) => ed.set("branch_id", e.target.value)}>
                  <option value="">— Chưa gán chi nhánh —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </Section>
      )}

      {/* Lịch hẹn dịch vụ — cùng bảng studio_appointments với màn Lịch studio. */}
      <ContractAppointmentsV2
        ownerId={ownerId}
        contractId={contract.id}
        clientName={f.client_name}
        clientPhone={f.client_phone}
        initial={initialAppointments}
        roster={roster}
        canEdit={canAssign}
      />

      <Checklist ctx={ctx} />

      {msEdit && <MilestoneModal ctx={ctx} id={msEdit.id} onClose={() => setMsEdit(null)} />}
    </>
  );
}

/* ── Một buổi chụp ── */
function SessionCard({ ctx, s, onEdit }: { ctx: V2Ctx; s: Session; onEdit: () => void }) {
  const { ed } = ctx;
  const { f } = ed;
  const live = s.crew.filter((c) => (c.row.status || "pending") !== "declined").map((c) => c.row);
  const pending = live.filter((c) => (c.status || "pending") === "pending").length;
  const rel = relDay(s.date);
  const past = !!s.date && s.date < ed.todayStr;
  const ev: CalEvent | null = s.date ? { date: s.date, time: s.time, title: s.main ? f.title : s.title, location: f.location } : null;
  const cancelled = f.status === "cancelled";

  const menu: MenuItem[] = [
    ...(ev
      ? [
          { label: "Thêm vào Google Calendar", icon: CalendarPlus, href: googleCalendarUrl(ev), external: true },
          { label: "Tải file lịch (.ics)", icon: Download, onClick: () => downloadIcs(ev.title || "su-kien", ev) },
          "divider" as const,
        ]
      : []),
    ...(s.main
      ? [
          { label: "Sửa ngày, giờ, địa điểm", icon: Pencil, onClick: ctx.openInfo },
          ...(!cancelled ? [{ label: "Dời lịch", icon: CalendarClock, onClick: () => ed.setChangeDlg("reschedule"), hint: "Báo khách, chuyển lịch thợ theo" }] : []),
        ]
      : [
          { label: "Sửa tên, ngày, giờ", icon: Pencil, onClick: onEdit },
          {
            label: "Xoá mốc này",
            icon: Trash2,
            danger: true,
            onClick: () =>
              ctx.ask({
                title: `Xoá mốc “${s.title}”?`,
                desc: s.crew.length
                  ? "Mốc bị gỡ khỏi lịch. Thợ của mốc này chuyển về buổi chính — lưu lại ê-kíp để lịch thợ đổi theo."
                  : "Mốc bị gỡ khỏi lịch (cả Google Lịch nếu đã đồng bộ).",
                confirm: "Xoá mốc",
                danger: true,
                run: () => ed.deleteMilestone(s.id!),
              }),
          },
        ]),
  ];

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:flex-nowrap sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <DateTile iso={s.date} muted={past} />
      <div className="min-w-0 flex-1 basis-[200px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[14.5px] font-semibold">{s.title}</p>
          {s.main && <Badge tone="brand">Buổi chính</Badge>}
          {!live.length && s.date && !past && (
            <Badge tone="amber" icon={UserPlus}>
              Chưa có thợ
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          {sessionWhen(s)}
          {rel && (
            <span style={{ color: past ? "var(--tx3)" : toneText(rel.tone), fontWeight: past ? 400 : 600 }}> · {rel.text}</span>
          )}
        </p>
        {s.main && f.location && (
          <p className="mt-1 flex gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <MapPin size={14} className="mt-[1px] flex-none" />
            <span className="line-clamp-2">{f.location}</span>
          </p>
        )}
        {live.length > 0 && (
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <CrewFaces rows={live} />
            <span className="truncate text-[12.5px]" style={{ color: "var(--tx2)" }}>
              {live.map((c) => c.name || c.phone).join(", ")}
            </span>
            {pending > 0 && <Badge tone="amber">{pending} chờ nhận</Badge>}
          </div>
        )}
      </div>
      <div className="flex w-full flex-none items-center justify-end gap-1.5 sm:w-auto sm:self-center">
        {s.date ? (
          <button type="button" className={btn("secondary", "sm")} onClick={() => ctx.openCrew(null, s.id ?? "")}>
            <UserPlus size={15} /> Phân công
          </button>
        ) : (
          <button type="button" className={btn("secondary", "sm")} onClick={ctx.openInfo}>
            <CalendarDays size={15} /> Đặt ngày
          </button>
        )}
        <Menu items={menu} label={`Thao tác cho ${s.title}`} width={240} />
      </div>
    </li>
  );
}

/* ── Thêm / sửa mốc lịch ── */
function MilestoneModal({ ctx, id, onClose }: { ctx: V2Ctx; id: string | null; onClose: () => void }) {
  const { ed } = ctx;
  const m = id ? ed.milestones.find((x) => x.id === id) : null;
  // Thêm mới: dùng đúng form `ms` của hook (addMilestone đọc từ đó).
  const [edit, setEdit] = useState(() => (m ? { title: m.title, event_date: m.event_date, event_time: m.event_time ?? "" } : null));
  const v = edit ?? ed.ms;
  const put = (patch: Partial<typeof v>) => (edit ? setEdit({ ...edit, ...patch }) : ed.setMs((p) => ({ ...p, ...patch })));
  const [saving, setSaving] = useState(false);
  const busy = saving || ed.busy === "milestone" || ed.busy === "crew";

  async function save() {
    if (m && edit) {
      setSaving(true);
      const ok = await ed.updateMilestone(m.id, edit);
      setSaving(false);
      if (ok) onClose();
    } else if (await ed.addMilestone()) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={CalendarPlus}
      title={m ? "Sửa mốc lịch" : "Thêm buổi / mốc lịch"}
      desc={m ? "Thợ được gán vào mốc này sẽ thấy lịch đổi theo." : "vd: chụp pre-wedding, thử đồ, ngày cưới, trao ảnh. Mốc hiện trên Lịch và cổng khách."}
      width={480}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Thôi
          </button>
          <button type="button" className={btn("primary")} onClick={save} disabled={busy || !v.event_date}>
            {busy ? "Đang lưu…" : m ? "Lưu" : "Thêm mốc"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên mốc" htmlFor="ms-title">
          <input id="ms-title" className={inputCls} autoFocus placeholder="vd: Ngày cưới" value={v.title} onChange={(e) => put({ title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_130px]">
          <Field label="Ngày">
            <DateInput className={inputCls} value={v.event_date} onChange={(d) => put({ event_date: d })} />
          </Field>
          <Field label="Giờ" htmlFor="ms-time">
            <input id="ms-time" className={inputCls} placeholder="08:00" value={v.event_time} onChange={(e) => put({ event_time: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ── Checklist công việc ── */
function Checklist({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { tasks, tasksDone } = ed;
  const presets = PRESET_TASKS_BY_KIND[ed.kind].filter((label) => !tasks.some((t) => t.label === label));
  return (
    <Section
      title="Checklist công việc"
      icon={CheckSquare}
      desc={tasks.length ? `${tasksDone}/${tasks.length} việc đã xong` : "vd: đặt cọc, chụp, chọn ảnh, retouch, in album, giao."}
    >
      {tasks.length > 0 && (
        <div className="mb-3">
          <Progress value={(tasksDone / tasks.length) * 100} tone="green" />
        </div>
      )}
      {tasks.length > 0 && (
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <li key={t.id} className="group flex items-center gap-3 py-1.5">
              <button
                type="button"
                onClick={() => ed.toggleTask(t)}
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.label}
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px]"
                style={{ border: `1.5px solid ${t.done ? "var(--gn)" : "var(--bdS, var(--bd))"}`, background: t.done ? "var(--gn)" : "var(--sf)" }}
              >
                {t.done && <Check size={14} color="#fff" strokeWidth={3} />}
              </button>
              <span className="min-w-0 flex-1 text-[14px]" style={{ color: t.done ? "var(--tx3)" : "var(--tx)", textDecoration: t.done ? "line-through" : "none" }}>
                {t.label}
              </span>
              <button
                type="button"
                className={iconBtn("!h-8 !w-8")}
                aria-label={`Xoá việc ${t.label}`}
                title="Xoá việc"
                onClick={() =>
                  ctx.ask({ title: "Xoá việc này khỏi checklist?", desc: t.label, confirm: "Xoá việc", danger: true, run: () => ed.deleteTask(t.id) })
                }
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={`flex gap-2 ${tasks.length ? "mt-3" : ""}`}>
        <input
          className={inputCls}
          placeholder="Thêm việc…"
          aria-label="Thêm việc"
          value={ed.newTask}
          onChange={(e) => ed.setNewTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ed.addTask();
          }}
        />
        <button type="button" className={btn("secondary")} onClick={ed.addTask} disabled={!ed.newTask.trim()}>
          <Plus size={16} /> Thêm
        </button>
      </div>
      {presets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {presets.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => ed.addTaskLabel(label)}
              className="max-w-full truncate rounded-full px-2.5 py-1 text-[12.5px] font-medium"
              style={{ border: "1px dashed var(--bd)", color: "var(--tx2)" }}
            >
              + {label}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
