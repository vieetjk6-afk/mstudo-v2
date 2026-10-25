"use client";

import { useState } from "react";
import { Check, Mic, MicOff, Plus, Sparkles, Wand2 } from "lucide-react";
import { QUICK_EXAMPLE, type QuickContext, type QuickDraft } from "@/lib/contract-quick";
import { btn, inputCls } from "@/components/v2/kit";
import { Modal } from "@/components/v2/kit-client";
import { useQuickBox, type HintKey } from "./useQuickBox";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô "TẠO NHANH" — giao diện mới. Cùng logic với QuickContractBox (./useQuickBox):
   cùng chip gợi ý, cùng micro, cùng gọi phân tích và lùi về bộ đọc quy tắc.
   Khác ở cách đặt: trên màn chỉ là MỘT dải mỏng (không chen một ô nhập to giữa
   form); bấm vào mới mở hộp thoại để dán tin nhắn. Nút "Phân tích" là nút chính
   của hộp thoại, nên màn chính vẫn chỉ có một nút primary.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QuickContractBoxV2({
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
  initialText?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  sourceNote?: string;
  hideHints?: HintKey[];
}) {
  const [open, setOpen] = useState(false);
  const q = useQuickBox({
    context,
    // Điền xong thì đóng hộp thoại — màn hợp đồng còn nhảy thẳng tới bước Kiểm tra.
    onApply: (d, s) => {
      setOpen(false);
      onApply(d, s);
    },
    initialText,
    hideHints,
  });
  const found = q.hints.filter((h) => q.has(h.key)).length;
  const hasText = !!q.text.trim();

  return (
    <>
      <div
        className="v2-card flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-4 py-3.5"
        style={{ background: "linear-gradient(120deg, color-mix(in srgb, var(--ac) 7%, var(--sf)), var(--sf) 70%)" }}
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <Sparkles size={18} />
        </span>
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="text-[12.5px]" style={{ color: sourceNote ? "var(--ac)" : "var(--tx2)" }}>
            {sourceNote ?? (hasText ? `Đã có ${q.text.trim().length} ký tự — nhận ra ${found}/${q.hints.length} thông tin.` : subtitle)}
          </p>
        </div>
        <button type="button" className={btn("secondary", "sm", "ml-auto")} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Wand2 size={15} /> {hasText ? "Xem & phân tích" : "Dán tin nhắn"}
        </button>
        {q.err && !open ? (
          <p className="basis-full rounded-[10px] px-3 py-2 text-[12.5px] font-medium" style={{ background: "var(--amS)", color: "var(--am)" }}>
            {q.err}
          </p>
        ) : null}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        desc={subtitle}
        icon={Sparkles}
        width={620}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setOpen(false)}>
              Để sau
            </button>
            <button type="button" className={btn("primary")} onClick={q.analyse} disabled={!hasText || q.busy}>
              <Wand2 size={16} /> {q.busy ? "Đang phân tích…" : actionLabel}
            </button>
          </>
        }
      >
        {/* Chip: bấm để chèn nhãn; có ✓ khi bộ đọc đã nhận ra thông tin đó. */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {q.hints.map((h) => {
            const ok = q.has(h.key);
            return (
              <button
                key={h.key}
                type="button"
                onClick={() => q.insertHint(h.insert)}
                title={ok ? "Đã nhận ra" : "Bấm để thêm dòng này"}
                className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium"
                style={
                  ok
                    ? { background: "var(--gnS)", color: "var(--gn)", border: "1px solid color-mix(in srgb, var(--gn) 30%, transparent)" }
                    : { background: "var(--sf)", color: h.required ? "var(--tx)" : "var(--tx2)", border: `1px ${h.required ? "solid" : "dashed"} var(--bd)` }
                }
              >
                {ok ? <Check size={13} /> : <Plus size={13} />}
                {h.label}
                {h.required && !ok ? <span style={{ color: "var(--rd)" }}>*</span> : null}
              </button>
            );
          })}
        </div>
        {sourceNote ? (
          <p className="mb-2 text-[12.5px] font-medium" style={{ color: "var(--ac)" }}>{sourceNote}</p>
        ) : null}
        <textarea
          ref={q.ref}
          value={q.text}
          onChange={(e) => q.setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") q.analyse();
          }}
          rows={7}
          maxLength={4000}
          placeholder={QUICK_EXAMPLE}
          aria-label="Thông tin hợp đồng"
          className={`${inputCls} resize-y`}
          style={{ minHeight: 150 }}
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {!q.text ? (
            <button type="button" className={btn("ghost", "sm")} onClick={() => q.setText(QUICK_EXAMPLE)}>
              Dùng thử đoạn mẫu
            </button>
          ) : null}
          <span className="hidden text-[12px] sm:inline" style={{ color: "var(--tx3)" }}>
            Viết tự nhiên cũng được · Ctrl + Enter để phân tích
          </span>
          {q.canSpeak ? (
            <button
              type="button"
              onClick={q.toggleMic}
              aria-pressed={q.listening}
              aria-label={q.listening ? "Dừng ghi âm" : "Nói để nhập"}
              title={q.listening ? "Dừng ghi âm" : "Nói để nhập (tiếng Việt)"}
              className={btn(q.listening ? "danger" : "secondary", "sm", "ml-auto")}
            >
              {q.listening ? <MicOff size={15} /> : <Mic size={15} />}
              {q.listening ? "Đang nghe… bấm để dừng" : "Nói"}
            </button>
          ) : null}
        </div>
        {q.err ? (
          <p className="mt-2.5 rounded-[10px] px-3 py-2 text-[12.5px] font-medium" style={{ background: "var(--amS)", color: "var(--am)" }}>
            {q.err}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
