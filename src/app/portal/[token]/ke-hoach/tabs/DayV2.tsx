"use client";

import { useState } from "react";
import { Clock, Luggage, MapPin, Phone, Plus, Sparkles, UserRound, Users } from "lucide-react";
import TimeInput from "@/components/TimeInput";
import { Badge, Empty, Field, PageHead, Progress, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { PERSON_ROLES, SIDE_LABEL, mergeDay, type DayRow, type Side } from "@/lib/wedding-plan";
import { listOps, type Ctx } from "../ui";
import { CheckV2, FormDrawer, InlineAdd, RowMenu, SelectV2 } from "../uiV2";

type SideFilter = "all" | Side;

/**
 * NGÀY CƯỚI (giao diện mới) — lịch trình theo giờ (lọc cô dâu / chú rể, gộp
 * lịch hẹn studio), đội hỗ trợ và đồ cần mang. Một nút chính "Thêm vào lịch
 * trình"; thêm người mở ngăn kéo; đồ cần mang thêm ngay ở cuối danh sách. Cùng
 * thao tác với tabs/Day.tsx.
 */
export default function DayTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly } = ctx;
  const [adding, setAdding] = useState(false);
  return (
    <Stack>
      <PageHead
        desc={<>{plan.wedding_date ? `Ngày ${fmtDate(plan.wedding_date)}. ` : ""}{data.studio_name} và ê-kíp đọc lịch trình và đội hỗ trợ ở đây để có mặt đúng giờ — giờ nào chưa chốt thì để trống.</>}
        actions={!readOnly && (
          <button type="button" onClick={() => setAdding(true)} className={btn("primary")}>
            <Plus size={16} /> Thêm vào lịch trình
          </button>
        )}
      />
      <Timeline ctx={ctx} adding={adding} setAdding={setAdding} />
      {data.ext && <People ctx={ctx} />}
      {data.ext && <Packing ctx={ctx} />}
    </Stack>
  );
}

function Timeline({ ctx, adding, setAdding }: { ctx: Ctx; adding: boolean; setAdding: (v: boolean) => void }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [side, setSide] = useState<SideFilter>("all");
  const [editing, setEditing] = useState<DayRow | null>(null);

  const all = mergeDay(plan.day, data.studio_day);
  const rows = side === "all" ? all : all.filter((r) => !r.side || r.side === side);
  const hasSides = plan.day.some((d) => d.side);

  return (
    <>
      <Section
        title="Lịch trình ngày cưới"
        icon={Clock}
        flush
      >
        {hasSides && (
          <div className="px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <Segmented<SideFilter> value={side} onChange={setSide} size="sm" label="Lọc theo người" options={[{ value: "all", label: "Cả ngày" }, { value: "bride", label: "Cô dâu" }, { value: "groom", label: "Chú rể" }]} />
          </div>
        )}
        {all.length === 0 ? (
          <Empty
            compact
            icon={Clock}
            title="Chưa có lịch trình ngày cưới"
            hint="Bắt đầu từ lịch trình mẫu (lễ vu quy, rước dâu, lễ thành hôn, tiệc tối — đã tách việc của cô dâu và chú rể) rồi sửa giờ cho khớp với gia đình bạn."
            action={!readOnly && (
              <button type="button" onClick={() => onOp({ op: "template", list: "day" })} className={btn("soft")}>
                <Sparkles size={16} /> Dùng lịch trình mẫu
              </button>
            )}
          />
        ) : (
          rows.map((r) => (
            <div key={r.id} className="v2-row items-start">
              <span className="tnum w-[50px] flex-none pt-[1px] text-[15px] font-bold" style={{ color: r.time ? "var(--tx)" : "var(--tx3)", letterSpacing: "-.3px" }}>
                {r.time || "--:--"}
              </span>
              <div className="min-w-0 flex-1">
                {readOnly || r.studio ? (
                  <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{r.title}</p>
                ) : (
                  <button type="button" onClick={() => setEditing(r)} className="text-left text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{r.title}</button>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] empty:hidden" style={{ color: "var(--tx2)" }}>
                  {r.studio && <Badge tone="brand">{data.studio_name} xếp</Badge>}
                  {r.side && <Badge tone={r.side === "bride" ? "red" : "blue"}>{SIDE_LABEL[r.side]}</Badge>}
                  {r.place && <span className="flex items-start gap-1"><MapPin size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.place}</span>}
                  {r.who && <span className="flex items-start gap-1"><UserRound size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.who}</span>}
                </div>
              </div>
              {!readOnly && !r.studio && <RowMenu label={r.title} onEdit={() => setEditing(r)} onRemove={() => ops.remove("day", r.id)} />}
            </div>
          ))
        )}
      </Section>

      {adding && <DayForm onClose={() => setAdding(false)} onSave={(item) => ops.add("day", item)} />}
      {editing && (
        <DayForm r={editing} onClose={() => setEditing(null)} onSave={(patch) => ops.set("day", editing.id, patch)} onRemove={() => ops.remove("day", editing.id)} />
      )}
    </>
  );
}

/** Thêm (không có `r`) hoặc sửa một mốc của lịch trình. */
function DayForm({ r, onClose, onSave, onRemove }: { r?: DayRow; onClose: () => void; onSave: (v: Record<string, unknown>) => void; onRemove?: () => void }) {
  const [time, setTime] = useState(r?.time ?? "");
  const [title, setTitle] = useState(r?.title ?? "");
  const [place, setPlace] = useState(r?.place ?? "");
  const [who, setWho] = useState(r?.who ?? "");
  const [side, setSide] = useState<Side | "">(r?.side ?? "");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title={r ? "Sửa mốc lịch trình" : "Thêm vào lịch trình"}
      submitLabel={r ? "Lưu" : "Thêm"}
      canSubmit={!!title.trim()}
      onRemove={onRemove}
      onSubmit={() => {
        // Thêm mới: giống bản cũ — không gửi "ai phụ trách" khi để trống, "của ai" chỉ khi có chọn.
        onSave(r ? { time, title, place, who, side } : { time, title, place, ...(who ? { who } : {}), ...(side ? { side } : {}) });
        onClose();
      }}
    >
      <Field label="Giờ" hint="Để trống nếu chưa chốt giờ.">
        <TimeInput className={`${inputCls} text-center`} value={time} onChange={setTime} ariaLabel="Giờ" />
      </Field>
      <Field label="Của ai">
        <SelectV2 value={side} options={SIDE_LABEL} onChange={setSide} empty="Chung" ariaLabel="Của ai" />
      </Field>
      <Field label="Việc gì?" className="sm:col-span-2">
        <input className={inputCls} placeholder="Ví dụ: Nhà trai đến xin dâu" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} autoFocus={!r} />
      </Field>
      <Field label="Ở đâu?">
        <input className={inputCls} value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
      </Field>
      <Field label="Ai phụ trách?">
        <input className={inputCls} value={who} maxLength={120} onChange={(e) => setWho(e.target.value)} />
      </Field>
    </FormDrawer>
  );
}

function People({ ctx }: { ctx: Ctx }) {
  const { plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <Section
        title="Đội hỗ trợ"
        desc="Phù dâu, phù rể, đội bê tráp, MC, người giữ phong bì… — ê-kíp studio biết gọi ai khi cần."
        icon={Users}
        flush
      >
        {plan.people.length === 0 ? (
          <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>Chưa có ai.</p>
        ) : (
          plan.people.map((p) => (
            <div key={p.id} className="v2-row">
              <div className="min-w-0 flex-1">
                <p className="v2-row-title">{p.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
                  {p.role && <Badge>{p.role}</Badge>}
                  {p.side && <Badge tone={p.side === "bride" ? "red" : "blue"}>Bên {SIDE_LABEL[p.side].toLowerCase()}</Badge>}
                </div>
              </div>
              {p.phone && (
                <a href={`tel:${p.phone}`} className={btn("ghost", "sm", "tnum")} style={{ color: "var(--ac)" }}>
                  <Phone size={14} /> <span className="hidden sm:inline">{p.phone}</span><span className="sm:hidden">Gọi</span>
                </a>
              )}
              {!readOnly && <RowMenu label={p.name} onRemove={() => ops.remove("people", p.id)} />}
            </div>
          ))
        )}
        {!readOnly && (
          <div className="px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <button type="button" onClick={() => setAdding(true)} className={btn("secondary", "md")}>
              <Plus size={16} /> Thêm người
            </button>
          </div>
        )}
      </Section>
      {adding && <PersonAdd onClose={() => setAdding(false)} onAdd={(item) => ops.add("people", item)} />}
    </>
  );
}

function PersonAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [side, setSide] = useState<Side | "">("");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm người hỗ trợ"
      submitLabel="Thêm"
      canSubmit={!!name.trim()}
      onSubmit={() => {
        onAdd({ name, role, phone, ...(side ? { side } : {}) });
        onClose();
      }}
    >
      <Field label="Tên" className="sm:col-span-2">
        <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Vai trò">
        <input className={inputCls} placeholder="Phù dâu, MC…" list="planner-roles-v2" value={role} maxLength={40} onChange={(e) => setRole(e.target.value)} />
        <datalist id="planner-roles-v2">{PERSON_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      </Field>
      <Field label="Bên nào?">
        <SelectV2 value={side} options={SIDE_LABEL} onChange={setSide} empty="Chung" ariaLabel="Bên" />
      </Field>
      <Field label="Số điện thoại" className="sm:col-span-2">
        <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
    </FormDrawer>
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
    <Section
      title="Đồ cần mang"
      icon={Luggage}
      actions={plan.packing.length > 0 && <Badge tone={packed === plan.packing.length ? "green" : "gray"}>{packed}/{plan.packing.length} đã xếp</Badge>}
      flush
    >
      {plan.packing.length === 0 ? (
        <Empty
          compact
          icon={Luggage}
          title="Chưa có danh sách đồ cần mang"
          hint="Nhẫn, giấy tờ, váy áo, phong bì lì xì, đồ dặm phấn… — đánh dấu từng món khi đã xếp vào túi."
          action={!readOnly && (
            <button type="button" onClick={() => onOp({ op: "template", list: "packing" })} className={btn("soft")}>
              <Sparkles size={16} /> Dùng danh sách mẫu
            </button>
          )}
        />
      ) : (
        <>
          <div className="px-4 pt-3 sm:px-5"><Progress value={pct} tone={pct === 100 ? "green" : "brand"} /></div>
          <div className="pt-1">
            {plan.packing.map((p) => (
              <div key={p.id} className="v2-row py-2.5">
                <CheckV2 on={p.packed} disabled={readOnly} label={p.packed ? `Bỏ đánh dấu: ${p.name}` : `Đã xếp: ${p.name}`} onClick={() => ops.set("packing", p.id, { packed: !p.packed })} />
                <span className="min-w-0 flex-1 text-[14px]" style={{ color: p.packed ? "var(--tx3)" : "var(--tx)", textDecoration: p.packed ? "line-through" : undefined }}>
                  {p.name}
                </span>
                {p.qty > 1 && <span className="tnum flex-none text-[13px] font-semibold" style={{ color: "var(--tx3)" }}>×{p.qty}</span>}
                {!readOnly && <RowMenu label={p.name} onRemove={() => ops.remove("packing", p.id)} />}
              </div>
            ))}
          </div>
        </>
      )}
      {!readOnly && (
        <InlineAdd
          disabled={!name.trim()}
          onSubmit={() => {
            ops.add("packing", { name, qty });
            setName("");
            setQty(1);
          }}
        >
          <input className={`${inputCls} min-w-[120px] flex-1`} placeholder="Món cần mang…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Món cần mang" />
          <input type="number" min={1} max={999} className={`${inputCls} !w-[72px] flex-none text-center`} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} aria-label="Số lượng" />
        </InlineAdd>
      )}
    </Section>
  );
}
