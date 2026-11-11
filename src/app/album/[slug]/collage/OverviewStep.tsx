"use client";

import { CircleCheck, CloudOff, Download, LoaderCircle, Plus, Shuffle, SlidersHorizontal, Trash2, Type } from "lucide-react";
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
}) {
  const vp = useViewport();
  const f = formatById(doc.formatId);
  const cols = vp.w >= 900 ? 4 : vp.w >= 600 ? 3 : 2;
  const tile = Math.floor((Math.min(vp.w, 1080) - 24 - (cols - 1) * 10) / cols);
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
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            Chạm vào một layout để sửa riêng: kéo chỉnh ảnh, đổi ảnh, đổi bố cục, sửa chữ, đổi nền. Bộ này được giữ 1 ngày kể từ lần sửa cuối — nhớ tải ảnh về máy.
          </p>
          <div className="grid gap-[10px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {doc.pages.map((p, i) => {
              const t = pageText(p);
              return (
                <button key={p.id} type="button" onClick={() => onOpenPage(i)} className="group text-left" aria-label={`Sửa layout ${i + 1}`}>
                  <div className="overflow-hidden rounded-[10px]" style={{ border: "1px solid var(--bd)", boxShadow: "0 4px 14px -8px rgba(20,15,25,.35)" }}>
                    <PageView doc={doc} page={p} width={tile} img={img} driveOf={driveOf} fontsReady={fontsReady} watermark={watermark} />
                  </div>
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
        <button type="button" onClick={onExport} className={btn("primary", "lg", "flex-1")}>
          <Download size={17} /> Tải {doc.pages.length > 1 ? `${doc.pages.length} ảnh` : "ảnh"} về máy
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
                  {first ? <PageView doc={s.data} page={first} width={Math.round(64 * Math.min(1, f.w / f.h))} img={img} driveOf={driveOf} fontsReady={fontsReady} /> : null}
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
