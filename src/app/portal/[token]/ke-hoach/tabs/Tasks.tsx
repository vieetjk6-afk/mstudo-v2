"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import DateInput from "@/components/DateInput";
import { fmtDate, fmtDayMonth } from "@/lib/date";
import {
  OWNER_LABEL, PLAN_WHEN, PRIORITY_LABEL, currentWhen, groupTasks, taskDone, taskDue, taskStats,
  type PlanTask, type PlanWhen, type TaskOwner, type TaskPriority,
} from "@/lib/wedding-plan";
import {
  AddForm, CheckCircle, Chips, Field, GhostBtn, Pill, PrimaryBtn, RowActions, Select, card, listOps, type Ctx,
} from "../ui";

type OwnerFilter = "all" | TaskOwner | "none";
const WHEN_OPTIONS = PLAN_WHEN.map((w) => [w.key, w.label] as [PlanWhen, string]);

/**
 * VIỆC CẦN LÀM — xếp theo mốc trước ngày cưới. Mỗi việc có thể gán người lo,
 * mức ưu tiên và hạn riêng (thay hạn của mốc). Lọc theo người để cô dâu / chú rể
 * mỗi người xem phần của mình.
 */
export default function TasksTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [hideDone, setHideDone] = useState(false);
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const now = currentWhen(plan.wedding_date, today);
  const stats = taskStats(plan.tasks, data.auto, plan.wedding_date, today);

  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<PlanWhen>(now && now !== "after" ? now : "m3");
  const [newOwner, setNewOwner] = useState<TaskOwner | "">("");

  const byOwner = (t: PlanTask) => owner === "all" || (owner === "none" ? !t.owner : t.owner === owner);
  const groups = groupTasks(plan.tasks.filter(byOwner));
  const count = (k: OwnerFilter) => plan.tasks.filter((t) => (k === "all" ? true : k === "none" ? !t.owner : t.owner === k)).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-2 rounded-[14px] px-3 py-3 text-center" style={card}>
        {[
          ["Tổng", stats.total, "var(--tx)"],
          ["Đã xong", stats.done, "var(--gn)"],
          ["Quá hạn", stats.overdue, stats.overdue ? "var(--rd)" : "var(--tx3)"],
          ["Tiến độ", `${stats.pct}%`, "var(--ac)"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="min-w-0">
            <p className="text-[11px] font-bold" style={{ color: "var(--tx3)" }}>{label}</p>
            <p className="tnum text-[19px] font-bold" style={{ color: color as string, letterSpacing: "-.5px" }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Chips<OwnerFilter>
          value={owner}
          onChange={setOwner}
          options={[
            ["all", "Tất cả", count("all")],
            ...(Object.keys(OWNER_LABEL) as TaskOwner[]).map((k) => [k, OWNER_LABEL[k], count(k)] as [OwnerFilter, string, number]),
            ["none", "Chưa giao", count("none")],
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Việc có dấu <Sparkles size={12} className="inline" style={{ color: "var(--ac)" }} /> tự đánh dấu xong khi {data.studio_name} cập nhật.
          </p>
          <label className="flex flex-none cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
            <input type="checkbox" className="h-4 w-4 accent-[var(--ac)]" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Ẩn việc đã xong
          </label>
        </div>
      </div>

      {groups.map(({ when: w, tasks }) => {
        const shown = hideDone ? tasks.filter((t) => !taskDone(t, data.auto)) : tasks;
        const doneCount = tasks.filter((t) => taskDone(t, data.auto)).length;
        const isNow = now === w.key;
        const due = taskDue({ id: "", title: "", when: w.key, done: false }, plan.wedding_date);
        return (
          <section key={w.key} className="rounded-[16px] px-5 pb-2 pt-4" style={isNow ? { ...card, borderColor: "var(--acM)", boxShadow: "0 0 0 3px var(--acS)" } : card}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[15px] font-bold">{w.label}</h3>
              {isNow && <Pill tone="ac">Bây giờ</Pill>}
              <span className="tnum ml-auto flex-none text-[12px] font-bold" style={{ color: doneCount === tasks.length ? "var(--gn)" : "var(--tx3)" }}>
                {doneCount}/{tasks.length}
              </span>
            </div>
            {due && (
              <p className="tnum mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                {w.key === "d0" ? fmtDate(due) : w.key === "after" ? `Trong 2 tuần sau cưới · trước ${fmtDate(due)}` : `Nên xong trước ${fmtDate(due)}`}
              </p>
            )}
            {shown.length === 0 ? (
              <p className="py-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Đã xong hết việc ở mốc này.</p>
            ) : (
              <ul className="mt-1.5">
                {shown.map((t) =>
                  editing === t.id ? (
                    <TaskEdit key={t.id} t={t} onDone={() => setEditing(null)} onSave={(patch) => ops.set("tasks", t.id, patch)} />
                  ) : (
                    <TaskRow key={t.id} t={t} ctx={ctx} onEdit={() => setEditing(t.id)} />
                  ),
                )}
              </ul>
            )}
          </section>
        );
      })}

      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!title.trim()) return;
            ops.add("tasks", { title, when, ...(newOwner ? { owner: newOwner } : {}) });
            setTitle("");
          }}
        >
          <input className="input w-auto min-w-[200px] flex-1 px-3 py-2.5" placeholder="Thêm việc của bạn…" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <Select value={when} options={WHEN_OPTIONS} onChange={(v) => setWhen((v || "m3") as PlanWhen)} ariaLabel="Mốc thời gian" />
          <Select value={newOwner} options={OWNER_LABEL} onChange={setNewOwner} empty="Ai lo?" ariaLabel="Người phụ trách" />
          <PrimaryBtn disabled={!title.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </div>
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
    <li className="flex items-start gap-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
      <CheckCircle
        on={done}
        label={done ? `Bỏ đánh dấu: ${t.title}` : `Đánh dấu xong: ${t.title}`}
        title={byStudio ? `${data.studio_name} đã ghi nhận việc này` : undefined}
        disabled={readOnly || byStudio}
        onClick={() => ops.set("tasks", t.id, { done: !t.done })}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold" style={{ color: done ? "var(--tx3)" : "var(--tx)", textDecoration: done ? "line-through" : undefined, textWrap: "pretty" }}>
          {t.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          {overdue && <Pill tone="rd">Quá hạn</Pill>}
          {t.priority === "high" && !done && <Pill tone="am">{PRIORITY_LABEL.high}</Pill>}
          {t.priority === "low" && <Pill>Ưu tiên thấp</Pill>}
          {t.owner && <Pill tone="bl">{OWNER_LABEL[t.owner]}</Pill>}
          {t.due && <Pill tone={overdue ? "rd" : "nu"}>Hạn {fmtDayMonth(t.due)}</Pill>}
        </div>
        {auto?.sub && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
            <Sparkles size={12} style={{ flex: "none", color: "var(--ac)" }} /> {auto.sub}
            {auto.href === "#thiep" && ctx.openInvite ? (
              // Quà cưới: thiệp sửa ngay trong trang này.
              <button type="button" onClick={ctx.openInvite} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--ac)" }}>
                Mở thiệp
              </button>
            ) : auto.href && (
              <Link href={auto.href} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--ac)" }}>
                Mở <ExternalLink size={12} />
              </Link>
            )}
          </p>
        )}
        {t.note && <p className="mt-1 whitespace-pre-line text-[12px]" style={{ color: "var(--tx2)" }}>{t.note}</p>}
      </div>
      {!readOnly && <RowActions label={t.title} onEdit={onEdit} onRemove={() => ops.remove("tasks", t.id)} />}
    </li>
  );
}

function TaskEdit({ t, onDone, onSave }: { t: PlanTask; onDone: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState(t.title);
  const [when, setWhen] = useState<PlanWhen>(t.when);
  const [due, setDue] = useState(t.due ?? "");
  const [owner, setOwner] = useState<TaskOwner | "">(t.owner ?? "");
  const [priority, setPriority] = useState<TaskPriority | "">(t.priority ?? "");
  const [note, setNote] = useState(t.note ?? "");
  return (
    <li className="py-3" style={{ borderTop: "1px solid var(--bd2)" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({ title, when, due, owner, priority, note });
          onDone();
        }}
        className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2"
      >
        <Field label="Việc" className="min-[560px]:col-span-2">
          <input className="input px-3 py-2.5" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Mốc">
          <Select value={when} options={WHEN_OPTIONS} onChange={(v) => setWhen((v || "m3") as PlanWhen)} className="w-full" />
        </Field>
        <Field label="Hạn riêng (không bắt buộc)">
          <DateInput value={due} onChange={setDue} allowPast />
        </Field>
        <Field label="Ai lo">
          <Select value={owner} options={OWNER_LABEL} onChange={setOwner} empty="Chưa giao" className="w-full" />
        </Field>
        <Field label="Ưu tiên">
          <Select value={priority} options={PRIORITY_LABEL} onChange={setPriority} empty="Bình thường" className="w-full" />
        </Field>
        <Field label="Ghi chú" className="min-[560px]:col-span-2">
          <textarea className="input px-3 py-2.5" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Tên tiệm, số điện thoại, việc cần nhớ…" />
        </Field>
        <div className="flex justify-end gap-2 min-[560px]:col-span-2">
          <GhostBtn onClick={onDone}>Huỷ</GhostBtn>
          <PrimaryBtn disabled={!title.trim()}>Lưu</PrimaryBtn>
        </div>
      </form>
    </li>
  );
}
