"use client";

import { useState } from "react";
import { Camera, ExternalLink, Lightbulb, Link2, Palette, Plus, Sparkles, X } from "lucide-react";
import { Empty, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { PLAN_LIMITS } from "@/lib/wedding-plan";
import { CommitInput, listOps, type Ctx } from "../ui";
import { BadgeBtn, InlineAdd, RowMenu } from "../uiV2";

/** Vài bảng màu cưới hay gặp — chạm là dùng, rồi thêm / bớt từng màu (giống bản cũ). */
const PRESETS: [string, string[]][] = [
  ["Đỏ rượu vang", ["#862828", "#e8c6c2", "#f6e9e4", "#f3f0ea", "#a59d7a", "#c7b6a6"]],
  ["Hồng pastel", ["#f4c2c2", "#fbe4e4", "#fff7f3", "#d8a7b1", "#b5838d"]],
  ["Xanh sage", ["#9caf88", "#dfe6d5", "#f5f1e8", "#c9b79c", "#6b705c"]],
  ["Trắng & vàng gold", ["#fffaf0", "#f3e5c0", "#d4af37", "#a67c52", "#4a4a4a"]],
];

/**
 * PHONG CÁCH & ẢNH (giao diện mới) — bảng màu, concept, link cảm hứng và danh
 * sách ảnh cần chụp. Danh sách ảnh là phần studio đọc kỹ nhất nên đứng đầu.
 * Cùng thao tác với tabs/Style.tsx (set_style + danh sách shots).
 */
export default function StyleTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const style = plan.style;
  const [color, setColor] = useState("#c97b84");
  const [link, setLink] = useState("");
  const [shot, setShot] = useState("");
  const setStyle = (patch: { colors?: string[]; concept?: string; links?: string[] }) => onOp({ op: "set_style", ...patch });
  const must = plan.shots.filter((s) => s.must).length;

  return (
    <Stack>
      <Section
        title="Ảnh cần chụp"
        desc={`${plan.shots.length ? `${must} bắt buộc · ${plan.shots.length} tấm. ` : ""}Ê-kíp ${data.studio_name} xem danh sách này trước ngày chụp — chạm nhãn để đổi “Bắt buộc” / “Nếu kịp”.`}
        icon={Camera}
        flush
      >
        {plan.shots.length === 0 ? (
          <Empty
            compact
            icon={Camera}
            title="Chưa có danh sách ảnh"
            hint="Ảnh với ông bà, bố mẹ hai bên, nhóm bạn thân, chi tiết nhẫn và hoa cầm tay…"
            action={!readOnly && (
              <button type="button" onClick={() => onOp({ op: "template", list: "shots" })} className={btn("soft")}>
                <Sparkles size={16} /> Dùng danh sách mẫu
              </button>
            )}
          />
        ) : (
          plan.shots.map((s) => (
            <div key={s.id} className="v2-row py-2.5">
              <BadgeBtn tone={s.must ? "brand" : "gray"} onClick={readOnly ? undefined : () => ops.set("shots", s.id, { must: !s.must })} title="Chạm để đổi">
                {s.must ? "Bắt buộc" : "Nếu kịp"}
              </BadgeBtn>
              <span className="min-w-0 flex-1 text-[14px] leading-snug" style={{ textWrap: "pretty" }}>{s.title}</span>
              {!readOnly && <RowMenu label={s.title} onRemove={() => ops.remove("shots", s.id)} />}
            </div>
          ))
        )}
        {!readOnly && (
          <InlineAdd
            disabled={!shot.trim()}
            onSubmit={() => {
              ops.add("shots", { title: shot, must: true });
              setShot("");
            }}
          >
            <input className={`${inputCls} min-w-[180px] flex-1`} placeholder="Ảnh muốn có (vd. với cô giáo chủ nhiệm)…" value={shot} maxLength={160} onChange={(e) => setShot(e.target.value)} aria-label="Ảnh muốn có" />
          </InlineAdd>
        )}
      </Section>

      <Section title="Bảng màu cưới" desc="Tông màu cho trang trí, hoa, thiệp, trang phục phù dâu — studio cũng dùng để lên màu ảnh." icon={Palette}>
        {style.colors.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {style.colors.map((c) => (
              <div key={c} className="w-[68px]">
                <div className="relative h-[52px] rounded-[12px]" style={{ background: c, border: "1px solid var(--bd)" }}>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setStyle({ colors: style.colors.filter((x) => x !== c) })}
                      aria-label={`Bỏ màu ${c}`}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)", boxShadow: "var(--v2-shadow)" }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-center font-mono text-[11px]" style={{ color: "var(--tx3)" }}>{c.toUpperCase()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--tx3)" }}>Chưa chọn màu nào — chọn một bảng gợi ý bên dưới hoặc tự thêm từng màu.</p>
        )}
        {!readOnly && (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--bd2)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-[38px] w-[52px] cursor-pointer rounded-[10px]"
                style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                aria-label="Chọn màu"
              />
              <button
                type="button"
                disabled={style.colors.length >= PLAN_LIMITS.colors || style.colors.includes(color)}
                onClick={() => setStyle({ colors: [...style.colors, color] })}
                className={btn("secondary")}
              >
                <Plus size={16} /> Thêm màu
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([name, colors]) => (
                <button key={name} type="button" onClick={() => setStyle({ colors })} className={btn("ghost", "sm")} style={{ background: "var(--sf2)" }}>
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

      <Section title="Concept & ý tưởng" desc="Tự lưu khi bạn rời ô." icon={Lightbulb}>
        <CommitInput
          multiline
          className={inputCls}
          value={style.concept ?? ""}
          readOnly={readOnly}
          maxLength={500}
          ariaLabel="Concept"
          placeholder="Ví dụ: tiệc ngoài trời tông vintage, hoa hồng kem, cổng hoa vòm, váy đuôi cá…"
          onCommit={(v) => setStyle({ concept: v })}
        />
      </Section>

      <Section title="Link cảm hứng" desc="Bảng Pinterest, ảnh mẫu, video concept…" icon={Link2} flush>
        {style.links.length === 0 && <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>Chưa có link nào.</p>}
        {style.links.map((l) => (
          <div key={l} className="v2-row py-2.5">
            <a href={l} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium" style={{ color: "var(--ac)" }}>
              <ExternalLink size={15} className="flex-none" />
              <span className="truncate">{l.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            </a>
            {!readOnly && <RowMenu label={l} onRemove={() => setStyle({ links: style.links.filter((x) => x !== l) })} />}
          </div>
        ))}
        {!readOnly && style.links.length < PLAN_LIMITS.links && (
          <InlineAdd
            disabled={!link.trim()}
            onSubmit={() => {
              setStyle({ links: [...style.links, link.trim()] });
              setLink("");
            }}
          >
            <input className={`${inputCls} min-w-[180px] flex-1`} inputMode="url" placeholder="pinterest.com/…" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} aria-label="Link cảm hứng" />
          </InlineAdd>
        )}
      </Section>
    </Stack>
  );
}
