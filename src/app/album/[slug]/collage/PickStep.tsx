"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { btn } from "@/components/v2/kit";
import { suggestPhotos, type PhotoCat, type PhotoInfo } from "@/lib/collage/categories";
import { COLLAGE_LIMITS } from "@/lib/collage/types";
import type { PersonChip } from "@/lib/face-people";
import type { PhotoLite } from "./api";
import type { ImgUrl } from "./PageView";
import { CAT_ALL, CAT_HEARTS, CAT_PICKED, CAT_SUGGEST, CatChips, PhotoGrid, StudioFooter, StudioHeader, tagLabel, useViewport } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BƯỚC 1 — CHỌN ẢNH ĐỂ GHÉP. Chỉ ảnh studio đã giao trong album (không có nút
   tải ảnh lên). Gợi ý ảnh đẹp theo nhóm: ảnh chung, cô dâu, chú rể, decor &
   chi tiết, bê quả, gia đình… (lib/collage/categories — khuôn mặt máy chủ đã
   quét + tên thư mục studio đặt). Ảnh khách đã thả tim được ưu tiên.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SUGGEST_COUNT = 12;

export default function PickStep({
  photos,
  cats,
  info,
  selected,
  setSelected,
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
  selected: string[];
  setSelected: (ids: string[]) => void;
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
  const [cat, setCat] = useState(CAT_SUGGEST);
  const order = useMemo(() => photos.map((p) => p.id), [photos]);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const res = useMemo(() => ({ cats, info }), [cats, info]);
  const suggested = useMemo(() => suggestPhotos(order, res, 30, hearts), [order, res, hearts]);
  const heartList = useMemo(() => order.filter((id) => hearts.has(id)), [order, hearts]);
  const pickedSet = useMemo(() => new Set(selected), [selected]);

  const shown = useMemo(() => {
    let ids: string[];
    if (cat === CAT_SUGGEST) ids = suggested;
    else if (cat === CAT_ALL) ids = order;
    else if (cat === CAT_PICKED) ids = selected;
    else if (cat === CAT_HEARTS) ids = heartList;
    else ids = order.filter((id) => info[id]?.tags.includes(cat));
    return ids.map((id) => byId.get(id)).filter((p): p is PhotoLite => !!p);
  }, [cat, suggested, order, selected, heartList, info, byId]);

  const toggle = (id: string) => {
    if (pickedSet.has(id)) setSelected(selected.filter((x) => x !== id));
    else if (selected.length >= COLLAGE_LIMITS.photos) toast(`Mỗi bộ ảnh ghép tối đa ${COLLAGE_LIMITS.photos} ảnh.`);
    else setSelected([...selected, id]);
  };

  const helpMe = () => {
    const add = suggestPhotos(order, res, SUGGEST_COUNT, new Set([...hearts, ...selected])).filter((id) => !pickedSet.has(id));
    const next = [...selected, ...add].slice(0, COLLAGE_LIMITS.photos);
    setSelected(next);
    toast(add.length ? `Đã chọn thêm ${next.length - selected.length} ảnh gợi ý — bấm vào ảnh để bỏ bớt.` : "Bạn đã chọn hết các ảnh gợi ý.");
    setCat(CAT_PICKED);
  };

  const cols = vp.w >= 1024 ? 6 : vp.w >= 640 ? 4 : 3;
  const posOf = (id: string) => {
    const i = selected.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };

  return (
    <>
      <StudioHeader
        title="Chọn ảnh để ghép"
        sub={selected.length ? `Đã chọn ${selected.length} ảnh` : "Chạm vào ảnh để chọn"}
        onBack={onBack}
        close={backIsClose}
        backLabel={backIsClose ? "Đóng" : "Quay lại"}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-[14px] p-3" style={{ background: "var(--acS)" }}>
            <Sparkles size={18} className="flex-none" style={{ color: "var(--ac)" }} />
            <p className="min-w-0 flex-1 basis-52 text-[13px]" style={{ color: "var(--tx2)" }}>
              Một bộ đẹp nên có <b style={{ color: "var(--tx)" }}>ảnh chung</b>, <b style={{ color: "var(--tx)" }}>cô dâu</b>, <b style={{ color: "var(--tx)" }}>chú rể</b>, vài tấm{" "}
              <b style={{ color: "var(--tx)" }}>decor</b> và khoảnh khắc như <b style={{ color: "var(--tx)" }}>bê quả</b>. Máy chọn giúp những tấm rõ mặt, trải đều buổi chụp.
            </p>
            <button type="button" onClick={helpMe} className={btn("primary", "sm", "w-full sm:w-auto")}>
              <Sparkles size={15} /> Chọn giúp tôi {SUGGEST_COUNT} ảnh
            </button>
          </div>
          <div className="sticky top-0 z-[2]" style={{ background: "var(--bg)" }}>
            <CatChips
              cats={cats}
              value={cat}
              onChange={setCat}
              counts={{ suggest: suggested.length, all: order.length, picked: selected.length, hearts: heartList.length }}
              people={people}
              driveIdOf={driveIdOf}
            />
          </div>
          {shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13.5px]" style={{ color: "var(--tx3)" }}>
              {cat === CAT_PICKED ? "Bạn chưa chọn ảnh nào." : "Nhóm này chưa có ảnh."}
            </p>
          ) : (
            <div className="px-[3px] pb-4 sm:px-3">
              <PhotoGrid
                photos={shown}
                img={img}
                picked={(id) => pickedSet.has(id)}
                order={posOf}
                onTap={toggle}
                label={cat === CAT_SUGGEST || cat === CAT_ALL || cat === CAT_PICKED ? (id) => tagLabel(info[id], cats) : undefined}
                cols={cols}
              />
            </div>
          )}
        </div>
      </div>
      <StudioFooter>
        {selected.length > 0 ? (
          <button type="button" onClick={() => setSelected([])} className={btn("ghost", "lg", "flex-none")}>
            Bỏ chọn
          </button>
        ) : null}
        <button type="button" onClick={onNext} disabled={selected.length === 0} className={btn("primary", "lg", "flex-1")}>
          Tiếp tục{selected.length ? ` · ${selected.length} ảnh` : ""} <ArrowRight size={17} />
        </button>
      </StudioFooter>
    </>
  );
}
