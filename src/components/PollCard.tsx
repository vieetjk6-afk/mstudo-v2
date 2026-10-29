"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Vote, X } from "lucide-react";

type Poll = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  active: boolean;
  counts: number[];
  voters: number;
  mine: number[] | null;
};

/** "Để sau" ẩn thẻ tới hôm sau; "Đóng" sau khi đã bỏ phiếu thì ẩn hẳn bình chọn đó. */
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const keySnooze = (id: string) => `mstudo-poll-snooze:${id}`;
const keyDone = (id: string) => `mstudo-poll-done:${id}`;

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* trình duyệt chặn lưu — thẻ chỉ hiện lại ở lần tải sau, không sao */
  }
}

/**
 * Thẻ BÌNH CHỌN HỆ THỐNG — nằm trong cột thẻ nổi góc dưới phải cùng thông báo
 * hệ thống (xem AnnouncementPopup). Hiện bình chọn đang mở mới nhất dành cho tài
 * khoản này (admin tạo ở Cài đặt hệ thống → Bình chọn):
 *   • chưa bỏ phiếu → chọn phương án, bấm "Bình chọn"; "Để sau" ẩn tới hôm sau;
 *   • đã bỏ phiếu   → xem kết quả, "Đổi lựa chọn" hoặc "Đóng" (ẩn hẳn).
 * Phiếu đi qua /api/polls — trình duyệt không đọc thẳng bảng, nên không ai thấy
 * người khác chọn gì, chỉ thấy tổng số phiếu.
 */
export default function PollCard() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/polls", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const j = (await res.json().catch(() => ({}))) as { poll?: Poll | null };
    const p = j.poll ?? null;
    setPoll(p);
    if (!p) return;
    const snoozed = Number(readLocal(keySnooze(p.id)) || 0);
    const done = readLocal(keyDone(p.id)) === "1";
    setHidden(done || (!p.mine && Date.now() - snoozed < SNOOZE_MS));
    setPicked(p.mine ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!poll || hidden) return null;

  const voted = !!poll.mine && !editing;
  const total = poll.counts.reduce((s, n) => s + n, 0);

  function toggle(i: number) {
    if (!poll) return;
    setErr(null);
    setPicked((cur) => (poll.multi ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i]));
  }

  async function vote() {
    if (!poll || busy || picked.length === 0) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId: poll.id, choices: picked }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const code = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
      setErr(code === "closed" ? "Bình chọn này đã đóng." : res ? "Chưa gửi được phiếu, thử lại nhé." : "Mất kết nối, thử lại nhé.");
      return;
    }
    const j = (await res.json()) as { poll: Poll };
    setPoll(j.poll);
    setEditing(false);
  }

  function snooze() {
    if (!poll) return;
    writeLocal(keySnooze(poll.id), String(Date.now()));
    setHidden(true);
  }
  function close() {
    if (!poll) return;
    writeLocal(keyDone(poll.id), "1");
    setHidden(true);
  }

  return (
    <div
      className="rounded-xl p-4 shadow-lg animate-[vkFade_.3s_ease_both]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      role="region"
      aria-label="Bình chọn"
    >
      <div className="flex items-start gap-2.5">
        <Vote size={17} style={{ color: "var(--accent)", flex: "none" }} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
            {poll.question}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text3)" }}>
            {voted
              ? `Bạn đã bình chọn · ${poll.voters} người đã tham gia`
              : poll.multi
                ? "Chọn nhiều phương án"
                : "Chọn một phương án"}
          </p>
        </div>
        <button
          type="button"
          onClick={voted ? close : snooze}
          className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--surface2)]"
          aria-label={voted ? "Đóng" : "Để sau"}
          title={voted ? "Đóng" : "Để sau"}
          style={{ color: "var(--text3)" }}
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {poll.options.map((label, i) => {
          const on = picked.includes(i);
          const n = poll.counts[i] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return voted ? (
            <div
              key={i}
              className="relative overflow-hidden rounded-lg px-3 py-2"
              style={{ background: "var(--surface2)" }}
            >
              <span
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: "color-mix(in srgb, var(--accent) 18%, transparent)" }}
              />
              <span className="relative flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
                {on ? <Check size={14} style={{ color: "var(--accent)", flex: "none" }} /> : null}
                <span className="min-w-0 flex-1">{label}</span>
                <span className="flex-none tabular-nums font-semibold">{n}</span>
              </span>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              aria-pressed={on}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
              style={{
                background: on ? "color-mix(in srgb, var(--accent) 14%, var(--surface2))" : "var(--surface2)",
                border: `1px solid ${on ? "var(--accent)" : "transparent"}`,
                color: "var(--text)",
              }}
            >
              <span
                className="flex h-4 w-4 flex-none items-center justify-center"
                style={{
                  borderRadius: poll.multi ? 4 : 999,
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--text3)"}`,
                  background: on ? "var(--accent)" : "transparent",
                  color: "var(--accentInk)",
                }}
              >
                {on ? <Check size={11} strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">{label}</span>
              <span className="flex-none tabular-nums" style={{ color: "var(--text3)" }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {err ? (
        <p role="alert" className="mt-2 text-[12.5px] font-medium" style={{ color: "var(--danger)" }}>
          {err}
        </p>
      ) : null}

      {voted ? (
        <div className="mt-3 flex gap-2">
          {poll.active ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost flex-1 justify-center text-[13px]">
              Đổi lựa chọn
            </button>
          ) : null}
          <button type="button" onClick={close} className="btn-primary flex-1 justify-center text-[13px]">
            Đóng
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={vote}
          disabled={busy || picked.length === 0}
          className="btn-primary mt-3 w-full justify-center disabled:opacity-50"
        >
          {busy ? "Đang gửi…" : "Bình chọn"}
        </button>
      )}
    </div>
  );
}
