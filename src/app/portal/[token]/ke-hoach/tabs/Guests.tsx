"use client";

import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Heart, Mail, MailCheck, Plus, Search, TriangleAlert, Upload, UserPlus } from "lucide-react";
import { parseGuestFile } from "@/lib/guest-import";
import { vnd } from "@/lib/types";
import {
  GUEST_GROUP_LABEL, RSVP_LABEL, guestCount, guestRsvp, guestSummary, tableSummary, tablesNeeded,
  type GuestGroup, type PlanGuest, type Rsvp,
} from "@/lib/wedding-plan";
import {
  AddForm, Chips, CommitInput, Field, GhostBtn, MoneyField, Pill, PrimaryBtn, RowActions, Section, Select,
  card, listOps, rowLine, type Ctx, type Tone,
} from "../ui";

type View = "list" | "tables";
type GroupFilter = "all" | GuestGroup;
const RSVP_TONE: Record<Rsvp, Tone> = { pending: "nu", yes: "gn", no: "rd" };
const NEXT_RSVP: Record<Rsvp, Rsvp> = { pending: "yes", yes: "no", no: "pending" };
const PAGE = 100;

const key = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * KHÁCH MỜI — danh sách theo nhóm (họ hàng hai bên, bạn bè, đồng nghiệp), số
 * người của từng lời mời, đã gửi thiệp chưa, xác nhận tham dự, bàn, tiền mừng,
 * đã cảm ơn. Phản hồi gửi qua thiệp online tự khớp theo tên và thắng phần ghi
 * tay — cặp đôi không phải ngồi đối chiếu.
 *
 * Danh sách trong thiệp (để tạo link mời riêng) là một danh sách khác; nút "Nhập
 * từ thiệp" chép tên từ đó sang đây một lần.
 */
export default function GuestsTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const [view, setView] = useState<View>(ctx.guestView ?? "list");
  const s = guestSummary(plan.guests, replies);
  const tables = tableSummary(plan.guests, replies, plan.settings.table_size);
  const over = tables.filter((t) => t.over).length;

  // Tên trong thiệp chưa có ở đây — để nút "Nhập từ thiệp" biết còn bao nhiêu.
  const have = new Set(plan.guests.map((g) => key(g.name)));
  const fromInvite = (data.invite?.names ?? []).filter((n) => !have.has(key(n)));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4 min-[600px]:gap-3">
        <Box label="Sẽ đến" value={`${s.people}`} hint={`${s.entries} lời mời`} />
        <Box label="Đã xác nhận" value={`${s.yes}`} hint={`${s.pending} chưa phản hồi · ${s.no} không dự`} color="var(--gn)" />
        <Box
          label="Bàn cần đặt"
          value={`~${tablesNeeded(s.people, plan.settings.table_size)}`}
          hint={over ? `${over} bàn vượt sức chứa` : s.unseated ? `${s.unseated} người chưa xếp bàn` : `${plan.settings.table_size} người / bàn`}
          hintColor={over ? "var(--rd)" : undefined}
        />
        <Box label="Tiền mừng" value={vnd(s.gifts)} hint={`${s.thanked}/${s.entries} đã gửi lời cảm ơn`} />
      </div>

      {plan.guests.length === 0 && !readOnly && (
        <label className="flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-3 text-[12.5px]" style={card}>
          <span className="font-semibold">Chưa có danh sách — dự kiến khoảng</span>
          <input
            type="number"
            min={0}
            max={5000}
            className="input w-[96px] px-3 py-2 text-center"
            defaultValue={plan.settings.guests_expected || ""}
            onBlur={(e) => onOp({ op: "set_settings", guests_expected: Number(e.target.value) || 0 })}
            aria-label="Số khách dự kiến"
          />
          <span>khách (để tính bàn và chi phí mỗi khách).</span>
        </label>
      )}

      {data.invite && ctx.unmatched.length > 0 && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-3 text-[12.5px]" style={{ background: "var(--blS)", color: "var(--bl)" }}>
          <Heart size={15} className="flex-none" />
          <span className="min-w-0 flex-1 font-semibold">
            {ctx.unmatched.length} người đã phản hồi qua thiệp nhưng chưa có trong danh sách
          </span>
          <button
            type="button"
            onClick={() => onOp({
              op: "add_many",
              list: "guests",
              items: ctx.unmatched.map((r) => ({ name: r.guest_name, count: Math.max(1, r.num_guests || 1), rsvp: r.attending ? "yes" : "no", invited: true })),
            })}
            className="flex-none rounded-[8px] px-3 py-1.5 text-[12px] font-bold"
            style={{ background: "var(--sf)", color: "var(--bl)" }}
          >
            Thêm vào danh sách
          </button>
        </div>
      )}

      <Chips<View> value={view} onChange={setView} options={[["list", "Danh sách khách", plan.guests.length], ["tables", "Sơ đồ bàn", tables.length]]} />

      {view === "list" ? <GuestList ctx={ctx} /> : <TableView ctx={ctx} />}

      {!readOnly && view === "list" && <BulkAdd ctx={ctx} fromInvite={fromInvite} />}
      {!readOnly && view === "list" && (
        <QuickAdd onAdd={(item) => ops.add("guests", item)} />
      )}
    </div>
  );
}

function Box({ label, value, hint, color, hintColor }: { label: string; value: string; hint?: string; color?: string; hintColor?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] px-3 py-3 min-[600px]:px-4" style={card}>
      <p className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>{label}</p>
      <p className="tnum mt-0.5 truncate text-[19px] font-bold" style={{ color: color ?? "var(--tx)", letterSpacing: "-.5px" }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] font-semibold leading-snug" style={{ color: hintColor ?? "var(--tx3)" }}>{hint}</p>}
    </div>
  );
}

function GuestList({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const k = key(q);
    return plan.guests.filter((g) => (group === "all" || g.group === group) && (!k || key(g.name).includes(k) || (g.table ?? "").toLowerCase() === k));
  }, [plan.guests, q, group]);
  const groups = (Object.keys(GUEST_GROUP_LABEL) as GuestGroup[]).filter((g) => plan.guests.some((x) => x.group === g));

  if (plan.guests.length === 0) {
    return (
      <Section title="Danh sách khách mời">
        <p className="py-4 text-[13px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
          Thêm từng người ở ô bên dưới, dán cả danh sách, hoặc nhập file Excel. Mỗi dòng là một lời mời — một người hoặc cả gia đình.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Danh sách khách mời">
      <div className="mt-2 flex flex-col gap-2">
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
          <input className="input py-2.5 pl-9 pr-3" placeholder="Tìm tên khách hoặc số bàn…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {groups.length > 1 && (
          <Chips<GroupFilter>
            value={group}
            onChange={setGroup}
            options={[["all", "Tất cả", plan.guests.length], ...groups.map((g) => [g, GUEST_GROUP_LABEL[g], plan.guests.filter((x) => x.group === g).length] as [GroupFilter, string, number])]}
          />
        )}
      </div>
      <ul className="mt-2">
        {shown.slice(0, limit).map((g, i) =>
          editing === g.id ? (
            <GuestEdit key={g.id} g={g} first={i === 0} onDone={() => setEditing(null)} onSave={(patch) => ops.set("guests", g.id, patch)} />
          ) : (
            <GuestRow key={g.id} g={g} first={i === 0} ctx={ctx} onEdit={() => setEditing(g.id)} />
          ),
        )}
      </ul>
      {shown.length === 0 && <p className="py-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Không có khách nào khớp.</p>}
      {shown.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="mb-1 mt-1 w-full rounded-[10px] py-2 text-[12.5px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
          Xem thêm {Math.min(PAGE, shown.length - limit)} khách
        </button>
      )}
      {!readOnly && <p className="pb-1 pt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>Chạm vào trạng thái để đổi: chưa phản hồi → sẽ dự → không dự. Phản hồi gửi qua thiệp tự cập nhật.</p>}
    </Section>
  );
}

function GuestRow({ g, first, ctx, onEdit }: { g: PlanGuest; first: boolean; ctx: Ctx; onEdit: () => void }) {
  const { readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const reply = replies[g.id];
  const rsvp = guestRsvp(g, reply);
  const n = guestCount(g, reply);
  return (
    <li className="flex items-start gap-2.5 py-2.5" style={rowLine(first ? 0 : 1)}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => ops.set("guests", g.id, { invited: !g.invited })}
        aria-pressed={g.invited}
        aria-label={g.invited ? `Bỏ đánh dấu đã gửi thiệp: ${g.name}` : `Đánh dấu đã gửi thiệp: ${g.name}`}
        title={g.invited ? "Đã gửi thiệp" : "Chưa gửi thiệp"}
        className="mt-[1px] flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[8px]"
        style={g.invited ? { background: "var(--acS)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
      >
        {g.invited ? <MailCheck size={15} /> : <Mail size={15} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold" style={{ textWrap: "pretty", color: rsvp === "no" ? "var(--tx3)" : "var(--tx)" }}>
          {g.name}
          {n > 1 && <span className="tnum ml-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>· {n} người</span>}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{GUEST_GROUP_LABEL[g.group]}</span>
          <Pill
            tone={RSVP_TONE[rsvp]}
            onClick={readOnly || reply ? undefined : () => ops.set("guests", g.id, { rsvp: NEXT_RSVP[g.rsvp] })}
            title={reply ? "Khách đã phản hồi qua thiệp online" : "Chạm để đổi"}
          >
            {RSVP_LABEL[rsvp]}{reply ? " · qua thiệp" : ""}
          </Pill>
          {g.table && <Pill tone="bl">Bàn {g.table}</Pill>}
          {g.gift > 0 && <Pill tone="am">Mừng {vnd(g.gift)}</Pill>}
          {g.thanked && <Pill tone="gn">Đã cảm ơn</Pill>}
        </div>
        {g.note && <p className="mt-1 whitespace-pre-line text-[12px]" style={{ color: "var(--tx2)" }}>{g.note}</p>}
      </div>
      {!readOnly && <RowActions label={g.name} onEdit={onEdit} onRemove={() => ops.remove("guests", g.id)} />}
    </li>
  );
}

function GuestEdit({ g, first, onDone, onSave }: { g: PlanGuest; first: boolean; onDone: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [name, setName] = useState(g.name);
  const [group, setGroup] = useState<GuestGroup>(g.group);
  const [count, setCount] = useState(g.count);
  const [phone, setPhone] = useState(g.phone ?? "");
  const [rsvp, setRsvp] = useState<Rsvp>(g.rsvp);
  const [table, setTable] = useState(g.table ?? "");
  const [gift, setGift] = useState(g.gift);
  const [invited, setInvited] = useState(g.invited);
  const [thanked, setThanked] = useState(g.thanked);
  const [note, setNote] = useState(g.note ?? "");
  return (
    <li className="py-3" style={rowLine(first ? 0 : 1)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name, group, count, phone, rsvp, table, gift, invited, thanked, note });
          onDone();
        }}
        className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-4"
      >
        <Field label="Tên khách" className="col-span-2">
          <input className="input px-3 py-2.5" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Nhóm">
          <Select value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} className="w-full" />
        </Field>
        <Field label="Số người">
          <input type="number" min={1} max={50} className="input px-3 py-2.5" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
        </Field>
        <Field label="Xác nhận">
          <Select value={rsvp} options={RSVP_LABEL} onChange={(v) => setRsvp((v || "pending") as Rsvp)} className="w-full" />
        </Field>
        <Field label="Bàn">
          <input className="input px-3 py-2.5" value={table} maxLength={24} onChange={(e) => setTable(e.target.value)} placeholder="1, VIP…" />
        </Field>
        <Field label="Số điện thoại">
          <input className="input px-3 py-2.5" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Tiền mừng">
          <MoneyField className="input w-full px-3 py-2.5" value={gift} onCommit={setGift} live />
        </Field>
        <label className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold min-[640px]:col-span-4">
          <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--ac)]" checked={invited} onChange={(e) => setInvited(e.target.checked)} /> Đã gửi thiệp</span>
          <span className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[var(--ac)]" checked={thanked} onChange={(e) => setThanked(e.target.checked)} /> Đã gửi lời cảm ơn</span>
        </label>
        <Field label="Ghi chú" className="col-span-2 min-[640px]:col-span-4">
          <textarea className="input px-3 py-2.5" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ăn chay, đi cùng con nhỏ, cần đưa đón…" />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 min-[640px]:col-span-4">
          <GhostBtn onClick={onDone}>Huỷ</GhostBtn>
          <PrimaryBtn disabled={!name.trim()}>Lưu</PrimaryBtn>
        </div>
      </form>
    </li>
  );
}

function QuickAdd({ onAdd }: { onAdd: (item: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<GuestGroup>("bride_family");
  const [count, setCount] = useState(1);
  return (
    <AddForm
      onSubmit={() => {
        if (!name.trim()) return;
        onAdd({ name, group, count });
        setName("");
        setCount(1);
      }}
    >
      <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Tên khách (vd. Gia đình chú Ba)…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <Select value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} ariaLabel="Nhóm khách" />
      <input type="number" min={1} max={50} className="input w-[76px] flex-none px-3 py-2.5 text-center" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} aria-label="Số người" />
      <PrimaryBtn disabled={!name.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
    </AddForm>
  );
}

/** Thêm nhiều khách một lúc: dán danh sách, nhập file Excel/CSV, chép từ thiệp. */
function BulkAdd({ ctx, fromInvite }: { ctx: Ctx; fromInvite: string[] }) {
  const { onOp } = ctx;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [group, setGroup] = useState<GuestGroup>("bride_family");
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const addNames = (names: string[]) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (!clean.length) return;
    onOp({ op: "add_many", list: "guests", items: clean.map((name) => ({ name, group })) });
  };

  return (
    <section className="rounded-[16px] px-4 py-3.5" style={card}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <ClipboardPaste size={15} /> Dán cả danh sách
        </button>
        <button type="button" onClick={() => file.current?.click()} className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
          <Upload size={15} /> Nhập file Excel / CSV
        </button>
        {fromInvite.length > 0 && (
          <button
            type="button"
            onClick={() => onOp({ op: "add_many", list: "guests", items: fromInvite.map((name) => ({ name, invited: true })) })}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-bold"
            style={{ background: "var(--sf2)", color: "var(--tx2)" }}
          >
            <UserPlus size={15} /> Nhập {fromInvite.length} khách từ thiệp
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setErr(null);
            try {
              const names = await parseGuestFile(f);
              if (!names.length) setErr("File không có tên nào ở cột đầu tiên.");
              else addNames(names);
            } catch {
              setErr("Không đọc được file. Hãy lưu thành .xlsx hoặc .csv rồi thử lại.");
            }
          }}
        />
      </div>
      {err && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            className="input px-3 py-2.5"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Mỗi dòng một khách, ví dụ:\nGia đình chú Ba\nBạn Minh\nCô Lan"}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={group} options={GUEST_GROUP_LABEL} onChange={(v) => setGroup((v || "other") as GuestGroup)} ariaLabel="Nhóm cho cả danh sách" />
            <PrimaryBtn
              type="button"
              disabled={!text.trim()}
              onClick={() => {
                addNames(text.split(/\r?\n/));
                setText("");
                setOpen(false);
              }}
            >
              <Plus size={15} /> Thêm {text.split(/\r?\n/).filter((l) => l.trim()).length || ""} khách
            </PrimaryBtn>
          </div>
        </div>
      )}
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>File Excel: lấy tên ở cột A của trang đầu tiên.</p>
    </section>
  );
}

/** Sơ đồ bàn: mỗi bàn bao nhiêu người, bàn nào vượt sức chứa, ai chưa có bàn. */
function TableView({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp, replies } = ctx;
  const ops = listOps(onOp);
  const size = plan.settings.table_size;
  const tables = tableSummary(plan.guests, replies, size);
  const unseated = plan.guests.filter((g) => !g.table && guestRsvp(g, replies[g.id]) !== "no");

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
        Sức chứa mỗi bàn
        <input
          type="number"
          min={2}
          max={30}
          className="input w-[76px] px-3 py-2 text-center"
          defaultValue={size}
          readOnly={readOnly}
          onBlur={(e) => Number(e.target.value) !== size && onOp({ op: "set_settings", table_size: Number(e.target.value) || 10 })}
          aria-label="Số người mỗi bàn"
        />
        người
      </label>

      {tables.length === 0 ? (
        <Section title="Chưa xếp bàn nào" sub="Gõ số bàn cho từng khách ở danh sách bên dưới (hoặc trong ô sửa khách) — bàn tự hiện ở đây." />
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
          {tables.map((t) => (
            <section key={t.table} className="rounded-[14px] px-4 py-3" style={{ ...card, borderColor: t.over ? "var(--rd)" : "var(--bd)" }}>
              <div className="flex items-center gap-2">
                <h4 className="min-w-0 flex-1 truncate text-[14px] font-bold">Bàn {t.table}</h4>
                <span className="tnum flex-none text-[12.5px] font-bold" style={{ color: t.over ? "var(--rd)" : "var(--tx3)" }}>{t.people}/{size}</span>
              </div>
              {t.over && (
                <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--rd)" }}>
                  <TriangleAlert size={13} /> Vượt {t.people - size} chỗ
                </p>
              )}
              <ul className="mt-1.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                {t.guests.map((g) => (
                  <li key={g.id} className="flex justify-between gap-2 py-0.5">
                    <span className="min-w-0 truncate">{g.name}</span>
                    <span className="tnum flex-none" style={{ color: "var(--tx3)" }}>{guestCount(g, replies[g.id])}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unseated.length > 0 && (
        <Section title={`Chưa xếp bàn · ${unseated.reduce((n, g) => n + guestCount(g, replies[g.id]), 0)} người`} sub="Gõ số bàn rồi rời ô là lưu.">
          <ul className="mt-2">
            {unseated.slice(0, 200).map((g, i) => (
              <li key={g.id} className="flex items-center gap-2 py-2" style={rowLine(i)}>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold">
                  {g.name}
                  <span className="ml-1.5 text-[11.5px] font-normal" style={{ color: "var(--tx3)" }}>{GUEST_GROUP_LABEL[g.group]}</span>
                </span>
                <span className="tnum flex-none text-[12px]" style={{ color: "var(--tx3)" }}>{guestCount(g, replies[g.id])} người</span>
                <CommitInput
                  className="input w-[72px] flex-none px-2 py-1.5 text-center"
                  value=""
                  placeholder="Bàn"
                  readOnly={readOnly}
                  maxLength={24}
                  ariaLabel={`Bàn cho ${g.name}`}
                  onCommit={(v) => v.trim() && ops.set("guests", g.id, { table: v })}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
