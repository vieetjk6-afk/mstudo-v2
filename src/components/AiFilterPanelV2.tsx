"use client";

import { AlertTriangle, ArrowRight, Check, Info, Loader2, Play, ScanFace, Sparkles, X } from "lucide-react";
import { AI_DEFAULTS, type Verdict } from "@/lib/photo-ai";
import { Badge, Callout, Progress, btn, type Tone } from "@/components/v2/kit";
import { Segmented, Switch } from "@/components/v2/kit-client";
import AiCompareView from "./AiCompareView";
import {
  CARD_SIZES,
  PhotoCard,
  VERDICT_META,
  toggleExcluded,
  useAiFilterPanel,
  type AiFilterPanelProps,
  type CardSize,
} from "./ai-filter-shared";

/* ═══════════════════════════════════════════════════════════════════════════
   LỌC ẢNH BẰNG AI — giao diện mới. Cùng logic với AiFilterPanel
   (./ai-filter-shared). Nằm trong thẻ "AI tự tìm ảnh hỏng" của FilterToolV2
   (thẻ đó đã có viền + nút Thu gọn), nên đây là phần THÂN, không tự dựng thẻ.
     • Giới hạn của công cụ là một <Callout> thông tin, không phải đoạn chữ dài.
     • "Xét cả khuôn mặt" là công tắc của bộ khối, kèm cái giá nói thẳng.
     • Kết quả: nhãn đếm theo nghĩa màu, chọn cỡ ảnh bằng <Segmented>, một nút
       "Đưa vào danh sách lọc" — nút chính của màn vẫn là nút lọc của công cụ.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERDICT_TONE: Record<Verdict, Tone> = { keep: "green", review: "amber", duplicate: "gray", reject: "red" };

export default function AiFilterPanelV2(props: AiFilterPanelProps) {
  const { sourceFiles, sourceLabel, onUseNames } = props;
  const a = useAiFilterPanel(props);
  const muted = { color: "var(--tx3)" } as const;

  return (
    <section className="flex flex-col gap-4 px-4 pb-5 pt-1 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="v2-section-icon flex-none">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="v2-section-title">Lọc ảnh bằng AI</h3>
          <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            Quét {sourceLabel} để tìm <b>ảnh nhoè</b>, <b>ảnh chụp lỡ</b> và <b>các chuỗi bấm liên tiếp</b> — mỗi chuỗi chỉ giữ
            lại bản nét nhất. Tất cả tính toán chạy <b>trên máy này</b>, không ảnh nào được tải lên máy chủ.
          </p>
        </div>
      </div>

      {/* Nói thẳng giới hạn trước khi studio bấm xoá ảnh cưới của khách. */}
      <Callout tone="blue" icon={Info} title="Đây là gợi ý, không phải quyết định">
        <p className="leading-relaxed" style={{ textWrap: "pretty" }}>
          Công cụ đo cạnh và độ sáng, nó không biết ảnh nào đẹp. Ảnh cố ý xoá nét (bokeh dày, lia máy) có thể bị chấm điểm nét
          thấp, nên hãy xem qua danh sách trước khi làm gì. Bật <b>Xét cả khuôn mặt</b> bên dưới thì thêm được phần nhắm mắt và
          lấy nét trượt. Chưa làm: gom ảnh theo từng người (“tất cả ảnh có cô dâu”) — việc đó cần một mô hình nhận dạng danh
          tính, khác với mô hình tìm khuôn mặt đang dùng ở đây.
          {a.fromDrive && (
            <>
              {" "}
              Đang quét qua ảnh xem trước từ Drive nên độ chính xác thấp hơn; chọn <b>thư mục trên máy</b> để quét trên file gốc.
            </>
          )}
        </p>
      </Callout>

      {!a.supported ? (
        <Callout tone="amber" icon={AlertTriangle}>
          Trình duyệt này không giải mã ảnh được trong nền. Hãy dùng Chrome hoặc Edge bản mới.
        </Callout>
      ) : sourceFiles.length === 0 ? (
        <p className="text-[13px]" style={muted}>
          Hãy chọn nguồn ảnh ở trên (thư mục trên máy hoặc link Drive) rồi quay lại đây.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={a.run} disabled={a.busy || a.scannable === 0} className={btn("secondary")}>
              {a.busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {a.busy ? "Đang quét…" : `Quét ${a.scannable} ảnh`}
            </button>
            {a.busy && (
              <button type="button" onClick={a.stop} className={btn("ghost")}>
                <X size={16} /> Dừng
              </button>
            )}
            {a.undecodable > 0 && (
              <Badge tone="amber" icon={AlertTriangle}>{a.undecodable} file RAW/không đọc được sẽ bị bỏ qua</Badge>
            )}
          </div>

          {/* Lượt hai: khuôn mặt — TẮT sẵn và nói thẳng cái giá (xem bản cũ). */}
          <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
            <Switch
              checked={a.faceOn}
              onChange={a.setFaceOn}
              disabled={a.busy}
              label={
                <span className="flex items-center gap-1.5">
                  <ScanFace size={15} style={{ color: "var(--ac)" }} /> Xét cả khuôn mặt
                </span>
              }
              desc={
                <span className="mt-0.5 block leading-relaxed" style={{ textWrap: "pretty" }}>
                  Tìm ảnh có <b>người nhắm mắt</b> và ảnh <b>lấy nét trượt ra sau lưng</b> (mặt nhoè trong khi nền nét). Trong mỗi
                  chuỗi bấm, bản nên giữ chọn theo <b>mắt mở</b> trước, rồi mới tới nét. Lần đầu tải bộ nhận diện ~13 MB, lượt
                  quét chậm hơn nhiều lần — vẫn <b>không ảnh nào rời khỏi máy này</b>.
                </span>
              }
            />
          </div>

          {a.progress && (
            <div className="flex flex-col gap-1.5">
              <Progress value={a.progress.total ? (a.progress.done / a.progress.total) * 100 : 0} />
              <p className="truncate text-[12.5px]" style={muted}>
                {a.phase === "faces" ? "Xét khuôn mặt — " : ""}
                {a.progress.done}/{a.progress.total} · {a.progress.current}
              </p>
            </div>
          )}

          {a.error && <Callout tone="red" icon={AlertTriangle}>{a.error}</Callout>}
        </>
      )}

      {a.result && (
        <>
          {/* ── Tổng kết ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--bd2)" }}>
            {(["keep", "review", "duplicate", "reject"] as Verdict[]).map((v) => (
              <Badge key={v} tone={VERDICT_TONE[v]}>
                {VERDICT_META[v].label} {a.result!.summary[v]}
              </Badge>
            ))}
            <Badge tone="gray">
              {a.result.summary.groups} chuỗi bấm · trung vị điểm nét {Math.round(a.result.summary.medianSharpness)}
            </Badge>
            <span className="ml-auto flex items-center gap-2 text-[12.5px]" style={muted}>
              Cỡ ảnh
              <Segmented<CardSize>
                size="sm"
                label="Cỡ ảnh"
                value={a.cardSize}
                onChange={a.setCardSize}
                options={[
                  { value: "sm", label: "Nhỏ" },
                  { value: "md", label: "Vừa" },
                  { value: "lg", label: "Lớn" },
                ]}
              />
            </span>
          </div>

          {a.faceSummary && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[12px] px-3.5 py-2.5 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--tx)" }}>
                <ScanFace size={15} style={{ color: "var(--ac)" }} /> Khuôn mặt
              </span>
              <span>{a.faceSummary.withFaces}/{a.faceSummary.scanned} ảnh có người</span>
              <span style={{ color: a.faceSummary.blink ? "var(--am)" : undefined }}>
                <b>{a.faceSummary.blink}</b> nhắm mắt
              </span>
              <span style={{ color: a.faceSummary.softFace ? "var(--am)" : undefined }}>
                <b>{a.faceSummary.softFace}</b> mặt nhoè
              </span>
              <span>{a.faceSummary.noFace} không có mặt</span>
              {a.faceSummary.keepersChanged > 0 && (
                <span className="font-semibold" style={{ color: "var(--gn)" }}>
                  Đã đổi bản nên giữ ở {a.faceSummary.keepersChanged} tấm
                </span>
              )}
            </div>
          )}

          {a.skipped.length > 0 && (
            <p className="text-[12.5px]" style={muted}>
              Bỏ qua {a.skipped.length} file: {a.skipped.slice(0, 3).map((x) => x.name).join(", ")}
              {a.skipped.length > 3 ? "…" : ""}
            </p>
          )}

          {/* ── Đưa sang công cụ lọc ─────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] px-3.5 py-3" style={{ background: "var(--acS)" }}>
              <span className="min-w-0 flex-1 text-[13.5px]" style={{ color: "var(--tx)" }}>
                <b>{a.removeNames.length}</b> ảnh được đề nghị loại
                {a.excluded.size > 0 ? ` (bạn đã bỏ tick ${a.excluded.size})` : ""}.
              </span>
              <button
                type="button"
                onClick={() => {
                  onUseNames(a.removeNames);
                  a.setHandedOff(true);
                }}
                disabled={a.removeNames.length === 0}
                className={btn("secondary", "sm")}
              >
                {a.handedOff ? <Check size={14} /> : <ArrowRight size={14} />}
                {a.handedOff ? "Đã đưa vào danh sách" : "Đưa vào danh sách lọc"}
              </button>
            </div>
            <p className="text-[12.5px] leading-relaxed" style={muted}>
              Danh sách sẽ nằm ở ô <b>“Dán danh sách”</b> phía trên. Từ đó bạn chép chúng sang một thư mục riêng để xem lại, hoặc
              xoá khỏi Drive — công cụ này không tự xoá gì.
            </p>
          </div>

          {/* ── Các chuỗi bấm ────────────────────────────────────────── */}
          {a.groups.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div>
                <h4 className="text-[14px] font-semibold">Chuỗi bấm liên tiếp ({a.groups.length})</h4>
                <p className="mt-0.5 text-[12.5px]" style={muted}>
                  Viền xanh là bản nét nhất — bản nên giữ. <b>Bấm vào một tấm</b> để xem lớn, đặt cạnh bản đề xuất, và soi 1:1
                  điểm ảnh gốc trước khi quyết.
                </p>
              </div>
              {a.groups.map(([g, items]) => (
                <div key={g} className="rounded-[12px] p-2.5" style={{ background: "var(--sf2)" }}>
                  <div className="flex flex-wrap gap-2">
                    {items.map((j) => (
                      <PhotoCard
                        key={j.key}
                        j={j}
                        preview={a.previews[j.key]}
                        excluded={a.excluded.has(j.key)}
                        onToggle={() => toggleExcluded(j.key, a.setExcluded)}
                        size={CARD_SIZES[a.cardSize]}
                        onOpen={() => a.openCompare(items.map((x) => x.key), j.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Ảnh đứng riêng bị đánh dấu ───────────────────────────── */}
          {a.loners.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h4 className="text-[14px] font-semibold">Ảnh cần chú ý ({a.loners.length})</h4>
              <div className="flex flex-wrap gap-2">
                {a.loners.map((j) => (
                  <PhotoCard
                    key={j.key}
                    j={j}
                    preview={a.previews[j.key]}
                    excluded={a.excluded.has(j.key)}
                    onToggle={() => toggleExcluded(j.key, a.setExcluded)}
                    size={CARD_SIZES[a.cardSize]}
                    onOpen={() => a.openCompare(a.loners.map((x) => x.key), j.key)}
                  />
                ))}
              </div>
            </div>
          )}

          {a.groups.length === 0 && a.loners.length === 0 && (
            <Callout tone="green" icon={Check}>Không tìm thấy ảnh nhoè hay chuỗi trùng nào trong lô này.</Callout>
          )}

          <p className="text-[12px] leading-relaxed" style={muted}>
            Ngưỡng đang dùng: nhoè khi điểm nét dưới {AI_DEFAULTS.blurFloor} <i>và</i> dưới {Math.round(AI_DEFAULTS.blurRatio * 100)}% trung
            vị của lô; trùng khi khác nhau tối đa {AI_DEFAULTS.dupDistance}/128 bit mã nhận dạng khung và cách nhau không quá{" "}
            {AI_DEFAULTS.dupWindow} tấm.
          </p>
        </>
      )}

      {a.compare && a.compareFrames.length > 0 && (
        <AiCompareView
          frames={a.compareFrames}
          index={Math.min(a.compare.at, a.compareFrames.length - 1)}
          itemOf={a.itemOf}
          thumbs={a.previews}
          excluded={a.excluded}
          onToggle={(k) => toggleExcluded(k, a.setExcluded)}
          onIndex={(i) => a.setCompare((c) => (c ? { ...c, at: i } : c))}
          onClose={() => a.setCompare(null)}
        />
      )}
    </section>
  );
}
