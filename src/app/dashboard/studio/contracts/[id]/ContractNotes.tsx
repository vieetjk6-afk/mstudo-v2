"use client";

import { useMemo, useRef, useState } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { avatarColor, initials } from "@/lib/avatar";
import { useUndoToast } from "@/components/studio/UndoToast";
import { splitMentions, extractMentions } from "@/lib/mentions";
import { fmtWhen } from "@/lib/date";

/**
 * GHI CHÚ NỘI BỘ @NHẮC TÊN (tính năng mới số 13 của bản thiết kế)
 *
 * Luồng trao đổi giữa người trong studio về MỘT hợp đồng — khác hẳn ô "Điều
 * khoản hợp đồng" (văn bản gửi khách) và ô ghi chú một dòng của bản cũ.
 * Khách KHÔNG thấy: trang /c/<token> không đọc bảng này.
 */

export type NoteRow = {
  id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  mentions: string[];
  created_at: string;
};

/** Người có thể được @nhắc: nhân sự trong ê-kíp + tài khoản nhân viên studio. */
export type Mentionable = { id: string; name: string };

export default function ContractNotes({
  contractId,
  initial,
  people,
  me,
}: {
  contractId: string;
  initial: NoteRow[];
  people: Mentionable[];
  me: { id: string; name: string };
}) {
  const supabase = createClient();
  const { run, view } = useUndoToast();
  const [rows, setRows] = useState<NoteRow[]>(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);

  const names = useMemo(() => people.map((p) => p.name).filter(Boolean), [people]);

  /** Chèn "@Tên " vào đúng chỗ con trỏ đang đứng, không phải cuối ô. */
  function mention(name: string) {
    const el = box.current;
    const at = el ? el.selectionStart : body.length;
    const before = body.slice(0, at);
    const sep = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${sep}@${name} ${body.slice(at)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = before.length + sep.length + name.length + 2;
      el?.setSelectionRange(pos, pos);
    });
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("contract_notes")
      .insert({
        contract_id: contractId,
        author_id: me.id,
        author_name: me.name,
        body: text,
        mentions: extractMentions(text, names),
      })
      .select("id, author_id, author_name, body, mentions, created_at")
      .single();
    setBusy(false);
    if (error || !data) {
      setErr(
        error?.message?.includes("contract_notes")
          ? "Chưa có bảng ghi chú — chạy supabase/migrations/contract_notes.sql trong Supabase SQL Editor."
          : "Không gửi được, thử lại nhé."
      );
      return;
    }
    setRows((p) => [...p, data as NoteRow]);
    setBody("");
  }

  function remove(id: string) {
    const idx = rows.findIndex((r) => r.id === id);
    const row = rows[idx];
    if (!row) return;
    setRows((p) => p.filter((r) => r.id !== id));
    run({
      label: "Đã xoá ghi chú",
      commit: async () => { await supabase.from("contract_notes").delete().eq("id", id); },
      undo: () => setRows((p) => { const n = [...p]; n.splice(idx, 0, row); return n; }),
    });
  }

  return (
    <div className="card p-6">
      {view}
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-medium">
        <MessageSquare size={17} style={{ color: "var(--ac)" }} /> Ghi chú nội bộ
      </h2>
      <p className="mb-4 text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
        Trao đổi giữa người trong studio về hợp đồng này. Khách xem link hợp đồng không thấy phần này.
      </p>

      {rows.length === 0 ? (
        <p className="mb-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          Chưa có ghi chú nào — viết dòng đầu tiên bên dưới.
        </p>
      ) : (
        rows.map((n) => (
          <div key={n.id} className="group flex gap-[11px] pb-4">
            <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: avatarColor(n.author_name) }}
            >
              {initials(n.author_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="text-[13px] font-bold">{n.author_name || "Ẩn danh"}</p>
                <p className="text-[11px]" style={{ color: "var(--tx3)" }}>{fmtWhen(n.created_at)}</p>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Xoá ghi chú"
                  className="ml-auto flex-none opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  style={{ color: "var(--tx3)" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <p
                className="mt-1 rounded-[11px] px-[13px] py-2.5 text-[13px] leading-[1.6]"
                style={{ background: "var(--sf2)", color: "var(--tx2)", textWrap: "pretty" }}
              >
                {splitMentions(n.body, names).map((part, i) =>
                  part.mention ? (
                    <span
                      key={i}
                      className="rounded-[5px] px-[5px] py-px font-bold"
                      style={{ background: "var(--acS)", color: "var(--ac)" }}
                    >
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </p>
            </div>
          </div>
        ))
      )}

      {/* Ô soạn — nhắc nhanh bằng chip, khỏi phải gõ đúng chính tả tên. */}
      <div className="rounded-[12px] p-3.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
        <textarea
          ref={box}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder="Viết ghi chú… gõ @ để nhắc tên ai đó"
          className="w-full resize-y border-0 bg-transparent text-[13px] leading-[1.6] outline-none"
          style={{ minHeight: 46, color: "var(--tx)" }}
        />
        <div className="mt-[11px] flex flex-wrap items-center gap-[7px] pt-[11px]" style={{ borderTop: "1px solid var(--bd2)" }}>
          {people.length > 0 && (
            <span className="flex-none text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>Nhắc nhanh:</span>
          )}
          {people.slice(0, 6).map((p) => (
            <button
              key={p.id}
              onClick={() => mention(p.name)}
              className="flex flex-none items-center gap-[5px] rounded-[20px] py-1 pl-1 pr-2.5 text-[11.5px] font-semibold"
              style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                style={{ background: avatarColor(p.name) }}
              >
                {initials(p.name)}
              </span>
              {p.name}
            </button>
          ))}
          <button
            onClick={send}
            disabled={busy || !body.trim()}
            className="ml-auto flex flex-none items-center gap-1.5 rounded-[9px] px-[15px] py-2 text-[12.5px] font-semibold disabled:opacity-40"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Send size={14} /> {busy ? "Đang gửi…" : "Gửi"}
          </button>
        </div>
        {err && <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
      </div>
    </div>
  );
}
