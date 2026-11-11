"use client";

import { CircleCheck, Clapperboard, CloudOff, Download, Eye, LoaderCircle, Plus, Shuffle, SlidersHorizontal, Trash2, Type } from "lucide-react";
import { PHOTO_FILTERS } from "@/lib/collage/filters";
import type { SignSpec } from "@/lib/collage/brand";
import { btn } from "@/components/v2/kit";
import type { CollageDoc } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { pageText } from "@/lib/collage/generate";
import { fmtDateTime } from "@/lib/date";
import type { SavedSet } from "./api";
import { PageView, type ImgUrl } from "./PageView";
import { StudioFooter, StudioHeader, leftText, useViewport } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BƯỚC 3 — XEM CẢ BỘ LAYOUT vừa ghép: lưới các trang, "Tạo lại ngẫu nhiên",
   chạm một trang để sửa riêng trang đó. Kèm màn danh sách bộ đã lưu (giữ 1
   ngày) để khách mở lại sửa tiếp.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SaveStatus = { state: "idle" | "saving" | "saved" | "error"; expiresAt?: string | null; msg?: string };

export function SaveBadge({ s }: { s: SaveStatus }) {
  if (s.state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--tx3)" }}>
        <LoaderCircle size={13} className="animate-spin" /> Đang lưu…
      </span>
    );
  if (s.state === "error")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--rd)" }}>
        <CloudOff size={13} /> {s.msg || "Chưa lưu được"}
      </span>
    );
  if (s.state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--gn)" }}>
        <CircleCheck size={13} /> Đã lưu · giữ tới {s.expiresAt ? fmtDateTime(s.expiresAt).replace(/\/\d{4}$/, "") : "1 ngày"}
      </span>
    );
  return null;
}

export function OverviewStep({
  doc,
  img,
  driveOf,
  fontsReady,
  watermark,
  save,
  busy,
  onClose,
  onOpenPage,
  onShuffle,
  onOptions,
  onExport,
  sign = null,
  lockColor = false,
  onFilter,
  onPreview,
  onVideo,
}: {
  doc: CollageDoc;
  img: ImgUrl;
  driveOf: (id: string) => string | undefined;
  fontsReady: number;
  watermark: string | null;
  save: SaveStatus;
  busy: boolean;
  onClose: () => void;
  onOpenPage: (i: number) => void;
  onShuffle: () => void;
  onOptions: () => void;
  onExport: () => void;
  sign?: SignSpec | null;
  /** Studio khoá màu ảnh: ẩn bộ lọc màu. */
  lockColor?: boolean;
  onFilter: (id: string) => void;
  onPreview: () => void;
  onVideo: () => void;
}) {
  const vp = useViewport();
  const f = formatById(doc.formatId);
  const cols = vp.w >= 900 ? 4 : vp.w >= 600 ? 3 : 2;
  const full = Math.min(vp.w, 1080) - 24;
  const tile = Math.floor((full - (cols - 1) * 10) / cols);
  const images = doc.pages.reduce((n, p) => n + Math.max(1, Math.round(p.span ?? 1)), 0);
  return (
    <>
      <StudioHeader title={`Bộ ảnh ghép · ${doc.pages.length} layout`} sub={<SaveBadge s={save} />} onBack={onClose} close backLabel="Đóng" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1080px] px-3 pb-6 pt-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={onShuffle} disabled={busy} className={btn("secondary", "md")}>
              <Shuffle size={16} /> Tạo lại ngẫu nhiên
            </button>
            <button type="button" onClick={onOptions} disabled={busy} className={btn("ghost", "md")}>
              <SlidersHorizontal size={16} /> Đổi tuỳ chọn
            </button>
          </div>
          {lockColor ? null : (
            <div className="-mx-3 mb-3 flex items-center gap-2 overflow-x-auto px-3" style={{ scrollbarWidth: "none" }} role="radiogroup" aria-label="Màu ảnh cả bộ">
              <span className="flex-none text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
                Màu ảnh
              </span>
              {PHOTO_FILTERS.map((x) => {
                const on = (doc.filter ?? "none") === x.id;
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onFilter(x.id)}
                    className="h-9 flex-none rounded-full px-3 text-[13px] font-semibold"
                    style={on ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                  >
                    {x.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Chạm vào một layout để sửa riêng: kéo chỉnh ảnh, đổi ảnh, đổi bố cục, sửa chữ, đổi nền. Bộ này được giữ 1 ngày kể từ lần sửa cuối — nhớ tải ảnh về máy.
          </p>
          <div className="grid gap-[10px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {doc.pages.map((p, i) => {
              const t = pageText(p);
              const span = Math.max(1, Math.round(p.span ?? 1));
              return (
                <button key={p.id} type="button" onClick={() => onOpenPage(i)} className="group text-left" aria-label={`Sửa layout ${i + 1}`} style={span > 1 ? { gridColumn: "1 / -1" } : undefined}>
                  <div className="overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--bd)", boxShadow: "0 4px 14px -8px rgba(20,15,25,.35)" }}>
                    <PageView doc={doc} page={p} width={span > 1 ? full : tile} img={img} driveOf={driveOf} fontsReady={fontsReady} watermark={watermark} slides={span > 1 ? "full" : undefined} sign={sign} />
                  </div>
                  {span > 1 ? (
                    <span className="mt-1 block text-[12px]" style={{ color: "var(--tx3)" }}>
                      Carousel liền mạch · {span} ảnh nối nhau — đăng cùng một bài, đúng thứ tự 1 → {span}.
                    </span>
                  ) : null}
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                    {i + 1}
                    {t ? (
                      <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium" style={{ color: "var(--tx3)" }}>
                        <Type size={12} className="flex-none" /> <span className="truncate">{t.text}</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-[12px]" style={{ color: "var(--tx3)" }}>
            {f.label} · {f.w}×{f.h} px
          </p>
        </div>
      </div>
      <StudioFooter>
        <button type="button" onClick={onPreview} aria-label="Xem trước như trên Instagram" className={btn("secondary", "lg", "flex-none px-3")}>
          <Eye size={18} />
        </button>
        <button type="button" onClick={onVideo} className={btn("secondary", "lg", "flex-none px-3")}>
          <Clapperboard size={18} /> Video
        </button>
        <button type="button" onClick={onExport} className={btn("primary", "lg", "flex-1")}>
          <Download size={17} /> Tải {images > 1 ? `${images} ảnh` : "ảnh"}
        </button>
      </StudioFooter>
    </>
  );
}

export function SetsStep({
  sets,
  img,
  driveOf,
  fontsReady,
  onClose,
  onOpen,
  onDelete,
  onNew,
  busyId,
}: {
  sets: SavedSet[];
  img: ImgUrl;
  driveOf: (id: string) => string | undefined;
  fontsReady: number;
  onClose: () => void;
  onOpen: (s: SavedSet) => void;
  onDelete: (s: SavedSet) => void;
  onNew: () => void;
  busyId: string | null;
}) {
  return (
    <>
      <StudioHeader title="Ảnh ghép của bạn" sub="Giữ 1 ngày kể từ lần sửa cuối" onBack={onClose} close backLabel="Đóng" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2.5 px-3 pb-6 pt-3">
          {sets.map((s) => {
            const first = s.data.pages[0];
            const f = formatById(s.data.formatId);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-[14px] p-2.5" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                <button type="button" onClick={() => onOpen(s)} className="flex-none overflow-hidden rounded-[8px]" aria-label="Mở bộ ảnh ghép" style={{ border: "1px solid var(--bd2)" }}>
                  {first ? (
                    <PageView
                      doc={s.data}
                      page={first}
                      width={(first.span ?? 1) > 1 ? Math.min(180, Math.round((64 * f.w * (first.span ?? 1)) / f.h)) : Math.round(64 * Math.min(1, f.w / f.h))}
                      img={img}
                      driveOf={driveOf}
                      fontsReady={fontsReady}
                      slides={(first.span ?? 1) > 1 ? "lines" : undefined}
                    />
                  ) : null}
                </button>
                <button type="button" onClick={() => onOpen(s)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-semibold">{s.title || "Bộ ảnh ghép"}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    {s.data.pages.length} layout · {f.label} · {leftText(s.expires_at)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s)}
                  disabled={busyId === s.id}
                  aria-label="Xoá bộ ảnh ghép"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
                  style={{ color: "var(--tx3)" }}
                >
                  {busyId === s.id ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <StudioFooter>
        <button type="button" onClick={onNew} className={btn("primary", "lg", "flex-1")}>
          <Plus size={17} /> Ghép bộ mới
        </button>
      </StudioFooter>
    </>
  );
}
