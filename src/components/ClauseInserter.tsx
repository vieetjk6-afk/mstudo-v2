"use client";

import { useState } from "react";
import { FilePlus } from "lucide-react";
import { CONTRACT_CLAUSES, fullClauseText } from "@/lib/contract-clauses";

/** Append-only clause picker for a terms textarea. onInsert receives the text to add. */
export default function ClauseInserter({ onInsert }: { onInsert: (text: string) => void }) {
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
