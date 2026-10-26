"use client";

import { Sparkles, Play, X, Check, Info, AlertTriangle, Copy, Loader2, ScanFace } from "lucide-react";
import { AI_DEFAULTS, type Verdict } from "@/lib/photo-ai";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AiCompareView from "./AiCompareView";
import AiFilterPanelV2 from "./AiFilterPanelV2";
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

export default function AiFilterPanel(props: AiFilterPanelProps) {
  return useUiV2() ? <AiFilterPanelV2 {...props} /> : <AiFilterPanelV1 {...props} />;
}

function AiFilterPanelV1(props: AiFilterPanelProps) {
  const { sourceFiles, sourceLabel, onUseNames, compact = false } = props;
  const {
    busy, progress, result, skipped, previews, error, excluded, setExcluded, handedOff, setHandedOff, cardSize, setCardSize,
    faceOn, setFaceOn, faceSummary, phase, compare, setCompare, supported, fromDrive, undecodable, scannable,
    run, stop, removeNames, groups, loners, itemOf, compareFrames, openCompare,
  } = useAiFilterPanel(props);

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
