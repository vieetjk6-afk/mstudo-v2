"use client";

import { useState } from "react";
import { ChevronDown, FilePlus, Plus } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { btn } from "@/components/v2/kit";
import { CONTRACT_CLAUSES, fullClauseText } from "@/lib/contract-clauses";

type Props = { onInsert: (text: string) => void };

/** Append-only clause picker for a terms textarea. onInsert receives the text to add. */
export default function ClauseInserter(props: Props) {
  return useUiV2() ? <ClauseInserterV2 {...props} /> : <ClauseInserterV1 {...props} />;
}

function ClauseInserterV1({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
        <FilePlus size={13} /> Chèn điều khoản mẫu
      </button>
      {open && (
        <div className="mt-2 rounded-xl p-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {CONTRACT_CLAUSES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onInsert(c.text)}
                className="rounded-full px-2.5 py-1 text-xs"
                style={{ border: "1px solid var(--border2)", color: "var(--text2)" }}
                title="Chèn điều khoản này"
              >
                + {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onInsert(fullClauseText())} className="text-xs text-accent hover:underline">
            Chèn trọn bộ điều khoản
          </button>
        </div>
      )}
    </div>
  );
}

/** Giao diện mới: nút phụ mở một khay chip điều khoản, chèn trọn bộ bằng nút "soft". */
function ClauseInserterV2({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn("secondary", "sm")} aria-expanded={open}>
        <FilePlus size={14} /> Chèn điều khoản mẫu
        <ChevronDown size={14} className="transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined, color: "var(--tx3)" }} />
      </button>
      {open && (
        <div className="mt-2.5 rounded-[12px] p-3" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
          <p className="mb-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>Bấm để nối điều khoản vào cuối ô bên trên.</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_CLAUSES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onInsert(c.text)}
                className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-medium transition-colors hover:bg-[var(--sf)]"
                style={{ border: "1px solid var(--bd)", color: "var(--tx2)" }}
                title="Chèn điều khoản này"
              >
                <Plus size={13} /> {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onInsert(fullClauseText())} className={btn("soft", "sm", "mt-3")}>
            Chèn trọn bộ điều khoản
          </button>
        </div>
      )}
    </div>
  );
}
