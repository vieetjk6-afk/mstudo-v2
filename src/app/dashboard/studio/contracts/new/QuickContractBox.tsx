"use client";

import { useMemo, useRef, useState } from "react";
import { Sparkles, Check, Plus, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { todayVN } from "@/lib/date";
import {
  heuristicParse,
  QUICK_EXAMPLE,
  QUICK_HINTS,
  type QuickContext,
  type QuickDraft,
} from "@/lib/contract-quick";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô "TẠO NHANH" ở đầu màn tạo hợp đồng.

   Studio dán/gõ một đoạn chữ tự do (thường chép từ tin nhắn với khách) → máy
   phân tích ra tên, SĐT, gói, giá, ngày giờ, địa điểm, cọc… rồi điền sẵn cả 6
   bước và nhảy thẳng tới bước Kiểm tra. Studio soát lại, sửa chỗ sai, bấm tạo.

   Chip gợi ý đổi sang dấu ✓ NGAY KHI GÕ (bộ đọc quy tắc chạy ở trình duyệt,
   không tốn lượt AI) — nhìn là biết còn thiếu gì trước khi bấm phân tích.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function QuickContractBox({
  context,
  onApply,
}: {
  context: Omit<QuickContext, "today">;
  onApply: (draft: QuickDraft, source: "ai" | "rules") => void;
}) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const ctx = useMemo<QuickContext>(() => ({ ...context, today: todayVN() }), [context]);
  const live = useMemo(() => heuristicParse(text, ctx), [text, ctx]);

  const has = (key: (typeof QUICK_HINTS)[number]["key"]) => {
    if (key === "price") return live.mainPrice !== undefined || !!live.customLines?.length || !!live.mainPkgId;
    if (key === "mainPkgId") return !!live.mainPkgId || !!live.customLines?.length;
    const v = live[key];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
  };

  function insertHint(insert: string) {
    const el = ref.current;
    const sep = text && !text.endsWith("\n") ? "\n" : "";
    const next = `${text}${sep}${insert}`;
    setText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  }

  async function analyse() {
    if (!text.trim() || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/studio/contract-quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...context }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.draft) {
        // Máy chủ từ chối (hết lượt, mất phiên…) → vẫn điền bằng bộ đọc quy
        // tắc ở trình duyệt, kèm lời nhắn, thay vì bắt studio gõ tay lại hết.
        setErr(json?.error ? `${json.error} Đã điền bằng bộ đọc cơ bản.` : "AI chưa trả lời được — đã điền bằng bộ đọc cơ bản.");
        onApply(live, "rules");
      } else {
        onApply(json.draft as QuickDraft, json.source === "ai" ? "ai" : "rules");
      }
    } catch {
      setErr("Mất kết nối — đã điền bằng bộ đọc cơ bản.");
      onApply(live, "rules");
    } finally {
      setBusy(false);
    }
  }

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
          <span className="block text-[14.5px] font-bold">Tạo nhanh bằng AI</span>
          <span className="block text-[12px]" style={{ color: "var(--tx2)" }}>
            Dán tin nhắn chốt với khách — hệ thống tự điền cả 6 bước, bạn chỉ soát lại.
          </span>
        </span>
        {open ? <ChevronUp size={18} style={{ color: "var(--tx3)" }} /> : <ChevronDown size={18} style={{ color: "var(--tx3)" }} />}
      </button>

      {open && (
        <div className="mt-3.5">
          {/* Chip gợi ý: bấm để chèn nhãn; có ✓ khi đã nhận ra thông tin đó. */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_HINTS.map((h) => {
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
            <button
              type="button"
              onClick={analyse}
              disabled={!text.trim() || busy}
              className="ml-auto flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50"
              style={{ background: "var(--ac)", color: "#fff" }}
            >
              <Wand2 size={16} /> {busy ? "Đang phân tích…" : "Phân tích & điền hợp đồng"}
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
