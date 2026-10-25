"use client";

import { useState } from "react";
import { Sparkles, Check, Plus, Wand2, ChevronDown, ChevronUp, Mic, MicOff } from "lucide-react";
import { QUICK_EXAMPLE, type QuickContext, type QuickDraft } from "@/lib/contract-quick";
import { useQuickBox, type HintKey } from "./useQuickBox";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô "TẠO NHANH" ở đầu màn tạo hợp đồng.

   Studio dán/gõ một đoạn chữ tự do (thường chép từ tin nhắn với khách) → máy
   phân tích ra tên, SĐT, gói, giá, ngày giờ, địa điểm, cọc… rồi điền sẵn cả 6
   bước và nhảy thẳng tới bước Kiểm tra. Studio soát lại, sửa chỗ sai, bấm tạo.

   Chip gợi ý đổi sang dấu ✓ NGAY KHI GÕ (bộ đọc quy tắc chạy ở trình duyệt,
   không tốn lượt AI) — nhìn là biết còn thiếu gì trước khi bấm phân tích.

   Dùng chung cho màn Báo giá (đổi chữ + bỏ bớt chip không áp dụng) và nhận
   sẵn đoạn chat khi mở từ Hộp thư.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Logic (chữ, micro, chip, gọi phân tích) nằm ở ./useQuickBox — dùng chung với
   QuickContractBoxV2 của giao diện mới. */


export default function QuickContractBox({
  context,
  onApply,
  initialText = "",
  title = "Tạo nhanh bằng AI",
  subtitle = "Dán tin nhắn chốt với khách — hệ thống tự điền cả 6 bước, bạn chỉ soát lại.",
  actionLabel = "Phân tích & điền hợp đồng",
  sourceNote,
  hideHints = [],
}: {
  context: Omit<QuickContext, "today">;
  onApply: (draft: QuickDraft, source: "ai" | "rules") => void;
  /** Chữ điền sẵn — vd đoạn chat khi mở từ Hộp thư. */
  initialText?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  /** Dòng nhỏ nói chữ điền sẵn lấy từ đâu. */
  sourceNote?: string;
  /** Chip không áp dụng cho màn này (vd Báo giá không có thợ, không có cọc). */
  hideHints?: HintKey[];
}) {
  const { text, setText, canSpeak, listening, toggleMic, busy, err, ref, hints, has, insertHint, analyse } = useQuickBox({
    context,
    onApply,
    initialText,
    hideHints,
  });
  const [open, setOpen] = useState(true);

  return (
    <div
      className="rounded-[14px] px-4 py-4 sm:px-5"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--ac) 9%, var(--sf)), var(--sf))",
        border: "1px solid color-mix(in srgb, var(--ac) 30%, var(--bd))",
      }}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 text-left" aria-expanded={open}>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]" style={{ background: "var(--ac)", color: "#fff" }}>
          <Sparkles size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-bold">{title}</span>
          <span className="block text-[12px]" style={{ color: "var(--tx2)" }}>
            {subtitle}
          </span>
        </span>
        {open ? <ChevronUp size={18} style={{ color: "var(--tx3)" }} /> : <ChevronDown size={18} style={{ color: "var(--tx3)" }} />}
      </button>

      {open && (
        <div className="mt-3.5">
          {/* Chip gợi ý: bấm để chèn nhãn; có ✓ khi đã nhận ra thông tin đó. */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {hints.map((h) => {
              const ok = has(h.key);
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => insertHint(h.insert)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                  style={
                    ok
                      ? { background: "var(--gnS)", color: "var(--gn)", border: "1px solid color-mix(in srgb, var(--gn) 35%, transparent)" }
                      : { background: "var(--sf)", color: h.required ? "var(--tx)" : "var(--tx2)", border: `1px ${h.required ? "solid" : "dashed"} var(--bd)` }
                  }
                  title={ok ? "Đã nhận ra" : "Bấm để thêm dòng này"}
                >
                  {ok ? <Check size={13} /> : <Plus size={13} />}
                  {h.label}
                  {h.required && !ok && <span style={{ color: "var(--rd)" }}>*</span>}
                </button>
              );
            })}
          </div>

          {sourceNote && (
            <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: "var(--ac)" }}>{sourceNote}</p>
          )}
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") analyse();
            }}
            rows={5}
            maxLength={4000}
            placeholder={QUICK_EXAMPLE}
            aria-label="Thông tin hợp đồng"
            className="w-full resize-y rounded-[10px] px-3 py-2.5 text-[13px] leading-relaxed"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx)" }}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!text && (
              <button
                type="button"
                onClick={() => setText(QUICK_EXAMPLE)}
                className="text-[12px] font-semibold underline"
                style={{ color: "var(--ac)" }}
              >
                Dùng thử đoạn mẫu
              </button>
            )}
            <span className="hidden text-[11px] sm:inline" style={{ color: "var(--tx3)" }}>
              Viết tự nhiên cũng được: “chị Lan 0901…, gói cưới 15tr, 12/10 7h tại…”
            </span>
            {canSpeak && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Dừng ghi âm" : "Nói để nhập"}
                title={listening ? "Dừng ghi âm" : "Nói để nhập (tiếng Việt)"}
                className="ml-auto flex items-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold"
                style={
                  listening
                    ? { background: "var(--rdS)", color: "var(--rd)", border: "1px solid color-mix(in srgb, var(--rd) 35%, transparent)" }
                    : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
                }
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
                <span>{listening ? "Đang nghe… bấm để dừng" : "Nói"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={analyse}
              disabled={!text.trim() || busy}
              className={`${canSpeak ? "" : "ml-auto "}flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50`}
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Wand2 size={16} /> {busy ? "Đang phân tích…" : actionLabel}
            </button>
          </div>

          {err && (
            <p className="mt-2 rounded-[9px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
