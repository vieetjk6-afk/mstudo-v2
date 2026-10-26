"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import DateInput from "@/components/DateInput";
import { Badge, Card, Field, PageHead, Progress, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { Segmented, Switch } from "@/components/v2/kit-client";
import { fmtDate, fmtDayMonth } from "@/lib/date";
import {
  OWNER_LABEL, PLAN_WHEN, PRIORITY_LABEL, currentWhen, groupTasks, taskDone, taskDue, taskStats,
  type PlanTask, type PlanWhen, type TaskOwner, type TaskPriority,
} from "@/lib/wedding-plan";
import { listOps, type Ctx } from "../ui";
import { CheckV2, FormDrawer, RowMenu, SelectV2 } from "../uiV2";

type OwnerFilter = "all" | TaskOwner | "none";
const WHEN_OPTIONS = PLAN_WHEN.map((w) => [w.key, w.label] as [PlanWhen, string]);

/**
 * VIỆC CẦN LÀM (giao diện mới) — xếp theo mốc trước ngày cưới, mốc "bây giờ"
 * được làm nổi. Một nút chính "Thêm việc"; sửa mở ngăn kéo; lọc theo người lo
 * và ẩn việc đã xong gom một hàng. Cùng thao tác với tabs/Tasks.tsx.
 */
export default function TasksTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [hideDone, setHideDone] = useState(false);
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [editing, setEditing] = useState<PlanTask | null>(null);
  const [adding, setAdding] = useState(false);
  const now = currentWhen(plan.wedding_date, today);
  const stats = taskStats(plan.tasks, data.auto, plan.wedding_date, today);

  const byOwner = (t: PlanTask) => owner === "all" || (owner === "none" ? !t.owner : t.owner === owner);
  const groups = groupTasks(plan.tasks.filter(byOwner));
  const count = (k: OwnerFilter) => plan.tasks.filter((t) => (k === "all" ? true : k === "none" ? !t.owner : t.owner === k)).length;

  return (
    <Stack>
      <PageHead
        desc={<>Việc có dấu <Sparkles size={13} className="inline" style={{ color: "var(--ac)" }} /> tự đánh dấu xong khi {data.studio_name} cập nhật.</>}
        actions={!readOnly && (
          <button type="button" onClick={() => setAdding(true)} className={btn("primary")}>
            <Plus size={16} /> Thêm việc
          </button>
        )}
      />

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[15px] font-semibold">
            <span className="tnum">{stats.done}/{stats.total}</span> việc đã xong
          </p>
          <p className="tnum text-[13px]" style={{ color: stats.overdue ? "var(--rd)" : "var(--tx3)", fontWeight: stats.overdue ? 600 : 400 }}>
            {stats.overdue ? `${stats.overdue} việc quá hạn` : "Không có việc quá hạn"} · {stats.pct}%
          </p>
        </div>
        <div className="mt-2.5"><Progress value={stats.pct} /></div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<OwnerFilter>
          value={owner}
          onChange={setOwner}
          label="Lọc theo người lo"
          size="sm"
          options={[
            { value: "all", label: "Tất cả", count: count("all") },
            ...(Object.keys(OWNER_LABEL) as TaskOwner[]).map((k) => ({ value: k as OwnerFilter, label: OWNER_LABEL[k], count: count(k) })),
            { value: "none", label: "Chưa giao", count: count("none") },
          ]}
        />
        <div className="flex-none">
          <Switch checked={hideDone} onChange={setHideDone} label="Ẩn việc đã xong" />
        </div>
      </div>

      {groups.map(({ when: w, tasks }) => {
        const shown = hideDone ? tasks.filter((t) => !taskDone(t, data.auto)) : tasks;
        const doneCount = tasks.filter((t) => taskDone(t, data.auto)).length;
        const isNow = now === w.key;
        const due = taskDue({ id: "", title: "", when: w.key, done: false }, plan.wedding_date);
        return (
          <Section
            key={w.key}
            title={w.label}
            desc={due ? (w.key === "d0" ? fmtDate(due) : w.key === "after" ? `Trong 2 tuần sau cưới · trước ${fmtDate(due)}` : `Nên xong trước ${fmtDate(due)}`) : undefined}
            actions={
              <>
                {isNow && <Badge tone="brand" dot>Bây giờ</Badge>}
                <Badge tone={doneCount === tasks.length ? "green" : "gray"}>{doneCount}/{tasks.length}</Badge>
              </>
            }
            className={isNow ? "ring-[3px] ring-[var(--acS)] !border-[var(--acM)]" : undefined}
            flush
          >
            {shown.length === 0 ? (
              <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>Đã xong hết việc ở mốc này.</p>
            ) : (
              shown.map((t) => <TaskRow key={t.id} t={t} ctx={ctx} onEdit={() => setEditing(t)} />)
            )}
          </Section>
        );
      })}

      {plan.tasks.length > 0 && groups.length === 0 && (
        <Card><p className="text-[13.5px]" style={{ color: "var(--tx3)" }}>Không có việc nào khớp bộ lọc.</p></Card>
      )}

      {adding && <TaskAdd now={now} onClose={() => setAdding(false)} onAdd={(item) => ops.add("tasks", item)} />}
      {editing && (
        <TaskEdit
          t={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => ops.set("tasks", editing.id, patch)}
          onRemove={() => ops.remove("tasks", editing.id)}
        />
      )}
    </Stack>
  );
}

function TaskRow({ t, ctx, onEdit }: { t: PlanTask; ctx: Ctx; onEdit: () => void }) {
  const { data, plan, today, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const auto = t.link ? data.auto[t.link] : undefined;
  const byStudio = !!auto?.done;
  const done = t.done || byStudio;
  const due = taskDue(t, plan.wedding_date);
  const overdue = !done && !!due && due < today && t.when !== "after";
  return (
    <div className="v2-row items-start">
      <CheckV2
        on={done}
        label={done ? `Bỏ đánh dấu: ${t.title}` : `Đánh dấu xong: ${t.title}`}
        title={byStudio ? `${data.studio_name} đã ghi nhận việc này` : undefined}
        disabled={readOnly || byStudio}
        onClick={() => ops.set("tasks", t.id, { done: !t.done })}
      />
      <div className="min-w-0 flex-1 pt-[1px]">
        {readOnly ? (
          <p className="text-[14px] font-medium leading-snug" style={{ color: done ? "var(--tx3)" : "var(--tx)", textDecoration: done ? "line-through" : undefined, textWrap: "pretty" }}>{t.title}</p>
        ) : (
          <button type="button" onClick={onEdit} className="block text-left text-[14px] font-medium leading-snug" style={{ color: done ? "var(--tx3)" : "var(--tx)", textDecoration: done ? "line-through" : undefined, textWrap: "pretty" }}>
            {t.title}
          </button>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
          {overdue && <Badge tone="red">Quá hạn</Badge>}
          {t.priority === "high" && !done && <Badge tone="amber">{PRIORITY_LABEL.high}</Badge>}
          {t.priority === "low" && <Badge>Ưu tiên thấp</Badge>}
          {t.owner && <Badge tone="blue">{OWNER_LABEL[t.owner]}</Badge>}
          {t.due && <Badge tone={overdue ? "red" : "gray"}>Hạn {fmtDayMonth(t.due)}</Badge>}
        </div>
        {auto?.sub && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <Sparkles size={13} style={{ flex: "none", color: "var(--ac)" }} /> {auto.sub}
            {auto.href === "#thiep" && ctx.openInvite ? (
              // Quà cưới: thiệp sửa ngay trong trang này.
              <button type="button" onClick={ctx.openInvite} className="font-semibold" style={{ color: "var(--ac)" }}>
                Mở thiệp
              </button>
            ) : auto.href && (
              <Link href={auto.href} className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--ac)" }}>
                Mở <ExternalLink size={12} />
              </Link>
            )}
          </p>
        )}
        {t.note && <p className="mt-1 whitespace-pre-line text-[12.5px]" style={{ color: "var(--tx2)" }}>{t.note}</p>}
      </div>
      {!readOnly && <RowMenu label={t.title} onEdit={onEdit} onRemove={() => ops.remove("tasks", t.id)} />}
    </div>
  );
}

function TaskAdd({ now, onClose, onAdd }: { now: PlanWhen | null; onClose: () => void; onAdd: (item: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<PlanWhen>(now && now !== "after" ? now : "m3");
  const [owner, setOwner] = useState<TaskOwner | "">("");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm việc"
      desc="Việc được xếp vào mốc bạn chọn — đổi ngày cưới là mốc tự dời theo."
      submitLabel="Thêm việc"
      canSubmit={!!title.trim()}
      onSubmit={() => {
        onAdd({ title, when, ...(owner ? { owner } : {}) });
        onClose();
      }}
    >
      <Field label="Việc" className="sm:col-span-2">
        <input className={inputCls} placeholder="Ví dụ: Đặt bánh cưới" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Mốc">
        <SelectV2 value={when} options={WHEN_OPTIONS} onChange={(v) => setWhen((v || "m3") as PlanWhen)} ariaLabel="Mốc thời gian" />
      </Field>
      <Field label="Ai lo">
        <SelectV2 value={owner} options={OWNER_LABEL} onChange={setOwner} empty="Chưa giao" ariaLabel="Người phụ trách" />
      </Field>
    </FormDrawer>
  );
}

function TaskEdit({ t, onClose, onSave, onRemove }: { t: PlanTask; onClose: () => void; onSave: (patch: Record<string, unknown>) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [when, setWhen] = useState<PlanWhen>(t.when);
  const [due, setDue] = useState(t.due ?? "");
  const [owner, setOwner] = useState<TaskOwner | "">(t.owner ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(t.priority ?? "");
  const [note, setNote] = useState(t.note ?? "");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Sửa việc"
      canSubmit={!!title.trim()}
      onRemove={onRemove}
      onSubmit={() => {
        onSave({ title, when, due, owner, priority, note });
        onClose();
      }}
    >
      <Field label="Việc" className="sm:col-span-2">
        <input className={inputCls} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Mốc">
        <SelectV2 value={when} options={WHEN_OPTIONS} onChange={(v) => setWhen((v || "m3") as PlanWhen)} ariaLabel="Mốc" />
      </Field>
      <Field label="Hạn riêng" hint="Không bắt buộc — thay cho hạn của mốc.">
        <DateInput value={due} onChange={setDue} allowPast className={inputCls} />
      </Field>
      <Field label="Ai lo">
        <SelectV2 value={owner} options={OWNER_LABEL} onChange={setOwner} empty="Chưa giao" ariaLabel="Ai lo" />
      </Field>
      <Field label="Ưu tiên">
        <SelectV2 value={priority} options={PRIORITY_LABEL} onChange={setPriority} empty="Bình thường" ariaLabel="Ưu tiên" />
      </Field>
      <Field label="Ghi chú" className="sm:col-span-2">
        <textarea className={inputCls} rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Tên tiệm, số điện thoại, việc cần nhớ…" />
      </Field>
    </FormDrawer>
  );
}
