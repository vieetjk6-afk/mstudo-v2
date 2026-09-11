"use client";

import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { usePreview } from "./preview-mode";

/** Public guest RSVP + well-wishes form. Posts to /api/thiep/rsvp by slug. */
export default function RsvpForm({ slug, note, initialAttending = true }: { slug: string; note?: string; initialAttending?: boolean }) {
  const { preview } = usePreview();
  const [name, setName] = useState("");

  // Tự điền tên từ link cá nhân hóa (?guest=…) — đồng bộ với bì thư & lời mời.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = (sp.get("guest") || sp.get("g") || "").trim();
    if (g) setName(g.slice(0, 120));
  }, []);
  const [side, setSide] = useState<"groom" | "bride" | "both">("both");
  const [attending, setAttending] = useState(initialAttending);
  const [num, setNum] = useState(1);
  const [wish, setWish] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    // Bản xem trước: không ghi dữ liệu thật, chỉ báo cho người đang sửa thiệp.
    if (preview) { setState("done"); return; }
    setState("saving");
    try {
      const res = await fetch("/api/thiep/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, guest_name: name, side, attending, num_guests: num, wish }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border p-8 text-center" style={{ borderColor: "var(--wed-accent)" }}>
        <Heart className="mx-auto mb-3" style={{ color: "var(--wed-accent)" }} />
        <p className="font-serif text-xl">Cảm ơn bạn rất nhiều!</p>
        <p className="mt-2 text-sm opacity-70">
          {preview ? "Đây là bản xem trước — trên thiệp thật, phản hồi của khách sẽ được lưu lại cho bạn." : "Lời chúc và xác nhận của bạn đã được gửi đến cô dâu chú rể."}
        </p>
        {preview && <button type="button" onClick={() => setState("idle")} className="mt-3 text-xs underline opacity-70">Thử lại</button>}
      </div>
    );
  }

  // Nền ô nhập luôn trắng nên ép chữ đậm: các mẫu nền tối cho chữ sáng thừa kế
  // xuống sẽ chìm hẳn vào nền ô.
  const inputCls = "w-full rounded-lg border bg-white/90 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:ring-2";

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-3 text-left">
      {note && <p className="mb-2 text-center text-sm italic opacity-70">{note}</p>}
      <input
        className={inputCls}
        style={{ borderColor: "var(--wed-accent)" }}
        placeholder="Tên của bạn *"
        aria-label="Tên của bạn"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        required
      />
      <div className="flex gap-2">
        <select className={inputCls} aria-label="Bạn là khách của" style={{ borderColor: "var(--wed-accent)" }} value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
          <option value="both">Khách chung</option>
          <option value="groom">Khách của chú rể</option>
          <option value="bride">Khách của cô dâu</option>
        </select>
        <select className={inputCls} aria-label="Khả năng tham dự" style={{ borderColor: "var(--wed-accent)" }} value={attending ? "yes" : "no"} onChange={(e) => setAttending(e.target.value === "yes")}>
          <option value="yes">Sẽ tham dự</option>
          <option value="no">Không thể tham dự</option>
        </select>
      </div>
      {attending && (
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--wed-accent)" }}>
          <span className="opacity-70">Số người tham dự</span>
          <input
            type="number"
            min={1}
            max={50}
            className="w-16 rounded border bg-white/90 px-2 py-1 text-center text-stone-800"
            style={{ borderColor: "var(--wed-accent)" }}
            value={num}
            onChange={(e) => setNum(Number(e.target.value))}
          />
        </label>
      )}
      <textarea
        className={inputCls}
        style={{ borderColor: "var(--wed-accent)" }}
        placeholder="Gửi lời chúc đến cô dâu chú rể…"
        aria-label="Lời chúc"
        rows={3}
        value={wish}
        onChange={(e) => setWish(e.target.value)}
        maxLength={1000}
      />
      {state === "error" && <p className="text-center text-sm text-red-600">Gửi không thành công, vui lòng thử lại.</p>}
      <button
        type="submit"
        disabled={state === "saving" || !name.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: "var(--wed-accent)" }}
      >
        <Send size={16} />
        {state === "saving" ? "Đang gửi…" : "Gửi xác nhận & lời chúc"}
      </button>
    </form>
  );
}
