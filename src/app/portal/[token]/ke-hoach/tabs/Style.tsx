"use client";

import { useState } from "react";
import { Camera, ExternalLink, Link2, Plus, X } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/wedding-plan";
import { AddForm, CommitInput, Empty, Pill, PrimaryBtn, RowActions, Section, listOps, rowLine, type Ctx } from "../ui";

/** Vài bảng màu cưới hay gặp — chạm là dùng, rồi thêm / bớt từng màu. */
const PRESETS: [string, string[]][] = [
  ["Đỏ rượu vang", ["#862828", "#e8c6c2", "#f6e9e4", "#f3f0ea", "#a59d7a", "#c7b6a6"]],
  ["Hồng pastel", ["#f4c2c2", "#fbe4e4", "#fff7f3", "#d8a7b1", "#b5838d"]],
  ["Xanh sage", ["#9caf88", "#dfe6d5", "#f5f1e8", "#c9b79c", "#6b705c"]],
  ["Trắng & vàng gold", ["#fffaf0", "#f3e5c0", "#d4af37", "#a67c52", "#4a4a4a"]],
];

/**
 * PHONG CÁCH & ẢNH — bảng màu, concept trang trí, link cảm hứng, và danh sách
 * ảnh cần chụp. Danh sách ảnh là phần studio đọc kỹ nhất: tấm "bắt buộc" là
 * tấm ê-kíp không được bỏ sót (ảnh với ông bà, nhóm bạn đại học…).
 */
export default function StyleTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const style = plan.style;
  const [color, setColor] = useState("#c97b84");
  const [link, setLink] = useState("");
  const [shot, setShot] = useState("");
  const setStyle = (patch: { colors?: string[]; concept?: string; links?: string[] }) => onOp({ op: "set_style", ...patch });

  return (
    <div className="flex flex-col gap-3.5">
      <Section title="Bảng màu cưới" sub="Tông màu cho trang trí, hoa, thiệp, trang phục phù dâu — studio cũng dùng để lên màu ảnh.">
        {style.colors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2.5">
            {style.colors.map((c) => (
              <div key={c} className="w-[74px]">
                <div className="relative h-[52px] rounded-[10px]" style={{ background: c, border: "1px solid var(--bd)" }}>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setStyle({ colors: style.colors.filter((x) => x !== c) })}
                      aria-label={`Bỏ màu ${c}`}
                      className="absolute -right-1.5 -top-1.5 flex h-[20px] w-[20px] items-center justify-center rounded-full"
                      style={{ background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-center font-mono text-[11px]" style={{ color: "var(--tx3)" }}>{c.toUpperCase()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa chọn màu nào — chọn một bảng gợi ý bên dưới hoặc tự thêm từng màu.</p>
        )}
        {!readOnly && (
          <div className="mt-3 flex flex-col gap-2.5 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-[38px] w-[52px] cursor-pointer rounded-[8px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }} aria-label="Chọn màu" />
              <PrimaryBtn type="button" disabled={style.colors.length >= PLAN_LIMITS.colors || style.colors.includes(color)} onClick={() => setStyle({ colors: [...style.colors, color] })}>
                <Plus size={15} /> Thêm màu
              </PrimaryBtn>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([name, colors]) => (
                <button key={name} type="button" onClick={() => setStyle({ colors })} className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                  <span className="flex">
                    {colors.slice(0, 4).map((c) => <span key={c} className="-ml-1 h-[14px] w-[14px] rounded-full first:ml-0" style={{ background: c, border: "1px solid var(--sf)" }} />)}
                  </span>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Concept & ý tưởng">
        <CommitInput
          multiline
          className="input mt-2 px-3 py-2.5"
          value={style.concept ?? ""}
          readOnly={readOnly}
          maxLength={500}
          ariaLabel="Concept"
          placeholder="Ví dụ: tiệc ngoài trời tông vintage, hoa hồng kem, cổng hoa vòm, váy đuôi cá…"
          onCommit={(v) => setStyle({ concept: v })}
        />
        <p className="mb-1 mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>Tự lưu khi bạn rời ô.</p>
      </Section>

      <Section title="Link cảm hứng" sub="Bảng Pinterest, ảnh mẫu, video concept…">
        {style.links.length > 0 && (
          <ul className="mt-1.5">
            {style.links.map((l, i) => (
              <li key={l} className="flex items-center gap-2 py-2" style={rowLine(i)}>
                <Link2 size={14} className="flex-none" style={{ color: "var(--tx3)" }} />
                <a href={l} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--ac)" }}>
                  {l.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
                <ExternalLink size={13} className="flex-none" style={{ color: "var(--tx3)" }} />
                {!readOnly && <RowActions label={l} onRemove={() => setStyle({ links: style.links.filter((x) => x !== l) })} />}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && style.links.length < PLAN_LIMITS.links && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!link.trim()) return;
              setStyle({ links: [...style.links, link.trim()] });
              setLink("");
            }}
            className="mb-1 mt-2 flex gap-2"
          >
            <input className="input w-auto min-w-0 flex-1 px-3 py-2.5" inputMode="url" placeholder="pinterest.com/…" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} />
            <PrimaryBtn disabled={!link.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
          </form>
        )}
      </Section>

      <Section
        title={<span className="flex items-center gap-1.5"><Camera size={16} /> Ảnh cần chụp</span>}
        sub={`Ê-kíp ${data.studio_name} xem danh sách này trước ngày chụp. Đánh dấu "Bắt buộc" cho tấm không được thiếu.`}
        right={plan.shots.length > 0 && <span className="tnum text-[12.5px] font-bold" style={{ color: "var(--tx3)" }}>{plan.shots.filter((s) => s.must).length} bắt buộc · {plan.shots.length} tấm</span>}
      >
        {plan.shots.length === 0 ? (
          <Empty
            title="Chưa có danh sách ảnh"
            sub="Ảnh với ông bà, bố mẹ hai bên, nhóm bạn thân, chi tiết nhẫn và hoa cầm tay…"
            action={readOnly ? undefined : { label: "Dùng danh sách mẫu", onClick: () => onOp({ op: "template", list: "shots" }) }}
          />
        ) : (
          <ul className="mt-1.5">
            {plan.shots.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2.5 py-2.5" style={rowLine(i)}>
                <Pill tone={s.must ? "ac" : "nu"} onClick={readOnly ? undefined : () => ops.set("shots", s.id, { must: !s.must })} title="Chạm để đổi">
                  {s.must ? "Bắt buộc" : "Nếu kịp"}
                </Pill>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{s.title}</span>
                {!readOnly && <RowActions label={s.title} onRemove={() => ops.remove("shots", s.id)} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!shot.trim()) return;
            ops.add("shots", { title: shot, must: true });
            setShot("");
          }}
        >
          <input className="input w-auto min-w-[200px] flex-1 px-3 py-2.5" placeholder="Ảnh muốn có (vd. với cô giáo chủ nhiệm)…" value={shot} maxLength={160} onChange={(e) => setShot(e.target.value)} />
          <PrimaryBtn disabled={!shot.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </div>
  );
}
