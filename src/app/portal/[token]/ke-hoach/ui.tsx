"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ListChecks, Pencil, Sparkles, Trash2 } from "lucide-react";
import { ProgressBar } from "@/components/studio/ui";
import { newPlanId, type GuestReply, type PlanList, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import type { PlannerPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   Thành phần dùng chung của trang kế hoạch cưới. Cùng bộ token `.client-doc`
   với cổng khách: thẻ viền 1px không bóng, bo 16px, chữ to hơn khu quản lý.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlannerTab = "overview" | "tasks" | "budget" | "guests" | "vendors" | "day" | "style";
export type SaveState = "idle" | "saving" | "saved" | "error";

/** Những gì mọi tab cần — gom một chỗ để tab nào cũng nhận cùng một prop. */
export type Ctx = {
  data: PlannerPayload;
  plan: WeddingPlanData;
  today: string;
  readOnly: boolean;
  onOp: (op: PlanOp) => void;
  /** Phản hồi qua thiệp đã khớp với khách trong danh sách, theo mã khách. */
  replies: Record<string, GuestReply>;
  /** Phản hồi qua thiệp không khớp ai trong danh sách (mỗi tên bản mới nhất). */
  unmatched: { guest_name: string; attending: boolean; num_guests: number }[];
  go: (tab: PlannerTab) => void;
  /** Mở sẵn sơ đồ bàn ở tab Khách mời (dùng cho /uipreview). */
  guestView?: "list" | "tables";
  /** Chế độ Quà cưới: mở trình sửa thiệp (thay cả trang). */
  openInvite?: () => void;
};

export const card: React.CSSProperties = { background: "var(--sf)", border: "1px solid var(--bd)" };

/** Thêm / sửa / xoá một dòng — mã dòng mới tạo sẵn ở đây để bản hiện trước khớp bản lưu. */
export function listOps(onOp: (op: PlanOp) => void) {
  return {
    add: (list: PlanList, item: Record<string, unknown>) => onOp({ op: "add", list, item: { id: newPlanId(), ...item } }),
    set: (list: PlanList, id: string, patch: Record<string, unknown>) => onOp({ op: "set", list, id, patch }),
    remove: (list: PlanList, id: string) => onOp({ op: "remove", list, id }),
  };
}

export function Section({
  title, sub, right, children, className = "",
}: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[16px] px-5 pb-3 pt-4 ${className}`} style={card}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-bold">{title}</h3>
        {right && <div className="ml-auto flex flex-none items-center gap-2">{right}</div>}
      </div>
      {sub && <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{sub}</p>}
      {children}
    </section>
  );
}

const TONES = {
  ac: { bg: "var(--acS)", fg: "var(--ac)" },
  gn: { bg: "var(--gnS)", fg: "var(--gn)" },
  am: { bg: "var(--amS)", fg: "var(--am)" },
  rd: { bg: "var(--rdS)", fg: "var(--rd)" },
  bl: { bg: "var(--blS)", fg: "var(--bl)" },
  nu: { bg: "var(--sf2)", fg: "var(--tx2)" },
} as const;
export type Tone = keyof typeof TONES;

export function Pill({ tone = "nu", children, onClick, title }: { tone?: Tone; children: React.ReactNode; onClick?: () => void; title?: string }) {
  const cls = "inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-[20px] px-2 py-[2px] text-[11px] font-bold";
  const style = { background: TONES[tone].bg, color: TONES[tone].fg };
  if (onClick) return <button type="button" onClick={onClick} title={title} className={cls} style={style}>{children}</button>;
  return <span className={cls} style={style} title={title}>{children}</span>;
}

/** Hàng chip lọc — cuộn ngang trên điện thoại thay vì xuống dòng. */
export function Chips<T extends string>({
  value, options, onChange,
}: { value: T; options: [T, string, number?][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {options.map(([k, label, count]) => {
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className="flex flex-none items-center gap-1 whitespace-nowrap rounded-[20px] px-3 py-1.5 text-[12.5px] font-semibold"
            style={on ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
          >
            {label}
            {count !== undefined && <span className="tnum" style={{ opacity: 0.75 }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Stat({
  icon: Icon, label, value, bar, barColor, hint, hintColor, onClick,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
  bar?: number;
  barColor?: string;
  hint?: string;
  hintColor?: string;
  onClick?: () => void;
}) {
  // flex-col + justify-start: <button> tự canh giữa nội dung theo chiều dọc, ô
  // dạng nút sẽ lệch hàng so với ô bên cạnh.
  return (
    <button onClick={onClick} className="flex min-w-0 flex-col justify-start rounded-[14px] px-3 py-3 text-left min-[600px]:px-4 min-[600px]:py-3.5" style={card}>
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
        <Icon size={14} className="flex-none max-[420px]:hidden" /> <span className="truncate">{label}</span>
      </span>
      <span className="tnum mt-1 block whitespace-nowrap text-[19px] font-bold min-[600px]:text-[22px]" style={{ letterSpacing: "-.7px" }}>{value}</span>
      {bar !== undefined && <ProgressBar pct={bar} color={barColor} height={5} className="mt-1.5" />}
      {hint && <span className="mt-1.5 text-[11.5px] font-semibold leading-snug" style={{ color: hintColor ?? "var(--tx3)" }}>{hint}</span>}
    </button>
  );
}

export function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Đang lưu…", color: "var(--tx3)" },
    saved: { text: "Đã lưu", color: "var(--gn)" },
    error: { text: "Chưa lưu được", color: "var(--rd)" },
  } as const;
  const m = map[state];
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1 text-[12px] font-bold" style={{ color: m.color }}>
      {state === "saved" && <Check size={14} />} {m.text}
    </span>
  );
}

/** Ô trống của một danh sách — kèm nút "Dùng mẫu" khi có bộ mẫu. */
export function Empty({ title, sub, action }: { title: string; sub?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[13.5px] font-semibold">{title}</p>
      {sub && <p className="mx-auto mt-1 max-w-[440px] text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{sub}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
          <Sparkles size={15} /> {action.label}
        </button>
      )}
    </div>
  );
}

/** Khung form thêm dòng ở cuối mỗi danh sách. */
export function AddForm({ onSubmit, children }: { onSubmit: () => void; children: React.ReactNode }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-wrap gap-2 rounded-[16px] px-4 py-3.5"
      style={card}
    >
      {children}
    </form>
  );
}

export function PrimaryBtn({ children, disabled, type = "submit", onClick }: { children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="flex flex-none items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--ac)", color: "#fff" }}>
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-none items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
      {children}
    </button>
  );
}

/** Ô nhập có nhãn nhỏ phía trên — dùng trong form sửa một dòng. */
export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>{label}</span>
      {children}
    </label>
  );
}

/** Ô chọn với tuỳ chọn "—" = bỏ trống. */
export function Select<T extends string>({
  value, options, onChange, empty, className = "", ariaLabel,
}: { value: T | ""; options: Record<T, string> | [T, string][]; onChange: (v: T | "") => void; empty?: string; className?: string; ariaLabel?: string }) {
  const list = Array.isArray(options) ? options : (Object.entries(options) as [T, string][]);
  return (
    <select className={`input w-auto px-3 py-2.5 ${className}`} value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T | "")}>
      {empty !== undefined && <option value="">{empty}</option>}
      {list.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
    </select>
  );
}

/** Hai nút của một dòng: sửa + xoá. */
export function RowActions({ label, onEdit, onRemove }: { label: string; onEdit?: () => void; onRemove: () => void }) {
  return (
    <span className="flex flex-none items-center gap-0.5">
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Sửa: ${label}`} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ color: "var(--tx3)" }}>
          <Pencil size={15} />
        </button>
      )}
      <ConfirmDelete label={`Xoá: ${label}`} onConfirm={onRemove} />
    </span>
  );
}

/**
 * Ô chữ lưu khi RỜI ô (hoặc Enter), không lưu từng phím: mỗi phím một lượt ghi
 * lên máy chủ thì gõ một cái tên là hai chục lượt ghi.
 */
export function CommitInput({
  value, onCommit, className, readOnly, maxLength, ariaLabel, placeholder, multiline = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  readOnly?: boolean;
  maxLength?: number;
  ariaLabel?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft);
  };
  if (multiline) {
    return (
      <textarea
        className={className}
        value={draft}
        readOnly={readOnly}
        maxLength={maxLength}
        aria-label={ariaLabel}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      className={className}
      value={draft}
      readOnly={readOnly}
      maxLength={maxLength}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/**
 * Ô tiền có dấu chấm hàng nghìn (1.500.000). `live` = báo lên từng phím (ô của
 * form, chưa lưu gì); không thì lưu khi rời ô như CommitInput.
 */
export function MoneyField({
  value, onCommit, className, readOnly, placeholder, ariaLabel, live = false,
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  live?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`tnum ${className ?? ""}`}
      value={draft > 0 ? draft.toLocaleString("vi-VN") : ""}
      placeholder={placeholder ?? "0"}
      readOnly={readOnly}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, "")) || 0;
        setDraft(n);
        if (live) onCommit(n);
      }}
      onBlur={() => { if (!live && draft !== value) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !live) (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/** Nút xoá hai chạm: chạm lần đầu đổi thành "Xoá?", chạm lần nữa mới xoá. */
export function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      aria-label={armed ? `Chạm lần nữa để xoá — ${label}` : label}
      onClick={() => {
        if (armed) {
          if (timer.current) clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
      }}
      className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[8px] px-1.5 text-[12px] font-bold"
      style={armed ? { background: "var(--rdS)", color: "var(--rd)" } : { color: "var(--tx3)" }}
    >
      {armed ? "Xoá?" : <Trash2 size={15} />}
    </button>
  );
}

/** Ô tròn đánh dấu xong (việc, đồ đã xếp). */
export function CheckCircle({ on, onClick, label, disabled, title }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
      style={on ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" } : { background: "var(--sf)", border: "1.5px solid var(--bd)" }}
    >
      {on && <Check size={14} strokeWidth={3} />}
    </button>
  );
}

/** Vạch kẻ giữa các dòng của một danh sách (dòng đầu không có vạch trên). */
export const rowLine = (i: number): React.CSSProperties | undefined => (i ? { borderTop: "1px solid var(--bd2)" } : undefined);
