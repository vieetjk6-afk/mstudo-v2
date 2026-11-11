"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Minus, Plus, Sparkles, X } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { suggestPhotos, type PhotoCat, type PhotoInfo } from "@/lib/collage/categories";
import { COLLAGE_LIMITS } from "@/lib/collage/types";
import type { PersonChip } from "@/lib/face-people";
import type { PhotoLite } from "./api";
import type { ImgUrl } from "./PageView";
import { CAT_ALL, CAT_HEARTS, CAT_PICKED, CAT_SUGGEST, CatChips, PhotoGrid, StudioFooter, StudioHeader, tagLabel, useViewport } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BƯỚC 1 — CHỌN ẢNH ĐỂ GHÉP. Chỉ ảnh studio đã giao trong album (không có nút
   tải ảnh lên). Hai cách:
     • TỰ ĐỘNG: chọn nhiều ảnh, máy chia vào các layout;
     • TỰ CHỌN TỪNG LAYOUT: chọn ảnh cho layout 1, bấm "+ Layout" chọn tiếp
       layout 2… — máy chỉ dàn trang, không chia lại ảnh.
   Gợi ý ảnh đẹp theo nhóm: ảnh chung, cô dâu, chú rể, decor & chi tiết, bê
   quả, gia đình… (lib/collage/categories). "Chọn giúp tôi" chọn đúng số ảnh
   khách nhập, trải đều buổi chụp; ảnh khách đã thả tim được ưu tiên.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PickMode = "auto" | "manual";

/** Số ảnh mặc định cho "Chọn giúp tôi" ở chế độ tự động. */
export const SUGGEST_COUNT = 12;

/** Ô nhập số có nút −/+ (bấm được bằng ngón cái, gõ được số). */
function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v) || min)));
  return (
    <div className="inline-flex h-10 flex-none items-center overflow-hidden rounded-full" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= min} aria-label="Bớt một ảnh" className="flex h-10 w-10 items-center justify-center disabled:opacity-35" style={{ color: "var(--tx2)" }}>
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => set(Number(e.target.value))}
        className="tnum h-10 w-11 bg-transparent text-center text-[15px] font-semibold outline-none"
        style={{ color: "var(--tx)", fontSize: 16 }}
      />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label="Thêm một ảnh" className="flex h-10 w-10 items-center justify-center disabled:opacity-35" style={{ color: "var(--tx2)" }}>
        <Plus size={16} />
      </button>
    </div>
  );
}

export default function PickStep({
  photos,
  cats,
  info,
  selected,
  setSelected,
  mode,
  setMode,
  groups,
  setGroups,
  active,
  setActive,
  hearts,
  people,
  driveIdOf,
  img,
  onBack,
  backIsClose,
  onNext,
  toast,
}: {
  photos: PhotoLite[];
  cats: PhotoCat[];
  info: Record<string, PhotoInfo>;
  /** Chế độ tự động: ảnh đã chọn (theo thứ tự chọn). */
  selected: string[];
  setSelected: (ids: string[]) => void;
  mode: PickMode;
  setMode: (m: PickMode) => void;
  /** Chế độ tự chọn: ảnh của từng layout. */
  groups: string[][];
  setGroups: (g: string[][]) => void;
  /** Layout đang chọn ảnh (chế độ tự chọn). */
  active: number;
  setActive: (i: number) => void;
  hearts: ReadonlySet<string>;
  people: PersonChip[];
  driveIdOf: Map<string, string>;
  img: ImgUrl;
  onBack: () => void;
  backIsClose: boolean;
  onNext: () => void;
  toast: (t: string) => void;
}) {
  const vp = useViewport();
  const manual = mode === "manual";
  const [cat, setCat] = useState(CAT_SUGGEST);
  const [autoN, setAutoN] = useState(SUGGEST_COUNT);
  const [pageN, setPageN] = useState(4);
  const order = useMemo(() => photos.map((p) => p.id), [photos]);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const res = useMemo(() => ({ cats, info }), [cats, info]);
  const suggested = useMemo(() => suggestPhotos(order, res, 30, hearts), [order, res, hearts]);
  const heartList = useMemo(() => order.filter((id) => hearts.has(id)), [order, hearts]);

  const cur = useMemo(() => (manual ? (groups[active] ?? []) : selected), [manual, groups, active, selected]);
  const curSet = useMemo(() => new Set(cur), [cur]);
  /** Ảnh đang nằm ở layout nào (chế độ tự chọn). */
  const groupOf = useMemo(() => {
    const m = new Map<string, number>();
    groups.forEach((g, i) => g.forEach((id) => m.set(id, i)));
    return m;
  }, [groups]);
  const used = manual ? groupOf.size : selected.length;
  const layouts = groups.filter((g) => g.length).length;

  const shown = useMemo(() => {
    let ids: string[];
    if (cat === CAT_SUGGEST) ids = suggested;
    else if (cat === CAT_ALL) ids = order;
    else if (cat === CAT_PICKED) ids = cur;
    else if (cat === CAT_HEARTS) ids = heartList;
    else ids = order.filter((id) => info[id]?.tags.includes(cat));
    return ids.map((id) => byId.get(id)).filter((p): p is PhotoLite => !!p);
  }, [cat, suggested, order, cur, heartList, info, byId]);

  const setGroup = (i: number, ids: string[]) => setGroups(groups.map((g, j) => (j === i ? ids : g)));

  const toggle = (id: string) => {
    if (!manual) {
      if (curSet.has(id)) setSelected(selected.filter((x) => x !== id));
      else if (selected.length >= COLLAGE_LIMITS.photos) toast(`Mỗi bộ ảnh ghép tối đa ${COLLAGE_LIMITS.photos} ảnh.`);
      else setSelected([...selected, id]);
      return;
    }
    if (curSet.has(id)) {
      setGroup(active, cur.filter((x) => x !== id));
      return;
    }
    if (cur.length >= COLLAGE_LIMITS.pagePhotos) {
      toast(`Mỗi layout tối đa ${COLLAGE_LIMITS.pagePhotos} ảnh — bấm “+ Layout” để chọn tiếp layout mới.`);
      return;
    }
    const from = groupOf.get(id);
    if (from === undefined && used >= COLLAGE_LIMITS.photos) {
      toast(`Mỗi bộ ảnh ghép tối đa ${COLLAGE_LIMITS.photos} ảnh.`);
      return;
    }
    // Ảnh đang ở layout khác → chuyển sang layout đang chọn (mỗi ảnh một chỗ).
    setGroups(groups.map((g, j) => (j === active ? [...g, id] : j === from ? g.filter((x) => x !== id) : g)));
    if (from !== undefined) toast(`Đã chuyển ảnh từ layout ${from + 1} sang layout ${active + 1}.`);
  };

  const room = manual ? Math.max(0, COLLAGE_LIMITS.pagePhotos - cur.length) : Math.max(0, COLLAGE_LIMITS.photos - selected.length);
  const helpN = manual ? Math.max(1, Math.min(pageN, room || 1)) : Math.max(1, Math.min(autoN, room || 1));
  const helpMe = () => {
    if (!room) {
      toast(manual ? `Layout này đã đủ ${COLLAGE_LIMITS.pagePhotos} ảnh.` : `Bạn đã chọn đủ ${COLLAGE_LIMITS.photos} ảnh.`);
      return;
    }
    // Không lấy lại ảnh đã nằm ở layout khác / đã chọn.
    const taken = new Set<string>(manual ? [...groupOf.keys()] : selected);
    const add = suggestPhotos(order, res, helpN, new Set([...hearts].filter((id) => !taken.has(id))), taken).filter((id) => !taken.has(id)).slice(0, helpN);
    if (!add.length) {
      toast("Bạn đã chọn hết các ảnh gợi ý.");
      return;
    }
    if (manual) setGroup(active, [...cur, ...add]);
    else setSelected([...selected, ...add]);
    toast(`Đã chọn thêm ${add.length} ảnh gợi ý — bấm vào ảnh để bỏ bớt.`);
    setCat(CAT_PICKED);
  };

  const addLayout = () => {
    if (!cur.length) {
      toast(`Chọn ảnh cho layout ${active + 1} trước đã.`);
      return;
    }
    if (groups.length >= COLLAGE_LIMITS.pages) {
      toast(`Mỗi bộ tối đa ${COLLAGE_LIMITS.pages} layout.`);
      return;
    }
    // Có layout trống sẵn thì sang đó, không thêm layout trống thứ hai.
    const empty = groups.findIndex((g) => !g.length);
    if (empty >= 0) {
      setActive(empty);
    } else {
      setGroups([...groups, []]);
      setActive(groups.length);
    }
    setCat(CAT_SUGGEST);
  };
  const removeLayout = (i: number) => {
    if (groups.length <= 1) {
      setGroups([[]]);
      setActive(0);
      return;
    }
    setGroups(groups.filter((_, j) => j !== i));
    setActive(Math.max(0, Math.min(active > i ? active - 1 : active, groups.length - 2)));
  };

  const cols = vp.w >= 1024 ? 6 : vp.w >= 640 ? 4 : 3;
  const posOf = (id: string) => {
    const i = cur.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };
  const labelOf = (id: string) => {
    if (manual) {
      const g = groupOf.get(id);
      if (g !== undefined && g !== active) return `Layout ${g + 1}`;
    }
    return cat === CAT_SUGGEST || cat === CAT_ALL || cat === CAT_PICKED ? tagLabel(info[id], cats) : null;
  };

  return (
    <>
      <StudioHeader
        title={manual ? `Chọn ảnh cho layout ${active + 1}` : "Chọn ảnh để ghép"}
        sub={manual ? `${cur.length}/${COLLAGE_LIMITS.pagePhotos} ảnh · ${layouts} layout` : selected.length ? `Đã chọn ${selected.length} ảnh` : "Chạm vào ảnh để chọn"}
        onBack={onBack}
        close={backIsClose}
        backLabel={backIsClose ? "Đóng" : "Quay lại"}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1080px]">
          {/* Cách ghép */}
          <div className="mx-3 mt-3 grid grid-cols-2 gap-1 rounded-[14px] p-1" role="radiogroup" aria-label="Cách ghép" style={{ background: "var(--sf2)" }}>
            {(
              [
                { v: "auto", t: "Tự động ghép", d: "Chọn ảnh, máy chia vào các layout" },
                { v: "manual", t: "Tự chọn từng layout", d: "Bạn chọn ảnh cho mỗi layout" },
              ] as const
            ).map((o) => {
              const on = mode === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(o.v)}
                  className="rounded-[11px] px-2.5 py-2 text-left"
                  style={on ? { background: "var(--sf)", boxShadow: "0 1px 4px rgba(15,30,55,.12)", color: "var(--tx)" } : { color: "var(--tx2)" }}
                >
                  <span className="block text-[13.5px] font-semibold" style={{ color: on ? "var(--ac)" : undefined }}>
                    {o.t}
                  </span>
                  <span className="block text-[11.5px] leading-snug" style={{ color: "var(--tx3)" }}>
                    {o.d}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Gợi ý: chọn giúp đúng số ảnh khách muốn */}
          <div className="mx-3 mt-2.5 rounded-[14px] p-3" style={{ background: "var(--acS)" }}>
            <div className="flex items-start gap-2.5">
              <Sparkles size={18} className="mt-0.5 flex-none" style={{ color: "var(--ac)" }} />
              <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
                {manual ? (
                  <>
                    Máy chọn giúp những tấm đẹp cho <b style={{ color: "var(--tx)" }}>layout {active + 1}</b> — không lấy lại ảnh đã nằm ở layout khác.
                  </>
                ) : (
                  <>
                    Một bộ đẹp nên có <b style={{ color: "var(--tx)" }}>ảnh chung</b>, <b style={{ color: "var(--tx)" }}>cô dâu</b>, <b style={{ color: "var(--tx)" }}>chú rể</b>, vài tấm <b style={{ color: "var(--tx)" }}>decor</b> và khoảnh khắc như{" "}
                    <b style={{ color: "var(--tx)" }}>bê quả</b>. Máy chọn giúp những tấm rõ mặt, trải đều buổi chụp.
                  </>
                )}
              </p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Stepper
                value={manual ? pageN : autoN}
                min={1}
                max={manual ? COLLAGE_LIMITS.pagePhotos : COLLAGE_LIMITS.photos}
                onChange={manual ? setPageN : setAutoN}
                label="Số ảnh muốn máy chọn giúp"
              />
              <button type="button" onClick={helpMe} className={btn("primary", "md", "min-w-0 flex-1 sm:flex-none")}>
                <Sparkles size={15} /> Chọn giúp tôi {helpN} ảnh
              </button>
            </div>
          </div>

          <div className="sticky top-0 z-[2] mt-1" style={{ background: "var(--bg)" }}>
            <CatChips
              cats={cats}
              value={cat}
              onChange={setCat}
              counts={{ suggest: suggested.length, all: order.length, picked: cur.length, hearts: heartList.length }}
              people={people}
              driveIdOf={driveIdOf}
            />
          </div>
          {shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13.5px]" style={{ color: "var(--tx3)" }}>
              {cat === CAT_PICKED ? (manual ? `Layout ${active + 1} chưa có ảnh nào.` : "Bạn chưa chọn ảnh nào.") : "Nhóm này chưa có ảnh."}
            </p>
          ) : (
            <div className="px-[3px] pb-4 sm:px-3">
              <PhotoGrid
                photos={shown}
                img={img}
                picked={(id) => curSet.has(id)}
                order={posOf}
                onTap={toggle}
                label={labelOf}
                dim={manual ? (id) => groupOf.has(id) && groupOf.get(id) !== active : undefined}
                cols={cols}
              />
            </div>
          )}
        </div>
      </div>

      {/* Các layout tự chọn */}
      {manual ? (
        <div className="flex flex-none items-center gap-2 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: "none", borderTop: "1px solid var(--bd)", background: "var(--sf)" }} role="tablist" aria-label="Các layout">
          {groups.map((g, i) => {
            const on = i === active;
            const first = g[0] ? byId.get(g[0]) : undefined;
            return (
              <div key={i} className="relative flex-none">
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13px] font-semibold"
                  style={on ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full text-[11px] font-bold" style={{ background: "var(--sf)", color: "var(--tx3)" }}>
                    {first ? <img src={img(first.d, 200)} alt="" className="h-full w-full object-cover" /> : i + 1}
                  </span>
                  Layout {i + 1}
                  <span className="tnum text-[12px]" style={{ color: on ? "var(--ac)" : "var(--tx3)" }}>
                    {g.length}
                  </span>
                </button>
                {on && (groups.length > 1 || g.length) ? (
                  <button
                    type="button"
                    onClick={() => removeLayout(i)}
                    aria-label={`Xoá layout ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: "var(--tx2)", color: "var(--sf)" }}
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addLayout}
            className="inline-flex h-10 flex-none items-center gap-1 rounded-full px-3.5 text-[13px] font-semibold"
            style={{ border: "1.5px dashed var(--bd)", color: "var(--tx2)" }}
          >
            <Plus size={15} /> Layout
          </button>
        </div>
      ) : null}

      <StudioFooter>
        {cur.length > 0 ? (
          <button type="button" onClick={() => (manual ? setGroup(active, []) : setSelected([]))} className={btn("ghost", "lg", "flex-none")}>
            Bỏ chọn
          </button>
        ) : null}
        {manual ? (
          <button type="button" onClick={onNext} disabled={layouts === 0} className={btn("primary", "lg", "flex-1")}>
            Tiếp tục{layouts ? ` · ${layouts} layout` : ""} <ArrowRight size={17} />
          </button>
        ) : (
          <button type="button" onClick={onNext} disabled={selected.length === 0} className={btn("primary", "lg", "flex-1")}>
            Tiếp tục{selected.length ? ` · ${selected.length} ảnh` : ""} <ArrowRight size={17} />
          </button>
        )}
      </StudioFooter>
    </>
  );
}
