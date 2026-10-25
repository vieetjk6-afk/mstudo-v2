"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { todayVN } from "@/lib/date";
import { heuristicParse, QUICK_HINTS, type QuickContext, type QuickDraft } from "@/lib/contract-quick";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC của ô "Tạo nhanh" — bản cũ (QuickContractBox) và giao diện mới
   (QuickContractBoxV2) cùng gọi: chữ đang gõ, bộ đọc quy tắc chạy trực tiếp,
   chip gợi ý, micro, và gọi /api/studio/contract-quick (lùi về bộ đọc quy tắc
   khi máy chủ từ chối). Hai bản chỉ khác cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type HintKey = (typeof QUICK_HINTS)[number]["key"];

/* Web Speech API — chỉ Chrome/Edge/Safari có, và dưới tên có tiền tố. Khai kiểu
   tối thiểu ở đây thay vì kéo cả lib.dom.speech vào dự án. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
function speechCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type QuickBoxInput = {
  context: Omit<QuickContext, "today">;
  onApply: (draft: QuickDraft, source: "ai" | "rules") => void;
  /** Chữ điền sẵn — vd đoạn chat khi mở từ Hộp thư. */
  initialText?: string;
  /** Chip không áp dụng cho màn này (vd Báo giá không có thợ, không có cọc). */
  hideHints?: HintKey[];
};

export function useQuickBox({ context, onApply, initialText = "", hideHints = [] }: QuickBoxInput) {
  const [text, setText] = useState(initialText);
  // Mic: chỉ biết trình duyệt có hỗ trợ SAU khi mount — đoán ở lúc render server
  // là lệch hydrate.
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  useEffect(() => {
    setCanSpeak(!!speechCtor());
    return () => recRef.current?.stop();
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const ctx = useMemo<QuickContext>(() => ({ ...context, today: todayVN() }), [context]);
  const live = useMemo(() => heuristicParse(text, ctx), [text, ctx]);

  const hints = QUICK_HINTS.filter((h) => !hideHints.includes(h.key));

  /** Bấm mic: đọc tiếng Việt, câu nào nghe xong thì nối vào cuối ô nhập. */
  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "vi-VN";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) said += e.results[i][0].transcript;
      }
      said = said.trim();
      if (!said) return;
      setText((prev) => (prev && !/\s$/.test(prev) ? `${prev}\n${said}` : `${prev}${said}`));
    };
    rec.onend = () => setListening(false);
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setErr("Trình duyệt chưa cho dùng micro — bật quyền micro cho trang này rồi thử lại.");
      }
    };
    recRef.current = rec;
    setErr(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  const has = (key: HintKey) => {
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
        // Mã lỗi thô ("unauthorized") không nói gì với studio — đổi sang câu dễ hiểu.
        const why =
          res.status === 401
            ? "Phiên đăng nhập đã hết hoặc gói chưa có tính năng này"
            : res.status === 429 || res.status === 400
              ? String(json?.error || "AI chưa trả lời được")
              : "AI chưa trả lời được";
        setErr(`${why.replace(/[\s.—]+$/, "")} — đã điền bằng bộ đọc cơ bản.`);
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

  return { text, setText, canSpeak, listening, toggleMic, busy, err, ref, hints, has, insertHint, analyse };
}
