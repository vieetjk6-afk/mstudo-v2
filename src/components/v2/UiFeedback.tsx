"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, MessageSquareHeart, Undo2 } from "lucide-react";
import { Modal } from "@/components/v2/kit-client";
import { Field, btn, inputCls } from "@/components/v2/kit";

/** Lý do hay gặp khi quay về bản cũ — chạm một cái thay vì phải gõ. */
const LEAVE_REASONS = ["Khó tìm chức năng", "Thiếu chức năng", "Chạy chậm", "Bị lỗi", "Quen bản cũ hơn"];

/**
 * Hộp GÓP Ý GIAO DIỆN MỚI (gửi về admin qua /api/studio/ui-feedback).
 *
 *   • mode "feedback" — menu tài khoản → "Góp ý giao diện mới": gửi xong báo cảm ơn.
 *   • mode "leave"    — bấm "Về giao diện cũ": hỏi nhanh điều gì chưa ổn, KHÔNG bắt
 *     buộc. Nút chính luôn chuyển về bản cũ; có nội dung thì gửi trước rồi chuyển,
 *     gửi lỗi cũng vẫn chuyển (không giữ chân người dùng vì một lượt góp ý).
 */
export default function UiFeedback({
  mode,
  open,
  onClose,
  onLeave,
}: {
  mode: "feedback" | "leave";
  open: boolean;
  onClose: () => void;
  /** Chỉ mode "leave": chuyển về giao diện cũ. */
  onLeave?: () => void;
}) {
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText(""); setReasons([]); setBusy(false); setSent(false); setErr(null);
  }, [open]);

  const message = [reasons.join(", "), text.trim()].filter(Boolean).join(" — ");
  const leaving = mode === "leave";

  async function send(): Promise<boolean> {
    const res = await fetch("/api/studio/ui-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, leaving, path: pathname, width: window.innerWidth }),
    }).catch(() => null);
    return !!res?.ok;
  }

  async function submit() {
    if (busy) return;
    if (leaving) {
      setBusy(true);
      if (message) await send();
      onLeave?.();
      return;
    }
    if (!message) return;
    setBusy(true);
    setErr(null);
    const ok = await send();
    setBusy(false);
    if (ok) setSent(true);
    else setErr("Chưa gửi được, bạn thử lại sau ít phút nhé.");
  }

  if (sent) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        icon={CheckCircle2}
        title="Cảm ơn bạn đã góp ý"
        desc="mstudo đã nhận được và sẽ xem từng góp ý để làm giao diện mới tốt hơn."
        footer={<button type="button" onClick={onClose} className={btn("primary")}>Xong</button>}
      />
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={leaving ? Undo2 : MessageSquareHeart}
      title={leaving ? "Về giao diện cũ?" : "Góp ý giao diện mới"}
      desc={
        leaving
          ? "Dữ liệu giữ nguyên, bạn có thể bật lại giao diện mới bất cứ lúc nào. Nếu có điều gì chưa ổn, cho mstudo biết nhé (không bắt buộc)."
          : "Chỗ nào khó dùng, thiếu gì hay bị lỗi? Góp ý của bạn gửi thẳng tới đội ngũ mstudo."
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>{leaving ? "Ở lại bản mới" : "Đóng"}</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || (!leaving && !message)}
            className={btn("primary")}
          >
            {leaving ? (busy ? "Đang chuyển…" : message ? "Gửi và về bản cũ" : "Về bản cũ") : busy ? "Đang gửi…" : "Gửi góp ý"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {leaving && (
          <div className="flex flex-wrap gap-1.5">
            {LEAVE_REASONS.map((r) => {
              const on = reasons.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons((cur) => (on ? cur.filter((x) => x !== r) : [...cur, r]))}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-medium"
                  style={on
                    ? { background: "var(--acS)", color: "var(--ac)", boxShadow: "inset 0 0 0 1px var(--ac)" }
                    : { background: "var(--sf2)", color: "var(--tx2)" }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}
        <Field label={leaving ? "Điều gì chưa ổn?" : "Nội dung góp ý"} error={err} htmlFor="ui-feedback-text">
          <textarea
            id="ui-feedback-text"
            className={inputCls}
            rows={4}
            maxLength={3000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={leaving ? "Ví dụ: không tìm thấy nút in hợp đồng…" : "Ví dụ: trên điện thoại khó bấm nút lưu ở màn Thu chi…"}
            autoFocus={!leaving}
          />
        </Field>
      </div>
    </Modal>
  );
}
