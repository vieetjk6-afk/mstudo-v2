"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Sparkles, Play, X, Check, EyeOff, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { thumbnailUrl } from "@/lib/drive";
import { duplicateGroups, type DuplicateGroup } from "@/lib/photo-ai";
import { scanPhotos, scanSupported, type ScanItem, type ScanProgress } from "@/lib/photo-ai-scan";

/* ═══════════════════════════════════════════════════════════════════════════
   GỢI Ý ẢNH NA NÁ NHAU — cho KHÁCH, ngay trong album chọn ảnh.

   Việc mệt nhất của khách không phải chọn ảnh đẹp. Là cuộn qua bảy tấm giống hệt
   nhau, không thấy chúng khác nhau ở đâu, rồi chọn đại — hoặc chọn cả bảy. Máy
   ảnh bấm liên tiếp nên một album 800 tấm thật ra chỉ có chừng 500 khoảnh khắc.

   Dùng CHUNG bộ đo với công cụ của studio (@/lib/photo-ai) nhưng CỐ Ý chỉ lấy
   một nửa: `duplicateGroups` — gom nhóm và chỉ ra bản nét nhất. KHÔNG dùng
   `judge()`. Bộ ấy còn kết luận "nhoè", "chụp lỡ", "nên loại" — đúng cho studio
   đang dọn thư mục, nhưng nói câu đó với khách là chuyện khác hẳn: chê ảnh cưới
   của khách là việc của studio nếu họ muốn, không phải của phần mềm, và một dòng
   chữ "ảnh này nhoè" dưới tấm ảnh cưới sẽ làm hỏng đúng cái việc đáng ra là vui
   nhất. Ở đây chỉ có một câu: mấy tấm này giống nhau, tấm này nét nhất.

   BA RÀNG BUỘC vì đây là máy của KHÁCH, không phải máy studio:

    1. KHÔNG TỰ CHẠY. Quét là việc nặng và tốn 3G. Khách phải bấm mới chạy, và
       nút nói rõ nó sẽ làm gì.
    2. KHÔNG BAO GIỜ ĐỘNG VÀO LỰA CHỌN. Quét xong, máy chỉ TÁCH RIÊNG các tấm
       trùng ra khỏi lưới và bày chúng thành từng chuỗi ở khối này; không tấm nào
       được thêm vào lựa chọn của khách. Khách bấm tấm nào thì tấm đó mới vào —
       và đó là đường DUY NHẤT một tấm đi vào lựa chọn từ khối này. Cố ý KHÔNG có
       nút "chọn hết bản đề xuất": một cú bấm thêm sáu chục tấm vào danh sách rồi
       khách phải ngồi gỡ ra thì tệ hơn hẳn là tự bấm sáu chục lần có chủ ý.
       Việc tách riêng có công tắc tắt ngay cạnh, và ảnh khách ĐÃ CHỌN thì không
       bao giờ bị tách khỏi lưới.
    3. QUÉT QUA ẢNH XEM TRƯỚC đã có sẵn trên lưới (`/api/img`), nên phần lớn tấm
       đã nằm trong cache trình duyệt: không tải thêm gì đáng kể, và không byte
       ảnh gốc nào rời khỏi máy khách.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FinderPhoto = { id: string; drive_file_id: string; name: string };

/**
 * Trần số ảnh một lượt quét. Album cưới trọn gói có thể 3.000 tấm; quét từng ấy
 * trên điện thoại là mấy phút máy nóng ran. 600 tấm là chỗ mà lợi ích còn rõ
 * ràng hơn cái giá phải trả.
 */
const SCAN_CAP = 600;

export default function AlbumDuplicateFinder({
  photos,
  selected,
  groups,
  onGroups,
  hide,
  onHide,
  onToggle,
}: {
  /** Ảnh theo ĐÚNG thứ tự bấm máy — luật gom nhóm dựa vào thứ tự đó. */
  photos: FinderPhoto[];
  selected: ReadonlySet<string>;
  groups: DuplicateGroup[] | null;
  onGroups: (g: DuplicateGroup[] | null) => void;
  hide: boolean;
  onHide: (v: boolean) => void;
  /** Bấm một tấm trong khối này = thêm/bỏ tấm đó khỏi lựa chọn của khách. */
  onToggle: (id: string) => void;
}) {
  const { t } = useLang();
  // Mở SẴN. Khách vào đây để chọn ảnh, không để đi tìm công cụ — một khối gập
  // lại thì gần như không ai bấm vào. Mở sẵn KHÔNG tốn gì: nó chỉ là mấy dòng
  // chữ và một cái nút, việc quét chỉ chạy khi khách bấm.
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const supported = scanSupported();
  const scanList = useMemo(() => photos.slice(0, SCAN_CAP), [photos]);

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    onGroups(null);
    setProgress({ done: 0, total: scanList.length, failed: 0, current: "" });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // 640px là đúng cỡ lưới ảnh đang dùng, nên phần lớn tấm đã có sẵn trong
      // cache của service worker — quét gần như không tốn thêm mạng.
      const items: ScanItem[] = scanList.map((p) => ({
        key: p.id,
        name: p.name,
        url: thumbnailUrl(p.drive_file_id, 640),
      }));
      const outcome = await scanPhotos(items, setProgress, ac.signal);
      if (!outcome.aborted || outcome.metrics.length > 0) {
        onGroups(duplicateGroups(outcome.metrics));
      }
    } catch {
      onGroups([]);
    }
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }, [busy, scanList, onGroups]);

  const dupCount = useMemo(
    () => (groups ?? []).reduce((n, g) => n + g.keys.length - 1, 0),
    [groups]
  );

  // Trình duyệt không giải mã ảnh trong nền được (Safari cũ, trình duyệt trong
  // app nhắn tin) thì không hiện gì: một khối công cụ chỉ để báo "máy bạn không
  // làm được" là thứ khách không cần giữa lúc đang chọn ảnh cưới.
  if (!supported) return null;
  return (
    <div
      className="mb-4 overflow-hidden rounded-[14px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <Sparkles size={17} style={{ color: "var(--gold)" }} />
        <span className="flex-1 text-[13.5px] font-semibold">{t("dupTitle")}</span>
        {groups && groups.length > 0 && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
            style={{ background: "var(--surface2)", color: "var(--text2)" }}
          >
            {groups.length}
          </span>
        )}
        <span className="text-[12px]" style={{ color: "var(--text3)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text2)" }}>
            {t("dupIntro")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={run}
              disabled={busy || scanList.length === 0}
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--gold)", color: "#fff" }}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {busy ? t("dupRunning") : t("dupRun")}
            </button>
            {busy && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold"
                style={{ background: "var(--surface2)", color: "var(--text2)" }}
              >
                <X size={15} /> {t("dupStop")}
              </button>
            )}
          </div>

          {progress && (
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface2)" }}>
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    background: "var(--gold)",
                  }}
                />
              </div>
              <p className="tnum mt-1 text-[11.5px]" style={{ color: "var(--text3)" }}>
                {progress.done}/{progress.total}
              </p>
            </div>
          )}

          <p className="mt-2 text-[11.5px]" style={{ color: "var(--text3)" }}>
            {t("dupPrivacy")}
            {photos.length > SCAN_CAP && ` · ${SCAN_CAP}/${photos.length}`}
          </p>

          {groups && groups.length === 0 && !busy && (
            <p className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--text2)" }}>
              {t("dupNone")}
            </p>
          )}

          {groups && groups.length > 0 && (
            <>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <span className="text-[12.5px]" style={{ color: "var(--text2)" }}>
                  <b>{groups.length}</b> {t("dupFound")}
                </span>
                <button
                  onClick={() => onHide(!hide)}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
                  style={{
                    background: hide ? "var(--gold)" : "var(--surface2)",
                    color: hide ? "#fff" : "var(--text2)",
                  }}
                >
                  <EyeOff size={14} /> {t("dupHide")}
                  {dupCount > 0 && <span className="tnum opacity-80">({dupCount})</span>}
                </button>
              </div>
              {hide && (
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                  {t("dupHideOn")}
                </p>
              )}
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text2)" }}>
                {t("dupPickHere")}
              </p>

              {/* Mỗi chuỗi một hàng cuộn ngang: trên điện thoại đó là cách duy
                  nhất đặt bảy tấm cạnh nhau mà tấm nào cũng còn đủ to để nhìn. */}
              <div className="mt-3 flex flex-col gap-2.5">
                {groups.map((g) => {
                  const picked = g.keys.filter((k) => selected.has(k)).length;
                  return (
                    <div
                      key={g.bestKey}
                      className="rounded-[10px] p-2"
                      style={{ background: "var(--surface2)" }}
                    >
                      {/* Đếm ĐÃ CHỌN của riêng chuỗi này. Không có nó thì cuộn
                          qua hai chục chuỗi xong khách không nhớ chuỗi nào đã
                          xử lý rồi. */}
                      <p
                        className="mb-1.5 px-0.5 text-[11px]"
                        style={{ color: picked > 0 ? "var(--gold)" : "var(--text3)" }}
                      >
                        {g.keys.length} {t("photos")} · {picked > 0 ? `${picked} ${t("dupInGroup")}` : "—"}
                      </p>
                      <div className="flex gap-2 overflow-x-auto">
                      {g.keys.map((id) => {
                        const p = byId.get(id);
                        if (!p) return null;
                        const isBest = id === g.bestKey;
                        const isPicked = selected.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => onToggle(id)}
                            aria-pressed={isPicked}
                            className="relative h-[104px] w-[104px] flex-none overflow-hidden rounded-[8px]"
                            style={{
                              border: isPicked
                                ? "2.5px solid var(--gold)"
                                : isBest
                                  ? "2.5px solid var(--success, #1e9e72)"
                                  : "2.5px solid transparent",
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumbnailUrl(p.drive_file_id, 320)}
                              alt={p.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                            {isBest && (
                              <span
                                className="absolute left-1 top-1 rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold"
                                style={{ background: "var(--success, #1e9e72)", color: "#fff" }}
                              >
                                {t("dupBest")}
                              </span>
                            )}
                            {isPicked && (
                              <span
                                className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full"
                                style={{ background: "var(--gold)", color: "#fff" }}
                              >
                                <Check size={12} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
