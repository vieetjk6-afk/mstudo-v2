"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookImage, ChevronRight, CornerDownLeft, FileText, ReceiptText, Sparkles, X } from "lucide-react";
import { COMMAND_EXAMPLES, parseCommand, type Entity } from "@/lib/pet-command";

/* ═══════════════════════════════════════════════════════════════════════════
   Ô RA LỆNH TRÊN ĐẦU BÉ MÁY ẢNH (nằm trong components/PetBuddy).

   Thu gọn: một ô nhỏ "Ra lệnh cho bé…" ngay trên đầu bé. Bấm vào → mở ô gõ,
   kèm vài lệnh mẫu bấm được. Gõ xong Enter:
     • "tạo hợp đồng / báo giá / album", "lịch", "thu chi"… → mở đúng màn;
     • "mở hợp đồng chị Lan", "mở album Minh Thư", gõ thẳng tên → tìm qua
       /api/pet/find: một kết quả thì mở luôn, nhiều thì bày danh sách chọn;
     • "cho ăn" → cho bé ăn.
   Luật hiểu câu: @/lib/pet-command (có kiểm thử).
   ═══════════════════════════════════════════════════════════════════════════ */

type Found = { type: Entity; id: string; title: string; sub: string; href: string };

const ICON: Record<Entity, typeof FileText> = { contract: FileText, quote: ReceiptText, album: BookImage };
const TYPE_LABEL: Record<Entity, string> = { contract: "Hợp đồng", quote: "Báo giá", album: "Album" };

export default function PetCommand({
  open,
  setOpen,
  onFeed,
  name,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onFeed: () => void;
  name: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
    else {
      setReply(null);
      setFound([]);
    }
  }, [open]);

  const close = () => {
    setOpen(false);
    setText("");
  };

  const run = async (raw: string) => {
    const cmd = parseCommand(raw);
    setFound([]);
    if (cmd.kind === "feed") {
      close();
      onFeed();
      return;
    }
    if (cmd.kind === "go") {
      close();
      router.push(cmd.href);
      return;
    }
    if (cmd.kind === "unknown") {
      setReply("Mình chưa hiểu lắm… thử “tạo hợp đồng”, “mở album Minh Thư” hay “mở báo giá chị Lan” nha.");
      return;
    }
    setBusy(true);
    setReply(`Đang tìm “${cmd.query}”…`);
    const r = await fetch(`/api/pet/find?type=${cmd.entity}&q=${encodeURIComponent(cmd.query)}`, { cache: "no-store" }).catch(() => null);
    const j = r?.ok ? ((await r.json().catch(() => null)) as { results?: Found[] } | null) : null;
    setBusy(false);
    const res = j?.results ?? [];
    if (!r?.ok) {
      setReply("Ơ, mình tìm bị lỗi rồi — thử lại sau nhé.");
    } else if (res.length === 0) {
      const where = cmd.entity === "all" ? "hợp đồng, báo giá hay album nào" : `${cmd.label.toLowerCase()} nào`;
      setReply(`Không thấy ${where} khớp “${cmd.query}”. Gõ tên khác hoặc mã số thử xem.`);
    } else if (res.length === 1) {
      close();
      router.push(res[0].href);
    } else {
      setReply(`Có ${res.length} kết quả, bạn chọn nha:`);
      setFound(res);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pc-pill flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[12px] font-semibold shadow-md"
        style={{ background: "var(--sf)", color: "var(--tx3)", border: "1px solid var(--bd)" }}
        aria-label={`Ra lệnh cho ${name}`}
      >
        <Sparkles size={13} style={{ color: "var(--ac)" }} /> Ra lệnh cho bé…
      </button>
    );
  }

  return (
    <div
      className="pc-box w-[min(320px,calc(100vw-24px))] rounded-[16px] p-2.5 shadow-xl"
      style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx)" }}
    >
      {(reply || found.length > 0) && (
        <div className="mb-2 px-1">
          {reply && <p className="text-[12.5px] leading-snug" style={{ color: "var(--tx2)" }}>{reply}</p>}
          {found.length > 0 && (
            <div className="mt-1.5 flex max-h-[260px] flex-col overflow-y-auto">
              {found.map((f) => {
                const Icon = ICON[f.type];
                return (
                  <Link
                    key={`${f.type}:${f.id}`}
                    href={f.href}
                    onClick={close}
                    className="pc-row flex items-center gap-2.5 rounded-[9px] px-1.5 py-1.5"
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{f.title}</span>
                      <span className="block truncate text-[11px]" style={{ color: "var(--tx3)" }}>
                        {TYPE_LABEL[f.type]}{f.sub ? ` · ${f.sub}` : ""}
                      </span>
                    </span>
                    <ChevronRight size={14} className="flex-none" style={{ color: "var(--tx3)" }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !busy) void run(text);
        }}
        className="flex items-center gap-1.5 rounded-[11px] px-2.5"
        style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}
      >
        <Sparkles size={14} className="flex-none" style={{ color: "var(--ac)" }} />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          placeholder="VD: mở hợp đồng chị Lan"
          maxLength={120}
          className="min-w-0 flex-1 bg-transparent py-2 text-[13px] outline-none"
          // Ô ngoài đã có viền — tắt vòng focus chung của app cho khỏi hai lớp viền.
          style={{ color: "var(--tx)", outline: "none", boxShadow: "none", border: 0 }}
          aria-label={`Ra lệnh cho ${name}`}
          enterKeyHint="go"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-[7px] p-1 disabled:opacity-40" style={{ color: "var(--ac)" }} aria-label="Gửi lệnh">
          <CornerDownLeft size={15} />
        </button>
        <button type="button" onClick={close} className="rounded-[7px] p-1" style={{ color: "var(--tx3)" }} aria-label="Đóng">
          <X size={15} />
        </button>
      </form>

      {!reply && !text && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMMAND_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                // Lệnh cần tên → điền sẵn để gõ tiếp; lệnh trọn vẹn → chạy luôn.
                if (/chị Lan|Minh Thư/.test(ex)) {
                  const stem = ex.replace(/ (chị Lan|Minh Thư)$/, " ");
                  setText(stem);
                  input.current?.focus();
                } else void run(ex);
              }}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: "var(--acS)", color: "var(--ac)" }}
            >
              {ex.replace(/ (chị Lan|Minh Thư)$/, " …")}
            </button>
          ))}
        </div>
      )}
      <style>{`
        .pc-row:hover { background: var(--sf2); }
        .pc-box { animation: pb-in .18s ease-out; }
      `}</style>
    </div>
  );
}
