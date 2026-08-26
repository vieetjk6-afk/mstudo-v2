"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Khối gập được của khu quản trị (Cấu hình mstudo, Người dùng & studio).
 *
 * Tách ra khỏi SettingsPanel khi hai mục "Yêu cầu nâng cấp" và "Mã giảm giá"
 * dọn sang tab Người dùng & studio — hai màn cùng dùng một khối thì đừng để mỗi
 * bên tự khai một bản rồi lệch nhau.
 */
export function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-5 text-left"
        style={{ borderBottom: open ? "1px solid var(--border)" : "none" }}
      >
        <Icon size={16} style={{ color: "var(--brand, var(--gold))" }} />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {open ? <ChevronDown size={16} style={{ color: "var(--text3)" }} /> : <ChevronRight size={16} style={{ color: "var(--text3)" }} />}
      </button>
      {open && <div className="space-y-4 p-5">{children}</div>}
    </div>
  );
}

/** Nhãn + ô nhập + ghi chú nhỏ bên dưới. */
export function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {note && <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>{note}</p>}
    </div>
  );
}
