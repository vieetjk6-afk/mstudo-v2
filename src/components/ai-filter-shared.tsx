"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { thumbnailUrl } from "@/lib/drive";
import {
  countVerdicts,
  judge,
  namesToRemove,
  type JudgeResult,
  type PhotoJudgement,
  type Verdict,
} from "@/lib/photo-ai";
import { applyFaces, summarizeFaces, type FaceSummary } from "@/lib/face-ai";
import { faceScanSupported, loadFaceModel, detectFull } from "@/lib/face-detect";
import {
  isDecodable,
  makePreviews,
  scanPhotos,
  scanSupported,
  type ScanItem,
  type ScanProgress,
} from "@/lib/photo-ai-scan";
import type { CompareFrame } from "./AiCompareView";

/* ═══════════════════════════════════════════════════════════════════════════
   LỌC ẢNH BẰNG AI — phần dùng chung giữa bản cũ (AiFilterPanel) và bản giao
   diện mới (AiFilterPanelV2): toàn bộ trạng thái + lượt quét (useAiFilterPanel),
   hằng số nhãn/cỡ ảnh và thẻ một tấm ảnh (PhotoCard). Xem ghi chú đầu
   AiFilterPanel.tsx về các nguyên tắc của màn này.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AiSourceFile = {
  key: string;
  name: string;
  driveId?: string;
  file?: File;
  // FileSystemFileHandle — kiểu này chưa có trong lib.dom của TS 5.6.
  handle?: { getFile: () => Promise<File> };
};

export const VERDICT_META: Record<Verdict, { label: string; color: string; soft: string }> = {
  keep: { label: "Giữ", color: "var(--gn, #1e9e72)", soft: "var(--gnS, #e7f6ef)" },
  review: { label: "Xem lại", color: "var(--am, #a9740a)", soft: "var(--amS, #fbf0da)" },
  duplicate: { label: "Trùng", color: "var(--tx2, #666)", soft: "var(--sf2, #f3f2ef)" },
  reject: { label: "Nên loại", color: "var(--rd, #c0392b)", soft: "var(--rdS, #fbeaea)" },
};

/** Trần số tấm vẽ ảnh xem trước — xem @/lib/photo-ai-scan makePreviews. */
const PREVIEW_CAP = 240;

/**
 * Cỡ ô ảnh trong bảng kết quả. Ba nấc chứ không phải thanh trượt: studio chọn
 * một lần cho cả lượt lọc, và ba nấc thì bấm một cái là xong.
 *
 * `md` là mặc định — 128px (nấc `sm`, cỡ cũ) đủ để BIẾT hai tấm khác nhau nhưng
 * không đủ để CHỌN giữa chúng, mà chọn mới là việc studio ngồi đây để làm.
 */
export const CARD_SIZES = { sm: 128, md: 190, lg: 264 } as const;
export type CardSize = keyof typeof CARD_SIZES;

export type AiFilterPanelProps = {
  sourceFiles: AiSourceFile[];
  /** "thư mục trên máy" / "link Drive" — để nói rõ độ chính xác mong đợi. */
  sourceLabel: string;
  /** Đưa danh sách tên file nên loại sang ô danh sách của công cụ Lọc ảnh. */
  onUseNames: (names: string[]) => void;
  compact?: boolean;
  /** Album đang mở (nếu công cụ được mở từ một album) — điền sẵn ô chọn khi lưu. */
  albumId?: string;
};

export function useAiFilterPanel({ sourceFiles }: AiFilterPanelProps) {

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** Tấm studio đã BỎ TICK — không đưa vào danh sách nên loại. */
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [handedOff, setHandedOff] = useState(false);
  const [cardSize, setCardSize] = useState<CardSize>("md");
  /** Có chạy thêm lượt nhận diện khuôn mặt sau lượt đo nét không. */
  const [faceOn, setFaceOn] = useState(false);
  const [faceSummary, setFaceSummary] = useState<FaceSummary | null>(null);
  /** Lượt quét đang ở bước nào — hai bước có tốc độ khác hẳn nhau. */
  const [phase, setPhase] = useState<"scan" | "faces" | null>(null);
  /*
   * KHÔNG có phần "gom ảnh theo từng người" ở đây nữa, và đó là chủ ý.
   *
   * Bản trước cho studio bật thêm một lượt sinh vector danh tính rồi lưu xuống
   * album_people để khách lọc. Hai lý do bỏ hẳn:
   *
   *  1. Studio không cần tìm mặt — chỉ khách mới cần — nên bắt studio quét là
   *     bắt làm một việc chẳng phục vụ họ.
   *  2. Từ khi máy chủ tự quét (@/lib/face-scan-server), vector sinh ở trình
   *     duyệt CĂN MẶT KHÁC vector sinh ở máy chủ. Ghi cả hai vào cùng một bảng
   *     là hỏng âm thầm: cùng một người ra hai vector xa nhau, khách bấm vào
   *     khuôn mặt mình thì thiếu nửa số ảnh, mà chẳng có lỗi nào hiện ra.
   *
   * Phần XÉT KHUÔN MẶT bên dưới thì Ở LẠI: nó chỉ tìm mắt nhắm và mặt nhoè
   * (@/lib/face-ai), không dính gì tới danh tính.
   */
  /** Khung so sánh đang mở: danh sách tấm để lật + vị trí trong danh sách đó. */
  const [compare, setCompare] = useState<{ keys: string[]; at: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Nguồn ảnh của lượt quét vừa xong. Khung so sánh giải mã lại ĐÚNG LÚC MỞ nên
  // nó cần chính những ScanItem này — giữ ở ref chứ không state: đổi nó không
  // làm bảng kết quả phải vẽ lại.
  const itemsRef = useRef<ScanItem[]>([]);

  // Khả năng của trình duyệt phải hỏi TRONG EFFECT, không hỏi lúc dựng.
  //
  // `scanSupported()` đọc `window` → máy chủ trả false, trình duyệt trả true.
  // Với phần CHỮ thì React vẽ lại được, nhưng với THUỘC TÍNH (`disabled` của
  // nút) thì React 18 chỉ cảnh báo rồi GIỮ NGUYÊN giá trị của máy chủ — nút
  // "Quét" ở lại trạng thái vô hiệu vĩnh viễn. Chính bài kiểm tra ở
  // /uipreview/khuon-mat bắt được điều này.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(scanSupported()), []);
  const fromDrive = sourceFiles.some((f) => f.driveId) && !sourceFiles.some((f) => f.file || f.handle);
  const undecodable = useMemo(() => sourceFiles.filter((f) => !isDecodable(f.name)).length, [sourceFiles]);
  const scannable = sourceFiles.length - undecodable;

  /** Đổi nguồn của FilterTool thành đầu vào cho bộ quét. */
  const toScanItems = useCallback(async (): Promise<ScanItem[]> => {
    const out: ScanItem[] = [];
    for (const f of sourceFiles) {
      if (f.file) out.push({ key: f.key, name: f.name, file: f.file });
      else if (f.handle) {
        try {
          out.push({ key: f.key, name: f.name, file: await f.handle.getFile() });
        } catch {
          out.push({ key: f.key, name: f.name });
        }
      } else if (f.driveId) {
        // 640px: đủ chi tiết để đo nét/gom trùng. raw=1: quét bằng fetch() nên
        // cần byte cùng miền (/api/img chỉ trả byte khi URL có raw=1).
        out.push({ key: f.key, name: f.name, url: `${thumbnailUrl(f.driveId, 640)}&raw=1` });
      }
    }
    return out;
  }, [sourceFiles]);

  async function run() {
    if (busy || sourceFiles.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setPreviews({});
    setExcluded(new Set());
    setCompare(null);
    setFaceSummary(null);
    setPhase("scan");
    setHandedOff(false);
    setProgress({ done: 0, total: sourceFiles.length, failed: 0, current: "" });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const items = await toScanItems();
      itemsRef.current = items;
      const outcome = await scanPhotos(items, setProgress, ac.signal);
      setSkipped(outcome.skipped);
      if (outcome.aborted && outcome.metrics.length === 0) {
        setBusy(false);
        setProgress(null);
        return;
      }
      let judged = judge(outcome.metrics);

      // ── Lượt hai: khuôn mặt ────────────────────────────────────────────────
      // Chạy SAU lượt đo nét chứ không thay nó: bộ đo nét đã gom chuỗi và loại
      // ảnh hỏng rồi, khuôn mặt chỉ sửa đúng hai chỗ bộ đo ấy sai được (bản nên
      // giữ của chuỗi, và tấm đứng riêng có người nhắm mắt) — xem @/lib/face-ai.
      if (faceOn && faceScanSupported()) {
        setPhase("faces");
        setProgress({ done: 0, total: items.length, failed: 0, current: "" });

        const detector = await loadFaceModel();
        const fm: Awaited<ReturnType<typeof detectFull>>["metrics"][] = [];
        const failed: { name: string; reason: string }[] = [];
        for (let i = 0; i < items.length; i++) {
          if (ac.signal.aborted) break;
          try {
            const full = await detectFull(detector, items[i], i);
            fm.push(full.metrics);
          } catch (e) {
            failed.push({ name: items[i].name, reason: e instanceof Error ? e.message : "không đọc được" });
          }
          setProgress({ done: i + 1, total: items.length, failed: failed.length, current: items[i].name });
          if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
        }
        const fo = { metrics: fm, skipped: failed };
        const merged = applyFaces(judged.judgements, fo.metrics);
        judged = {
          judgements: merged.judgements,
          // Đếm LẠI: kết luận vừa đổi, giữ số cũ là màn hình nói dối.
          summary: countVerdicts(merged.judgements, judged.summary.groups, judged.summary.medianSharpness),
        };
        setFaceSummary(summarizeFaces(merged.faceJudgements, merged.keepersChanged));
        if (fo.skipped.length) setSkipped((s) => [...s, ...fo.skipped]);
      }

      setResult(judged);
      // Ảnh xem trước chỉ cho những tấm màn hình thật sự vẽ ra.
      const shownKeys = judged.judgements
        .filter((j) => j.verdict !== "keep" || j.keeper)
        .slice(0, PREVIEW_CAP)
        .map((j) => j.key);
      setPreviews(await makePreviews(items, shownKeys));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quét không thành công.");
    }
    setBusy(false);
    setProgress(null);
    setPhase(null);
    abortRef.current = null;
  }

  function stop() {
    abortRef.current?.abort();
  }

  /** Danh sách nên loại, đã trừ những tấm studio bỏ tick. */
  const removeNames = useMemo(() => {
    if (!result) return [];
    const kept = result.judgements.filter((j) => !excluded.has(j.key));
    return namesToRemove(kept);
  }, [result, excluded]);

  const groups = useMemo(() => {
    if (!result) return [];
    const byGroup = new Map<number, PhotoJudgement[]>();
    for (const j of result.judgements) {
      if (j.group === null) continue;
      if (!byGroup.has(j.group)) byGroup.set(j.group, []);
      byGroup.get(j.group)!.push(j);
    }
    return [...byGroup.entries()].sort((a, b) => a[0] - b[0]);
  }, [result]);

  const loners = useMemo(
    () => (result ? result.judgements.filter((j) => j.group === null && j.verdict !== "keep") : []),
    [result]
  );

  const itemOf = useCallback((key: string) => itemsRef.current.find((i) => i.key === key), []);

  const judgementByKey = useMemo(() => {
    const m = new Map<string, PhotoJudgement>();
    for (const j of result?.judgements ?? []) m.set(j.key, j);
    return m;
  }, [result]);

  /** Đổi một dãy khoá thành dữ liệu khung so sánh cần. */
  const compareFrames = useMemo<CompareFrame[]>(() => {
    if (!compare) return [];
    const out: CompareFrame[] = [];
    for (const k of compare.keys) {
      const j = judgementByKey.get(k);
      if (!j) continue;
      const meta = VERDICT_META[j.verdict];
      out.push({
        key: j.key,
        name: j.name,
        label: meta.label,
        color: meta.color,
        soft: meta.soft,
        reason: j.reason,
        sharpness: j.sharpness,
        keeper: j.keeper,
        inRemoveList: j.verdict === "duplicate" || j.verdict === "reject",
      });
    }
    return out;
  }, [compare, judgementByKey]);

  /** Mở khung so sánh trên một dãy tấm, dừng ở tấm được bấm. */
  const openCompare = useCallback((keys: string[], key: string) => {
    const at = Math.max(0, keys.indexOf(key));
    setCompare({ keys, at });
  }, []);

  return {
    busy, progress, result, skipped, previews, error, excluded, setExcluded, handedOff, setHandedOff, cardSize, setCardSize,
    faceOn, setFaceOn, faceSummary, phase, compare, setCompare, supported, fromDrive, undecodable, scannable,
    run, stop, removeNames, groups, loners, itemOf, compareFrames, openCompare,
  };
}

export type AiFilterPanelState = ReturnType<typeof useAiFilterPanel>;

export function toggleExcluded(key: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) {
  set((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

/**
 * Một tấm trong bảng kết quả. Ảnh + nhãn + LÝ DO kèm số đo, và một ô tick để
 * studio loại tấm này khỏi danh sách đề nghị. Tấm "nên giữ" của nhóm không có ô
 * tick vì nó vốn không nằm trong danh sách loại.
 */
export function PhotoCard({
  j,
  preview,
  excluded,
  onToggle,
  size,
  onOpen,
}: {
  j: PhotoJudgement;
  preview?: string;
  excluded: boolean;
  onToggle: () => void;
  /** Cạnh ô ảnh, px — studio chỉnh cho cả bảng ở đầu phần kết quả. */
  size: number;
  /** Mở khung so sánh ở đúng tấm này. */
  onOpen: () => void;
}) {
  const meta = VERDICT_META[j.verdict];
  const inRemoveList = j.verdict === "duplicate" || j.verdict === "reject";
  const dimmed = excluded && inRemoveList;
  return (
    <div
      className="overflow-hidden rounded-[9px]"
      style={{
        width: size,
        background: "var(--sf, var(--surface))",
        border: `2px solid ${j.keeper ? "var(--gn, #1e9e72)" : "var(--bd, var(--border))"}`,
        opacity: dimmed ? 0.45 : 1,
      }}
      title={j.reason}
    >
      {/* Cả ô ảnh là một nút mở khung so sánh: đây là thao tác chính của bảng
          này (xem tấm cho rõ rồi mới quyết), nên nó phải là chỗ dễ bấm nhất chứ
          không phải một biểu tượng nhỏ ở góc. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem lớn ${j.name}`}
        className="group relative block aspect-square w-full cursor-zoom-in"
        style={{ background: "var(--sf2, var(--surface2))" }}
      >
        {preview ? (
          <img src={preview} alt={j.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px]" style={{ color: "var(--tx3, var(--text3))" }}>
            không xem trước
          </span>
        )}
        <span
          className="absolute left-1 top-1 rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold"
          style={{ background: meta.soft, color: meta.color }}
        >
          {j.keeper ? "Nên giữ" : meta.label}
        </span>
        <span
          className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(0,0,0,.55)", color: "#fff" }}
        >
          <Maximize2 size={12} />
        </span>
      </button>
      <div className="px-1.5 py-1.5">
        <p className="truncate text-[10.5px] font-semibold" title={j.name}>{j.name}</p>
        <p className="mt-0.5 text-[9.5px] leading-snug" style={{ color: "var(--tx3, var(--text3))" }}>{j.reason}</p>
        {inRemoveList && (
          <label className="mt-1.5 flex cursor-pointer items-center gap-1 text-[10px]" style={{ color: "var(--tx2, var(--text2))" }}>
            <input type="checkbox" checked={!excluded} onChange={onToggle} />
            đưa vào danh sách loại
          </label>
        )}
      </div>
    </div>
  );
}
