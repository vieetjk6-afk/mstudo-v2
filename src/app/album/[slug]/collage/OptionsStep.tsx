"use client";

import { useMemo } from "react";
import { LayoutGrid, LoaderCircle, Plus, Shuffle, Type, X } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { COLLAGE_FORMATS } from "@/lib/collage/formats";
import { COLLAGE_STYLES, MIX_STYLE } from "@/lib/collage/styles";
import { pageSizes } from "@/lib/collage/generate";
import { rng } from "@/lib/collage/rng";
import { COLLAGE_LIMITS, type PerPage } from "@/lib/collage/types";
import { StudioFooter, StudioHeader } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BƯỚC 2 — TUỲ CHỌN GHÉP: khổ ảnh, số ảnh mỗi trang, phong cách, nội dung chữ.

   Nội dung chữ: mỗi nội dung nằm trên ĐÚNG MỘT layout (máy chọn ngẫu nhiên),
   mỗi layout tối đa một nội dung — nên số nội dung không được vượt số layout.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CollageOptions {
  formatId: string;
  perPage: PerPage;
  styleId: string;
  texts: string[];
}

const PER_PAGE: PerPage[] = [1, 2, 3, 4, 5, 6, 9, "mix"];

function Group({ title, desc, children }: { title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-5">
      <p className="text-[12px] font-bold uppercase tracking-[.6px]" style={{ color: "var(--tx3)" }}>
        {title}
      </p>
      {desc ? <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>{desc}</p> : null}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export default function OptionsStep({
  count,
  opts,
  setOpts,
  ideas,
  busy,
  onBack,
  onGenerate,
}: {
  count: number;
  opts: CollageOptions;
  setOpts: (fn: (o: CollageOptions) => CollageOptions) => void;
  /** Gợi ý nội dung (theo tên album, ngày cưới…). */
  ideas: string[];
  busy: boolean;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const pages = useMemo(() => pageSizes(count, opts.perPage, rng(1)).length, [count, opts.perPage]);
  const filled = opts.texts.filter((t) => t.trim()).length;
  const tooMany = filled > pages;
  const canAdd = opts.texts.length < Math.min(pages, COLLAGE_LIMITS.texts);

  const setText = (i: number, v: string) => setOpts((o) => ({ ...o, texts: o.texts.map((t, j) => (j === i ? v.slice(0, COLLAGE_LIMITS.textChars) : t)) }));
  const addText = (v = "") =>
    setOpts((o) => {
      const empty = o.texts.findIndex((t) => !t.trim());
      if (v && empty >= 0) return { ...o, texts: o.texts.map((t, j) => (j === empty ? v : t)) };
      return { ...o, texts: [...o.texts, v] };
    });
  const removeText = (i: number) => setOpts((o) => ({ ...o, texts: o.texts.filter((_, j) => j !== i) }));

  return (
    <>
      <StudioHeader title="Tuỳ chọn ghép" sub={`${count} ảnh đã chọn`} onBack={onBack} backLabel="Chọn lại ảnh" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
        <div className="mx-auto w-full max-w-[640px]">
          <Group title="Khổ ảnh" desc="Đăng ở đâu thì chọn khổ đó — sửa được sau.">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {COLLAGE_FORMATS.map((f) => {
                const on = opts.formatId === f.id;
                const ratio = f.w / f.h;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOpts((o) => ({ ...o, formatId: f.id }))}
                    className="flex flex-col items-center gap-1.5 rounded-[12px] px-1.5 py-2.5 text-center"
                    style={{ background: on ? "var(--acS)" : "var(--sf)", border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}` }}
                  >
                    <span className="flex h-12 items-center justify-center">
                      <span className="block rounded-[3px]" style={{ height: ratio >= 1 ? 48 / ratio : 46, width: ratio >= 1 ? 48 : 46 * ratio, border: `2px solid ${on ? "var(--ac)" : "var(--tx3)"}` }} />
                    </span>
                    <span className="text-[12.5px] font-semibold" style={{ color: on ? "var(--ac)" : "var(--tx)" }}>{f.label}</span>
                    <span className="text-[10.5px] leading-tight" style={{ color: "var(--tx3)" }}>{f.hint}</span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Số ảnh mỗi trang" desc={<>Máy chia {count} ảnh thành <b style={{ color: "var(--tx)" }}>{opts.perPage === "mix" ? `khoảng ${pages}` : pages} layout</b>{opts.perPage !== "mix" && count % (opts.perPage as number) !== 0 && pages > 1 ? " (các trang chênh nhau tối đa 1 ảnh)" : ""}.</>}>
            <div className="flex flex-wrap gap-2">
              {PER_PAGE.map((n) => {
                const on = opts.perPage === n;
                return (
                  <button
                    key={String(n)}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOpts((o) => ({ ...o, perPage: n }))}
                    className="inline-flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold"
                    style={on ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                  >
                    {n === "mix" ? (
                      <>
                        <Shuffle size={15} /> Ngẫu nhiên 2–5
                      </>
                    ) : (
                      n
                    )}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Phong cách">
            <div className="flex flex-wrap gap-2">
              {[...COLLAGE_STYLES.map((s) => ({ id: s.id, name: s.name, bg: s.background, ink: s.ink, blur: !!s.bgPhoto })), { id: MIX_STYLE, name: "Mỗi trang một kiểu", bg: "", ink: "", blur: false }].map((s) => {
                const on = opts.styleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOpts((o) => ({ ...o, styleId: s.id }))}
                    className="inline-flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-[13.5px] font-semibold"
                    style={on ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                  >
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-bold"
                      style={{
                        background: s.id === MIX_STYLE ? "conic-gradient(#fff 0 25%, #f5f0e8 0 50%, #f7e9e6 0 75%, #121212 0)" : s.blur ? "linear-gradient(135deg,#c9b8a8,#7d8fa3)" : s.bg,
                        color: s.ink || "var(--tx)",
                        border: "1px solid var(--bd)",
                      }}
                    >
                      {s.id === MIX_STYLE ? "" : "Aa"}
                    </span>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group
            title="Nội dung trên ảnh"
            desc={
              <>
                Mỗi nội dung hiện trên <b style={{ color: "var(--tx)" }}>đúng 1 layout</b> do máy chọn ngẫu nhiên; layout không có nội dung chỉ có ảnh. Tối đa {Math.min(pages, COLLAGE_LIMITS.texts)} nội dung cho {pages} layout. Để trống nếu chỉ muốn ảnh.
              </>
            }
          >
            <div className="flex flex-col gap-2">
              {opts.texts.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                    {i + 1}
                  </span>
                  <textarea
                    value={t}
                    rows={2}
                    onChange={(e) => setText(i, e.target.value)}
                    placeholder={i === 0 ? "Ví dụ: Chúng mình cưới rồi! 💍" : "Nội dung khác…"}
                    aria-label={`Nội dung ${i + 1}`}
                    className="v2-input min-h-[52px] flex-1 resize-none"
                    style={{ fontSize: 16 }}
                  />
                  <button type="button" onClick={() => removeText(i)} aria-label={`Xoá nội dung ${i + 1}`} className="mt-1.5 flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ color: "var(--tx3)" }}>
                    <X size={17} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addText()} disabled={!canAdd} className={btn("secondary", "md", "self-start")}>
                <Plus size={16} /> Thêm nội dung
              </button>
              {ideas.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ideas.map((x) => (
                    <button
                      key={x}
                      type="button"
                      disabled={!canAdd && !opts.texts.some((t) => !t.trim())}
                      onClick={() => addText(x)}
                      className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium disabled:opacity-50"
                      style={{ background: "var(--sf2)", color: "var(--tx2)", border: "1px dashed var(--bd)" }}
                    >
                      <Type size={12} /> {x}
                    </button>
                  ))}
                </div>
              ) : null}
              {tooMany ? (
                <p className="text-[12.5px] font-medium" style={{ color: "var(--rd)" }}>
                  Bạn có {filled} nội dung nhưng chỉ có {pages} layout — mỗi layout chỉ mang một nội dung. Bớt nội dung, chọn thêm ảnh hoặc giảm số ảnh mỗi trang.
                </p>
              ) : null}
            </div>
          </Group>
        </div>
      </div>
      <StudioFooter>
        <button type="button" onClick={onGenerate} disabled={busy || tooMany || count === 0} className={btn("primary", "lg", "flex-1")}>
          {busy ? <LoaderCircle size={17} className="animate-spin" /> : <LayoutGrid size={17} />}
          {busy ? "Đang ghép…" : `Tạo ${opts.perPage === "mix" ? "" : `${pages} `}layout`}
        </button>
      </StudioFooter>
    </>
  );
}
