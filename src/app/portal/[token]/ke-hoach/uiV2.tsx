"use client";

import { useId, useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Progress, btn, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { Drawer, Menu, Modal, type MenuItem } from "@/components/v2/kit-client";

/* ═══════════════════════════════════════════════════════════════════════════
   Thành phần dùng chung của kế hoạch cưới — GIAO DIỆN MỚI. Dựng trên bộ khối
   V2 (@/components/v2/kit); bản cũ vẫn dùng ./ui.tsx. Ô tiền / ô lưu-khi-rời
   (MoneyField, CommitInput) và `listOps` dùng lại nguyên từ ./ui.tsx.

   Luật của các tab V2: mỗi tab MỘT nút chính (thêm dòng); sửa một dòng mở
   ngăn kéo; xoá luôn hỏi lại bằng hộp thoại; thao tác phụ dồn vào menu ⋯.
   ═══════════════════════════════════════════════════════════════════════════ */

const MONTH = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"];

/** Ô số liệu bấm được (sang tab tương ứng) — có thanh tiến độ và dòng gợi ý. */
export function StatTile({
  icon: Icon, label, value, bar, barTone = "brand", hint, hintTone, valueTone, onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  bar?: number;
  barTone?: Tone;
  hint?: string;
  hintTone?: Tone;
  valueTone?: Tone;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="v2-stat-label truncate">{label}</p>
        <span className="v2-stat-icon" style={{ color: "var(--ac)", background: "var(--acS)" }}>
          <Icon size={16} />
        </span>
      </div>
      <p className="v2-stat-value whitespace-nowrap" style={valueTone ? { color: toneFg(valueTone) } : undefined}>{value}</p>
      {bar !== undefined && <Progress value={bar} tone={barTone} />}
      {hint && <p className="v2-stat-sub leading-snug" style={hintTone ? { color: toneFg(hintTone), fontWeight: 600 } : undefined}>{hint}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="v2-card v2-stat v2-card-link min-w-0 text-left">{inner}</button>
  ) : (
    <div className="v2-card v2-stat min-w-0">{inner}</div>
  );
}

/** Nhãn bấm được (đổi trạng thái tại chỗ: đã chốt, bắt buộc, xác nhận…). */
export function BadgeBtn({
  tone = "gray", children, onClick, title,
}: { tone?: Tone; children: React.ReactNode; onClick?: () => void; title?: string }) {
  const style = { background: toneBg(tone), color: toneFg(tone) };
  if (!onClick) return <span className="v2-badge" style={style} title={title}>{children}</span>;
  return (
    <button type="button" onClick={onClick} title={title} className="v2-badge" style={{ ...style, cursor: "pointer", boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${toneFg(tone)} 25%, transparent)` }}>
      {children}
    </button>
  );
}

/** Ô tròn đánh dấu xong (việc, đồ đã xếp) — vùng bấm 36px. */
export function CheckV2({ on, onClick, label, disabled, title }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="-m-1.5 flex h-9 w-9 flex-none items-center justify-center rounded-full disabled:cursor-default"
    >
      <span
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors"
        style={on ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" } : { background: "var(--sf)", border: "1.5px solid var(--bdS)" }}
      >
        {on && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Ô ngày nhỏ: ngày to + tháng (danh sách "Sắp tới", thanh toán). */
export function DateChip({ date, tone = "gray" }: { date: string; tone?: Tone }) {
  const d = new Date(date + "T00:00:00");
  const hot = tone !== "gray";
  return (
    <span className="flex w-[46px] flex-none flex-col items-center rounded-[11px] py-1" style={{ background: hot ? toneBg(tone) : "var(--sf2)" }}>
      <span className="tnum text-[17px] font-bold leading-tight" style={{ color: hot ? toneFg(tone) : "var(--tx)" }}>{String(d.getDate()).padStart(2, "0")}</span>
      <span className="text-[10.5px] font-semibold" style={{ color: "var(--tx3)" }}>{MONTH[d.getMonth()]}</span>
    </span>
  );
}

/** Menu ⋯ của một dòng: Sửa · (thao tác thêm) · Xoá — xoá hỏi lại bằng hộp thoại. */
export function RowMenu({
  label, onEdit, onRemove, extra = [],
}: { label: string; onEdit?: () => void; onRemove?: () => void; extra?: MenuItem[] }) {
  const [ask, setAsk] = useState(false);
  const items: MenuItem[] = [
    ...(onEdit ? [{ label: "Sửa", icon: Pencil, onClick: onEdit }] : []),
    ...extra,
    ...(onRemove ? (["divider", { label: "Xoá", icon: Trash2, danger: true, onClick: () => setAsk(true) }] as MenuItem[]) : []),
  ];
  return (
    <>
      <Menu items={items} label={`Thao tác: ${label}`} width={220} />
      {onRemove && <ConfirmRemove open={ask} label={label} onClose={() => setAsk(false)} onConfirm={() => { setAsk(false); onRemove(); }} />}
    </>
  );
}

export function ConfirmRemove({ open, label, onClose, onConfirm }: { open: boolean; label: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xoá dòng này?"
      desc={<>“<b style={{ color: "var(--tx)" }}>{label}</b>” sẽ bị xoá khỏi kế hoạch.</>}
      icon={Trash2}
      width={420}
      footer={
        <>
          <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
          <button type="button" onClick={onConfirm} className={btn("danger")}><Trash2 size={16} /> Xoá</button>
        </>
      }
    />
  );
}

/**
 * Ngăn kéo chứa form thêm / sửa một dòng. Nút Lưu ở chân ngăn kéo gắn với form
 * qua thuộc tính `form` (chân nằm ngoài <form>). `onRemove` thêm nút Xoá bên trái.
 */
export function FormDrawer({
  open, onClose, title, desc, onSubmit, submitLabel = "Lưu", canSubmit = true, onRemove, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  canSubmit?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const [ask, setAsk] = useState(false);
  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={title}
        desc={desc}
        width={500}
        footer={
          <>
            {onRemove && (
              <button type="button" onClick={() => setAsk(true)} className={btn("danger", "md", "mr-auto")}>
                <Trash2 size={16} /> Xoá
              </button>
            )}
            <button type="button" onClick={onClose} className={btn("ghost")}>Huỷ</button>
            <button type="submit" form={id} disabled={!canSubmit} className={btn("primary")}>{submitLabel}</button>
          </>
        }
      >
        <form
          id={id}
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit();
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {children}
        </form>
      </Drawer>
      {onRemove && <ConfirmRemove open={ask} label={title} onClose={() => setAsk(false)} onConfirm={() => { setAsk(false); onRemove(); onClose(); }} />}
    </>
  );
}

/** Ô chọn V2 với tuỳ chọn "—" = bỏ trống. */
export function SelectV2<T extends string>({
  value, options, onChange, empty, className = "", ariaLabel, id,
}: { value: T | ""; options: Record<T, string> | [T, string][]; onChange: (v: T | "") => void; empty?: string; className?: string; ariaLabel?: string; id?: string }) {
  const list = Array.isArray(options) ? options : (Object.entries(options) as [T, string][]);
  return (
    <select id={id} className={`v2-input ${className}`} value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T | "")}>
      {empty !== undefined && <option value="">{empty}</option>}
      {list.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
    </select>
  );
}

/** Ô thêm nhanh MỘT trường ở cuối danh sách (link, ảnh cần chụp, đồ cần mang). */
export function InlineAdd({ onSubmit, children, disabled }: { onSubmit: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
      className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5"
      style={{ borderTop: "1px solid var(--bd2)" }}
    >
      {children}
      <button type="submit" disabled={disabled} className={btn("secondary", "md", "flex-none")}>
        <Plus size={16} /> Thêm
      </button>
    </form>
  );
}

/** Một dòng bấm được trong danh sách lối tắt / sắp tới. */
export function NavRow({
  leading, title, sub, subTone, onClick,
}: { leading: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; subTone?: Tone; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="v2-row v2-row-link w-full text-left">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{title}</span>
        {sub && <span className="mt-0.5 block text-[12.5px]" style={{ color: subTone ? toneFg(subTone) : "var(--tx3)" }}>{sub}</span>}
      </span>
      <ChevronRight size={16} style={{ flex: "none", color: "var(--tx3)" }} />
    </button>
  );
}

/** Ô vuông icon đầu dòng. */
export function IconBox({ icon: Icon, tone = "brand" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: toneBg(tone), color: toneFg(tone) }}>
      <Icon size={17} />
    </span>
  );
}
