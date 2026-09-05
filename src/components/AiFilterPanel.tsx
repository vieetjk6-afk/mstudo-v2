"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Play, X, Check, Info, AlertTriangle, Copy, Loader2, Maximize2, ScanFace, Users } from "lucide-react";
import { thumbnailUrl } from "@/lib/drive";
import {
  AI_DEFAULTS,
  countVerdicts,
  judge,
  namesToRemove,
  type JudgeResult,
  type PhotoJudgement,
  type Verdict,
} from "@/lib/photo-ai";
import { applyFaces, summarizeFaces, type FaceSummary } from "@/lib/face-ai";
import { faceScanSupported, loadFaceModel, detectFull } from "@/lib/face-detect";
import { embedFace, loadRecognizer } from "@/lib/face-embed";
import { GROUP_DEFAULTS, groupFaces, mergePeople, type FaceVector, type Person } from "@/lib/face-group";
import AiPeopleSave from "@/components/AiPeopleSave";
import {
  isDecodable,
  makePreviews,
  scanPhotos,
  scanSupported,
  type ScanItem,
  type ScanProgress,
} from "@/lib/photo-ai-scan";
import AiCompareView, { type CompareFrame } from "./AiCompareView";

/* ═══════════════════════════════════════════════════════════════════════════
   LỌC ẢNH BẰNG AI — màn hình cho studio.

   Nằm trong công cụ Lọc ảnh sẵn có: nguồn ảnh (thư mục trên máy hoặc link Drive)
   đã được <FilterTool/> nạp, panel này chỉ QUÉT rồi đề nghị danh sách nên loại,
   và đưa danh sách đó sang đúng ô "danh sách ảnh" của công cụ — từ đó studio
   dùng luôn các nút đã có: chép sang thư mục riêng, hoặc xoá khỏi Drive.

   Ba nguyên tắc của màn này:
    1. KHÔNG TỰ XOÁ GÌ. Nó chỉ đề nghị. Việc xoá vẫn phải là một cú bấm có ý thức
       của studio ở bước sau.
    2. NÓI LÝ DO cho từng tấm, kèm số đo. Studio phải kiểm được máy nói đúng hay
       sai, chứ không phải tin một cái nhãn.
    3. BỎ TICK ĐƯỢC từng tấm. Máy chấm sai một tấm là chuyện sẽ xảy ra; phải có
       đường sửa ngay tại đây, trước khi danh sách đi tiếp.
    4. XEM ĐƯỢC ĐỦ LỚN ĐỂ CHỌN. Nguyên tắc 3 là lời hứa suông nếu ảnh chỉ to
       bằng con tem: bỏ tick một tấm mà không nhìn rõ nó thì cũng là đoán. Nên có
       ô chỉnh cỡ ảnh cho cả bảng, và bấm vào một tấm là mở khung so sánh
       (@/components/AiCompareView) — ảnh lớn, hai ảnh cạnh nhau, và cắt 1:1
       điểm ảnh gốc để soi nét.
   ═══════════════════════════════════════════════════════════════════════════ */

type SourceFile = {
  key: string;
  name: string;
  driveId?: string;
  file?: File;
  // FileSystemFileHandle — kiểu này chưa có trong lib.dom của TS 5.6.
  handle?: { getFile: () => Promise<File> };
};

const VERDICT_META: Record<Verdict, { label: string; color: string; soft: string }> = {
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
const CARD_SIZES = { sm: 128, md: 190, lg: 264 } as const;
type CardSize = keyof typeof CARD_SIZES;

export default function AiFilterPanel({
  sourceFiles,
  sourceLabel,
  onUseNames,
  compact = false,
  albumId,
}: {
  sourceFiles: SourceFile[];
  /** "thư mục trên máy" / "link Drive" — để nói rõ độ chính xác mong đợi. */
  sourceLabel: string;
  /** Đưa danh sách tên file nên loại sang ô danh sách của công cụ Lọc ảnh. */
  onUseNames: (names: string[]) => void;
  compact?: boolean;
  /** Album đang mở (nếu công cụ được mở từ một album) — điền sẵn ô chọn khi lưu. */
  albumId?: string;
}) {
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
  /** Có gom ảnh theo từng người không (cần thêm mô hình nhận dạng danh tính). */
  const [groupOn, setGroupOn] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [tight, setTight] = useState<number>(GROUP_DEFAULTS.maxDistance);
  /**
   * Vector đặc trưng của lượt quét vừa xong, giữ lại để GOM LẠI TỨC THÌ khi
   * studio kéo thanh "chặt/rộng". Gom lại là phép tính thuần trên vector đã có —
   * bắt họ quét lại cả nghìn ảnh chỉ để nới một ngưỡng là điều không chấp nhận được.
   */
  const vectorsRef = useRef<FaceVector[]>([]);
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
        // 640px: đủ chi tiết để đo nét/gom trùng, và đúng cỡ /api/img đã phục vụ
        // cho lưới ảnh nên phần lớn đã nằm trong cache trình duyệt.
        out.push({ key: f.key, name: f.name, url: thumbnailUrl(f.driveId, 640) });
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
    setPeople(null);
    vectorsRef.current = [];
    setPhase("scan");
    setHandedOff(false);
    setProgress({ done: 0, total: sourceFiles.length, failed: 0, current: "" });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const items = await toScanItems();
      itemsRef.current = items;
      // Ảnh đại diện của các nhóm người — gom lại đây để lượt dựng ảnh xem trước
      // ở cuối hàm còn biết mà vẽ chúng.
      let coverKeys: string[] = [];
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

        // Một vòng duy nhất cho CẢ hai việc: tìm mặt (nhắm mắt, mặt nhoè) và —
        // nếu studio bật — sinh vector danh tính. Giải mã ảnh là phần nặng nhất
        // của lượt quét; chạy hai vòng riêng là làm đôi nó mà không được gì.
        const detector = await loadFaceModel();
        const recog = groupOn ? await loadRecognizer() : null;
        const fm: Awaited<ReturnType<typeof detectFull>>["metrics"][] = [];
        const vecs: FaceVector[] = [];
        const failed: { name: string; reason: string }[] = [];
        for (let i = 0; i < items.length; i++) {
          if (ac.signal.aborted) break;
          try {
            const full = await detectFull(detector, items[i], i);
            fm.push(full.metrics);
            if (recog) {
              for (let k = 0; k < full.landmarks.length; k++) {
                const face = full.metrics.faces[k];
                if (!face) continue;
                const v = await embedFace(recog, full.canvas, full.width, full.height, full.landmarks[k]);
                if (v)
                  vecs.push({
                    key: items[i].key,
                    at: k,
                    v,
                    area: face.box.w * face.box.h,
                    sharpness: face.sharpness,
                    box: face.box,
                  });
              }
            }
          } catch (e) {
            failed.push({ name: items[i].name, reason: e instanceof Error ? e.message : "không đọc được" });
          }
          setProgress({ done: i + 1, total: items.length, failed: failed.length, current: items[i].name });
          if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
        }
        const fo = { metrics: fm, skipped: failed };
        if (recog) {
          vectorsRef.current = vecs;
          const grouped = groupFaces(vecs, { maxDistance: tight }).people;
          setPeople(grouped);
          coverKeys = grouped.map((p) => p.coverKey);
        }
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
      // Ảnh xem trước chỉ cho những tấm màn hình thật sự vẽ ra…
      const shownKeys = judged.judgements
        .filter((j) => j.verdict !== "keep" || j.keeper)
        .slice(0, PREVIEW_CAP)
        .map((j) => j.key);
      // …CỘNG ảnh đại diện của từng người. Ảnh đại diện thường là một tấm chân
      // dung "giữ" bình thường nên không lọt vào danh sách trên, và thiếu nó thì
      // mỗi thẻ người là một ô xám — đúng thứ khiến bảng kết quả vô dụng.
      for (const c of coverKeys) if (!shownKeys.includes(c)) shownKeys.push(c);
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

  const pad = compact ? "p-4" : "p-6";

  return (
    <section className={`card ${pad}`} style={{ background: "var(--sf, var(--surface))", border: "1px solid var(--bd, var(--border))" }}>
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <Sparkles size={17} style={{ color: "var(--ac, var(--accent))" }} /> Lọc ảnh bằng AI
      </h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, var(--text2))" }}>
        Quét {sourceLabel} để tìm <b>ảnh nhoè</b>, <b>ảnh chụp lỡ</b> và <b>các chuỗi bấm liên tiếp</b> — mỗi
        chuỗi chỉ giữ lại bản nét nhất. Tất cả tính toán chạy <b>trên máy này</b>, không ảnh nào được tải lên
        máy chủ.
      </p>

      {/* Nói thẳng giới hạn. Studio phải biết mình đang dùng công cụ gì trước khi
          bấm xoá ảnh cưới của khách — chứ không phát hiện ra sau. */}
      <div
        className="mt-3 flex gap-2 rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed"
        style={{ background: "var(--sf2, var(--surface2))", color: "var(--tx2, var(--text2))" }}
      >
        <Info size={14} style={{ flex: "none", marginTop: 2, color: "var(--tx3, var(--text3))" }} />
        <span>
          Đây là <b>gợi ý</b>, không phải quyết định — công cụ đo cạnh và độ sáng, nó không biết ảnh nào
          đẹp. Ảnh cố ý xoá nét (bokeh dày, lia máy) có thể bị chấm điểm nét thấp, nên hãy xem qua danh
          sách trước khi làm gì. Bật <b>Xét cả khuôn mặt</b> bên dưới thì thêm được phần nhắm mắt và lấy
          nét trượt. Chưa làm: gom ảnh theo từng người (“tất cả ảnh có cô dâu”) — việc đó cần một mô hình
          nhận dạng danh tính, khác với mô hình tìm khuôn mặt đang dùng ở đây.
          {fromDrive && (
            <>
              {" "}
              Đang quét qua ảnh xem trước từ Drive nên độ chính xác thấp hơn; chọn <b>thư mục trên máy</b> để
              quét trên file gốc.
            </>
          )}
        </span>
      </div>

      {!supported ? (
        <p className="mt-3 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--amS, #fbf0da)", color: "var(--am, #a9740a)" }}>
          Trình duyệt này không giải mã ảnh được trong nền. Hãy dùng Chrome hoặc Edge bản mới.
        </p>
      ) : sourceFiles.length === 0 ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
          Hãy chọn nguồn ảnh ở trên (thư mục trên máy hoặc link Drive) rồi quay lại đây.
        </p>
      ) : (
        <>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <button
              onClick={run}
              disabled={busy || scannable === 0}
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
              style={{ background: "var(--ac, var(--accent))", color: "#fff" }}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {busy ? "Đang quét…" : `Quét ${scannable} ảnh`}
            </button>
            {busy && (
              <button
                onClick={stop}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold"
                style={{ background: "var(--sf2, var(--surface2))", color: "var(--tx2, var(--text2))", border: "1px solid var(--bd, var(--border))" }}
              >
                <X size={15} /> Dừng
              </button>
            )}
            {undecodable > 0 && (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--am, #a9740a)" }}>
                <AlertTriangle size={14} /> {undecodable} file RAW/không đọc được sẽ bị bỏ qua
              </span>
            )}
          </div>

          {/* ── Lượt hai: khuôn mặt ─────────────────────────────────────────
              TẮT SẴN, và nói thẳng cái giá. Bộ nhận diện nặng ~13 MB tải lần đầu
              và chạy chậm hơn hẳn lượt đo nét (mô hình chạy tuần tự, xem
              @/lib/face-detect). Bật nó sau lưng studio rồi để họ ngồi chờ gấp
              mười lần mà không biết vì sao là cách chắc nhất để họ bỏ công cụ. */}
          <label
            className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-[10px] px-3 py-2.5"
            style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
          >
            <input
              type="checkbox"
              checked={faceOn}
              onChange={(e) => setFaceOn(e.target.checked)}
              disabled={busy}
              className="mt-0.5"
            />
            <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, var(--text2))" }}>
              <b className="flex items-center gap-1.5">
                <ScanFace size={14} style={{ color: "var(--ac, var(--accent))" }} /> Xét cả khuôn mặt
              </b>
              Tìm ảnh có <b>người nhắm mắt</b> và ảnh <b>lấy nét trượt ra sau lưng</b> (mặt nhoè trong khi nền
              nét — thứ mà điểm nét cả khung không bao giờ bắt được). Trong mỗi chuỗi bấm, bản nên giữ sẽ
              chọn theo <b>mắt mở</b> trước, rồi mới tới nét.
              <span className="mt-1 block" style={{ color: "var(--tx3, var(--text3))" }}>
                Lần đầu tải bộ nhận diện ~13 MB (sau đó nằm trong bộ nhớ đệm), và lượt quét chậm hơn nhiều
                lần vì mô hình chạy từng tấm một. Vẫn <b>không ảnh nào rời khỏi máy này</b>.
              </span>
            </span>
          </label>

          {/* Gom theo người nằm BÊN TRONG lượt xét khuôn mặt, không đứng riêng:
              nó dùng lại đúng khuôn mặt mà lượt kia đã tìm ra. Tách thành hai nút
              là mời studio bật cái thứ hai mà quên cái thứ nhất, rồi ngồi chờ một
              lượt quét không làm gì. */}
          {faceOn && (
            <label
              className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
            >
              <input
                type="checkbox"
                checked={groupOn}
                onChange={(e) => setGroupOn(e.target.checked)}
                disabled={busy}
                className="mt-0.5"
              />
              <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2, var(--text2))" }}>
                <b className="flex items-center gap-1.5">
                  <Users size={14} style={{ color: "var(--ac, var(--accent))" }} /> Gom ảnh theo từng người
                </b>
                Nhóm các tấm có cùng một người lại, để lấy nhanh “tất cả ảnh có cô dâu”.
                <span className="mt-1 block" style={{ color: "var(--tx3, var(--text3))" }}>
                  Tải thêm ~7,5 MB mô hình nhận dạng và chậm hơn nữa. Máy gom sai là chuyện sẽ xảy ra — có
                  thanh chỉnh <b>chặt/rộng</b> và nút gộp hai nhóm ngay dưới kết quả.
                </span>
              </span>
            </label>
          )}

          {progress && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sf2, var(--surface2))" }}>
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                    background: "var(--ac, var(--accent))",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
                {phase === "faces" ? "Xét khuôn mặt — " : ""}
                {progress.done}/{progress.total} · {progress.current}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--rdS, #fbeaea)", color: "var(--rd, #c0392b)" }}>
              {error}
            </p>
          )}
        </>
      )}

      {result && (
        <>
          {/* ── Tổng kết ─────────────────────────────────────────────────── */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(["keep", "review", "duplicate", "reject"] as Verdict[]).map((v) => (
              <span
                key={v}
                className="rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: VERDICT_META[v].soft, color: VERDICT_META[v].color }}
              >
                {VERDICT_META[v].label} {result.summary[v]}
              </span>
            ))}
            <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "var(--sf2, var(--surface2))", color: "var(--tx2, var(--text2))" }}>
              {result.summary.groups} chuỗi bấm · trung vị điểm nét {Math.round(result.summary.medianSharpness)}
            </span>

            {/* Cỡ ảnh cho CẢ bảng. Ba nấc, chọn một lần cho cả lượt lọc. */}
            <span className="ml-auto flex items-center gap-1 text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
              Cỡ ảnh
              {(["sm", "md", "lg"] as CardSize[]).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setCardSize(sz)}
                  className="rounded-[7px] px-2 py-1 text-[11.5px] font-bold"
                  style={{
                    background: cardSize === sz ? "var(--ac, var(--accent))" : "var(--sf2, var(--surface2))",
                    color: cardSize === sz ? "#fff" : "var(--tx2, var(--text2))",
                  }}
                >
                  {sz === "sm" ? "Nhỏ" : sz === "md" ? "Vừa" : "Lớn"}
                </button>
              ))}
            </span>
          </div>

          {faceSummary && (
            <div
              className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] px-3.5 py-2.5 text-[12.5px]"
              style={{ background: "var(--sf2, var(--surface2))", color: "var(--tx2, var(--text2))" }}
            >
              <span className="flex items-center gap-1.5 font-bold">
                <ScanFace size={14} style={{ color: "var(--ac, var(--accent))" }} /> Khuôn mặt
              </span>
              <span>{faceSummary.withFaces}/{faceSummary.scanned} ảnh có người</span>
              <span style={{ color: faceSummary.blink ? "var(--am, #a9740a)" : undefined }}>
                <b>{faceSummary.blink}</b> nhắm mắt
              </span>
              <span style={{ color: faceSummary.softFace ? "var(--am, #a9740a)" : undefined }}>
                <b>{faceSummary.softFace}</b> mặt nhoè
              </span>
              <span>{faceSummary.noFace} không có mặt</span>
              {/* Con số đáng giá nhất của cả lượt quét: bao nhiêu chuỗi mà bộ đo
                  nét đã chọn nhầm bản nhắm mắt và khuôn mặt vừa sửa lại. */}
              {faceSummary.keepersChanged > 0 && (
                <span className="font-bold" style={{ color: "var(--gn, #1e9e72)" }}>
                  Đã đổi bản nên giữ ở {faceSummary.keepersChanged} tấm
                </span>
              )}
            </div>
          )}

          {people && (
            <div
              className="mt-3 rounded-[12px] px-3.5 py-3"
              style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  <Users size={15} style={{ color: "var(--ac, var(--accent))" }} /> {people.length} người
                </span>
                {/* Gom lại TỨC THÌ khi kéo: vector đã có sẵn trong bộ nhớ, gom lại
                    chỉ là phép tính. Bắt quét lại cả nghìn ảnh để nới một ngưỡng
                    là cách chắc chắn để studio không bao giờ chỉnh nó. */}
                <label className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--tx2, var(--text2))" }}>
                  Gom chặt
                  <input
                    type="range"
                    min={0.35}
                    max={0.85}
                    step={0.01}
                    value={tight}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setTight(v);
                      setPeople(groupFaces(vectorsRef.current, { maxDistance: v }).people);
                    }}
                    className="w-[150px]"
                  />
                  rộng
                  <span className="tnum" style={{ color: "var(--tx3, var(--text3))" }}>{tight.toFixed(2)}</span>
                </label>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--tx3, var(--text3))" }}>
                Một người bị tách thành hai nhóm thì kéo sang <b>rộng</b>, hoặc bấm <b>Gộp</b>. Hai người bị
                gom làm một thì kéo sang <b>chặt</b>. Ngưỡng mặc định {GROUP_DEFAULTS.maxDistance} là con số
                nhà làm mô hình công bố cho ảnh chụp thật — lô ảnh của bạn có thể cần khác.
              </p>

              <div className="mt-3 flex flex-wrap gap-2.5">
                {people.map((p) => (
                  <div
                    key={p.id}
                    className="w-[150px] overflow-hidden rounded-[10px]"
                    style={{ background: "var(--sf, var(--surface))", border: "1px solid var(--bd, var(--border))" }}
                  >
                    <div className="aspect-square w-full" style={{ background: "var(--sf2, var(--surface2))" }}>
                      {previews[p.coverKey] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[p.coverKey]} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="text-[12px] font-bold">{p.photoKeys.length} ảnh</p>
                      <button
                        onClick={() => {
                          const names = result.judgements
                            .filter((j) => p.photoKeys.includes(j.key))
                            .map((j) => j.name);
                          onUseNames(names);
                          setHandedOff(true);
                        }}
                        className="mt-1 w-full rounded-[7px] px-2 py-1 text-[11px] font-semibold"
                        style={{ background: "var(--ac, var(--accent))", color: "#fff" }}
                      >
                        Đưa vào danh sách
                      </button>
                      {people.length > 1 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) setPeople(mergePeople(people, p.id, e.target.value));
                          }}
                          className="mt-1 w-full rounded-[7px] px-1.5 py-1 text-[11px]"
                          style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
                        >
                          <option value="">Gộp người khác vào đây…</option>
                          {people.filter((q) => q.id !== p.id).map((q, i) => (
                            <option key={q.id} value={q.id}>Người #{i + 1} ({q.photoKeys.length} ảnh)</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {people.length === 0 && (
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
                  Không gom được nhóm nào — lô này có thể ít ảnh chụp người, hoặc mỗi người chỉ xuất hiện
                  một hai lần.
                </p>
              )}

              {/* Lưu xuống album: đây là điểm khác biệt lớn nhất giữa "hay" và
                  "dùng được". Gom xong mà chỉ xem trên máy studio thì lần sau
                  phải quét lại; lưu xuống thì KHÁCH lọc được mà không tải mô hình. */}
              {people.length > 0 && (
                <AiPeopleSave
                  people={people}
                  vectors={vectorsRef.current}
                  files={sourceFiles.map((f) => ({ key: f.key, name: f.name }))}
                  previews={previews}
                  albumId={albumId}
                  tight={tight}
                />
              )}
            </div>
          )}

          {skipped.length > 0 && (
            <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
              Bỏ qua {skipped.length} file: {skipped.slice(0, 3).map((s) => s.name).join(", ")}
              {skipped.length > 3 ? "…" : ""}
            </p>
          )}

          {/* ── Đưa sang công cụ lọc ─────────────────────────────────────── */}
          <div
            className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-[12px] px-3.5 py-3"
            style={{ background: "var(--sf2, var(--surface2))", border: "1px solid var(--bd, var(--border))" }}
          >
            <span className="text-[12.5px]" style={{ color: "var(--tx2, var(--text2))" }}>
              <b>{removeNames.length}</b> ảnh được đề nghị loại
              {excluded.size > 0 ? ` (bạn đã bỏ tick ${excluded.size})` : ""}.
            </span>
            <button
              onClick={() => {
                onUseNames(removeNames);
                setHandedOff(true);
              }}
              disabled={removeNames.length === 0}
              className="ml-auto flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-bold disabled:opacity-50"
              style={{ background: "var(--ac, var(--accent))", color: "#fff" }}
            >
              {handedOff ? <Check size={14} /> : <Copy size={14} />}
              {handedOff ? "Đã đưa vào danh sách" : "Đưa vào danh sách lọc →"}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--tx3, var(--text3))" }}>
            Danh sách sẽ nằm ở ô <b>“Dán danh sách”</b> phía trên. Từ đó bạn chép chúng sang một thư mục
            riêng để xem lại, hoặc xoá khỏi Drive — công cụ này không tự xoá gì.
          </p>

          {/* ── Các chuỗi bấm ────────────────────────────────────────────── */}
          {groups.length > 0 && (
            <>
              <h4 className="mt-5 text-[13px] font-bold">Chuỗi bấm liên tiếp ({groups.length})</h4>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3, var(--text3))" }}>
                Viền xanh là bản nét nhất — bản nên giữ. <b>Bấm vào một tấm</b> để xem lớn, đặt cạnh bản
                đề xuất, và soi 1:1 điểm ảnh gốc trước khi quyết.
              </p>
              <div className="mt-2.5 space-y-2.5">
                {groups.map(([g, items]) => (
                  <div key={g} className="rounded-[10px] p-2.5" style={{ background: "var(--sf2, var(--surface2))" }}>
                    <div className="flex flex-wrap gap-2">
                      {items.map((j) => (
                        <PhotoCard
                          key={j.key}
                          j={j}
                          preview={previews[j.key]}
                          excluded={excluded.has(j.key)}
                          onToggle={() => toggleExcluded(j.key, setExcluded)}
                          size={CARD_SIZES[cardSize]}
                          // Lật trong khung so sánh đi hết CHUỖI này — đúng phạm
                          // vi của câu hỏi "giữ tấm nào trong mấy tấm giống nhau".
                          onOpen={() => openCompare(items.map((x) => x.key), j.key)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Ảnh đứng riêng bị đánh dấu ───────────────────────────────── */}
          {loners.length > 0 && (
            <>
              <h4 className="mt-5 text-[13px] font-bold">Ảnh cần chú ý ({loners.length})</h4>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {loners.map((j) => (
                  <PhotoCard
                    key={j.key}
                    j={j}
                    preview={previews[j.key]}
                    excluded={excluded.has(j.key)}
                    onToggle={() => toggleExcluded(j.key, setExcluded)}
                    size={CARD_SIZES[cardSize]}
                    onOpen={() => openCompare(loners.map((x) => x.key), j.key)}
                  />
                ))}
              </div>
            </>
          )}

          {groups.length === 0 && loners.length === 0 && (
            <p className="mt-4 text-[12.5px]" style={{ color: "var(--gn, #1e9e72)" }}>
              Không tìm thấy ảnh nhoè hay chuỗi trùng nào trong lô này.
            </p>
          )}

          <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--tx3, var(--text3))" }}>
            Ngưỡng đang dùng: nhoè khi điểm nét dưới {AI_DEFAULTS.blurFloor} <i>và</i> dưới{" "}
            {Math.round(AI_DEFAULTS.blurRatio * 100)}% trung vị của lô; trùng khi khác nhau tối đa{" "}
            {AI_DEFAULTS.dupDistance}/128 bit mã nhận dạng khung và cách nhau không quá{" "}
            {AI_DEFAULTS.dupWindow} tấm.
          </p>
        </>
      )}

      {compare && compareFrames.length > 0 && (
        <AiCompareView
          frames={compareFrames}
          index={Math.min(compare.at, compareFrames.length - 1)}
          itemOf={itemOf}
          thumbs={previews}
          excluded={excluded}
          onToggle={(k) => toggleExcluded(k, setExcluded)}
          onIndex={(i) => setCompare((c) => (c ? { ...c, at: i } : c))}
          onClose={() => setCompare(null)}
        />
      )}
    </section>
  );
}

function toggleExcluded(key: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) {
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
function PhotoCard({
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
          // eslint-disable-next-line @next/next/no-img-element
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
