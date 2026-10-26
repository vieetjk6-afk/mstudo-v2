"use client";

import { Check, Loader2, Maximize2, Play, Sparkles, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { btn, Empty, Progress } from "@/components/v2/kit";
import { Drawer, Switch } from "@/components/v2/kit-client";
import { SCAN_CAP, type DuplicateScan } from "./useDuplicateScan";
import { useAlbumImg } from "./album-v2-ui";

/* ═══════════════════════════════════════════════════════════════════════════
   ẢNH NA NÁ NHAU — giao diện mới: một ngăn kéo công cụ. Cùng luật với khối cũ
   ./AlbumDuplicateFinder (logic ở ./useDuplicateScan): khách bấm mới quét,
   không bao giờ tự thêm ảnh vào lựa chọn, bấm một tấm là mở ĐÚNG khung xem ảnh
   của lưới trên cả chuỗi, vòng tròn ở góc là đường tắt để chọn.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function DuplicatesV2({
  open,
  onClose,
  scan,
  photoCount,
  selected,
  hide,
  onHide,
  onToggle,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  /** Trạng thái quét — giữ ở trang để đóng ngăn kéo vẫn quét tiếp. */
  scan: DuplicateScan;
  photoCount: number;
  selected: ReadonlySet<string>;
  hide: boolean;
  onHide: (v: boolean) => void;
  onToggle: (id: string) => void;
  onOpen: (ids: string[], id: string) => void;
}) {
  const { t } = useLang();
  const img = useAlbumImg();
  const { busy, progress, run, stop, scanList, byId, shown, dupCount } = scan;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("dupTitle")}
      desc={t("dupIntro")}
      width={520}
      footer={
        busy ? (
          <button type="button" onClick={stop} className={btn("secondary", "md", "w-full sm:w-auto")}>
            <X size={16} /> {t("dupStop")}
          </button>
        ) : (
          <button type="button" onClick={run} disabled={scanList.length === 0} className={btn(shown ? "secondary" : "primary", "md", "w-full sm:w-auto")}>
            <Play size={16} /> {t("dupRun")}
          </button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {progress && (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--ac)" }} /> {t("dupRunning")}
            </p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="tnum text-[12px]" style={{ color: "var(--tx3)" }}>
              {progress.done}/{progress.total}
            </p>
          </div>
        )}

        {!shown && !busy && (
          <Empty
            compact
            icon={Sparkles}
            title="Gom những tấm chụp liên tiếp"
            hint="Bấm “Tìm ảnh na ná nhau” ở dưới. Máy sẽ xếp những tấm giống nhau cạnh nhau và chỉ ra tấm nét nhất — bạn tự quyết lấy tấm nào."
          />
        )}

        {shown && shown.length === 0 && !busy && <Empty compact icon={Check} title={t("dupNone")} />}

        {shown && shown.length > 0 && (
          <>
            <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
              <Switch
                checked={hide}
                onChange={onHide}
                label={`${t("dupHide")}${dupCount > 0 ? ` (${dupCount})` : ""}`}
                desc={hide ? t("dupHideOn") : `${shown.length} ${t("dupFound")}`}
              />
            </div>
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
              Máy KHÔNG tự chọn tấm nào. Bấm một tấm để xem lớn và lật qua cả nhóm; ưng tấm nào thì chạm vòng tròn ở góc để chọn.
            </p>
            <div className="flex flex-col gap-3">
              {shown.map((g) => {
                const picked = g.keys.filter((k) => selected.has(k)).length;
                return (
                  <div key={g.bestKey} className="rounded-[14px] p-2.5" style={{ border: "1px solid var(--bd)" }}>
                    <p className="mb-2 px-0.5 text-[12px] font-semibold" style={{ color: picked > 0 ? "var(--ac)" : "var(--tx3)" }}>
                      {g.keys.length} {t("photos")}
                      {picked > 0 ? ` · ${picked} ${t("dupInGroup")}` : ""}
                    </p>
                    <div className="-mx-2.5 flex gap-2 overflow-x-auto px-2.5" style={{ scrollbarWidth: "none" }}>
                      {g.keys.map((id) => {
                        const p = byId.get(id);
                        if (!p) return null;
                        const isBest = id === g.bestKey;
                        const isPicked = selected.has(id);
                        return (
                          <div
                            key={id}
                            className="relative h-[120px] w-[120px] flex-none overflow-hidden rounded-[10px]"
                            style={{ background: "var(--sf2)" }}
                          >
                            <button type="button" onClick={() => onOpen(g.keys, id)} aria-label={p.name} className="block h-full w-full">
                              <img src={img.thumb(p.drive_file_id, 320)} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                              <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,.5)", color: "#fff" }}>
                                <Maximize2 size={12} />
                              </span>
                            </button>
                            {isPicked && <span className="pointer-events-none absolute inset-0 rounded-[10px]" style={{ boxShadow: "inset 0 0 0 3px var(--ac)" }} />}
                            {isBest && (
                              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--gn)", color: "#fff" }}>
                                {t("dupBest")}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggle(id)}
                              aria-pressed={isPicked}
                              aria-label={isPicked ? t("deselect") : t("selectThis")}
                              title={isPicked ? t("deselect") : t("selectThis")}
                              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center"
                            >
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-full"
                                style={{ background: isPicked ? "var(--ac)" : "rgba(0,0,0,.3)", border: "2px solid #fff", color: "#fff" }}
                              >
                                {isPicked ? <Check size={13} strokeWidth={3} /> : null}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
          {t("dupPrivacy")}
          {photoCount > SCAN_CAP && ` · ${SCAN_CAP}/${photoCount}`}
        </p>
      </div>
    </Drawer>
  );
}
