"use client";

import { useState } from "react";
import { MapPin, Phone, Plus, UserRound } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import { ProgressBar } from "@/components/studio/ui";
import { fmtDate } from "@/lib/date";
import {
  PERSON_ROLES, SIDE_LABEL, mergeDay,
  type DayRow, type Side,
} from "@/lib/wedding-plan";
import {
  AddForm, CheckCircle, Chips, Empty, GhostBtn, Pill, PrimaryBtn, RowActions, Section, Select, listOps, rowLine, type Ctx,
} from "../ui";

type SideFilter = "all" | Side;

/**
 * NGÀY CƯỚI — ba thứ cần trong đúng một ngày: lịch trình theo giờ (tách việc
 * riêng của cô dâu / chú rể, gộp lịch hẹn của studio), đội hỗ trợ (phù dâu, phù
 * rể, bê tráp, MC… kèm số điện thoại) và đồ cần mang. Studio đọc lịch trình và
 * đội hỗ trợ ở màn hợp đồng để ê-kíp có mặt đúng giờ, biết gọi ai.
 */
export default function DayTab({ ctx }: { ctx: Ctx }) {
  const { data, plan } = ctx;
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        {plan.wedding_date ? `Ngày ${fmtDate(plan.wedding_date)}. ` : ""}
        {data.studio_name} và ê-kíp đọc lịch trình và đội hỗ trợ ở đây để có mặt đúng giờ — giờ nào chưa chốt thì để trống.
      </p>
      <Timeline ctx={ctx} />
      {data.ext && <People ctx={ctx} />}
      {data.ext && <Packing ctx={ctx} />}
    </div>
  );
}

function Timeline({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [side, setSide] = useState<SideFilter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [newSide, setNewSide] = useState<Side | "">("");

  const all = mergeDay(plan.day, data.studio_day);
  const rows = side === "all" ? all : all.filter((r) => !r.side || r.side === side);
  const hasSides = plan.day.some((d) => d.side);

  return (
    <>
      <Section title="Lịch trình ngày cưới">
        {hasSides && (
          <div className="mt-2">
            <Chips<SideFilter> value={side} onChange={setSide} options={[["all", "Cả ngày"], ["bride", "Cô dâu"], ["groom", "Chú rể"]]} />
          </div>
        )}
        {all.length === 0 ? (
          <Empty
            title="Chưa có lịch trình ngày cưới"
            sub="Bắt đầu từ lịch trình mẫu (lễ vu quy, rước dâu, lễ thành hôn, tiệc tối — đã tách việc của cô dâu và chú rể) rồi sửa giờ cho khớp với gia đình bạn."
            action={readOnly ? undefined : { label: "Dùng lịch trình mẫu", onClick: () => onOp({ op: "template", list: "day" }) }}
          />
        ) : (
          <ul className="mt-1">
            {rows.map((r, i) =>
              editing === r.id && !r.studio ? (
                <DayEdit key={r.id} r={r} first={i === 0} onDone={() => setEditing(null)} onSave={(patch) => ops.set("day", r.id, patch)} />
              ) : (
                <li key={r.id} className="flex items-start gap-3 py-3" style={rowLine(i)}>
                  <span className="tnum w-[52px] flex-none pt-[1px] text-[15px] font-bold" style={{ color: r.time ? "var(--tx)" : "var(--tx3)", letterSpacing: "-.3px" }}>
                    {r.time || "--:--"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold" style={{ textWrap: "pretty" }}>{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] empty:hidden" style={{ color: "var(--tx2)" }}>
                      {r.studio && <Pill tone="ac">{data.studio_name} xếp</Pill>}
                      {r.side && <Pill tone={r.side === "bride" ? "rd" : "bl"}>{SIDE_LABEL[r.side]}</Pill>}
                      {r.place && <span className="flex items-start gap-1"><MapPin size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.place}</span>}
                      {r.who && <span className="flex items-start gap-1"><UserRound size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.who}</span>}
                    </div>
                  </div>
                  {!readOnly && !r.studio && <RowActions label={r.title} onEdit={() => setEditing(r.id)} onRemove={() => ops.remove("day", r.id)} />}
                </li>
              ),
            )}
          </ul>
        )}
      </Section>

      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!title.trim()) return;
            ops.add("day", { time, title, place, ...(newSide ? { side: newSide } : {}) });
            setTitle("");
            setPlace("");
            setTime("");
          }}
        >
          <TimeInput className="input w-[84px] flex-none px-3 py-2.5 text-center" value={time} onChange={setTime} ariaLabel="Giờ" />
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Việc gì? (vd. Nhà trai đến xin dâu)" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <input className="input w-auto min-w-[140px] flex-1 px-3 py-2.5 sm:max-w-[200px]" placeholder="Ở đâu?" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
          <Select value={newSide} options={SIDE_LABEL} onChange={setNewSide} empty="Chung" ariaLabel="Của ai" />
          <PrimaryBtn disabled={!title.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </>
  );
}

function DayEdit({ r, first, onDone, onSave }: { r: DayRow; first: boolean; onDone: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [time, setTime] = useState(r.time);
  const [title, setTitle] = useState(r.title);
  const [place, setPlace] = useState(r.place ?? "");
  const [who, setWho] = useState(r.who ?? "");
  const [side, setSide] = useState<Side | "">(r.side ?? "");
  return (
    <li className="py-3" style={rowLine(first ? 0 : 1)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({ time, title, place, who, side });
          onDone();
        }}
        className="flex flex-wrap gap-2"
      >
        <TimeInput className="input w-[84px] flex-none px-3 py-2 text-center" value={time} onChange={setTime} ariaLabel="Giờ" />
        <input className="input w-auto min-w-[180px] flex-1 px-3 py-2" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} aria-label="Việc" autoFocus />
        <input className="input w-auto min-w-[140px] flex-1 px-3 py-2" placeholder="Ở đâu?" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
        <input className="input w-auto min-w-[140px] flex-1 px-3 py-2" placeholder="Ai phụ trách?" value={who} maxLength={120} onChange={(e) => setWho(e.target.value)} />
        <Select value={side} options={SIDE_LABEL} onChange={setSide} empty="Chung" ariaLabel="Của ai" />
        <div className="flex flex-none gap-2">
          <GhostBtn onClick={onDone}>Huỷ</GhostBtn>
          <PrimaryBtn disabled={!title.trim()}>Lưu</PrimaryBtn>
        </div>
      </form>
    </li>
  );
}

function People({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [side, setSide] = useState<Side | "">("");
  return (
    <>
      <Section title="Đội hỗ trợ" sub="Phù dâu, phù rể, đội bê tráp, MC, người giữ phong bì… — ê-kíp studio biết gọi ai khi cần.">
        {plan.people.length === 0 ? (
          <p className="py-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa có ai.</p>
        ) : (
          <ul className="mt-1">
            {plan.people.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 py-2.5" style={rowLine(i)}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{p.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 empty:hidden">
                    {p.role && <Pill>{p.role}</Pill>}
                    {p.side && <Pill tone={p.side === "bride" ? "rd" : "bl"}>Bên {SIDE_LABEL[p.side].toLowerCase()}</Pill>}
                  </div>
                </div>
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="tnum flex flex-none items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
                    <Phone size={13} /> {p.phone}
                  </a>
                )}
                {!readOnly && <RowActions label={p.name} onRemove={() => ops.remove("people", p.id)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!name.trim()) return;
            ops.add("people", { name, role, phone, ...(side ? { side } : {}) });
            setName("");
            setRole("");
            setPhone("");
          }}
        >
          <input className="input w-auto min-w-[160px] flex-1 px-3 py-2.5" placeholder="Tên…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <input className="input w-[150px] flex-none px-3 py-2.5" placeholder="Vai trò" list="planner-roles" value={role} maxLength={40} onChange={(e) => setRole(e.target.value)} />
          <datalist id="planner-roles">{PERSON_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
          <input className="input w-[140px] flex-none px-3 py-2.5" inputMode="tel" placeholder="SĐT" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Select value={side} options={SIDE_LABEL} onChange={setSide} empty="Bên nào?" ariaLabel="Bên" />
          <PrimaryBtn disabled={!name.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </>
  );
}

function Packing({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const packed = plan.packing.filter((p) => p.packed).length;
  const pct = plan.packing.length ? (packed / plan.packing.length) * 100 : 0;
  return (
    <>
      <Section
        title="Đồ cần mang"
        right={plan.packing.length > 0 && <span className="tnum text-[12.5px] font-bold" style={{ color: packed === plan.packing.length ? "var(--gn)" : "var(--tx3)" }}>{packed}/{plan.packing.length} đã xếp</span>}
      >
        {plan.packing.length === 0 ? (
          <Empty
            title="Chưa có danh sách đồ cần mang"
            sub="Nhẫn, giấy tờ, váy áo, phong bì lì xì, đồ dặm phấn… — đánh dấu từng món khi đã xếp vào túi."
            action={readOnly ? undefined : { label: "Dùng danh sách mẫu", onClick: () => onOp({ op: "template", list: "packing" }) }}
          />
        ) : (
          <>
            <ProgressBar pct={pct} height={5} color={pct === 100 ? "var(--gn)" : "var(--ac)"} className="mt-2" />
            <ul className="mt-1.5">
              {plan.packing.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2" style={rowLine(i)}>
                  <CheckCircle on={p.packed} disabled={readOnly} label={p.packed ? `Bỏ đánh dấu: ${p.name}` : `Đã xếp: ${p.name}`} onClick={() => ops.set("packing", p.id, { packed: !p.packed })} />
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold" style={{ color: p.packed ? "var(--tx3)" : "var(--tx)", textDecoration: p.packed ? "line-through" : undefined }}>
                    {p.name}
                  </span>
                  {p.qty > 1 && <span className="tnum flex-none text-[12.5px] font-bold" style={{ color: "var(--tx3)" }}>×{p.qty}</span>}
                  {!readOnly && <RowActions label={p.name} onRemove={() => ops.remove("packing", p.id)} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!name.trim()) return;
            ops.add("packing", { name, qty });
            setName("");
            setQty(1);
          }}
        >
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Món cần mang…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <input type="number" min={1} max={999} className="input w-[76px] flex-none px-3 py-2.5 text-center" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} aria-label="Số lượng" />
          <PrimaryBtn disabled={!name.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </>
  );
}
